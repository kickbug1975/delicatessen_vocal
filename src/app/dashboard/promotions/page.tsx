import React from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import PromotionForm from './PromotionForm';
import { deletePromotion, togglePromotionActive } from './actions';
import PromoListRow from './PromoListRow'; // Client component for interactive rows (delete/toggle)

export const revalidate = 0;

export default async function PromotionsPage() {
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('id, name, base_price')
    .order('name');

  const { data: promotions } = await supabaseAdmin
    .from('promotions')
    .select('*, products(name)')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-6xl mx-auto font-sans">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Promotions Flash</h1>
        <p className="text-slate-500 mt-2">Gérez les promotions temporelles actives pour vos clients.</p>
      </div>

      <PromotionForm products={products || []} />

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b text-slate-600">
              <th className="p-4 font-semibold">Titre</th>
              <th className="p-4 font-semibold">Produit</th>
              <th className="p-4 font-semibold">Prix Promo</th>
              <th className="p-4 font-semibold">Début</th>
              <th className="p-4 font-semibold">Fin</th>
              <th className="p-4 font-semibold">Statut</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {promotions && promotions.length > 0 ? (
              promotions.map((promo) => (
                <PromoListRow key={promo.id} promo={promo} />
              ))
            ) : (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  Aucune promotion configurée actuellement.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
