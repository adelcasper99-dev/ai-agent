import subprocess
import json

cmd = """cd /root/ai-support-agent/casper-voice-web && node -e '
const { PrismaClient } = require("@prisma/client");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const prisma = new PrismaClient();

async function main() {
  const keys = await prisma.apiKeyPool.findMany();
  for (const k of keys) {
    console.log("-----------------------------------------");
    console.log("KEY ID:", k.id, "PROVIDER:", k.provider, "PREFIX:", k.keyString.substring(0, 10));
    
    // 1. Direct Models API
    try {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=" + k.keyString.trim());
      const data = await res.json();
      if (data.models) {
        console.log("  [Direct Models Endpoint]: VALID (Models:", data.models.length, ")");
      } else {
        console.log("  [Direct Models Endpoint]: ERROR:", JSON.stringify(data.error || data));
      }
    } catch (e) {
      console.log("  [Direct Models Endpoint]: EXCEPTION:", e.message);
    }

    // 2. SDK generateContent
    if (k.provider === "gemini") {
      try {
        const genAI = new GoogleGenerativeAI(k.keyString.trim());
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        const res = await model.generateContent("hi");
        console.log("  [SDK generateContent]: SUCCESS ->", res.response.text().replace(/\\n/g, " ").substring(0, 40));
      } catch (err) {
        console.log("  [SDK generateContent]: ERROR -> status:", err.status, "msg:", err.message);
      }
    }
  }
}
main().finally(() => prisma.$disconnect());
'"""

res = subprocess.run(['ssh', '-o', 'StrictHostKeyChecking=no', 'root@109.123.247.119', cmd], capture_output=True, text=True, encoding='utf-8', errors='replace')
print("STDOUT:")
print(res.stdout)
