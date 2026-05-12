"use client";

import React, { useRef, useState } from 'react';

export default function ImportCatalogueButton() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/produits/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'import');
      }

      setMessage(`Succès ! ${data.count} produits importés. Veuillez rafraîchir la page.`);
      // Optionally route.refresh() to reload server components
      window.location.reload();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {message && (
        <span className={`text-sm font-medium ${message.includes('Erreur') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </span>
      )}
      
      <input 
        type="file" 
        accept="application/pdf"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
      >
        {loading ? 'Importation en cours...' : '+ Importer Catalogue (PDF)'}
      </button>
    </div>
  );
}
