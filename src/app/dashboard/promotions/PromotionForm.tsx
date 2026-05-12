'use client';

import React, { useRef, useState } from 'react';
import { createPromotion } from './actions';

type Product = {
  id: string;
  name: string;
  base_price: number;
};

export default function PromotionForm({ products }: { products: Product[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    
    const result = await createPromotion(formData);
    
    if (result?.error) {
      setError(result.error);
    } else {
      if (formRef.current) {
        formRef.current.reset();
      }
    }
    setLoading(false);
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border mb-8">
      <h2 className="text-xl font-bold text-slate-800 mb-6">Ajouter une promotion</h2>
      
      {error && (
        <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg">
          {error}
        </div>
      )}

      <form ref={formRef} action={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
        
        <div className="lg:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Produit</label>
          <select name="product_id" required className="w-full p-2 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500">
            <option value="">Sélectionner un produit...</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name} (Prix base: {p.base_price ? `${p.base_price} €` : '-'})</option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Titre (ex: Black Friday)</label>
          <input type="text" name="title" required placeholder="Titre promo" className="w-full p-2 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>

        <div className="lg:col-span-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Prix Promo (€)</label>
          <input type="number" step="0.01" name="promo_price" required placeholder="0.00" className="w-full p-2 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>

        <div className="lg:col-span-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Début</label>
          <input type="date" name="start_date" required className="w-full p-2 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>

        <div className="lg:col-span-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Fin</label>
          <input type="date" name="end_date" required className="w-full p-2 border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500" />
        </div>

        <div className="lg:col-span-6 mt-2 flex justify-end">
          <button 
            type="submit" 
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-6 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer la promotion'}
          </button>
        </div>
      </form>
    </div>
  );
}
