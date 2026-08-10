import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getTenantId, runWithTenant } from "../lib/prisma-tenant-extension";

describe("Prisma Tenant Extension getTenantId", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.INTERNAL_SERVICE_SECRET = "test-internal-secret-999";
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("1. runWithTenant correctly scopes tenant context", async () => {
    await runWithTenant("tenant-ctx-100", async () => {
      const tenantId = await getTenantId();
      expect(tenantId).toBe("tenant-ctx-100");
    });
  });

  it("2. Returns undefined when outside AsyncLocalStorage and headers context", async () => {
    const tenantId = await getTenantId();
    expect(tenantId).toBeUndefined();
  });
});
