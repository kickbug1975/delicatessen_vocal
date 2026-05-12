'use client';

import React, { useTransition } from 'react';
import { deletePromotion, togglePromotionActive } from './actions';

export default function PromoListRow({ promo }: { promo: any }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm("Voulez-vous vraiment supprimer cette promotion ?")) {
      startTransition(() => {
        deletePromotion(promo.id);
      });
    }
  };

  const handleToggle = () => {
    startTransition(() => {
      togglePromotionActive(promo.id, !promo.active);
    });
  };

  return (
    <tr className={`border-b last:border-0 hover:bg-slate-50 ${isPending ? 'opacity-50' : ''}`}>
      <td className="p-4 font-medium text-slate-800">{promo.title}</td>
      <td className="p-4 text-slate-600">{promo.products?.name || 'Produit Inconnu'}</td>
      <td className="p-4 font-bold text-amber-600">{promo.promo_price ? `${promo.promo_price} €` : '-'}</td>
      <td className="p-4 text-slate-500">{new Date(promo.start_date).toLocaleDateString()}</td>
      <td className="p-4 text-slate-500">{new Date(promo.end_date).toLocaleDateString()}</td>
      <td className="p-4">
        <button 
          onClick={handleToggle}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
            promo.active 
              ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' 
              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
          }`}
        >
          {promo.active ? 'Active' : 'Inactive'}
        </button>
      </td>
      <td className="p-4 text-right">
        <button 
          onClick={handleDelete}
          className="text-red-500 hover:text-red-700 font-medium text-sm transition"
        >
          Supprimer
        </button>
      </td>
    </tr>
  );
}
