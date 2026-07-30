import fs from "fs";
import path from "path";

const REQUIRED_SECRETS = [
  "TELEGRAM_WEBHOOK_SECRET",
  "JWT_SECRET",
  "TELEGRAM_BOT_TOKEN",
  "ADMIN_CHAT_ID",
  "INTERNAL_API_KEY",
  "DATABASE_URL",
];

function checkEnvSecrets() {
  console.log("==========================================");
  console.log("🔒 Running Pre-Deploy Environment Secrets Verification");
  console.log("==========================================");

  const envPath = path.resolve(process.cwd(), ".env");
  const envProdPath = path.resolve(process.cwd(), ".env.production");

  const targetPath = fs.existsSync(envProdPath) ? envProdPath : envPath;
  console.log(`[Env Verification] Reading environment from: ${targetPath}`);

  if (!fs.existsSync(targetPath)) {
    console.error(`❌ CRITICAL: Environment file not found at ${targetPath}`);
    process.exit(1);
  }

  const envContent = fs.readFileSync(targetPath, "utf-8");
  const missing: string[] = [];

  for (const secret of REQUIRED_SECRETS) {
    const regex = new RegExp(`^${secret}=.+`, "m");
    const inProcess = Boolean(process.env[secret]);
    const inEnvFile = regex.test(envContent);

    if (!inProcess && !inEnvFile) {
      missing.push(secret);
    } else {
      console.log(`  ✅ Verified secret key: ${secret}`);
    }
  }

  if (missing.length > 0) {
    console.error("\n==========================================");
    console.error(`❌ DEPLOYMENT BLOCKED: Missing ${missing.length} required environment secret(s):`);
    missing.forEach((s) => console.error(`   - ${s}`));
    console.error("==========================================");
    process.exit(1);
  }

  console.log("\n==========================================");
  console.log("🎉 ALL ENVIRONMENT SECRETS VERIFIED PASSING!");
  console.log("==========================================");
}

checkEnvSecrets();
