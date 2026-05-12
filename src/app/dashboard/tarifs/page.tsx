"use client";

import React, { useState } from 'react';

export default function TarifsPage() {
  const [formulas, setFormulas] = useState({
    '06': 5, // e.g. +5%
    '08': 10,
    '09': 15,
    '10': 25,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUpdate = async () => {
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch('/api/tarifs/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ formulas })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erreur inconnue');

      setMessage(`Succès ! Les prix ont été recalculés pour ${data.updatedCount} produits.`);
    } catch (err: any) {
      setMessage(`Erreur: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFormulaChange = (tier: string, value: string) => {
    setFormulas(prev => ({
      ...prev,
      [tier]: parseFloat(value) || 0
    }));
  };

  return (
    <div className="max-w-4xl font-sans">
      <h1 className="text-3xl font-bold mb-2 text-slate-800">Module Tarifs</h1>
      <p className="text-slate-600 mb-8">
        Définissez le pourcentage de majoration (marge) à appliquer sur le <strong>prix de base</strong> pour chaque groupe de clients. 
        Lors du clic sur "Appliquer", la base de données recalculera automatiquement les prix de tout votre catalogue.
      </p>

      <div className="bg-white p-8 rounded-xl shadow-sm border space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TarifCard 
            id="06"
            title="06 - Poissonnerie et gros volume"
            value={formulas['06']}
            onChange={(v: string) => handleFormulaChange('06', v)}
            baseExample={10}
          />
          <TarifCard 
            id="08"
            title="08 - Traiteur"
            value={formulas['08']}
            onChange={(v: string) => handleFormulaChange('08', v)}
            baseExample={10}
          />
          <TarifCard 
            id="09"
            title="09 - Horeca"
            value={formulas['09']}
            onChange={(v: string) => handleFormulaChange('09', v)}
            baseExample={10}
          />
          <TarifCard 
            id="10"
            title="10 - Particulier"
            value={formulas['10']}
            onChange={(v: string) => handleFormulaChange('10', v)}
            baseExample={10}
          />
        </div>

        <div className="pt-6 border-t flex items-center justify-between">
          <div className="text-sm font-medium text-amber-600">
            * Attention: Cette action mettra à jour l'intégralité de la base de produits.
          </div>
          
          <button 
            onClick={handleUpdate}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Calcul en cours...' : 'Appliquer aux produits'}
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-lg mt-4 ${message.includes('Erreur') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}

      </div>
    </div>
  );
}

function TarifCard({ id, title, value, onChange, baseExample }: any) {
  const calculatedPrice = baseExample * (1 + value / 100);

  return (
    <div className="p-4 border rounded-lg bg-slate-50">
      <h3 className="font-bold text-slate-700 mb-4">{title}</h3>
      <div className="flex items-center space-x-3 mb-4">
        <span className="text-slate-600 text-sm font-medium">Marge appliquée :</span>
        <div className="flex items-center">
          <span className="text-slate-500 mr-2 text-lg">+</span>
          <input 
            type="number" 
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-20 p-2 border rounded-md text-center focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <span className="text-slate-500 ml-2 font-bold">%</span>
        </div>
      </div>
      
      <div className="bg-white p-3 rounded text-sm text-slate-500 border border-slate-100">
        <em>Exemple de calcul :</em><br/>
        Prix de base à <strong>{baseExample} €</strong>  
        ➔ Prix final : <strong className="text-blue-600">{calculatedPrice.toFixed(2)} €</strong>
      </div>
    </div>
  );
}
