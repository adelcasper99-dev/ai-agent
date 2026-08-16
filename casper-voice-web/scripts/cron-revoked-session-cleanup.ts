import { cleanupExpiredRevokedSessions } from '../lib/session-store';
import { prismaSystem } from '../lib/prisma';

/**
 * scripts/cron-revoked-session-cleanup.ts
 *
 * Periodic maintenance job to prune expired entries from the RevokedSession blacklist.
 * Can be run via PM2 cron or system crontab (e.g. daily at midnight).
 */
async function main() {
  console.log(`[REVOKED_SESSION_CLEANUP] Starting cleanup of expired blacklisted tokens at ${new Date().toISOString()}...`);
  const prunedCount = await cleanupExpiredRevokedSessions();
  console.log(`[REVOKED_SESSION_CLEANUP] Pruned ${prunedCount} expired revoked session(s).`);
  await prismaSystem.$disconnect();
}

main().catch((err) => {
  console.error('[REVOKED_SESSION_CLEANUP] Error during cleanup:', err);
  process.exit(1);
});
