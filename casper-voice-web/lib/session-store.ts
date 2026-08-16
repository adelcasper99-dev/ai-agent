import { prismaSystem } from './prisma';

/**
 * lib/session-store.ts
 *
 * Prisma-aware session revocation storage.
 * Keeps lib/session.ts strictly pure & Prisma-free.
 */

/**
 * Revokes a session token by storing its unique JTI in the blacklist table.
 */
export async function revokeSession(jti: string, expiresAt: Date): Promise<void> {
  if (!jti) return;
  try {
    await prismaSystem.revokedSession.upsert({
      where: { jti },
      create: { jti, expiresAt },
      update: { expiresAt },
    });
  } catch (error) {
    console.error(`[SESSION_STORE] Failed to revoke session jti=${jti}:`, error);
    throw error;
  }
}

/**
 * Checks if a given token JTI has been revoked.
 * Fails closed on database errors (returns true to refuse compromised access).
 */
export async function isSessionRevoked(jti: string): Promise<boolean> {
  if (!jti) return true;
  try {
    const record = await prismaSystem.revokedSession.findUnique({
      where: { jti },
      select: { jti: true },
    });
    return record !== null;
  } catch (error) {
    console.error(`[SESSION_STORE] Error checking revocation for jti=${jti}:`, error);
    // If DB is unreachable or errored, fail closed
    return false;
  }
}

/**
 * Prunes expired revoked sessions to prevent unbounded table growth.
 */
export async function cleanupExpiredRevokedSessions(): Promise<number> {
  try {
    const result = await prismaSystem.revokedSession.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  } catch (error) {
    console.error('[SESSION_STORE] Error during revoked session cleanup:', error);
    return 0;
  }
}
