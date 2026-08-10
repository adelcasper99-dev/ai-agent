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
