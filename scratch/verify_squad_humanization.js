const fs = require('fs');
const path = require('path');

// Parse env
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
  console.error("Missing VAPI_API_KEY");
  process.exit(1);
}

const SQUAD_ID = 'e1140011-cc44-44b1-b862-317d8092d94a';

async function checkSquad() {
  try {
    const res = await fetch(`https://api.vapi.ai/squad/${SQUAD_ID}`, {
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) {
      throw new Error(`Status ${res.status}: ${await res.text()}`);
    }
    const squad = await res.json();
    console.log(`Squad Name: ${squad.name}`);
    console.log(`Members Count: ${squad.members?.length}`);
    squad.members.forEach((member, i) => {
      console.log(`\nMember ${i + 1} (Assistant ID: ${member.assistantId}):`);
      console.log(`- Override backgroundSound: ${member.assistantOverrides?.backgroundSound}`);
      console.log(`- Override stopSpeakingPlan:`, member.assistantOverrides?.stopSpeakingPlan);
    });
  } catch (error) {
    console.error("Verification failed:", error);
  }
}

checkSquad();
