import React from 'react';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white min-h-screen p-6">
        <h2 className="text-2xl font-bold mb-8 text-amber-500">Delicatessen Vocal</h2>
        <nav className="flex flex-col gap-4">
          <Link href="/dashboard" className="px-4 py-2 rounded-lg hover:bg-slate-800 transition">
            📦 Commandes
          </Link>
          <Link href="/dashboard/tarifs" className="px-4 py-2 rounded-lg hover:bg-slate-800 transition">
            💶 Module Tarifs
          </Link>
          <Link href="/dashboard/clients" className="px-4 py-2 rounded-lg hover:bg-slate-800 transition">
            👥 Clients
          </Link>
          <Link href="/dashboard/produits" className="px-4 py-2 rounded-lg hover:bg-slate-800 transition">
            🐟 Produits & Stocks
          </Link>
          <Link href="/dashboard/connaissances" className="px-4 py-2 rounded-lg hover:bg-slate-800 transition">
            🧠 Base Connaissances
          </Link>
          <Link href="/dashboard/promotions" className="px-4 py-2 rounded-lg hover:bg-slate-800 transition text-red-400 font-semibold">
            🔥 Promotions
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
}
