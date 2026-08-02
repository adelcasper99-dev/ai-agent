#!/bin/bash
GROQ_KEY=$(grep GROQ_API_KEY /root/ai-support-agent/casper-voice-web/.env | cut -d'=' -f2 | tr -d '"' | tr -d '\r' | tr -d "'")
echo "Key prefix: ${GROQ_KEY:0:10}..."
curl -s "https://api.groq.com/openai/v1/models" -H "Authorization: Bearer $GROQ_KEY" | python3 -m json.tool | grep '"id"'
