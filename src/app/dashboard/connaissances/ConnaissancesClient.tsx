'use client';

import React, { useState } from 'react';

interface KnowledgeItem {
  id?: string;
  product_name: string;
  provenance: string;
  saisonnalite: string;
  calibres: string;
  conseils_preparation: string;
}

interface Props {
  initialItems: KnowledgeItem[];
}

export default function ConnaissancesClient({ initialItems }: Props) {
  const [items, setItems] = useState<KnowledgeItem[]>(initialItems);
  const [formData, setFormData] = useState<KnowledgeItem>({
    product_name: '',
    provenance: '',
    saisonnalite: '',
    calibres: '',
    conseils_preparation: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch('/api/connaissances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const resData = await res.json();

      if (!res.ok) throw new Error(resData.error || 'Une erreur est survenue');

      // Update local list
      const updatedItem = resData.data;
      const index = items.findIndex((i) => i.product_name.toLowerCase() === updatedItem.product_name.toLowerCase());
      
      if (index !== -1) {
        // Updated existing
        const newItems = [...items];
        newItems[index] = updatedItem;
        setItems(newItems);
        setMessage({ type: 'success', text: `La fiche technique du "${formData.product_name}" a bien été mise à jour !` });
      } else {
        // Added new
        setItems([updatedItem, ...items]);
        setMessage({ type: 'success', text: `La fiche technique du "${formData.product_name}" a bien été ajoutée !` });
      }

      // Reset form and selection
      handleResetForm();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Select Item for editing
  const handleSelectItem = (item: KnowledgeItem) => {
    setFormData(item);
    setSelectedId(item.id || item.product_name);
    setMessage({ type: '', text: '' });
  };

  // Reset form
  const handleResetForm = () => {
    setFormData({
      product_name: '',
      provenance: '',
      saisonnalite: '',
      calibres: '',
      conseils_preparation: ''
    });
    setSelectedId(null);
  };

  // Filter items based on search
  const filteredItems = items.filter((item) =>
    item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.provenance.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto font-sans">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Base de Connaissances Marée (RAG)</h1>
        <p className="text-slate-500">Ajoutez, modifiez ou recherchez les fiches techniques consultées en temps réel par l'assistant vocal vocal Vapi.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Form */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
              <h2 className="text-lg font-bold text-slate-800">
                {selectedId ? 'Modifier la fiche' : 'Nouvelle fiche technique'}
              </h2>
              {selectedId && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition"
                >
                  Annuler l'édition
                </button>
              )}
            </div>

            {message.text && (
              <div className={`p-4 rounded-lg text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {message.text}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nom du poisson / produit *</label>
              <input
                type="text"
                required
                placeholder="Ex: Cabillaud, Saumon d'Ecosse, Bar de ligne..."
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                disabled={!!selectedId} // Prevents changing the unique product name during edit
              />
              {selectedId && (
                <p className="text-xs text-slate-400 mt-1">Le nom du produit est l'identifiant unique. Pour le changer, recréez une fiche.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Provenance / Criée *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Criée de Loctudy, Bretagne"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  value={formData.provenance}
                  onChange={(e) => setFormData({ ...formData, provenance: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Saisonnalité</label>
                <input
                  type="text"
                  placeholder="Ex: Septembre à Mars"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                  value={formData.saisonnalite}
                  onChange={(e) => setFormData({ ...formData, saisonnalite: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Calibres disponibles</label>
              <input
                type="text"
                placeholder="Ex: Filets de 1.2kg à 1.8kg, poissons entiers de 2-3kg"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                value={formData.calibres}
                onChange={(e) => setFormData({ ...formData, calibres: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Conseils de préparation (Affichés aux Particuliers) 🍳</label>
              <textarea
                rows={4}
                placeholder="Saisissez ici les recettes de cuisine, modes de cuisson, temps conseillés..."
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700"
                value={formData.conseils_preparation}
                onChange={(e) => setFormData({ ...formData, conseils_preparation: e.target.value })}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 disabled:bg-slate-300"
            >
              {loading ? 'Sauvegarde en cours...' : selectedId ? 'Mettre à jour la fiche' : 'Enregistrer la fiche technique'}
            </button>
          </form>

          {/* Visual Preview */}
          <div className="bg-slate-50 border rounded-xl p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aperçu de la réponse Vapi</h3>
            <div className="border-l-4 border-blue-500 pl-4 space-y-2 text-sm text-slate-700">
              <p className="font-bold text-base text-slate-900">{formData.product_name || 'Nom du poisson'}</p>
              <p>📍 <span className="font-semibold">Provenance:</span> {formData.provenance || '-'}</p>
              <p>📅 <span className="font-semibold">Saison:</span> {formData.saisonnalite || '-'}</p>
              <p>⚖️ <span className="font-semibold">Calibres:</span> {formData.calibres || '-'}</p>
              {formData.conseils_preparation && (
                <p className="mt-4 pt-2 border-t text-amber-800 bg-amber-50 p-2 rounded">
                  💡 <span className="font-semibold">Conseils particuliers:</span> {formData.conseils_preparation}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: List */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Fiches enregistrées</h2>
              <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full font-medium">
                {items.length} produit{items.length > 1 ? 's' : ''}
              </span>
            </div>

            {/* Search Input */}
            <input
              type="text"
              placeholder="Rechercher un produit..."
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {/* List */}
            <div className="divide-y max-h-[500px] overflow-y-auto pr-2">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <div
                    key={item.product_name}
                    onClick={() => handleSelectItem(item)}
                    className={`py-4 cursor-pointer hover:bg-slate-50 transition px-2 rounded-lg flex flex-col gap-1 border border-transparent ${selectedId === (item.id || item.product_name) ? 'bg-blue-50/55 border-blue-200' : ''}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-semibold text-slate-800 text-sm">{item.product_name}</span>
                      <span className="text-xs text-slate-400 font-medium">✏️ éditer</span>
                    </div>
                    <span className="text-xs text-slate-500 truncate">📍 {item.provenance}</span>
                    <span className="text-xs text-slate-400">📅 {item.saisonnalite || 'Toute l\'année'}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Aucune fiche correspondante.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
