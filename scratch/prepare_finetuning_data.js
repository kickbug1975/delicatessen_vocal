const fs = require('fs');
const path = require('path');

// Load environment variables
const env = {};
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.substring(0, eqIndex).trim();
    const val = trimmed.substring(eqIndex + 1).replace(/^["']|["']$/g, '').trim();
    env[key] = val;
  }
}

const vapiApiKey = process.env.VAPI_API_KEY || env.VAPI_API_KEY;
if (!vapiApiKey) {
  console.error("❌ Error: Missing VAPI_API_KEY");
  process.exit(1);
}

// Maison Fumesse Assistants
const ASSISTANTS = {
  router: 'f8e699f4-5306-462e-ae3c-0b57d7cca70e',
  orderTaker: '588a8560-460c-424b-8036-63e0389c511a',
  closer: '10203c20-ad17-48da-9038-f9b68b957ac7',
  legacy: 'a0eee2d3-de59-4c71-8900-1a6f71c7e816'
};

async function fetchCallsForAssistant(assistantId, label) {
  console.log(`🔍 Fetching calls for ${label}...`);
  try {
    const res = await fetch(`https://api.vapi.ai/call?assistantId=${assistantId}&limit=50`, {
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) {
      throw new Error(`Vapi API error: ${res.status} - ${await res.text()}`);
    }
    return await res.json();
  } catch (error) {
    console.error(`❌ Error fetching calls for ${label}:`, error.message);
    return [];
  }
}

function cleanText(text) {
  if (!text) return '';
  // Clean potential unicode replacement chars or weird encodings
  return text
    .replace(/Ǹ/g, 'é')
    .replace(/ǩ/g, 't')
    .replace(/ǯ/g, 'û')
    .replace(/Ǧ/g, 'ê')
    .replace(/Ǩ/g, 'à')
    .trim();
}

async function generateDataset() {
  const allCalls = [];
  
  // Fetch calls from all 3 squad assistants
  for (const [key, id] of Object.entries(ASSISTANTS)) {
    const calls = await fetchCallsForAssistant(id, key);
    allCalls.push(...calls);
  }
  
  console.log(`📊 Found total of ${allCalls.length} calls across assistants.`);
  
  const jsonlLines = [];
  
  for (const call of allCalls) {
    if (!call.messages || call.messages.length === 0) continue;
    
    // Extract system prompt
    const systemMsg = call.messages.find(m => m.role === 'system');
    const systemContent = systemMsg ? systemMsg.message : "Tu es un assistant commercial expert pour la Maison Fumesse.";
    
    const formattedMessages = [
      { role: "system", content: systemContent }
    ];
    
    let hasUserTurn = false;
    
    for (const msg of call.messages) {
      if (msg.role === 'user') {
        const text = cleanText(msg.message);
        if (text) {
          formattedMessages.push({ role: "user", content: text });
          hasUserTurn = true;
        }
      } else if (msg.role === 'bot') {
        const text = cleanText(msg.message);
        if (text) {
          formattedMessages.push({ role: "assistant", content: text });
        }
      }
    }
    
    // We only train on conversations with actual user interactions
    if (hasUserTurn && formattedMessages.length > 2) {
      jsonlLines.push(JSON.stringify({ messages: formattedMessages }));
    }
  }
  
  const outputPath = path.join(__dirname, 'grok_finetuning_dataset.jsonl');
  fs.writeFileSync(outputPath, jsonlLines.join('\n'), 'utf-8');
  
  console.log(`\n🎉 Dataset preparation complete!`);
  console.log(`💾 Saved ${jsonlLines.length} qualified call conversations to:`);
  console.log(`👉 ${outputPath}`);
}

generateDataset();
