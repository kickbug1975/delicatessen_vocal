import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { formulas } = await req.json();

    if (!formulas || typeof formulas !== 'object') {
      return NextResponse.json({ error: 'Formules invalides' }, { status: 400 });
    }

    const tiers = ['06', '08', '09', '10'];
    for (const tier of tiers) {
      if (typeof formulas[tier] === 'undefined') {
        return NextResponse.json({ error: `Tarif manquant pour le groupe ${tier}` }, { status: 400 });
      }
      const val = parseFloat(formulas[tier]);
      if (isNaN(val)) {
        return NextResponse.json({ error: `Tarif invalide pour le groupe ${tier}` }, { status: 400 });
      }
    }

    // 1. Fetch all products
    const { data: products, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('id, base_price');

    if (fetchError) throw new Error(`Erreur récupération produits: ${fetchError.message}`);
    if (!products || products.length === 0) {
      return NextResponse.json({ updatedCount: 0 });
    }

    // 2. Compute new prices
    const productsToUpdate = products.map((product) => {
      const base = parseFloat(product.base_price || 0);

      const price_06 = base * (1 + parseFloat(formulas['06']) / 100);
      const price_08 = base * (1 + parseFloat(formulas['08']) / 100);
      const price_09 = base * (1 + parseFloat(formulas['09']) / 100);
      const price_10 = base * (1 + parseFloat(formulas['10']) / 100);

      return {
        id: product.id, // Only provide the fields we want to update along with the Primary Key
        price_06: Number(price_06.toFixed(2)),
        price_08: Number(price_08.toFixed(2)),
        price_09: Number(price_09.toFixed(2)),
        price_10: Number(price_10.toFixed(2)),
      };
    });

    // 3. Bulk Update using chunked Promise.all
    // We avoid upsert to prevent NOT NULL constraint errors, and use parallel chunks to bypass serverless timeouts.
    const chunkSize = 50;
    for (let i = 0; i < productsToUpdate.length; i += chunkSize) {
      const chunk = productsToUpdate.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map((p) =>
          supabaseAdmin.from('products').update({
            price_06: p.price_06,
            price_08: p.price_08,
            price_09: p.price_09,
            price_10: p.price_10,
          }).eq('id', p.id)
        )
      );
    }

    return NextResponse.json({ success: true, updatedCount: productsToUpdate.length });

  } catch (err: any) {
    console.error('API /tarifs/update Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
