import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

function cleanProductName(name: string): string {
  if (!name) return "";
  let cleaned = name.toUpperCase();
  
  // Replace specific phrases/words
  cleaned = cleaned.replace(/\bDEEP SKIN\b/g, 'sans peau');
  cleaned = cleaned.replace(/\b\(HANDMADE\)\b/g, '(artisanal)');
  cleaned = cleaned.replace(/\bHANDMADE\b/g, 'artisanal');
  cleaned = cleaned.replace(/\bNORWAY\b/g, 'de Norvège');
  cleaned = cleaned.replace(/\bICELAND\b/g, "d'Islande");
  cleaned = cleaned.replace(/\bDK\/UK\b/g, 'Danemark/Royaume-Uni');
  cleaned = cleaned.replace(/\b5KG\+\b/g, '5 kg et plus');
  cleaned = cleaned.replace(/\bKG\b/g, 'kg');
  
  // Convert standard terms to nice lowercase/accented French
  cleaned = cleaned.replace(/\bSAUMON\b/g, 'Saumon');
  cleaned = cleaned.replace(/\bLIEU NOIR\b/g, 'Lieu noir');
  cleaned = cleaned.replace(/\bFILET\b/g, 'filet');
  cleaned = cleaned.replace(/\bENTIER\b/g, 'entier');
  cleaned = cleaned.replace(/\bPORTION\b/g, 'portion');
  cleaned = cleaned.replace(/\bCABILLAUD\b/g, 'Cabillaud');
  cleaned = cleaned.replace(/\bDOS\b/g, 'dos');
  cleaned = cleaned.replace(/\bTURBOT\b/g, 'Turbot');
  cleaned = cleaned.replace(/\bSOLE\b/g, 'Sole');
  cleaned = cleaned.replace(/\bBAR\b/g, 'Bar');
  cleaned = cleaned.replace(/\bDAURADE\b/g, 'Daurade');
  cleaned = cleaned.replace(/\bDORADE\b/g, 'Dorade');
  cleaned = cleaned.replace(/\bTRUITE\b/g, 'Truite');
  cleaned = cleaned.replace(/\bMOULES\b/g, 'Moules');
  cleaned = cleaned.replace(/\bMOULE\b/g, 'Moule');
  cleaned = cleaned.replace(/\bHOMARD\b/g, 'Homard');
  cleaned = cleaned.replace(/\bLANGOUSTINE\b/g, 'Langoustine');
  cleaned = cleaned.replace(/\bHUÎTRE\b/g, 'Huître');
  cleaned = cleaned.replace(/\bHUITRE\b/g, 'Huître');
  cleaned = cleaned.replace(/\bHUÎTRES\b/g, 'Huîtres');
  cleaned = cleaned.replace(/\bHUITRES\b/g, 'Huîtres');
  cleaned = cleaned.replace(/\bCOQUILLE\b/g, 'Coquille');
  cleaned = cleaned.replace(/\bSAINT JACQUES\b/g, 'Saint-Jacques');
  cleaned = cleaned.replace(/\bSAINT-JACQUES\b/g, 'Saint-Jacques');
  cleaned = cleaned.replace(/\bPALOURDE\b/g, 'Palourde');
  cleaned = cleaned.replace(/\bCOUTEAU\b/g, 'Couteau');
  cleaned = cleaned.replace(/\bCOQUE\b/g, 'Coque');
  cleaned = cleaned.replace(/\bBULOT\b/g, 'Bulot');
  cleaned = cleaned.replace(/\bAMANDE\b/g, 'Amande');
  cleaned = cleaned.replace(/\bPETONCLE\b/g, 'Pétoncle');
  cleaned = cleaned.replace(/\bPÉTONCLE\b/g, 'Pétoncle');
  cleaned = cleaned.replace(/\bBIGORNEAU\b/g, 'Bigorneau');
  
  // Format remaining uppercase words in lowercase
  cleaned = cleaned.split(' ').map((word) => {
    if (word === word.toUpperCase() && word.length > 2 && !word.includes('/') && !word.includes('-') && !word.includes('(') && !word.includes(')')) {
      return word.toLowerCase();
    }
    return word;
  }).join(' ');

  // Clean double spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // Capitalize first letter of the whole name
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  return cleaned;
}

