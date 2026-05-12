import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// --- Load .env manually ---
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

// --- Config ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- CSV Parsing (handles the multi-line format) ---
interface RawClient {
  code: string;
  nom: string;
  handelsbenaming: string;
  rue: string;
  numero: string;
  codePostal: string;
  localite: string;
  pays: string;
  telephone: string;
  gsm: string;
  btwNr: string;
  email: string;
  afzetkanaal: string; // pricing group like "09 HORECA"
  datumLaatsteBestelling: string;
  maxKrediet: string;
  datumAanmaak: string;
}

function parseCSV(filePath: string): RawClient[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Skip header
  const dataLines = lines.slice(1);
  
  const clients: RawClient[] = [];
  let current: Partial<RawClient> | null = null;

  for (const line of dataLines) {
    if (!line.trim()) continue;
    
    const fields = parseCSVLine(line);
    
    const code = fields[0]?.trim();
    
    if (code && code !== '') {
      // New client entry: save previous if exists
      if (current && current.code) {
        clients.push(current as RawClient);
      }
      
      current = {
        code: code.replace('.0', ''),
        nom: fields[1]?.trim() || '',
        handelsbenaming: fields[2]?.trim() || '',
        rue: fields[3]?.trim() || '',
        numero: fields[4]?.trim() || '',
        codePostal: (fields[5]?.trim() || '').replace('.0', ''),
        localite: fields[6]?.trim() || '',
        pays: fields[7]?.trim() || 'BEL',
        telephone: fields[8]?.trim() || '',
        gsm: fields[11]?.trim() || '',
        btwNr: fields[12]?.trim() || '',
        email: '',
        afzetkanaal: '',
        datumLaatsteBestelling: '',
        maxKrediet: '',
        datumAanmaak: '',
      };
      
      // Check if this first line already has email/afzetkanaal
      const email1 = fields[18]?.trim() || '';
      // Afzetkanaal is at index 21 in the data (despite header showing 20)
      const afzetkanaal1 = fields[21]?.trim() || '';
      if (email1 && email1 !== '' && !email1.includes('ghlin@delicatessen')) current.email = email1;
      if (afzetkanaal1 && afzetkanaal1 !== '') current.afzetkanaal = afzetkanaal1;
      
    } else if (current) {
      // Continuation line: pick up missing data
      const email = fields[18]?.trim() || '';
      // Afzetkanaal is at index 21 in continuation lines
      const afzetkanaal = fields[21]?.trim() || '';
      const datumLaatsteBestelling = fields[22]?.trim() || '';
      const maxKrediet = fields[24]?.trim() || '';
      const datumAanmaak = fields[25]?.trim() || '';
      
      // Gsm from continuation if missing
      const gsm = fields[11]?.trim() || '';
      if (gsm && !current.gsm) current.gsm = gsm;
      
      // Take the non-default email (not ghlin@delicatessen...)
      if (email && !email.includes('ghlin@delicatessen') && !current.email) {
        current.email = email;
      }
      // If we still don't have an email, take even the ghlin one
      if (!current.email && email) {
        current.email = email;
      }
      
      // Afzetkanaal (pricing group) - take the first non-empty one
      if (afzetkanaal && !current.afzetkanaal) {
        current.afzetkanaal = afzetkanaal;
      }
      
      if (datumLaatsteBestelling && !current.datumLaatsteBestelling) {
        current.datumLaatsteBestelling = datumLaatsteBestelling;
      }
      if (maxKrediet && !current.maxKrediet) {
        current.maxKrediet = maxKrediet;
      }
      if (datumAanmaak && !current.datumAanmaak) {
        current.datumAanmaak = datumAanmaak;
      }
    }
  }
  
  // Don't forget the last client
  if (current && current.code) {
    clients.push(current as RawClient);
  }
  
  return clients;
}

// Simple CSV line parser (handles quoted fields)
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

// --- Normalization ---
function extractPricingGroup(afzetkanaal: string): string {
  // "09 HORECA" -> "09", "06 POISSONERIE" -> "06"
  const match = afzetkanaal.match(/^(\d{2})/);
  if (match) return match[1];
  return '10'; // default
}

