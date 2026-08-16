import { enforceSubscriptionExpiry } from "../lib/subscription-guard";
import { prismaSystem } from "../lib/prisma";

/**
 * scripts/cron-subscription-expiry.ts
 *
 * Standalone background cron job to enforce subscription expiration,
 * transition past-due tenants to 'past_due_silent', and dispatch Telegram alerts.
 * Run hourly via PM2 cron or system crontab.
 */
async function main() {
  console.log(`[SUBSCRIPTION_EXPIRY_CRON] Running subscription expiry check at ${new Date().toISOString()}...`);
  const transitionedCount = await enforceSubscriptionExpiry();
  console.log(`[SUBSCRIPTION_EXPIRY_CRON] Processed expiry check. ${transitionedCount} tenant(s) transitioned to past-due.`);
  await prismaSystem.$disconnect();
}

main().catch((err) => {
  console.error('[SUBSCRIPTION_EXPIRY_CRON] Error during subscription expiry check:', err);
  process.exit(1);
});
