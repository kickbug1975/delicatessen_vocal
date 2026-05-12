'use server';

import { supabaseAdmin } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

export async function createPromotion(formData: FormData) {
  const productId = formData.get('product_id') as string;
  const title = formData.get('title') as string;
  const promoPrice = formData.get('promo_price') as string;
  const startDate = formData.get('start_date') as string;
  const endDate = formData.get('end_date') as string;

  if (!productId || !title || !promoPrice || !startDate || !endDate) {
    return { error: 'Tous les champs sont requis.' };
  }

  const { error } = await supabaseAdmin.from('promotions').insert({
    product_id: productId,
    title,
    promo_price: parseFloat(promoPrice),
    start_date: startDate,
    end_date: endDate,
    active: true
  });

  if (error) {
    console.error('Erreur lors de la création de la promotion:', error);
    return { error: error.message };
  }

  revalidatePath('/dashboard/promotions');
  return { success: true };
}

export async function deletePromotion(id: string) {
  const { error } = await supabaseAdmin.from('promotions').delete().eq('id', id);

  if (error) {
    console.error('Erreur lors de la suppression de la promotion:', error);
    return { error: error.message };
  }

  revalidatePath('/dashboard/promotions');
  return { success: true };
}

export async function togglePromotionActive(id: string, active: boolean) {
  const { error } = await supabaseAdmin.from('promotions').update({ active }).eq('id', id);

  if (error) {
    console.error('Erreur lors du changement de statut de la promotion:', error);
    return { error: error.message };
  }

  revalidatePath('/dashboard/promotions');
  return { success: true };
}
