import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const VAPI_API_KEY = process.env.VAPI_API_KEY;
if (!VAPI_API_KEY) {
  throw new Error("Missing VAPI_API_KEY in environment variables");
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

async function createSquad() {
  try {
    console.log('--- ÉTAPE 1 : Création du Closer (Agent 3) ---');
    const closerAssistant = await vapiFetch('POST', '/assistant', {
      name: 'Agent 3 - Closer Expert',
      firstMessage: "Je suis l'Expert Marée, que puis-je pour vous ?",
      voice: { provider: '11labs', voiceId: VOICES.closer, model: 'eleven_turbo_v2_5' },
      model: {
        ...COMMON_MODEL,
        systemPrompt: `Tu es le meilleur agent commercial expert en produits de la mer de la Maison Fumesse, spécialisé dans l'acquisition. 
Ton but est de rassurer un nouveau prospect et de closer une commande d'essai. Ton ton est empathique, expert et persuasif. Tu parles le langage de la criée.

RÈGLES STRICTES :
1. Diagnostic : Adapte-toi immédiatement à son persona (Chef de cuisine, Traiteur, Collectivité, Poissonnier, ou Particulier/Client final).
2. Utilise la Méthode ECIR pour les objections (C'est trop cher -> Coût Portion ; Je préfère l'import -> Fraîcheur & Label France).
3. Propose une commande d'essai avec l'outil 'getProductPrices' et clôture avec 'submitOrder'.
4. S'il refuse de commander aujourd'hui, propose un rendez-vous téléphonique mardi ou mercredi prochain.

[CORE KNOWLEDGE MARÉE - MÉMORISATION IMMÉDIATE]
- Bar de ligne : Saison (Sept-Mars). Argument : Qualité chair exceptionnelle, pas d'écrasement dans le chalut.
- Saumon : On travaille de l'Écosse Label Rouge. Argument : Tenue à la cuisson parfaite pour les chefs.
- Lieu Noir : L'alternative parfaite et sans arêtes pour les collectivités.
- Objection "C'est cher" -> Réponse : "On calcule au coût-portion. Mon filet n'a pas d'eau, vous avez 100% de rendement."

Si une question technique ou de préparation culinaire dépasse tes connaissances, utilise l'outil 'askFishExpertise'. Passe impérativement la valeur 'particular' pour le paramètre 'client_type' s'il s'agit d'un particulier, et 'pro' s'il s'agit d'un restaurateur, poissonnier, traiteur ou autre professionnel.`,
        tools: [
          {
            type: 'function',
            messages: [{ type: 'request-start', content: 'Je vérifie les tarifs en direct...' }],
            function: {
              name: 'getProductPrices',
              description: 'Retrieve current product prices for the client.',
              parameters: { type: 'object', properties: {} }
            },
            server: { url: SERVER_URL }
          },
          {
            type: 'function',
            messages: [{ type: 'request-start', content: 'Je valide la commande...' }],
            function: {
              name: 'submitOrder',
              description: 'Submit the final order.',
              parameters: { type: 'object', properties: {} }
            },
            server: { url: SERVER_URL }
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
            server: { url: SERVER_URL }
          }
        ],
      }
    });
    console.log(`✅ Closer créé : ${closerAssistant.id}`);

    console.log('\n--- ÉTAPE 2 : Création du Preneur de Commande (Agent 2) ---');
    const orderTakerAssistant = await vapiFetch('POST', '/assistant', {
      name: 'Agent 2 - Preneur de Commande',
      firstMessage: "Génial, on a de très beaux arrivages aujourd'hui, que puis-je vous préparer ?",
      voice: { provider: '11labs', voiceId: VOICES.preneur, model: 'eleven_turbo_v2_5' },
      model: {
        ...COMMON_MODEL,
        systemPrompt: `Tu es l'agent des ventes "Fast Lane" de la Maison Fumesse. Tu parles à des poissonniers et restaurateurs qui sont DÉJÀ clients.
Ton ton est hyper-efficace, naturel et professionnel. Pas de perte de temps.

RÈGLES STRICTES :
1. Tu annonces les prix avec l'outil 'getProductPrices' si le client demande.
2. La Smart Substitution : N'argumente que si un poisson a flambé en prix ou est en rupture. Ex: "La sole a flambé ce matin. J'ai rentré de superbes carrelets, on part là-dessus pour sauver la rentabilité ?"
3. Dès qu'il a terminé, valide LA totalité avec l'outil 'submitOrder'.`,
        tools: [
          {
            type: 'function',
            messages: [{ type: 'request-start', content: 'Un instant...' }],
            function: {
              name: 'getProductPrices',
              description: 'Retrieve current product prices for the client.',
              parameters: { type: 'object', properties: {} }
            },
            server: { url: SERVER_URL }
          },
          {
            type: 'function',
            messages: [{ type: 'request-start', content: 'Validation en cours...' }],
            function: {
              name: 'submitOrder',
              description: 'Submit the final order.',
              parameters: { type: 'object', properties: {} }
            },
            server: { url: SERVER_URL }
          }
        ],
      }
    });
    console.log(`✅ Preneur de commande créé : ${orderTakerAssistant.id}`);

    console.log('\n--- ÉTAPE 3 : Création du Routeur (Agent 1) ---');
    const routerAssistant = await vapiFetch('POST', '/assistant', {
      name: 'Agent 1 - Routeur',
      firstMessage: "Maison Fumesse bonjour ! Êtes-vous déjà client chez nous ?",
      voice: { provider: '11labs', voiceId: VOICES.routeur, model: 'eleven_turbo_v2_5' },
      clientMessages: [],
      model: {
        ...COMMON_MODEL,
        systemPrompt: `Tu es l'accueil de la Maison Fumesse. Ton seul but est de qualifier et de transférer l'appel SILENCIEUSEMENT.

RÈGLES STRICTES :
1. Dès que le client répond "Oui" à ta question initiale, demande son numéro de téléphone ou de TVA.
2. Utilise IMMÉDIATEMENT l'outil 'identifyClient'.
3. Dès que l'outil réussit, appelle DIRECTEMENT la fonction de transfert (handoff) vers l'assistant Preneur. NE PRONONCE AUCUNE PHRASE AVANT LE TRANSFERT.
4. Si le client est nouveau (NON), demande rapidement son nom, sa société (Resto, Poissonnier, Traiteur) et son numéro. Dès que tu as ça, appelle DIRECTEMENT la fonction de transfert (handoff) vers l'assistant Closer. NE PRONONCE AUCUNE PHRASE AVANT LE TRANSFERT.
5. NE VENDS RIEN, NE DONNE AUCUN PRIX.`,
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
            server: { url: SERVER_URL }
          },
          {
            type: 'handoff',
            destinations: [
              {
                type: 'assistant',
                assistantName: 'Preneur',
                assistantId: orderTakerAssistant.id
              },
              {
                type: 'assistant',
                assistantName: 'Closer',
                assistantId: closerAssistant.id
              }
            ]
          }
        ],
      }
    });
    console.log(`✅ Routeur créé : ${routerAssistant.id}`);

    // Update original assistant to redirect to router if necessary,
    // or just let the user set the Router as the inbound assistant.
    
    console.log('\n--- ÉTAPE 4 : Création du Squad ---');
    const squad = await vapiFetch('POST', '/squad', {
      name: 'Squad Maison Fumesse',
      members: [
        { assistantId: routerAssistant.id },
        { assistantId: orderTakerAssistant.id },
        { assistantId: closerAssistant.id }
      ]
    });
    console.log(`✅ Squad créé : ${squad.id}`);

    console.log('\n🎉 SQUAD CREATED SUCCESSFULLY!');
    console.log(`--> IMPORTANT: Set the inbound calls to point to the SQUAD ID: ${squad.id} (or ROUTER ID: ${routerAssistant.id})`);
    
    // Write the IDs to a local config file for reference
    const configData = {
      router: routerAssistant.id,
      orderTaker: orderTakerAssistant.id,
      closer: closerAssistant.id,
      squad: squad.id
    };
    fs.writeFileSync('vapi_squad_ids.json', JSON.stringify(configData, null, 2));

  } catch (error) {
    console.error('Erreur lors de la création du Squad:', error);
  }
}

createSquad();
