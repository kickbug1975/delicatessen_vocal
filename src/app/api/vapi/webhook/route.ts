import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    // Verify Vapi webhook secret token
    const authHeader = req.headers.get('Authorization');
    const expectedSecret = process.env.VAPI_WEBHOOK_SECRET;
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { message } = payload;
    
    if (!message || !message.type) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Handle Assistant Request (Dynamic setup before call starts)
    if (message.type === 'assistant-request') {
      // Dans l'architecture Squad, nous ne voulons plus écraser l'assistant au démarrage.
      // Nous laissons Vapi utiliser le "Routeur" (Agent 1) configuré via l'API.
      // Nous pourrions injecter des 'assistantOverrides' ici si besoin (ex: promotions du jour),
      // mais pour éviter la latence, nous gardons ça vide.
      return NextResponse.json({}, { status: 200 });
    }

    // Handle Tool Calls
    if (message.type === 'tool-calls') {
      const toolCalls = message.toolWithToolCallList;
      const toolResponses = [];

      for (const call of toolCalls) {
        const toolCallId = call.toolCall.id;
        const functionName = call.toolCall.function.name;
        const args = call.toolCall.function.arguments;

        if (functionName === 'identifyClient') {
          const identifier = args.identifier || args.tva_ou_telephone;
          
          // Recherche réelle dans la table clients (par TVA, téléphone, ou nom)
          const { data: clients, error: clientErr } = await supabaseAdmin
            .from('clients')
            .select('*')
            .or(`vat_number.ilike.%${identifier}%,phone.ilike.%${identifier}%,name.ilike.%${identifier}%,company_name.ilike.%${identifier}%`)
            .limit(3);

          if (clientErr || !clients || clients.length === 0) {
            toolResponses.push({
              toolCallId,
              result: `Client introuvable dans la base de données. Demandez la création d'une fiche prospect.`
            });
          } else {
            const resultsText = clients.map((c: any) => 
              `- ${c.company_name || c.name} (Tél: ${c.phone}). Tarif: price_${c.pricing_group || '10'}. ID: ${c.id}`
            ).join('\n');

            toolResponses.push({
              toolCallId,
              result: `Profils trouvés :\n${resultsText}\n\nMémorisez le "Tarif: price_XX" du client pour la consultation des prix, et l'ID pour prendre la commande.`
            });
          }
        }

        if (functionName === 'getProductPrices') {
          const { search_query, price_column } = args;

          // Sécurisation de la colonne demandée pour éviter les hallucinations de l'IA (ex: tarif_06)
          const validColumns = ['price_06', 'price_08', 'price_09', 'price_10'];
          const actualColumn = validColumns.includes(price_column) ? price_column : 'price_10';

          // Search products (only active ones)
          const { data: products, error: prodErr } = await supabaseAdmin
            .from('products')
            .select(`id, name, stock_quantity, ${actualColumn}`)
            .ilike('name', `%${search_query}%`)
            .eq('is_active', true)
            .limit(3);

          if (prodErr || !products || products.length === 0) {
            toolResponses.push({
              toolCallId,
              result: `Désolé, aucun produit trouvé pour la recherche "${search_query}".`
            });
          } else {
            const resultsText = products.map((p: any) => {
              const priceVal = p[actualColumn] ? `${p[actualColumn]} €` : "Prix non défini";
              return `- ${p.name} (ID: ${p.id}) : ${priceVal}. (Stock restant: ${p.stock_quantity})`;
            }).join('\n');
            
            toolResponses.push({
              toolCallId,
              result: `Voici les produits trouvés :\n${resultsText}\n\nDonnez le prix au client.`
            });
          }
        }

        if (functionName === 'submitOrder') {
          const { client_id, items } = args;
          
          let total_price = 0;
          for (const item of items) {
             total_price += (item.quantity * item.unit_price);
          }

          // Create order
          const { data: order, error: orderError } = await supabaseAdmin
            .from('orders')
            .insert({
              client_id: client_id === 'anonymous' ? null : client_id,
              total_price,
              status: 'pending'
            })
            .select()
            .single();

          if (orderError) {
             console.error('Order creation error:', orderError);
             toolResponses.push({
               toolCallId,
               result: `Erreur interne lors de la création de la commande.`
             });
          } else {
            // Insert items
            const orderItemsInsert = items.map((i: any) => ({
              order_id: order.id,
              product_id: i.product_id,
              quantity: i.quantity,
              unit_price: i.unit_price
            }));
            
            await supabaseAdmin.from('order_items').insert(orderItemsInsert);

            toolResponses.push({
              toolCallId,
              result: `Commande créée avec succès. ID: ${order.id}. Total: ${total_price} €.`
            });
          }
        }

        if (functionName === 'askFishExpertise') {
          const { question, client_type } = args;
          const clientType = client_type || 'pro'; // Par défaut pro

          // Nettoyage de la question pour enlever accents et ponctuations
          const cleanQ = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

          // 1. Détection rapide par mots-clés des poissons connus
          const fishes = ['saumon', 'bar', 'lieu', 'cabillaud', 'sole'];
          let matchedFish = '';
          for (const f of fishes) {
            if (cleanQ.includes(f)) {
              matchedFish = f;
              break;
            }
          }

          let fact = null;
          if (matchedFish) {
            // Recherche par le poisson matché
            const { data } = await supabaseAdmin
              .from('products_knowledge')
              .select('*')
              .ilike('product_name', `%${matchedFish}%`)
              .limit(1)
              .maybeSingle();
            fact = data;
          }

          // 2. Recherche textuelle floue si aucun match précis ou si fact vide
          if (!fact) {
            // Découpe les 3 premiers mots significatifs pour chercher
            const searchTerms = cleanQ.split(/\s+/).filter((w: string) => w.length > 3).slice(0, 3).join('%');
            if (searchTerms) {
              const { data } = await supabaseAdmin
                .from('products_knowledge')
                .select('*')
                .or(`product_name.ilike.%${searchTerms}%,provenance.ilike.%${searchTerms}%`)
                .limit(1)
                .maybeSingle();
              fact = data;
            }
          }

          let expertResponse = "Je n'ai pas la fiche technique exacte sous les yeux pour ce produit, mais je peux demander à notre chef d'atelier de vous rappeler avec les spécifications.";

          if (fact) {
            // Construction de la réponse selon le profil (Pro vs Particulier)
            const parts = [
              `Fiche Technique pour le ${fact.product_name} :`,
              `- Provenance : ${fact.provenance}`,
              `- Saisonnalité : ${fact.saisonnalite}`,
              `- Calibres disponibles : ${fact.calibres}`
            ];

            // On ajoute les conseils de préparation uniquement pour les particuliers
            if (clientType === 'particular' && fact.conseils_preparation) {
              parts.push(`- Conseils de préparation et cuisson : ${fact.conseils_preparation}`);
            }

            expertResponse = parts.join('\n');
          }

          toolResponses.push({
            toolCallId,
            result: expertResponse
          });
        }
      }

      return NextResponse.json({
        results: toolResponses
      }, { status: 200 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
