import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { parse } from 'csv-parse/sync';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    const text = await file.text();

    // Parse CSV with csv-parse
    const records = parse(text, {
      columns: true, // Expected headers: name, company_name, phone, email, pricing_group
      skip_empty_lines: true,
      relax_column_count: true,
      delimiter: [',', ';'] // support both standard and European CSVs
    });

    if (records.length === 0) {
      return NextResponse.json({ error: 'Fichier CSV vide ou format invalide' }, { status: 400 });
    }

    let importedCount = 0;

    // Loop through records
    for (const record of records) {
      // Basic normalization of CSV fields (sometimes headers have spaces/weird casing)
      const getField = (keys: string[]) => {
        const typedRecord = record as Record<string, string>;
        const key = Object.keys(typedRecord).find(k => keys.includes(k.toLowerCase().trim()));
        return key ? typedRecord[key].trim() : '';
      };

      const name = getField(['name', 'nom']) || null;
      const company_name = getField(['company', 'company_name', 'societe', 'entreprise']) || null;
      const establishment_name = getField(['etablissement', 'établissement', 'lieu', 'establishment']) || null;
      let phone = getField(['phone', 'telephone', 'tel']);
      const email = getField(['email', 'mail']) || null;
      let pricing_group = getField(['tarif', 'pricing_group', 'groupe']) || '10';

      // Clean phone (remove spaces)
      if (phone) phone = phone.replace(/\s+/g, '');

      // Ensure we have at least phone or an identifier
      if (!phone && !email && !name && !company_name && !establishment_name) continue;

      // 1. Check if client exists by phone (priority) or email
      let query = supabaseAdmin.from('clients').select('id');
      if (phone) {
        query = query.eq('phone', phone);
      } else if (email) {
        query = query.eq('email', email);
      } else {
        query = query.eq('name', name); // Fallback
      }

      const { data: existing } = await query;

      const payload = {
        name,
        company_name,
        establishment_name,
        phone,
        email,
        pricing_group
      };

      if (existing && existing.length > 0) {
        // Update existing
        await supabaseAdmin.from('clients').update(payload).eq('id', existing[0].id);
      } else {
        // Insert new
        await supabaseAdmin.from('clients').insert(payload);
      }
      importedCount++;
    }

    return NextResponse.json({ 
      success: true, 
      count: importedCount
    });

  } catch (error: any) {
    console.error('Erreur importation CSV:', error);
    return NextResponse.json({ error: error.message || 'Erreur lors de l\'importation' }, { status: 500 });
  }
}
