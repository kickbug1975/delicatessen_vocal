import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { product_name, provenance, saisonnalite, calibres, conseils_preparation } = await req.json();

    if (!product_name || !provenance) {
      return NextResponse.json({ error: 'Le nom et la provenance sont obligatoires' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('products_knowledge')
      .upsert({
        product_name,
        provenance,
        saisonnalite,
        calibres,
        conseils_preparation
      }, { onConflict: 'product_name' })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('Erreur enregistrement RAG:', err);
    return NextResponse.json({ error: 'Erreur interne de sauvegarde' }, { status: 500 });
  }
}
