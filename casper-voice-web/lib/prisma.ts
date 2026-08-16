import { PrismaClient } from "@prisma/client";
import { prismaTenantExtension } from "./prisma-tenant-extension";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof buildPrisma> | undefined;
};

function buildPrisma() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  // Enable WAL mode for SQLite to prevent SQLITE_BUSY under concurrent Telegram webhooks
  if (process.env.DATABASE_URL?.startsWith("file:")) {
    void base.$executeRawUnsafe("PRAGMA journal_mode=WAL;");
    void base.$executeRawUnsafe("PRAGMA synchronous=NORMAL;");
    void base.$executeRawUnsafe("PRAGMA busy_timeout=5000;");
  }
  // Only apply the extension server-side (prismaTenantExtension is null in browser)
  return prismaTenantExtension ? base.$extends(prismaTenantExtension) : base;
}

export const prisma = globalForPrisma.prisma ?? buildPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma as any;

/**
 * System-level Prisma client with NO tenant filter extension.
 *
 * ⚠️  INTERNAL USE ONLY. Only use this in:
 *   - /api/admin/* Super Admin routes that must see all tenants
 *   - scripts/cron-*.ts scheduled jobs
 *   - Internal health-check aggregates
 *
 * NEVER pass `prismaSystem` to tenant-facing API handlers.
 * Use `prisma` (with tenant extension) for all user-facing routes.
 */
export const prismaSystem = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});
