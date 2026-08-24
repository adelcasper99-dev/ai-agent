import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { executeTool, parseEgyptianArabicDateTime } from "../lib/telegram_llm";
import { prisma, prismaSystem } from "../lib/prisma";

describe("Smart Reminder Engine E2E Test Suite", () => {
  let testTenantId: string;
  let testChatId: string;

  beforeEach(async () => {
    testTenantId = "test_tenant_reminders_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
    testChatId = "rem_chat_" + Date.now() + "_" + Math.floor(Math.random() * 10000);

    await (prismaSystem as any).tenant.create({
      data: {
        id: testTenantId,
        name: "ورشة النور للتصنيع",
        merchantName: "الحاج أنور",
        businessType: "Alumital & Maintenance",
        telegramChatId: testChatId
      }
    });

    await (prismaSystem as any).customer.create({
      data: {
        tenantId: testTenantId,
        name: "المهندس محمود",
        phone: "010998877" + Math.floor(Math.random() * 100)
      }
    });
  });

  afterEach(async () => {
    await (prismaSystem as any).reminder.deleteMany({ where: { tenantId: testTenantId } });
    await (prismaSystem as any).customer.deleteMany({ where: { tenantId: testTenantId } });
    await (prismaSystem as any).tenant.deleteMany({ where: { id: testTenantId } });
  });

  it("1. should parse Egyptian Arabic time expressions accurately", () => {
    const d1 = parseEgyptianArabicDateTime("بعد 30 دقيقة");
    const diff1 = d1.getTime() - Date.now();
    expect(diff1).toBeGreaterThan(28 * 60 * 1000);
    expect(diff1).toBeLessThan(32 * 60 * 1000);

    const d2 = parseEgyptianArabicDateTime("بعد ساعتين");
    const diff2 = d2.getTime() - Date.now();
    expect(diff2).toBeGreaterThan(118 * 60 * 1000);
    expect(diff2).toBeLessThan(122 * 60 * 1000);

    const d3 = parseEgyptianArabicDateTime("بكرة الساعة 5 مساءً");
    expect(d3.getDate()).not.toBe(new Date().getDate());
  });

  it("2. should set reminder successfully with customer linking", async () => {
    const res = await executeTool(
      "set_reminder",
      {
        title: "تسليم شباك ألوميتال دبل",
        time_expression: "بكرة الساعة 4",
        customer_name: "المهندس محمود"
      },
      testTenantId,
      "فكرني بكرة الساعة 4 بتسليم شباك للمهندس محمود",
      undefined,
      0,
      undefined,
      { chatId: testChatId }
    );

    expect(res.success).toBe(true);
    expect(res.resultText).toContain("تم ضبط تذكير");
    expect(res.resultText).toContain("تسليم شباك ألوميتال دبل");
    expect(res.resultText).toContain("المهندس محمود");

    const saved = await (prisma as any).reminder.findFirst({
      where: { tenantId: testTenantId, title: "تسليم شباك ألوميتال دبل" }
    });
    expect(saved).not.toBeNull();
    expect(saved.customerName).toBe("المهندس محمود");
    expect(saved.status).toBe("pending");
  });

  it("3. should retrieve active reminders list via get_reminders", async () => {
    await (prismaSystem as any).reminder.create({
      data: {
        tenantId: testTenantId,
        title: "دفع شيك قطاعات الألومنيوم",
        remindAt: new Date(Date.now() + 3600 * 1000),
        status: "pending",
        telegramChatId: testChatId
      }
    });

    const res = await executeTool(
      "get_reminders",
      {},
      testTenantId,
      "ايه التذكيرات اللي عندي",
      undefined,
      0,
      undefined,
      { chatId: testChatId }
    );

    expect(res.success).toBe(true);
    expect(res.resultText).toContain("قائمة التذكيرات المجدولة");
    expect(res.resultText).toContain("دفع شيك قطاعات الألومنيوم");
  });

  it("4. should cancel a reminder by title keyword", async () => {
    const rem = await (prismaSystem as any).reminder.create({
      data: {
        tenantId: testTenantId,
        title: "صيانة كالون شباك",
        remindAt: new Date(Date.now() + 7200 * 1000),
        status: "pending",
        telegramChatId: testChatId
      }
    });

    const res = await executeTool(
      "cancel_reminder",
      { title_keyword: "كالون" },
      testTenantId,
      "الغي تذكير صيانة الكالون"
    );

    expect(res.success).toBe(true);
    expect(res.resultText).toContain("تم إلغاء تذكير");

    const check = await (prismaSystem as any).reminder.findUnique({ where: { id: rem.id } });
    expect(check.status).toBe("cancelled");
  });

  it("5. should enforce tenant isolation when setting and listing reminders", async () => {
    const blocked = await executeTool("set_reminder", { title: "تذكير بدون شركة" }, undefined);
    expect(blocked.success).toBe(false);
    expect(blocked.resultText).toContain("لم يتم تحديد هوية الشركة");
  });
});
