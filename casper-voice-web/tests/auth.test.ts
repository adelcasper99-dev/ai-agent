import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { signTenantSession, verifyTenantSession, getResolvedTenantId } from "../lib/auth";

describe("Tenant Auth Engine", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.JWT_SECRET = "super-secret-jwt-key-123456789";
    process.env.INTERNAL_SERVICE_SECRET = "test-internal-secret-999";
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("should fail fast if JWT_SECRET is missing", () => {
    delete process.env.JWT_SECRET;
    expect(() => signTenantSession("tenant-123")).toThrow("JWT_SECRET environment variable is mandatory");
  });

  it("1. Valid tenant_session cookie returns verified tenantId", async () => {
    const tenantId = "tenant-pilot-999";
    const signedToken = signTenantSession(tenantId);

    const req = new NextRequest("http://localhost/api/sales", {
      headers: {
        cookie: `tenant_session=${signedToken}`,
      },
    });

    const resolved = await getResolvedTenantId(req);
    expect(resolved).toBe(tenantId);
  });

  it("2. Missing cookie and missing internal secret returns undefined", async () => {
    const req = new NextRequest("http://localhost/api/sales");
    const resolved = await getResolvedTenantId(req);
    expect(resolved).toBeUndefined();
  });

  it("3. Spoofed x-tenant-id header without tenant_session cookie is IGNORED", async () => {
    const req = new NextRequest("http://localhost/api/sales", {
      headers: {
        "x-tenant-id": "spoofed-tenant-id-666",
        cookie: "admin_session=valid", // admin session without signed tenant_session
      },
    });

    const resolved = await getResolvedTenantId(req);
    expect(resolved).toBeUndefined();
  });

  it("4. Valid x-internal-secret respects x-tenant-id header", async () => {
    const req = new NextRequest("http://localhost/api/sales", {
      headers: {
        "x-internal-secret": "test-internal-secret-999",
        "x-tenant-id": "telegram-bot-tenant-123",
      },
    });

    const resolved = await getResolvedTenantId(req);
    expect(resolved).toBe("telegram-bot-tenant-123");
  });

  it("5. Tampered tenant_session cookie returns undefined", async () => {
    const tenantId = "tenant-pilot-999";
    const signedToken = signTenantSession(tenantId);
    const tamperedToken = signedToken.replace("tenant-pilot-999", "tenant-hacked-000");

    const req = new NextRequest("http://localhost/api/sales", {
      headers: {
        cookie: `tenant_session=${tamperedToken}`,
      },
    });

    const resolved = await getResolvedTenantId(req);
    expect(resolved).toBeUndefined();
  });
});
