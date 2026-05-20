import React from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import ConnaissancesClient from './ConnaissancesClient';

export const revalidate = 0;

export default async function ConnaissancesPage() {
  // Fetch existing fiches from Supabase
  const { data: initialItems, error } = await supabaseAdmin
    .from('products_knowledge')
    .select('*')
    .order('product_name', { ascending: true });

  if (error) {
    console.error('Erreur lors du chargement des connaissances:', error.message);
  }

  return (
    <ConnaissancesClient initialItems={initialItems || []} />
  );
}
