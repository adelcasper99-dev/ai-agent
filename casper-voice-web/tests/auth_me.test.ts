import { describe, it, expect, beforeAll } from "vitest";
import { GET } from "../app/api/auth/me/route";
import { signAdminSession, signTenantSession } from "../lib/auth";
import { prismaSystem } from "../lib/prisma";
import { NextRequest } from "next/server";

describe("Auth Me Identity & Session API", () => {
  const TEST_TENANT_ID = "auth-me-test-tenant";

  beforeAll(async () => {
    await prismaSystem.tenant.upsert({
      where: { id: TEST_TENANT_ID },
      update: {},
      create: {
        id: TEST_TENANT_ID,
        name: "شركة الاختبار الشخصي",
        phoneNumber: "01099998888",
        state: "active",
      },
    });
  });

  it("returns unauthenticated for requests with no session cookie", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/me");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isAuthenticated).toBe(false);
    expect(data.user).toBeNull();
  });

  it("returns authenticated admin identity with valid admin_session", async () => {
    const adminToken = await signAdminSession("admin-root");
    const req = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: {
        cookie: `admin_session=${adminToken}`,
      },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isAuthenticated).toBe(true);
    expect(data.user.role).toBe("Super Admin");
    expect(data.user.name).toBe("المدير العام");
    expect(data.user.initials).toBe("G");
    expect(data.session.role).toBe("admin");
  });

  it("returns authenticated tenant identity with valid tenant_session", async () => {
    const tenantToken = await signTenantSession(TEST_TENANT_ID);
    const req = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: {
        cookie: `tenant_session=${tenantToken}`,
      },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.isAuthenticated).toBe(true);
    expect(data.tenant.id).toBe(TEST_TENANT_ID);
    expect(data.tenant.name).toBe("شركة الاختبار الشخصي");
  });
});
