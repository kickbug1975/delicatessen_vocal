import React from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import ImportClientsButton from './ImportClientsButton';

export const revalidate = 0;

export default async function ClientsPage() {
  const { data: clients, error } = await supabaseAdmin
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-6xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Gestion des Clients</h1>
        <ImportClientsButton />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b text-slate-600 text-sm">
              <th className="p-4 font-semibold">Nom / Société</th>
              <th className="p-4 font-semibold">Établissement</th>
              <th className="p-4 font-semibold">Téléphone</th>
              <th className="p-4 font-semibold">Email</th>
              <th className="p-4 font-semibold">Groupe Tarifaire</th>
            </tr>
          </thead>
          <tbody>
            {clients && clients.length > 0 ? (
              clients.map((client) => (
                <tr key={client.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-4 font-medium text-slate-800">{client.name || client.company_name || '-'}</td>
                  <td className="p-4 text-slate-700 italic">{client.establishment_name || '-'}</td>
                  <td className="p-4 text-slate-600">{client.phone || '-'}</td>
                  <td className="p-4 text-slate-600">{client.email || '-'}</td>
                  <td className="p-4">
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-bold">
                       Tarif {client.pricing_group}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  Aucun client existant pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
