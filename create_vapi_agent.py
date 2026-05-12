import urllib.request
import urllib.error
import json
import os
from dotenv import load_dotenv

load_dotenv()

vapi_key = os.getenv("VAPI_API_KEY")

if not vapi_key:
    print("Error: VAPI_API_KEY not found in .env")
    exit(1)

url = "https://api.vapi.ai/assistant"

payload = {
  "name": "Agent Vanhauwaert",
  "model": {
    "provider": "openai",
    "model": "gpt-4o",
    "messages": [
      {
        "role": "system",
        "content": "Vous êtes un employé de Delicatessen Vanhauwaert. Votre rôle final sera défini par le Webhook."
      }
    ]
  },
  "voice": {
    "provider": "openai",
    "voiceId": "alloy"
  },
  "serverUrl": "https://delicatessen-dashboard-dimitri-2026.netlify.app/api/vapi/webhook",
  "maxDurationSeconds": 1800
}

req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode('utf-8'),
    headers={
        'Authorization': f'Bearer {vapi_key}',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    method='POST'
)

try:
    response = urllib.request.urlopen(req)
    result = json.loads(response.read().decode('utf-8'))
    print("Assistant cr avec succs !")
    print(f"ID de l'assistant : {result['id']}")
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8')
    print(f"Erreur HTTP: {e.code} - {body}")
except Exception as e:
    print(f"Erreur: {e}")
