import { NextRequest } from "next/server";
import crypto from "crypto";
// Session token utils live in session.ts (zero Prisma imports — prevents circular dep)
export { signTenantSession, verifyTenantSession } from "./session";



export async function getResolvedTenantId(req: NextRequest): Promise<string | undefined> {
  // 1. Internal service authentication (e.g. Telegram webhook bot)
  const reqSecret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET || "casper-voice-internal-secret-9988776655";

  if (reqSecret) {
    const reqBuffer = Buffer.from(reqSecret);
    const expectedBuffer = Buffer.from(expectedSecret);
    if (
      reqBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(reqBuffer, expectedBuffer)
    ) {
      return req.headers.get("x-tenant-id") || undefined;
    }
  }

  // 2. Web UI session authentication (HttpOnly tenant_session cookie)
  const tenantCookie = req.cookies.get("tenant_session");
  if (!tenantCookie?.value) {
    return undefined;
  }

  const verifiedTenantId = verifyTenantSession(tenantCookie.value);
  return verifiedTenantId || undefined;
}

export function isInternalAuthValid(req: NextRequest): boolean {
  const reqSecret = req.headers.get("x-internal-secret");
  const authHeader = req.headers.get("authorization");
  const adminSessionHeader = req.headers.get("x-admin-session");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : authHeader;

  const provided = reqSecret || bearerToken || adminSessionHeader;
  if (!provided) return false;

  const validSecrets = [
    process.env.INTERNAL_SERVICE_SECRET || "casper-voice-internal-secret-9988776655",
    process.env.INTERNAL_API_KEY || "test-internal-secret-key-123",
  ].filter(Boolean);

  return validSecrets.includes(provided);
}


