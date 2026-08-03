import { NextRequest } from "next/server";
import crypto from "crypto";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is mandatory for tenant session security.");
  }
  return secret;
}

export function signTenantSession(tenantId: string): string {
  const secret = getJwtSecret();
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(tenantId);
  const signature = hmac.digest("hex");
  return `${tenantId}.${signature}`;
}

export function verifyTenantSession(token: string): string | null {
  if (!token || !token.includes(".")) return null;
  const secret = getJwtSecret();
  const [tenantId, signature] = token.split(".");
  if (!tenantId || !signature) return null;

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(tenantId);
  const expectedSignature = hmac.digest("hex");

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return tenantId;
  }

  return null;
}

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


