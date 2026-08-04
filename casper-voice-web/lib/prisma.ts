import { PrismaClient } from "@prisma/client";
import { prismaTenantExtension } from "./prisma-tenant-extension";

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof buildPrisma> | undefined;
};

function buildPrisma() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  // Only apply the extension server-side (prismaTenantExtension is null in browser)
  return prismaTenantExtension ? base.$extends(prismaTenantExtension) : base;
}

export const prisma = globalForPrisma.prisma ?? buildPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma as any;
