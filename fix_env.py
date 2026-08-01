import re

with open('/root/ai-support-agent/casper-voice-web/.env', 'r') as f:
    data = f.read()

data = re.sub(r'ADMIN_CHAT_ID.*', 'ADMIN_CHAT_ID="6175094816"', data)

with open('/root/ai-support-agent/casper-voice-web/.env', 'w') as f:
    f.write(data)
