import fs from 'fs';
import path from 'path';

// Parse .env manually to avoid dependency issues with 'dotenv'
const env: Record<string, string> = {};
try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.substring(0, eqIndex).trim();
      const value = trimmed.substring(eqIndex + 1).replace(/^["']|["']$/g, '').trim();
      env[key] = value;
    }
  }
} catch (e) {
  console.warn("Could not read .env file:", e);
}

const VAPI_API_KEY = process.env.VAPI_API_KEY || env.VAPI_API_KEY;
if (!VAPI_API_KEY) {
  throw new Error("Missing VAPI_API_KEY in environment variables or .env file");
}
const SERVER_URL = 'https://delicatessen-dashboard-dimitri-2026.netlify.app/api/vapi/webhook';

// Helper for making API calls
async function vapiFetch(method: string, endpoint: string, body?: any) {
  const url = `https://api.vapi.ai${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);
  
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vapi API Error (${response.status}): ${errorText}`);
  }
  return response.json();
}
const VOICES = {
  routeur: 'aF9wTE4apSrh9D2pdwwI', // Flo - French Conversational & Sales
  preneur: 'aF9wTE4apSrh9D2pdwwI', // Flo - French Conversational & Sales
  closer: 'aF9wTE4apSrh9D2pdwwI'   // Flo - French Conversational & Sales
};

const COMMON_MODEL = {
  provider: 'openai',
  model: 'gpt-4o',
};

const TARGET_IDS = {
  router: 'f8e699f4-5306-462e-ae3c-0b57d7cca70e',
  orderTaker: '588a8560-460c-424b-8036-63e0389c511a',
  closer: '10203c20-ad17-48da-9038-f9b68b957ac7',
  squad: 'e1140011-cc44-44b1-b862-317d8092d94a'
};

