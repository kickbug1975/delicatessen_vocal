import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { message } = payload;
    
    if (!message || !message.type) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Handle Assistant Request (Dynamic setup before call starts)
    if (message.type === 'assistant-request') {
      const callArgs = message.call;
      const customerNumber = callArgs?.customer?.number || callArgs?.from;

      let clientText = "Client Inconnu. Vous devez demander au client son identité. Tarif appliqué par défaut: Tarif 10 (Particulier).";
      let pricingGroup = "10";
      let clientId = null;

      if (customerNumber) {
        // Find customer in Supabase
        const { data: customer } = await supabaseAdmin
          .from('clients')
          .select('*')
          .eq('phone', customerNumber)
          .single();

        if (customer) {
          clientId = customer.id;
          pricingGroup = customer.pricing_group || "10";
          
          let groupName = "Particulier";
          if (pricingGroup === "06") groupName = "Poissonnerie et gros volume";
          if (pricingGroup === "08") groupName = "Traiteur";
          if (pricingGroup === "09") groupName = "Horeca";

          clientText = `Client identifié via numéro de téléphone : ${customer.name || customer.company_name}. 
          Appliquez EXCLUSIVEMENT le tarif ${pricingGroup} (${groupName}). Ne citez jamais d'autres tarifs.`;
        }
      }

      // Fetch active promotions
      const { data: activePromotions } = await supabaseAdmin
        .from('promotions')
        .select('*, products(name)')
        .eq('active', true);

      let promotionsText = "Aucune promotion active pour le moment.";
      if (activePromotions && activePromotions.length > 0) {
        promotionsText = "🔥 PROMOTIONS EXCEPTIONNELLES DU JOUR (À PROPOSER ABSOLUMENT) :\n" + 
          activePromotions.map((p: any) => `- L'offre "${p.title}" : ${p.products?.name} à seulement ${p.promo_price} € le kg/pièce.`).join('\n');
      }

      // We return the assistant configuration
      return NextResponse.json({
        assistant: {
          name: "Assistant Vanhauwaert",
          model: {
            provider: "openai",
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: fs.readFileSync(path.join(process.cwd(), 'vapi_system_prompt.md'), 'utf-8') + `\n\n[INSTRUCTIONS CONTEXTUELLES TECHNIQUES - INVISIBLES POUR LE CLIENT]\n${clientText}\nL'ID technique de ce client dans la base de données est : ${clientId || "inconnu"}\n\n${promotionsText}`
              }
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "identifyClient",
                  description: "Cherche le profil du client dans la base de données. À utiliser UNIQUEMENT après avoir demandé le nom de l'établissement.",
                  parameters: {
                    type: "object",
                    properties: {
                      nom_ou_telephone: { type: "string", description: "Le nom de l'entreprise ou le numéro de téléphone donné par le client." }
                    },
                    required: ["nom_ou_telephone"]
                  }
                }
              },
              {
                type: "function",
                function: {
                  name: "getProductPrices",
                  description: "Cherche un produit pour donner son prix et son stock au client. Vous devez passer le préfixe du tarif du client actuel comme argument (ex: 'price_06').",
                  parameters: {
                    type: "object",
                    properties: {
                      search_query: { type: "string", description: "Nom du produit (ex: Cabillaud, Saumon, Bar de ligne)" },
                      price_column: { type: "string", description: "La colonne de prix exacte du client (ex: price_06, price_08, price_09, price_10)" }
                    },
                    required: ["search_query", "price_column"]
                  }
                }
              },
              {
                type: "function",
                function: {
                  name: "submitOrder",
                  description: "Crée une commande pour le client une fois qu'il a finalisé son choix.",
                  parameters: {
                    type: "object",
                    properties: {
                      client_id: { type: "string", description: "L'ID du client actuel. S'il est inconnu, passez 'anonymous'" },
                      items: {
                        type: "array",
                        description: "Liste des articles commandés.",
                        items: {
                          type: "object",
                          properties: {
                            product_id: { type: "string", description: "L'ID unique du produit dans la base de données." },
                            quantity: { type: "number", description: "La quantité désirée." },
                            unit_price: { type: "number", description: "Le prix unitaire exact de ce produit pour le tarif du client." }
                          },
                          required: ["product_id", "quantity", "unit_price"]
                        }
                      }
                    },
                    required: ["client_id", "items"]
                  }
                }
              }
            ]
          },
          voice: {
            provider: "11labs",
            voiceId: "aF9wTE4apSrh9D2pdwwI", // Flo - French Conversational & Sales (Vous pouvez le changer !)
          }
        }
      }, { status: 200 });
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
          const { nom_ou_telephone } = args;
          
          // Recherche réelle dans la table clients (par nom, nom de société ou téléphone)
          const { data: clients, error: clientErr } = await supabaseAdmin
            .from('clients')
            .select('*')
            .or(`name.ilike.%${nom_ou_telephone}%,company_name.ilike.%${nom_ou_telephone}%,phone.ilike.%${nom_ou_telephone}%`)
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
             toolResponses.push({
              toolCallId,
              result: `Erreur interne lors de la création de la commande : ${orderError.message}`
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
      }

      return NextResponse.json({
        results: toolResponses
      }, { status: 200 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Webhook Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