function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  // Remove all spaces, dots, slashes  
  let cleaned = phone.replace(/[\s./()-]+/g, '');
  
  // Belgian format: 0XXX/XX.XX.XX -> +32XXXXXXXXX
  if (cleaned.startsWith('0') && !cleaned.startsWith('00')) {
    cleaned = '+32' + cleaned.substring(1);
  }
  
  if (cleaned.length < 8) return null;
  
  return cleaned;
}

// --- Import ---
async function importClients() {
  console.log('📂 Parsing CSV...');
  const csvPath = path.join(process.cwd(), 'asset', 'Map1.csv');
  const rawClients = parseCSV(csvPath);
  
  console.log(`✅ ${rawClients.length} clients parsed from CSV`);
  
  // Filter out test clients (code >= 999000) and internal entries
  const clients = rawClients.filter(c => {
    const code = parseInt(c.code);
    if (isNaN(code)) return false;
    if (code >= 999000) return false; // test clients
    return true;
  });
  
  console.log(`🔍 ${clients.length} clients after filtering (removed test clients)`);
  
  // Track unique phones to handle duplicates in CSV
  const seenPhones = new Set<string>();
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const raw of clients) {
    try {
      // Choose best phone: prefer GSM over landline
      const phone = normalizePhone(raw.gsm) || normalizePhone(raw.telephone);
      
      // Skip if no phone and no meaningful identifier
      if (!phone && !raw.nom && !raw.handelsbenaming) {
        skipped++;
        continue;
      }
      
      // Skip duplicate phones
      if (phone && seenPhones.has(phone)) {
        console.log(`⏭️  Doublon téléphone ignoré: ${raw.nom} (${phone})`);
        skipped++;
        continue;
      }
      if (phone) seenPhones.add(phone);
      
      // Build address
      const addressParts = [raw.rue, raw.numero].filter(Boolean);
      const address = addressParts.length > 0 ? addressParts.join(' ') : null;
      
      // Determine name vs company_name
      const companyName = raw.nom || null;
      const establishmentName = raw.handelsbenaming || null;
      
      // Email: prefer non-ghlin
      let email = raw.email || null;
      if (email === 'ghlin@delicatessenvanhauwaert.be') email = null; // internal email, not the client's
      
      // Pricing group
      const pricingGroup = extractPricingGroup(raw.afzetkanaal);
      
      // Validate pricing group is in allowed set
      const validGroups = ['00','01','02','03','04','05','06','07','08','09','10'];
      const finalPricingGroup = validGroups.includes(pricingGroup) ? pricingGroup : '10';
      
      const payload = {
        external_code: raw.code,
        name: companyName,
        company_name: companyName,
        establishment_name: establishmentName,
        phone: phone,
        email: email,
        pricing_group: finalPricingGroup,
        address: address,
        postal_code: raw.codePostal || null,
        city: raw.localite || null,
        country: raw.pays || 'BEL',
        vat_number: raw.btwNr || null,
      };
      
      const { error } = await supabase
        .from('clients')
        .insert(payload);
      
      if (error) {
        // If phone duplicate in DB, try update
        if (error.code === '23505' && phone) {
          const { error: updateErr } = await supabase
            .from('clients')
            .update(payload)
            .eq('phone', phone);
          
          if (updateErr) {
            console.error(`❌ Erreur update ${raw.nom}: ${updateErr.message}`);
            errors++;
          } else {
            imported++;
          }
        } else {
          console.error(`❌ Erreur insert ${raw.nom}: ${error.message}`);
          errors++;
        }
      } else {
        imported++;
      }
    } catch (err: any) {
      console.error(`❌ Exception pour ${raw.nom}: ${err.message}`);
      errors++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 RÉSULTAT DE L'IMPORT`);
  console.log(`   ✅ Importés: ${imported}`);
  console.log(`   ⏭️  Ignorés:  ${skipped}`);
  console.log(`   ❌ Erreurs:  ${errors}`);
  console.log('='.repeat(50));
}

importClients().catch(console.error);