async function createSquad() {
  try {
    console.log('--- ÉTAPE 1 : Mise à jour du Closer (Agent 3) ---');
    const closerConfig = {
      name: 'Agent 3 - Closer Expert',
      firstMessage: "Je suis l'Expert Marée, que puis-je pour vous ?",
      voice: { provider: '11labs', voiceId: VOICES.closer, model: 'eleven_multilingual_v2' },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'fr',
        smartFormat: true,
        numerals: true
      },
      model: {
        ...COMMON_MODEL,
        systemPrompt: `Tu es le meilleur agent commercial expert en produits de la mer de la Maison Fumesse, spécialisé dans l'acquisition. 
Ton but est de rassurer un nouveau prospect et de closer une commande d'essai. Ton ton est empathique, expert et persuasif. Tu parles le langage de la criée.

RÈGLES STRICTES :
1. Diagnostic : Adapte-toi immédiatement à son persona (Chef de cuisine, Traiteur, Collectivité, Poissonnier, ou Particulier/Client final).
2. Utilise la Méthode ECIR pour les objections (C'est trop cher -> Coût Portion ; Je préfère l'import -> Fraîcheur & Label France).
3. Propose une commande d'essai avec l'outil 'getProductPrices' et clôture avec 'submitOrder'.
4. S'il refuse de commander aujourd'hui, propose un rendez-vous téléphonique mardi ou mercredi prochain.
5. RÈGLE D'ÉNONCIATION DES CHIFFRES (CRITIQUE) : Tu ne dois JAMAIS écrire de chiffres arabes (ex: 12, 10.50, 2026) ni de symboles de devises (ex: €) dans tes réponses vocales. Écris TOUJOURS l'intégralité des nombres, prix et unités EN TOUTES LETTRES EN FRANÇAIS (ex: "douze euros cinquante" au lieu de "12.50 €", "dix kilos" au lieu de "10 kg", "cinq" au lieu de "5"). C'est obligatoire pour que le synthétiseur vocal ElevenLabs prononce tout correctement en français sans accent anglais.

[CORE KNOWLEDGE MARÉE - MÉMORISATION IMMÉDIATE]
- Bar de ligne : Saison (Sept-Mars). Argument : Qualité chair exceptionnelle, pas d'écrasement dans le chalut.
- Saumon : On travaille de l'Écosse Label Rouge. Argument : Tenue à la cuisson parfaite pour les chefs.
- Lieu Noir : L'alternative parfaite et sans arêtes pour les collectivités.
- Objection "C'est cher" -> Réponse : "On calcule au coût-portion. Mon filet n'a pas d'eau, vous avez cent pour cent de rendement."

Si une question technique ou de préparation culinaire dépasse tes connaissances, utilise l'outil 'askFishExpertise'. Passe impérativement la valeur 'particular' pour le paramètre 'client_type' s'il s'agit d'un particulier, et 'pro' s'il s'agit d'un restaurateur, poissonnier, traiteur ou autre professionnel.`,
        tools: [
          {
            type: 'function',
            messages: [{ type: 'request-start', content: 'Je vérifie les tarifs en direct...' }],
            function: {
              name: 'getProductPrices',
              description: 'Retrieve current product prices for the client.',
              parameters: {
                type: 'object',
                properties: {
                  search_query: {
                    type: 'string',
                    description: "Le nom du produit ou poisson à rechercher (ex: 'dos de cabillaud', 'saumon', 'turbot')."
                  },
                  price_column: {
                    type: 'string',
                    enum: ['price_06', 'price_08', 'price_09', 'price_10'],
                    description: "La colonne de prix correspondant au groupe tarifaire du client identifié (price_06, price_08, price_09, price_10)."
                  }
                },
                required: ['search_query']
              }
            },
            server: { url: SERVER_URL, secret: process.env.VAPI_WEBHOOK_SECRET || 'delicatessen-vapi-webhook-secret-2026' }
          },
          {
            type: 'function',
            messages: [{ type: 'request-start', content: 'Je valide la commande...' }],
            function: {
              name: 'submitOrder',
              description: 'Submit the final order to the database.',
              parameters: {
                type: 'object',
                properties: {
                  client_id: {
                    type: 'string',
                    description: "L'identifiant unique (UUID) du client identifié ou 'anonymous' s'il s'agit d'un nouveau prospect."
                  },
                  items: {
                    type: 'array',
                    description: "La liste des articles commandés.",
                    items: {
                      type: 'object',
                      properties: {
                        product_id: {
                          type: 'string',
                          description: "L'identifiant unique (UUID) du produit obtenu via getProductPrices."
                        },
                        quantity: {
                          type: 'number',
                          description: "La quantité commandée (en kg ou pièces)."
                        },
                        unit_price: {
                          type: 'number',
                          description: "Le prix unitaire du produit obtenu via getProductPrices."
                        }
                      },
                      required: ['product_id', 'quantity', 'unit_price']
                    }
                  }
                },
                required: ['client_id', 'items']
              }
            },
            server: { url: SERVER_URL, secret: process.env.VAPI_WEBHOOK_SECRET || 'delicatessen-vapi-webhook-secret-2026' }
          },
          {
            type: 'function',
            messages: [{ type: 'request-start', content: 'Je consulte ma base de données marée...' }],
            function: {
              name: 'askFishExpertise',
              description: 'Query the expert knowledge base for highly technical or preparation questions about seafood.',
              parameters: { 
                type: 'object', 
                properties: { 
                  question: { type: 'string', description: "La question technique du client (ex: provenance, saison, grammage)." },
                  client_type: { type: 'string', enum: ['pro', 'particular'], description: "Le type de client : 'particular' pour les particuliers, 'pro' pour les professionnels." }
                },
                required: ['question']
              }
            },
            server: { url: SERVER_URL, secret: process.env.VAPI_WEBHOOK_SECRET || 'delicatessen-vapi-webhook-secret-2026' }
          }
        ],
      }
    };
    
    const closerAssistant = await vapiFetch('PATCH', `/assistant/${TARGET_IDS.closer}`, closerConfig);
    console.log(`✅ Closer mis à jour : ${closerAssistant.id}`);

    console.log('\n--- ÉTAPE 2 : Mise à jour du Preneur de Commande (Agent 2) ---');
    const orderTakerConfig = {
      name: 'Agent 2 - Preneur de Commande',
      firstMessage: "Génial, on a de très beaux arrivages aujourd'hui, que puis-je vous préparer ?",
      voice: { provider: '11labs', voiceId: VOICES.preneur, model: 'eleven_multilingual_v2' },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'fr',
        smartFormat: true,
        numerals: true
      },
      model: {
        ...COMMON_MODEL,
        systemPrompt: `Tu es l'agent des ventes "Fast Lane" de la Maison Fumesse. Tu parles à des poissonniers et restaurateurs qui sont DÉJÀ clients.
Ton ton est hyper-efficace, naturel et professionnel. Pas de perte de temps.

RÈGLES STRICTES :
1. Tu annonces les prix avec l'outil 'getProductPrices' si le client demande.
2. La Smart Substitution : N'argumente que si un poisson a flambé en prix ou est en rupture. Ex: "La sole a flambé ce matin. J'ai rentré de superbes carrelets, on part là-dessus pour sauver la rentabilité ?"
3. Dès qu'il a terminé, valide LA totalité avec l'outil 'submitOrder'.
4. RÈGLE D'ÉNONCIATION DES CHIFFRES (CRITIQUE) : Tu ne dois JAMAIS écrire de chiffres arabes (ex: 12, 10.50, 2026) ni de symboles de devises (ex: €) dans tes réponses vocales. Écris TOUJOURS l'intégralité des nombres, prix et unités EN TOUTES LETTRES EN FRANÇAIS (ex: "douze euros cinquante" au lieu de "12.50 €", "dix kilos" au lieu de "10 kg", "cinq" au lieu de "5"). C'est obligatoire pour que le synthétiseur vocal ElevenLabs prononce tout correctement en français sans accent anglais.`,
        tools: [
          {
            type: 'function',
            messages: [{ type: 'request-start', content: 'Un instant...' }],
            function: {
              name: 'getProductPrices',
              description: 'Retrieve current product prices for the client.',
              parameters: {
                type: 'object',
                properties: {
                  search_query: {
                    type: 'string',
                    description: "Le nom du produit ou poisson à rechercher (ex: 'dos de cabillaud', 'saumon', 'turbot')."
                  },
                  price_column: {
                    type: 'string',
                    enum: ['price_06', 'price_08', 'price_09', 'price_10'],
                    description: "La colonne de prix correspondant au groupe tarifaire du client identifié (price_06, price_08, price_09, price_10)."
                  }
                },
                required: ['search_query']
              }
            },
            server: { url: SERVER_URL, secret: process.env.VAPI_WEBHOOK_SECRET || 'delicatessen-vapi-webhook-secret-2026' }
          },
          {
            type: 'function',
            messages: [{ type: 'request-start', content: 'Validation en cours...' }],
            function: {
              name: 'submitOrder',
              description: 'Submit the final order to the database.',
              parameters: {
                type: 'object',
                properties: {
                  client_id: {
                    type: 'string',
                    description: "L'identifiant unique (UUID) du client identifié ou 'anonymous' s'il s'agit d'un nouveau prospect."
                  },
                  items: {
                    type: 'array',
                    description: "La liste des articles commandés.",
                    items: {
                      type: 'object',
                      properties: {
                        product_id: {
                          type: 'string',
                          description: "L'identifiant unique (UUID) du produit obtenu via getProductPrices."
                        },
                        quantity: {
                          type: 'number',
                          description: "La quantité commandée (en kg ou pièces)."
                        },
                        unit_price: {
                          type: 'number',
                          description: "Le prix unitaire du produit obtenu via getProductPrices."
                        }
                      },
                      required: ['product_id', 'quantity', 'unit_price']
                    }
                  }
                },
                required: ['client_id', 'items']
              }
            },
            server: { url: SERVER_URL, secret: process.env.VAPI_WEBHOOK_SECRET || 'delicatessen-vapi-webhook-secret-2026' }
          }
        ],
      }
    };

    const orderTakerAssistant = await vapiFetch('PATCH', `/assistant/${TARGET_IDS.orderTaker}`, orderTakerConfig);
    console.log(`✅ Preneur de commande mis à jour : ${orderTakerAssistant.id}`);

    console.log('\n--- ÉTAPE 2.5 : Création / Mise à jour des Outils de Transfert (Handoff) ---');
    const existingTools = await vapiFetch('GET', '/tool');
    
    // Find or create handoff to Preneur
    let preneurTool = existingTools.find((t: any) => 
      t.type === 'handoff' && 
      t.destinations && 
      t.destinations[0] && 
      t.destinations[0].assistantId === orderTakerAssistant.id
    );
    
    const preneurToolConfig = {
      type: 'handoff',
      function: {
        name: 'handoff_to_preneur',
        description: "Transférer l'appel vers l'agent Preneur de commande (Agent 2)."
      },
      destinations: [
        {
          type: 'assistant',
          assistantId: orderTakerAssistant.id
        }
      ]
    };
    
    let preneurToolId;
    if (preneurTool) {
      console.log(`Outil Handoff vers Preneur existant trouvé. Mise à jour de l'outil ${preneurTool.id}...`);
      const updated = await vapiFetch('PATCH', `/tool/${preneurTool.id}`, preneurToolConfig);
      preneurToolId = updated.id;
    } else {
      console.log("Création de l'outil Handoff vers Preneur...");
      const created = await vapiFetch('POST', '/tool', preneurToolConfig);
      preneurToolId = created.id;
    }
    console.log(`✅ Outil Handoff vers Preneur : ${preneurToolId}`);

    // Find or create handoff to Closer
    let closerTool = existingTools.find((t: any) => 
      t.type === 'handoff' && 
      t.destinations && 
      t.destinations[0] && 
      t.destinations[0].assistantId === closerAssistant.id
    );
    
    const closerToolConfig = {
      type: 'handoff',
      function: {
        name: 'handoff_to_closer',
        description: "Transférer l'appel vers l'agent Closer Expert (Agent 3)."
      },
      destinations: [
        {
          type: 'assistant',
          assistantId: closerAssistant.id
        }
      ]
    };
    
    let closerToolId;
    if (closerTool) {
      console.log(`Outil Handoff vers Closer existant trouvé. Mise à jour de l'outil ${closerTool.id}...`);
      const updated = await vapiFetch('PATCH', `/tool/${closerTool.id}`, closerToolConfig);
      closerToolId = updated.id;
    } else {
      console.log("Création de l'outil Handoff vers Closer...");
      const created = await vapiFetch('POST', '/tool', closerToolConfig);
      closerToolId = created.id;
    }
    console.log(`✅ Outil Handoff vers Closer : ${closerToolId}`);

    console.log('\n--- ÉTAPE 3 : Mise à jour du Routeur (Agent 1) ---');
    const routerConfig = {
      name: 'Agent 1 - Routeur',
      firstMessage: "Maison Fumesse bonjour ! Êtes-vous déjà client chez nous ?",
      voice: { provider: '11labs', voiceId: VOICES.routeur, model: 'eleven_multilingual_v2' },
      transcriber: {
        provider: 'deepgram',
        model: 'nova-2',
        language: 'fr',
        smartFormat: true,
        numerals: true
      },
      clientMessages: [],
      model: {
        ...COMMON_MODEL,
        systemPrompt: `Tu es l'accueil de la Maison Fumesse. Ton seul but est de qualifier et de transférer l'appel SILENCIEUSEMENT.

RÈGLES STRICTES :
1. Dès que le client répond "Oui" à ta question initiale, demande son numéro de téléphone ou de TVA.
2. Utilise IMMÉDIATEMENT l'outil 'identifyClient'.
3. Dès que l'outil réussit, appelle DIRECTEMENT la fonction de transfert (handoff) vers l'assistant Preneur. NE PRONONCE AUCUNE PHRASE AVANT LE TRANSFERT.
4. Si le client est nouveau (NON), demande rapidement son nom, sa société (Resto, Poissonnier, Traiteur) et son numéro. Dès que tu as ça, appelle DIRECTEMENT la fonction de transfert (handoff) vers l'assistant Closer. NE PRONONCE AUCUNE PHRASE AVANT LE TRANSFERT.
5. NE VENDS RIEN, NE DONNE AUCUN PRIX.
6. RÈGLE D'ÉNONCIATION DES CHIFFRES (CRITIQUE) : Tu ne dois JAMAIS écrire de chiffres arabes (ex: 12, 10.50, 2026) ni de symboles de devises (ex: €) dans tes réponses vocales. Écris TOUJOURS l'intégralité des nombres, prix et unités EN TOUTES LETTRES EN FRANÇAIS. C'est obligatoire pour que le synthétiseur vocal ElevenLabs prononce tout correctement en français sans accent anglais.`,
        tools: [
          {
            type: 'function',
            function: {
              name: 'identifyClient',
              description: 'Search for existing client by VAT number or phone number.',
              parameters: { 
                type: 'object', 
                properties: { identifier: { type: 'string' } },
                required: ['identifier']
              }
            },
            server: { url: SERVER_URL, secret: process.env.VAPI_WEBHOOK_SECRET || 'delicatessen-vapi-webhook-secret-2026' }
          }
        ],
        toolIds: [preneurToolId, closerToolId]
      }
    };

    const routerAssistant = await vapiFetch('PATCH', `/assistant/${TARGET_IDS.router}`, routerConfig);
    console.log(`✅ Routeur mis à jour : ${routerAssistant.id}`);

    console.log('\n--- ÉTAPE 4 : Mise à jour du Squad ---');
    const squad = await vapiFetch('PATCH', `/squad/${TARGET_IDS.squad}`, {
      name: 'Squad Maison Fumesse',
      members: [
        {
          assistantId: routerAssistant.id,
          assistantOverrides: {
            transcriber: {
              provider: 'deepgram',
              model: 'nova-2',
              language: 'fr',
              smartFormat: true,
              numerals: true
            }
          }
        },
        {
          assistantId: orderTakerAssistant.id,
          assistantOverrides: {
            transcriber: {
              provider: 'deepgram',
              model: 'nova-2',
              language: 'fr',
              smartFormat: true,
              numerals: true
            }
          }
        },
        {
          assistantId: closerAssistant.id,
          assistantOverrides: {
            transcriber: {
              provider: 'deepgram',
              model: 'nova-2',
              language: 'fr',
              smartFormat: true,
              numerals: true
            }
          }
        }
      ]
    });
    console.log(`✅ Squad mis à jour : ${squad.id}`);

    console.log('\n🎉 SQUAD UPDATED SUCCESSFULLY!');
    console.log(`--> squad ID: ${squad.id}`);
    
    // Write the IDs to a local config file for reference
    const configData = {
      router: routerAssistant.id,
      orderTaker: orderTakerAssistant.id,
      closer: closerAssistant.id,
      squad: squad.id
    };
    fs.writeFileSync('vapi_squad_ids.json', JSON.stringify(configData, null, 2));

  } catch (error) {
    console.error('Erreur lors de la mise à jour du Squad:', error);
  }
}

createSquad();
