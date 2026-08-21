import subprocess
import json

cmd = """cd /root/ai-support-agent/casper-voice-web && node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const keys = await prisma.apiKeyPool.findMany();
  console.log("KEYS_COUNT:", keys.length);
  for (const k of keys) {
    console.log("KEY_ITEM:", JSON.stringify({ id: k.id, provider: k.provider, isExhausted: k.isExhausted, prefix: k.keyString.substring(0, 10) }));
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + k.keyString);
      const data = await res.json();
      if (data.models) {
        console.log("KEY_VALID:", k.id, "Models count:", data.models.length);
      } else {
        console.log("KEY_INVALID_OR_ERROR:", k.id, JSON.stringify(data));
      }
    } catch (e) {
      console.log("KEY_FETCH_ERR:", k.id, e.message);
    }
  }
}
main().finally(() => prisma.$disconnect());
'"""

res = subprocess.run(['ssh', '-o', 'StrictHostKeyChecking=no', 'root@109.123.247.119', cmd], capture_output=True, text=True, encoding='utf-8', errors='replace')
print("STDOUT:")
print(res.stdout)
print("STDERR:")
print(res.stderr)