function formatPriceFrench(price: number | string): string {
  if (price === undefined || price === null || price === '') return "Prix non défini";
  const num = typeof price === 'number' ? price : parseFloat(price);
  if (isNaN(num)) return "Prix non défini";
  return `${num.toFixed(2).replace('.', ',')} €`;
}

export async function POST(req: Request) {
  try {
    // Verify Vapi webhook secret token
    const authHeader = req.headers.get('Authorization') || '';
    const xVapiSecret = req.headers.get('x-vapi-secret') || '';
    const expectedSecret = process.env.VAPI_WEBHOOK_SECRET || 'delicatessen-vapi-webhook-secret-2026';
    
    const isValid = 
      authHeader === `Bearer ${expectedSecret}` ||
      authHeader === expectedSecret ||
      authHeader.replace(/^Bearer\s+/i, '') === expectedSecret ||
      xVapiSecret === expectedSecret;

    if (!isValid) {
      console.warn('Unauthorized webhook request. Received Authorization:', authHeader ? 'Present' : 'Missing', 'x-vapi-secret:', xVapiSecret ? 'Present' : 'Missing');
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
        
        try {
          let args = call.toolCall.function.arguments;
          if (typeof args === 'string') {
            try {
              args = JSON.parse(args);
            } catch (e) {
              console.error("Failed to parse tool call arguments string:", args, e);
              args = {};
            }
          }
          if (!args || typeof args !== 'object') {
            args = {};
          }

        if (functionName === 'identifyClient') {
          const identifier = String(args.identifier || args.tva_ou_telephone || '').trim();
          
          let orConditions: string[] = [];

          // 1. Extraction of digits for phone / VAT number matching
          const digits = identifier.replace(/\D/g, '');
          if (digits.length >= 6) {
            const last6 = digits.slice(-6);
            orConditions.push(`phone.ilike.%${last6}%`);
            orConditions.push(`vat_number.ilike.%${last6}%`);
          }
          if (digits.length >= 8) {
            orConditions.push(`phone.ilike.%${digits}%`);
            orConditions.push(`vat_number.ilike.%${digits}%`);
          }

          // 2. Word tokenization for name / company matching
          const words = identifier.split(/[\s,.-]+/).filter(w => w.length >= 3);
          for (const word of words) {
            orConditions.push(`name.ilike.%${word}%`);
            orConditions.push(`company_name.ilike.%${word}%`);
          }

          // Fallback to exact match if no specific conditions were generated
          if (orConditions.length === 0 && identifier) {
            orConditions.push(`name.ilike.%${identifier}%`);
            orConditions.push(`company_name.ilike.%${identifier}%`);
            orConditions.push(`phone.ilike.%${identifier}%`);
            orConditions.push(`vat_number.ilike.%${identifier}%`);
          }

          let clients: any[] = [];
          let clientErr: any = null;

          if (orConditions.length > 0) {
            const orQuery = orConditions.join(',');
            const { data, error } = await supabaseAdmin
              .from('clients')
              .select('*')
              .or(orQuery)
              .limit(3);
            clients = data || [];
            clientErr = error;
          }

          if (clientErr || !clients || clients.length === 0) {
            toolResponses.push({
              toolCallId,
              result: `Client introuvable dans la base de données. Demandez la création d'une fiche prospect.`
            });
          } else {
            const resultsText = clients.map((c: any) => 
              `- ${c.company_name || c.name} (Tél: ${c.phone}). Tarif: groupe price_${c.pricing_group || '10'}. ID: ${c.id}`
            ).join('\n');

            toolResponses.push({
              toolCallId,
              result: `Profils trouvés :\n${resultsText}\n\nMémorisez le "Tarif: groupe price_XX" du client pour la consultation des prix, et l'ID pour prendre la commande.`
            });
          }
        }

        if (functionName === 'getProductPrices') {
          const { search_query = '', price_column = 'price_10' } = args;

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
              const priceVal = p[actualColumn] ? formatPriceFrench(p[actualColumn]) : "Prix non défini";
              const cleanedName = cleanProductName(p.name);
              return `- ${cleanedName} (ID: ${p.id}) : ${priceVal}. (Stock restant: ${p.stock_quantity})`;
            }).join('\n');
            
            toolResponses.push({
              toolCallId,
              result: `Voici les produits trouvés :\n${resultsText}\n\nDonnez le prix au client.`
            });
          }
        }

        if (functionName === 'submitOrder') {
          const { client_id, items } = args;
          
          if (!items || !Array.isArray(items) || items.length === 0) {
            console.warn('submitOrder tool called with empty or invalid items:', items);
            toolResponses.push({
              toolCallId,
              result: "La commande ne contient aucun article valide. Veuillez d'abord rechercher le poisson avec getProductPrices pour obtenir son ID et son prix, puis soumettre la commande avec la quantité souhaitée."
            });
          } else {
            let total_price = 0;
            let hasInvalidItems = false;

            for (const item of items) {
              if (!item || typeof item !== 'object') {
                hasInvalidItems = true;
                break;
              }
              const qty = Number(item.quantity);
              const price = Number(item.unit_price);
              
              if (!item.product_id || isNaN(qty) || isNaN(price) || qty <= 0) {
                hasInvalidItems = true;
                break;
              }
              total_price += (qty * price);
            }

            if (hasInvalidItems) {
              console.warn('submitOrder tool called with invalid item structure:', items);
              toolResponses.push({
                toolCallId,
                result: "Certains articles de la commande contiennent des données manquantes ou invalides (ID produit, quantité ou prix). Veuillez vous assurer de chercher les produits d'abord."
              });
            } else {
              // Create order
              const { data: order, error: orderError } = await supabaseAdmin
                .from('orders')
                .insert({
                  client_id: (!client_id || client_id === 'anonymous') ? null : client_id,
                  total_price,
                  status: 'pending'
                })
                .select()
                .single();

              if (orderError) {
                 console.error('Order creation error:', orderError);
                 toolResponses.push({
                   toolCallId,
                   result: `Erreur technique lors de l'enregistrement de la commande.`
                 });
              } else {
                // Insert items
                const orderItemsInsert = items.map((i: any) => ({
                  order_id: order.id,
                  product_id: i.product_id,
                  quantity: Number(i.quantity),
                  unit_price: Number(i.unit_price)
                }));
                
                const { error: itemsErr } = await supabaseAdmin.from('order_items').insert(orderItemsInsert);
                
                if (itemsErr) {
                  console.error('Order items insertion error:', itemsErr);
                  toolResponses.push({
                    toolCallId,
                    result: `Commande ${order.id} créée, mais erreur lors de l'enregistrement des articles.`
                  });
                } else {
                  toolResponses.push({
                    toolCallId,
                    result: `Commande créée avec succès. ID: ${order.id}. Total: ${formatPriceFrench(total_price)}.`
                  });
                }
              }
            }
          }
        }

        if (functionName === 'askFishExpertise') {
          const { question = '', client_type } = args;
          const clientType = client_type || 'pro'; // Par défaut pro

          // Nettoyage de la question pour enlever accents et ponctuations
          const cleanQ = question.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

          // 1. Détection rapide par mots-clés des poissons connus (du plus spécifique au plus général)
          const compoundFishes = [
            // 1. SAUMON
            { key: 'saumon des iles feroe', term: 'Saumon des Îles Féroé' },
            { key: 'saumon feroe', term: 'Saumon des Îles Féroé' },
            { key: 'saumon des feroe', term: 'Saumon des Îles Féroé' },
            { key: 'saumon de norvege', term: 'Saumon de Norvège' },
            { key: 'saumon norvege', term: 'Saumon de Norvège' },
            { key: 'saumon d\'ecosse', term: 'Saumon d\'Ecosse' },
            { key: 'saumon ecosse', term: 'Saumon d\'Ecosse' },
            { key: 'saumon atlantique d\'elevage', term: 'Saumon Atlantique d\'élevage' },
            { key: 'saumon d\'elevage', term: 'Saumon Atlantique d\'élevage' },
            { key: 'atlantische zalm', term: 'Saumon Atlantique d\'élevage' },
            { key: 'saumon atlantique', term: 'Saumon Atlantique d\'élevage' },
            { key: 'saumon', term: 'Saumon d\'Ecosse' },

            // 2. CABILLAUD
            { key: 'cabillaud des iles feroe', term: 'Cabillaud des Îles Féroé' },
            { key: 'cabillaud feroe', term: 'Cabillaud des Îles Féroé' },
            { key: 'cabillaud des feroe', term: 'Cabillaud des Îles Féroé' },
            { key: 'cabillaud de norvege', term: 'Skrei / Cabillaud de Norvège' },
            { key: 'cabillaud norvege', term: 'Skrei / Cabillaud de Norvège' },
            { key: 'skrei', term: 'Skrei / Cabillaud de Norvège' },
            { key: 'cabillaud d\'islande', term: 'Cabillaud d\'Islande' },
            { key: 'cabillaud islande', term: 'Cabillaud d\'Islande' },
            { key: 'cabillaud', term: 'Cabillaud' },

            // 3. SÉBASTE
            { key: 'sebaste des iles feroe', term: 'Sébaste des Îles Féroé' },
            { key: 'sebaste feroe', term: 'Sébaste des Îles Féroé' },
            { key: 'sebaste des feroe', term: 'Sébaste des Îles Féroé' },
            { key: 'sebaste d\'islande', term: 'Sébaste d\'Islande' },
            { key: 'sebaste islande', term: 'Sébaste d\'Islande' },
            { key: 'sebaste', term: 'Sébaste des Îles Féroé' },

            // 4. AIGLEFIN / ÉGLETIN
            { key: 'aiglefin des cotes ecossaises', term: 'Aiglefin des côtes écossaises et anglaises' },
            { key: 'aiglefin ecossais', term: 'Aiglefin des côtes écossaises et anglaises' },
            { key: 'aiglefin anglais', term: 'Aiglefin des côtes écossaises et anglaises' },
            { key: 'aiglefin d\'islande', term: 'Aiglefin / Égletin d\'Islande' },
            { key: 'aiglefin islande', term: 'Aiglefin / Égletin d\'Islande' },
            { key: 'eglefin d\'islande', term: 'Aiglefin / Égletin d\'Islande' },
            { key: 'eglefin islande', term: 'Aiglefin / Égletin d\'Islande' },
            { key: 'egletin d\'islande', term: 'Aiglefin / Égletin d\'Islande' },
            { key: 'egletin islande', term: 'Aiglefin / Égletin d\'Islande' },
            { key: 'aiglefin', term: 'Aiglefin des côtes écossaises et anglaises' },
            { key: 'eglefin', term: 'Aiglefin des côtes écossaises et anglaises' },
            { key: 'egletin', term: 'Aiglefin des côtes écossaises et anglaises' },
            { key: 'haddock', term: 'Aiglefin des côtes écossaises et anglaises' },

            // 5. LIEU
            { key: 'lieu jaune des cotes anglaises', term: 'Lieu jaune des côtes anglaises' },
            { key: 'lieu jaune anglais', term: 'Lieu jaune des côtes anglaises' },
            { key: 'lieu jaune de ligne', term: 'Lieu jaune des côtes anglaises' },
            { key: 'lieu jaune de cornouailles', term: 'Lieu jaune des côtes anglaises' },
            { key: 'lieu jaune', term: 'Lieu jaune des côtes anglaises' },
            { key: 'colin anglais', term: 'Lieu jaune des côtes anglaises' },
            { key: 'colin de ligne', term: 'Lieu jaune des côtes anglaises' },
            { key: 'pollack', term: 'Lieu jaune des côtes anglaises' },
            { key: 'lieu noir', term: 'Lieu noir' },
            { key: 'colin', term: 'Lieu jaune des côtes anglaises' },
            { key: 'lieu', term: 'Lieu jaune des côtes anglaises' },

            // 6. TURBOT
            { key: 'turbot sauvage de la mer du nord', term: 'Turbot sauvage de la Mer du Nord' },
            { key: 'turbot de la mer du nord', term: 'Turbot sauvage de la Mer du Nord' },
            { key: 'turbot de hollande', term: 'Turbot sauvage de la Mer du Nord' },
            { key: 'turbot hollandais', term: 'Turbot sauvage de la Mer du Nord' },
            { key: 'tarbot', term: 'Turbot sauvage de la Mer du Nord' },
            { key: 'turbot de la manche anglaise', term: 'Turbot de la Manche anglaise' },
            { key: 'turbot de la manche', term: 'Turbot de la Manche anglaise' },
            { key: 'turbot anglais', term: 'Turbot de la Manche anglaise' },
            { key: 'turbotine', term: 'Turbot de la Manche anglaise' },
            { key: 'turbot de zelande d\'elevage', term: 'Turbot d\'élevage' },
            { key: 'turbot d\'elevage', term: 'Turbot d\'élevage' },
            { key: 'turbot', term: 'Turbot sauvage de la Mer du Nord' },

            // 7. ROUGET-BARBET
            { key: 'rouget barbet de cornouailles', term: 'Rouget-barbet de Cornouailles' },
            { key: 'rouget barbet', term: 'Rouget-barbet de Cornouailles' },
            { key: 'rouget de cornouailles', term: 'Rouget-barbet de Cornouailles' },
            { key: 'rode mul', term: 'Rouget-barbet de Cornouailles' },
            { key: 'red mullet', term: 'Rouget-barbet de Cornouailles' },
            { key: 'rouget', term: 'Rouget-barbet de Cornouailles' },

            // 8. FLET
            { key: 'flet commun de hollande', term: 'Flet commun de Hollande' },
            { key: 'flet de hollande', term: 'Flet commun de Hollande' },
            { key: 'flet commun', term: 'Flet commun de Hollande' },
            { key: 'flet', term: 'Flet commun de Hollande' },
            { key: 'bot', term: 'Flet commun de Hollande' },

            // 9. TACAUD / TAREG
            { key: 'tacaud commun des pays bas', term: 'Tacaud commun des Pays-Bas' },
            { key: 'tacaud commun', term: 'Tacaud commun des Pays-Bas' },
            { key: 'tacaud', term: 'Tacaud commun des Pays-Bas' },
            { key: 'tareg', term: 'Tacaud commun des Pays-Bas' },
            { key: 'gade de hollande', term: 'Tacaud commun des Pays-Bas' },
            { key: 'steenbolk', term: 'Tacaud commun des Pays-Bas' },

            // 10. HARENG
            { key: 'hareng hollandse nieuwe', term: 'Hareng Hollandse Nieuwe / Matjes' },
            { key: 'hareng nouveau', term: 'Hareng Hollandse Nieuwe / Matjes' },
            { key: 'hareng commun', term: 'Hareng Hollandse Nieuwe / Matjes' },
            { key: 'matjes', term: 'Hareng Hollandse Nieuwe / Matjes' },
            { key: 'haring', term: 'Hareng Hollandse Nieuwe / Matjes' },
            { key: 'hareng', term: 'Hareng Hollandse Nieuwe / Matjes' },

            // 11. SOLE
            { key: 'sole de la mer du nord', term: 'Sole de la Mer du Nord / Noordzeetong' },
            { key: 'sole hollandaise', term: 'Sole de la Mer du Nord / Noordzeetong' },
            { key: 'sole de hollande', term: 'Sole de la Mer du Nord / Noordzeetong' },
            { key: 'noordzeetong', term: 'Sole de la Mer du Nord / Noordzeetong' },
            { key: 'tong', term: 'Sole de la Mer du Nord / Noordzeetong' },
            { key: 'sole', term: 'Sole de la Mer du Nord / Noordzeetong' },

            // 12. BAR
            { key: 'bar de zelande', term: 'Bar de Zélande' },
            { key: 'bar hollandais', term: 'Bar de Zélande' },
            { key: 'bar d\'elevage de turquie', term: 'Bar d\'élevage de Turquie' },
            { key: 'bar de turquie', term: 'Bar d\'élevage de Turquie' },
            { key: 'bar d\'elevage', term: 'Bar d\'élevage de Turquie' },
            { key: 'turkse zeebaars', term: 'Bar d\'élevage de Turquie' },
            { key: 'loup de mer d\'aquaculture', term: 'Bar d\'élevage de Turquie' },
            { key: 'zeebaars', term: 'Bar de Zélande' },
            { key: 'bar', term: 'Bar de ligne' },

            // 13. LIMANDE
            { key: 'limande commune des iles de la frise', term: 'Limande commune des îles de la Frise' },
            { key: 'limande de la frise', term: 'Limande commune des îles de la Frise' },
            { key: 'limande commune', term: 'Limande commune des îles de la Frise' },
            { key: 'schar', term: 'Limande commune des îles de la Frise' },
            { key: 'limande', term: 'Limande commune des îles de la Frise' },

            // 14. LANGOUSTINE
            { key: 'langoustine cotiere', term: 'Langoustine côtière' },
            { key: 'noorse kreeft', term: 'Langoustine côtière' },
            { key: 'dublin bay prawn', term: 'Langoustine côtière' },
            { key: 'gatte', term: 'Langoustine côtière' },
            { key: 'demoiselle de la mer', term: 'Langoustine côtière' },
            { key: 'langoustine', term: 'Langoustine côtière' },

            // 15. HOMARD
            { key: 'homard bleu', term: 'Homard européen / bleu' },
            { key: 'homard europeen', term: 'Homard européen / bleu' },
            { key: 'homard de zelande', term: 'Homard européen / bleu' },
            { key: 'oosterscheldekreeft', term: 'Homard européen / bleu' },
            { key: 'homard', term: 'Homard européen / bleu' },

            // 16. HUÎTRE PLATE
            { key: 'huitres plates de zelande', term: 'Huître plate de Zélande' },
            { key: 'huitre plate de zelande', term: 'Huître plate de Zélande' },
            { key: 'huitres plates d\'elevage', term: 'Huître d\'élevage' },
            { key: 'huitre plate d\'elevage', term: 'Huître d\'élevage' },
            { key: 'huitres plates', term: 'Huître plate de Zélande' },
            { key: 'huitre plate', term: 'Huître plate de Zélande' },
            { key: 'zeeuwse platte oester', term: 'Huître plate de Zélande' },
            { key: 'zeeuwse platte', term: 'Huître plate de Zélande' },
            { key: 'belon', term: 'Huître plate de Zélande' },

            // 17. HUÎTRE CREUSE
            { key: 'huitres creuses de zelande', term: 'Huître creuse "Creuse de Zélande"' },
            { key: 'huitre creuse de zelande', term: 'Huître creuse "Creuse de Zélande"' },
            { key: 'creuse de zelande', term: 'Huître creuse "Creuse de Zélande"' },
            { key: 'zeeuwse creuse', term: 'Huître creuse "Creuse de Zélande"' },
            { key: 'creuse de bretagne', term: 'Huître creuse "Creuse de Zélande"' },
            { key: 'creuse de marennes', term: 'Huître creuse "Creuse de Zélande"' },
            { key: 'huitres creuses d\'elevage', term: 'Huître d\'élevage' },
            { key: 'huitre creuse d\'elevage', term: 'Huître d\'élevage' },
            { key: 'huitres creuses', term: 'Huître creuse "Creuse de Zélande"' },
            { key: 'huitre creuse', term: 'Huître creuse "Creuse de Zélande"' },
            { key: 'creuse', term: 'Huître creuse "Creuse de Zélande"' },
            { key: 'huitres d\'elevage', term: 'Huître d\'élevage' },
            { key: 'huitre d\'elevage', term: 'Huître d\'élevage' },
            { key: 'zeeuwse oesters', term: 'Huître d\'élevage' },
            { key: 'zeeuwse oester', term: 'Huître d\'élevage' },
            { key: 'huitres', term: 'Huître creuse "Creuse de Zélande"' },
            { key: 'huitre', term: 'Huître creuse "Creuse de Zélande"' },

            // 18. COQUILLE SAINT-JACQUES
            { key: 'coquille saint jacques sauvage', term: 'Coquille Saint-Jacques sauvage' },
            { key: 'coquille saint jacques', term: 'Coquille Saint-Jacques sauvage' },
            { key: 'saint jacques sauvage', term: 'Coquille Saint-Jacques sauvage' },
            { key: 'saint jacques', term: 'Coquille Saint-Jacques sauvage' },
            { key: 'noix de saint jacques', term: 'Coquille Saint-Jacques sauvage' },
            { key: 'sint jacobsschelp', term: 'Coquille Saint-Jacques sauvage' },
            { key: 'pecten maximus', term: 'Coquille Saint-Jacques sauvage' },

            // 19. MOULE
            { key: 'moules de zelande', term: 'Moules de Zélande' },
            { key: 'moule de zelande', term: 'Moules de Zélande' },
            { key: 'moules d\'elevage', term: 'Moules d\'élevage' },
            { key: 'moule d\'elevage', term: 'Moules d\'élevage' },
            { key: 'moules de bouchot', term: 'Moules d\'élevage' },
            { key: 'moule de bouchot', term: 'Moules d\'élevage' },
            { key: 'moules de corde', term: 'Moules d\'élevage' },
            { key: 'moule de corde', term: 'Moules d\'élevage' },
            { key: 'zeeuwse mosselen', term: 'Moules de Zélande' },
            { key: 'mosselen', term: 'Moules de Zélande' },
            { key: 'moules', term: 'Moules de Zélande' },
            { key: 'moule', term: 'Moules de Zélande' },

            // 20. PALOURDE
            { key: 'palourde sauvage', term: 'Palourde européenne' },
            { key: 'palourde croisee d\'europe', term: 'Palourde européenne' },
            { key: 'palourde croisee', term: 'Palourde européenne' },
            { key: 'palourde d\'europe', term: 'Palourde européenne' },
            { key: 'tapijtschelp', term: 'Palourde européenne' },
            { key: 'palourde', term: 'Palourde européenne' },

            // 21. COUTEAU
            { key: 'couteau silhouette', term: 'Couteau d\'Europe' },
            { key: 'couteau d\'europe', term: 'Couteau d\'Europe' },
            { key: 'scheermes', term: 'Couteau d\'Europe' },
            { key: 'razor clam', term: 'Couteau d\'Europe' },
            { key: 'couteau', term: 'Couteau d\'Europe' },

            // 22. COQUE
            { key: 'coque commune', term: 'Coque commune' },
            { key: 'sourdon', term: 'Coque commune' },
            { key: 'kokkel', term: 'Coque commune' },
            { key: 'coque', term: 'Coque commune' },

            // 23. BULOT
            { key: 'buccin', term: 'Bulot / buccin' },
            { key: 'tourtot', term: 'Bulot / buccin' },
            { key: 'wulk', term: 'Bulot / buccin' },
            { key: 'bulot', term: 'Bulot / buccin' },

            // 24. AMANDE DE MER
            { key: 'dog cockle', term: 'Amande de mer' },
            { key: 'petoncle de chien', term: 'Amande de mer' },
            { key: 'almande', term: 'Amande de mer' },
            { key: 'amande de mer', term: 'Amande de mer' },
            { key: 'amande', term: 'Amande de mer' },

            // 25. PÉTONCLE
            { key: 'petoncle blanc', term: 'Pétoncle noir ou blanc' },
            { key: 'petoncle noir', term: 'Pétoncle noir ou blanc' },
            { key: 'wijde mantel', term: 'Pétoncle noir ou blanc' },
            { key: 'vanneau', term: 'Pétoncle noir ou blanc' },
            { key: 'petoncle', term: 'Pétoncle noir ou blanc' },

            // 26. BIGORNEAU
            { key: 'alikruik', term: 'Bigorneau' },
            { key: 'periwinkle', term: 'Bigorneau' },
            { key: 'vignot', term: 'Bigorneau' },
            { key: 'brigaud', term: 'Bigorneau' },
            { key: 'littorina littorea', term: 'Bigorneau' },
            { key: 'bigorneau', term: 'Bigorneau' },

            // 27. AUTRES ESPÈCES BELGES ET NORDIQUES
            { key: 'loup de mer atlantique', term: 'Loup anarhique' },
            { key: 'loup de mer', term: 'Loup anarhique' },
            { key: 'loup anarhique', term: 'Loup anarhique' },
            { key: 'fletan noir', term: 'Flétan' },
            { key: 'fletan du groenland', term: 'Flétan' },
            { key: 'fletan', term: 'Flétan' },
            { key: 'lingue bleue', term: 'Lingue bleue' },
            { key: 'lingue', term: 'Lingue bleue' },
            { key: 'elingue', term: 'Lingue' },
            { key: 'grondin rouge', term: 'Grondin' },
            { key: 'coucou de mer', term: 'Grondin' },
            { key: 'grondin', term: 'Grondin' },
            { key: 'carrelet', term: 'Carrelet' },
            { key: 'plie', term: 'Plie' },
            { key: 'raie', term: 'Raie' },
            { key: 'cardine', term: 'Cardine' },
            { key: 'maquereau', term: 'Maquereau' },
            { key: 'merlan', term: 'Merlan' },

            // 28. DAURADE ROYALE DE TURQUIE
            { key: 'daurade royale de turquie', term: 'Daurade royale de Turquie' },
            { key: 'dorade royale de turquie', term: 'Daurade royale de Turquie' },
            { key: 'daurade de turquie', term: 'Daurade royale de Turquie' },
            { key: 'dorade de turquie', term: 'Daurade royale de Turquie' },
            { key: 'turkse goudbrasem', term: 'Daurade royale de Turquie' },
            { key: 'daurade turque', term: 'Daurade royale de Turquie' },
            { key: 'dorade turque', term: 'Daurade royale de Turquie' },
            { key: 'daurade royale', term: 'Daurade royale de Turquie' },
            { key: 'dorade royale', term: 'Daurade royale de Turquie' },
            { key: 'daurade', term: 'Daurade royale de Turquie' },
            { key: 'dorade', term: 'Daurade royale de Turquie' },

            // 29. TRUITE ARC-EN-CIEL
            { key: 'truite arc en ciel', term: 'Truite arc-en-ciel' },
            { key: 'truite saumonee', term: 'Truite arc-en-ciel' },
            { key: 'regenboogforel', term: 'Truite arc-en-ciel' },
            { key: 'truite de riviere', term: 'Truite arc-en-ciel' },
            { key: 'truite', term: 'Truite arc-en-ciel' },

            // 30. ESTURGEON D'ÉLEVAGE
            { key: 'esturgeon d\'elevage', term: 'Esturgeon d\'élevage' },
            { key: 'esturgeon de chimay', term: 'Esturgeon d\'élevage' },
            { key: 'caviar europeen', term: 'Esturgeon d\'élevage' },
            { key: 'esturgeon', term: 'Esturgeon d\'élevage' },
            { key: 'steur', term: 'Esturgeon d\'élevage' }
          ];

          let matchedTerm = '';
          for (const item of compoundFishes) {
            if (cleanQ.includes(item.key)) {
              matchedTerm = item.term;
              break;
            }
          }

          let fact = null;
          if (matchedTerm) {
            // Recherche par le poisson matché
            const { data } = await supabaseAdmin
              .from('products_knowledge')
              .select('*')
              .ilike('product_name', `%${matchedTerm}%`)
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
        
        } catch (toolErr: any) {
          console.error(`Error processing tool call ${functionName} (${toolCallId}):`, toolErr);
          toolResponses.push({
            toolCallId,
            result: `Une erreur technique est survenue lors de l'exécution de l'outil ${functionName}.`
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
