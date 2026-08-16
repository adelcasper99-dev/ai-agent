import { NextRequest } from "next/server";
import crypto from "crypto";
import { 
  signTenantSession, verifyTenantSession, verifyTenantSessionRaw,
  signAdminSession, verifyAdminSession, verifyAdminSessionRaw,
  signCustomerSession, verifyCustomerSession, verifyCustomerSessionRaw,
  extractSessionDetails,
  hashPin, verifyPin,
  signMagicLink, verifyMagicLink
} from "./session";

export { 
  signTenantSession, verifyTenantSession, verifyTenantSessionRaw,
  signAdminSession, verifyAdminSession, verifyAdminSessionRaw,
  signCustomerSession, verifyCustomerSession, verifyCustomerSessionRaw,
  extractSessionDetails,
  hashPin, verifyPin,
  signMagicLink, verifyMagicLink
};

export async function getResolvedTenantId(req: NextRequest): Promise<string | undefined> {
  // 1. Internal service authentication (e.g. Telegram webhook bot)
  const reqSecret = req.headers.get("x-internal-secret");
  const expectedSecret = process.env.INTERNAL_SERVICE_SECRET;

  if (reqSecret && expectedSecret) {
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

  const verifiedTenantId = await verifyTenantSession(tenantCookie.value);
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
    process.env.INTERNAL_SERVICE_SECRET,
    process.env.INTERNAL_API_KEY,
  ].filter((s): s is string => Boolean(s && s.trim()));

  if (validSecrets.length === 0) {
    return false; // Fail closed: no hardcoded fallbacks
  }

  const providedBuffer = Buffer.from(provided);
  return validSecrets.some((secret) => {
    const secretBuffer = Buffer.from(secret);
    if (providedBuffer.length !== secretBuffer.length) return false;
    return crypto.timingSafeEqual(providedBuffer, secretBuffer);
  });
}
