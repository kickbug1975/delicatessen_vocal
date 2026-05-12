import { supabaseAdmin } from '@/lib/supabase';
import React from 'react';

export const revalidate = 0; // Disable cache so the dashboard is real-time on refresh

export default async function DashboardPage() {
  const { data: orders, error } = await supabaseAdmin
    .from('orders')
    .select('*, clients(*), order_items(*, products(name))')
    .order('created_at', { ascending: false });

  if (error) {
    return <div className="p-8 text-red-500">Erreur lors de la récupération des commandes : {error.message}</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-8 text-slate-800">Delicatessen Vanhauwaert - Dashboard</h1>
      
      <div className="grid gap-6">
        {orders && orders.length > 0 ? (
          orders.map((order: any) => (
            <div key={order.id} className="p-6 bg-white border rounded-xl shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-700">Commande #{order.id.split('-')[0]}</h2>
                  <p className="text-slate-500 text-sm">Passée le {new Date(order.created_at).toLocaleString('fr-FR')}</p>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${order.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                    {order.status === 'pending' ? 'En attente' : 'Traitée'}
                  </span>
                  <div className="text-xl font-bold text-slate-800 mt-2">{order.total_price} €</div>
                </div>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-semibold text-slate-700 mb-2">Client :</h3>
                <p>{order.clients ? `${order.clients.name || order.clients.company_name} (Tarif: ${order.clients.pricing_group})` : 'Client anonyme ou non identifié'}</p>
                <p className="text-sm text-slate-500">{order.clients?.phone}</p>
              </div>

              <div className="mt-4">
                <h3 className="font-semibold text-slate-700 mb-2">Articles ({order.order_items.length}) :</h3>
                <ul className="divide-y">
                  {order.order_items.map((item: any) => (
                    <li key={item.id} className="py-2 flex justify-between">
                      <span>{item.quantity}x {item.products?.name || 'Produit inconnu'}</span>
                      <span className="text-slate-600">{item.unit_price} € / unité</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed">
            Aucune commande reçue pour le moment.
          </div>
        )}
      </div>
    </div>
  );
}
