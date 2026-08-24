import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma, prismaSystem } from "../lib/prisma";
import { POST } from "../app/api/admin/broadcast/route";
import { NextRequest } from "next/server";

describe("Feature Broadcast Engine E2E Test Suite", () => {
  let testTenantId: string;
  let testChatId: string;

  beforeEach(async () => {
    testTenantId = "test_broadcast_tenant_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
    testChatId = "bcast_chat_" + Date.now() + "_" + Math.floor(Math.random() * 10000);

    await (prismaSystem as any).tenant.create({
      data: {
        id: testTenantId,
        name: "ورشة الأمل للألوميتال",
        merchantName: "المعلم صابر",
        businessType: "Alumital",
        telegramChatId: testChatId,
        state: "active"
      }
    });
  });

  afterEach(async () => {
    await (prismaSystem as any).featureRelease.deleteMany({});
    await (prismaSystem as any).tenant.deleteMany({ where: { id: testTenantId } });
  });

  it("1. should reject invalid broadcast payloads via Zod schema", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/broadcast", {
      method: "POST",
      body: JSON.stringify({ title: "hi" }) // missing description & examples
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it("2. should process live broadcast to active merchants and record stats", async () => {
    const payload = {
      title: "محرك التذكيرات الذكية ⏰",
      description: "تقدر دلوقتي تطلب من كاسبر يفكرك بأي مواعيد أو فواتير!",
      examples: [
        { label: "تذكير بالاسم", prompt: "فكرني بكرة الساعة 5 اكلم المهندس محمود" },
        { label: "تنبيه بمدة", prompt: "نبهني بعد ساعتين بفلوس المورد" }
      ],
      targetType: "all",
      previewOnly: false
    };

    const req = new NextRequest("http://localhost:3000/api/admin/broadcast", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.releaseId).toBeDefined();
    expect(data.recipients).toBeGreaterThanOrEqual(1);

    const record = await (prismaSystem as any).featureRelease.findUnique({
      where: { id: data.releaseId }
    });
    expect(record).not.toBeNull();
    expect(record.status).toBe("completed");
    expect(record.title).toBe(payload.title);
    expect(record.sentCount).toBeGreaterThanOrEqual(1);
  });

  it("3. should handle preview mode without broadcasting to all tenants", async () => {
    const payload = {
      title: "ميزة المقايسات السريعة 📐",
      description: "حساب وعرض أسعار فوري لقطاعات الألوميتال.",
      examples: [{ label: "مقايسة شباك", prompt: "احسبلي شباك 120 في 140" }],
      previewOnly: true
    };

    const req = new NextRequest("http://localhost:3000/api/admin/broadcast", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.mode).toBe("preview");
  });
});
