import subprocess

cmd = """cd /root/ai-support-agent/casper-voice-web && node -e '
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function test() {
  const key = await prisma.apiKeyPool.findFirst({
    where: { provider: "gemini", isExhausted: false }
  });
  console.log("Using permanent key:", key.keyString.substring(0, 10) + "...");
  const genAI = new GoogleGenerativeAI(key.keyString);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
  const result = await model.generateContent("مرحبا، أجب بكلمة واحدة: ممتاز");
  console.log("GENERATION_RESULT:", result.response.text());
}
test().catch(e => console.error("ERROR:", e)).finally(() => prisma.$disconnect());
'"""

res = subprocess.run(['ssh', '-o', 'StrictHostKeyChecking=no', 'root@109.123.247.119', cmd], capture_output=True, text=True, encoding='utf-8', errors='replace')
print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)
