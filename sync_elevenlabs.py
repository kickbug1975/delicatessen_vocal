import urllib.request
import urllib.error
import json
import os
from dotenv import load_dotenv

load_dotenv()

vapi_key = os.getenv("VAPI_API_KEY")
elevenlabs_key = os.getenv("ELEVENLABS_API_KEY")

if not vapi_key or not elevenlabs_key:
    print("Error: VAPI_API_KEY or ELEVENLABS_API_KEY not found in .env")
    exit(1)

# 1. Fetch voices from ElevenLabs
try:
    print("1. Fetching voices from ElevenLabs...")
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/voices",
        headers={
            "xi-api-key": elevenlabs_key,
            "User-Agent": "Mozilla/5.0"
        }
    )
    res = urllib.request.urlopen(req)
    data = json.loads(res.read().decode('utf-8'))
    voices = data.get("voices", [])
    
    print("\n--- VOIX ELEVENLABS DISPONIBLES ---")
    for voice in voices:
        print(f"Nom : {voice['name']} | ID : {voice['voice_id']} | Catgorie : {voice.get('category')}")
    print("-----------------------------------\n")
except Exception as e:
    print(f"Erreur lors de la rcupration des voix ElevenLabs : {e}")
    exit(1)

# 2. Add ElevenLabs Credential to Vapi
try:
    print("2. Adding ElevenLabs credential to Vapi...")
    payload = {
        "provider": "11labs",
        "apiKey": elevenlabs_key
    }
    
    req_vapi = urllib.request.Request(
        "https://api.vapi.ai/credential",
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {vapi_key}',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0'
        },
        method='POST'
    )
    res_vapi = urllib.request.urlopen(req_vapi)
    vapi_data = json.loads(res_vapi.read().decode('utf-8'))
    print("Succes! Cl API ElevenLabs ajoute  Vapi en tant que crdentiel.")
    print(f"ID Crdentiel Vapi : {vapi_data.get('id')}")
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8')
    print(f"Erreur HTTP Vapi: {e.code} - {body}")
except Exception as e:
    print(f"Erreur lors de l'ajout du crdentiel Vapi : {e}")

