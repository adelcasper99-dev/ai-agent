import subprocess

cmd = """cd /root/ai-support-agent/casper-voice-web && node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const del = await prisma.apiKeyPool.deleteMany({
    where: {
      keyString: {
        startsWith: "AQ."
      }
    }
  });
  console.log("Deleted temporary tokens:", del.count);
  const activeKeys = await prisma.apiKeyPool.findMany({ where: { isExhausted: false } });
  console.log("Active permanent keys count:", activeKeys.length);
  for (const k of activeKeys) {
    console.log("Active Key:", k.provider, k.keyString.substring(0, 10) + "...");
  }
}
main().finally(() => prisma.$disconnect());
'"""

res = subprocess.run(['ssh', '-o', 'StrictHostKeyChecking=no', 'root@109.123.247.119', cmd], capture_output=True, text=True, encoding='utf-8', errors='replace')
print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)
