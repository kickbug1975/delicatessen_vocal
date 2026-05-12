import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ============================================================================
//  SYNC_PRICES.TS — Synchronisation tarifaire PDF → Supabase
//  Usage: npx tsx sync_prices.ts
//
//  1. Place le nouveau PDF dans asset/Liste des prix.pdf
//  2. Lance ce script
//  3. Les produits sont ajoutés/mis à jour/désactivés automatiquement
// ============================================================================

// --- Load .env ---
const envContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf-8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex === -1) continue;
  const key = trimmed.substring(0, eqIndex);
  const value = trimmed.substring(eqIndex + 1).replace(/^["']|["']$/g, '');
  process.env[key] = value;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
//  COEFFICIENTS DE PRIX (fixes, vérifiés sur les données existantes)
// ============================================================================
const PRICE_COEFFICIENTS = {
  price_06: 1.20,  // Poissonnerie
  price_08: 1.24,  // Traiteur
  price_09: 1.30,  // Horeca
  price_10: 1.40,  // Comptant
};

// ============================================================================
//  TRADUCTION DES CATÉGORIES NL → FR
// ============================================================================
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  'ZALM EN RIVIERVIS': 'Saumon et poissons de rivière',
  'TONIJN EN ZWAARDVIS': 'Thon et espadon',
  'RONDE VISSEN': 'Poissons ronds',
  'BRUTO IMPORT': 'Import brut',
  'HAZEN': 'Dos de poisson',
  'STAARTEN': 'Queues et mélanges',
  'FILETS': 'Filets',
  'INKTVIS VERS': 'Calamars et seiches frais',
  'ST JACOBS': 'Coquilles Saint-Jacques',
};

// All known category keys (used for detection in text)
const CATEGORY_KEYS = Object.keys(CATEGORY_TRANSLATIONS);

// ============================================================================
//  TYPES
// ============================================================================
interface ParsedProduct {
  reference_code: string;
  name: string;
  base_price: number;
  category: string;
}

// ============================================================================
//  PDF PARSING
// ============================================================================

async function extractPDFText(pdfPath: string): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await (pdfjsLib as any).getDocument({ data }).promise;

  let fullText = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    fullText += ' ' + pageText;
  }
  return fullText;
}

function parseProducts(text: string): ParsedProduct[] {
  const products: ParsedProduct[] = [];
  let currentCategory = 'Non catégorisé';

  // Remove the repeated header from each page
  const headerPattern = /Prix valables à partir de \d{2}\/\d{2}\/\d{4}\s+01\s+Cher Client,.*?suivent notre stock\.\s*/g;
  let cleanedText = text.replace(headerPattern, ' ');

  // Remove footer (livraison info)
  const footerPattern = /Les livraisons:.*$/;
  cleanedText = cleanedText.replace(footerPattern, '');

  // Normalize whitespace
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

  // Split by category headers
  // Strategy: scan through text, detect categories and products
  
  // First, identify positions of all categories in the text
  const categoryPositions: { name: string; index: number }[] = [];
  for (const catKey of CATEGORY_KEYS) {
    let searchFrom = 0;
    while (true) {
      const idx = cleanedText.indexOf(catKey, searchFrom);
      if (idx === -1) break;
      // Verify it's a standalone category (not part of a product name)
      const charBefore = idx > 0 ? cleanedText[idx - 1] : ' ';
      const charAfter = cleanedText[idx + catKey.length] || ' ';
      if (/\s/.test(charBefore) && /\s/.test(charAfter)) {
        categoryPositions.push({ name: catKey, index: idx });
      }
      searchFrom = idx + catKey.length;
    }
  }

  // Sort by position in text
  categoryPositions.sort((a, b) => a.index - b.index);

  // Create segments: text between categories
  const segments: { category: string; text: string }[] = [];

  // Text before first category (if any)
  if (categoryPositions.length > 0 && categoryPositions[0].index > 0) {
    segments.push({
      category: 'Non catégorisé',
      text: cleanedText.substring(0, categoryPositions[0].index),
    });
  }

  for (let i = 0; i < categoryPositions.length; i++) {
    const start = categoryPositions[i].index + categoryPositions[i].name.length;
    const end = i + 1 < categoryPositions.length ? categoryPositions[i + 1].index : cleanedText.length;
    segments.push({
      category: CATEGORY_TRANSLATIONS[categoryPositions[i].name] || categoryPositions[i].name,
      text: cleanedText.substring(start, end),
    });
  }

  // If no categories found, use full text
  if (segments.length === 0) {
    segments.push({ category: 'Non catégorisé', text: cleanedText });
  }

  // Parse products from each segment
  // Product pattern: REFERENCE   KG/UNIT/ST PRODUCT_NAME   PRICE
  // Reference: starts with a digit, contains digits and optional letters
  // Price: digits with comma (European), at the end before next reference or end
  const productRegex = /\b(\d[\w]*)\s+(KG|UNIT|ST)\s+(.*?)\s+(\d+,\d{2})\b/g;

  for (const segment of segments) {
    let match;
    const segText = segment.text;

    // Reset regex
    productRegex.lastIndex = 0;

    while ((match = productRegex.exec(segText)) !== null) {
      const refCode = match[1];
      const unit = match[2]; // KG, UNIT, ST
      const rawName = match[3].trim();
      const priceStr = match[4];

      // Clean up the product name
      let name = rawName
        .replace(/\s+/g, ' ')          // normalize spaces
        .replace(/\s*\(\s*/g, ' (')     // fix parentheses spacing
        .replace(/\s*\)\s*/g, ') ')
        .replace(/''\s*''/g, '"')       // normalize double quotes
        .replace(/''/g, '"')
        .trim();

      // Remove trailing parenthesis artifacts
      name = name.replace(/\)\s*$/, ')').trim();

      // Parse European price (comma → dot)
      const basePrice = parseFloat(priceStr.replace(',', '.'));

      if (isNaN(basePrice) || basePrice <= 0) continue;

      products.push({
        reference_code: refCode,
        name,
        base_price: basePrice,
        category: segment.category,
      });
    }
  }

  return products;
}

