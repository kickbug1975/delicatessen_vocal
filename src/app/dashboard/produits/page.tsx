import React from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import ImportCatalogueButton from './ImportCatalogueButton';

export const revalidate = 0;

export default async function ProductsPage() {
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .order('name', { ascending: true });

  return (
    <div className="max-w-6xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Catalogue & Stocks</h1>
        <ImportCatalogueButton />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b text-slate-600">
              <th className="p-4 font-semibold">Produit</th>
              <th className="p-4 font-semibold">Réf.</th>
              <th className="p-4 font-semibold">Stock</th>
              <th className="p-4 font-semibold">Prix Base</th>
              <th className="p-4 font-semibold text-amber-600">Tarif 06</th>
              <th className="p-4 font-semibold text-amber-600">Tarif 08</th>
              <th className="p-4 font-semibold text-amber-600">Tarif 09</th>
              <th className="p-4 font-semibold text-amber-600">Tarif 10</th>
            </tr>
          </thead>
          <tbody>
            {products && products.length > 0 ? (
              products.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50 text-slate-700">
                  <td className="p-4 font-medium">{p.name}</td>
                  <td className="p-4">{p.reference_code || '-'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-md font-medium ${p.stock_quantity > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {p.stock_quantity}
                    </span>
                  </td>
                  <td className="p-4 font-bold">{p.base_price ? `${parseFloat(p.base_price).toFixed(2)} €` : '-'}</td>
                  <td className="p-4">{p.price_06 ? `${parseFloat(p.price_06).toFixed(2)} €` : '-'}</td>
                  <td className="p-4">{p.price_08 ? `${parseFloat(p.price_08).toFixed(2)} €` : '-'}</td>
                  <td className="p-4">{p.price_09 ? `${parseFloat(p.price_09).toFixed(2)} €` : '-'}</td>
                  <td className="p-4">{p.price_10 ? `${parseFloat(p.price_10).toFixed(2)} €` : '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  Aucun produit dans le catalogue. Utilisez le bouton d'importation pour commencer.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
