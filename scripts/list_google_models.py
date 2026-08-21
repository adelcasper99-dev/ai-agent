import subprocess

cmd = """cd /root/ai-support-agent/casper-voice-web && node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function list() {
  const key = await prisma.apiKeyPool.findFirst({
    where: { provider: "gemini", isExhausted: false }
  });
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + key.keyString);
  const data = await res.json();
  if (data.models) {
    const names = data.models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")).map(m => m.name);
    console.log("SUPPORTED_MODELS:", JSON.stringify(names));
  } else {
    console.log("ERROR:", JSON.stringify(data));
  }
}
list().finally(() => prisma.$disconnect());
'"""

res = subprocess.run(['ssh', '-o', 'StrictHostKeyChecking=no', 'root@109.123.247.119', cmd], capture_output=True, text=True, encoding='utf-8', errors='replace')
print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)