// ============================================================================
//  SYNC WITH SUPABASE
// ============================================================================

async function syncProducts(products: ParsedProduct[]) {
  console.log(`\n🔄 Synchronisation de ${products.length} produits avec Supabase...\n`);

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let errors = 0;

  // Track all reference codes from the PDF
  const pdfRefCodes = new Set(products.map(p => p.reference_code));

  for (const product of products) {
    const {
      reference_code,
      name,
      base_price,
      category,
    } = product;

    // Calculate prices per group
    const price_06 = Math.round(base_price * PRICE_COEFFICIENTS.price_06 * 100) / 100;
    const price_08 = Math.round(base_price * PRICE_COEFFICIENTS.price_08 * 100) / 100;
    const price_09 = Math.round(base_price * PRICE_COEFFICIENTS.price_09 * 100) / 100;
    const price_10 = Math.round(base_price * PRICE_COEFFICIENTS.price_10 * 100) / 100;

    const payload = {
      reference_code,
      name,
      category,
      base_price,
      price_06,
      price_08,
      price_09,
      price_10,
      is_active: true,
      stock_quantity: 100, // Default stock
    };

    // Check if product exists
    const { data: existing } = await supabase
      .from('products')
      .select('id, base_price, name, category')
      .eq('reference_code', reference_code)
      .limit(1);

    if (existing && existing.length > 0) {
      // Check if anything changed (price, name, or category)
      const old = existing[0];
      const priceMatch = parseFloat(String(old.base_price)) === base_price;
      const nameMatch = old.name === name;
      const categoryMatch = old.category === category;

      if (priceMatch && nameMatch && categoryMatch) {
        // Just ensure is_active = true
        await supabase
          .from('products')
          .update({ is_active: true })
          .eq('id', old.id);
        unchanged++;
      } else {
        // Update with new data
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', old.id);

        if (error) {
          console.error(`  ❌ Erreur update ${reference_code}: ${error.message}`);
          errors++;
        } else {
          const priceChange = old.base_price !== base_price
            ? ` (prix: ${old.base_price}€ → ${base_price}€)`
            : '';
          console.log(`  📝 MÀJ: ${reference_code} - ${name}${priceChange}`);
          updated++;
        }
      }
    } else {
      // Insert new product
      const { error } = await supabase
        .from('products')
        .insert(payload);

      if (error) {
        console.error(`  ❌ Erreur insert ${reference_code}: ${error.message}`);
        errors++;
      } else {
        console.log(`  ✨ NOUVEAU: ${reference_code} - ${name} (${base_price}€)`);
        inserted++;
      }
    }
  }

  // Deactivate products NOT in the current PDF
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, reference_code, name')
    .eq('is_active', true);

  let deactivated = 0;
  if (allProducts) {
    for (const p of allProducts) {
      if (!pdfRefCodes.has(p.reference_code)) {
        await supabase
          .from('products')
          .update({ is_active: false })
          .eq('id', p.id);
        console.log(`  🔴 DÉSACTIVÉ: ${p.reference_code} - ${p.name}`);
        deactivated++;
      }
    }
  }

  return { inserted, updated, unchanged, deactivated, errors };
}

// ============================================================================
//  MAIN
// ============================================================================

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🐟 DELICATESSEN VANHAUWAERT — Sync Tarifaire');
  console.log('═══════════════════════════════════════════════════════');

  const pdfPath = path.join(process.cwd(), 'asset', 'Liste des prix.pdf');

  if (!fs.existsSync(pdfPath)) {
    console.error('❌ Fichier PDF introuvable:', pdfPath);
    console.error('   Placez le PDF dans asset/Liste des prix.pdf');
    process.exit(1);
  }

  // Step 1: Extract text
  console.log('\n📄 Extraction du PDF...');
  const text = await extractPDFText(pdfPath);
  console.log(`   Texte extrait: ${text.length} caractères`);

  // Step 2: Parse products
  console.log('\n🔍 Analyse des produits...');
  const products = parseProducts(text);
  console.log(`   ${products.length} produits identifiés`);

  // Show category breakdown
  const categories = new Map<string, number>();
  for (const p of products) {
    categories.set(p.category, (categories.get(p.category) || 0) + 1);
  }
  console.log('\n   📦 Répartition par catégorie:');
  for (const [cat, count] of categories) {
    console.log(`      • ${cat}: ${count} produits`);
  }

  // Step 3: Sync
  const results = await syncProducts(products);

  // Step 4: Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  📊 RÉSULTAT DE LA SYNCHRONISATION');
  console.log('───────────────────────────────────────────────────────');
  console.log(`   ✨ Nouveaux produits:    ${results.inserted}`);
  console.log(`   📝 Mis à jour (prix):   ${results.updated}`);
  console.log(`   ✅ Inchangés:           ${results.unchanged}`);
  console.log(`   🔴 Désactivés:          ${results.deactivated}`);
  console.log(`   ❌ Erreurs:             ${results.errors}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Show coefficients reminder
  console.log('  💰 Coefficients appliqués:');
  console.log('     • Poissonnerie (06): base × 1.20');
  console.log('     • Traiteur (08):     base × 1.24');
  console.log('     • Horeca (09):       base × 1.30');
  console.log('     • Comptant (10):     base × 1.40');
  console.log('');
}

main().catch(console.error);
