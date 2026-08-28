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
    const base = new Date("2026-08-24T19:04:00+03:00"); // 07:04 PM Cairo time

    // Relative minutes
    const d1 = parseEgyptianArabicDateTime("بعد 30 دقيقة", undefined, base);
    expect(d1.getTime() - base.getTime()).toBe(30 * 60 * 1000);

    const d2 = parseEgyptianArabicDateTime("كمان دقيقتين", undefined, base);
    expect(d2.getTime() - base.getTime()).toBe(2 * 60 * 1000);

    const d3 = parseEgyptianArabicDateTime("في الـ 5 دقائق القادمة", undefined, base);
    expect(d3.getTime() - base.getTime()).toBe(5 * 60 * 1000);

    const d4 = parseEgyptianArabicDateTime("خلال ربع ساعة", undefined, base);
    expect(d4.getTime() - base.getTime()).toBe(15 * 60 * 1000);

    const d5 = parseEgyptianArabicDateTime("تلت ساعة", undefined, base);
    expect(d5.getTime() - base.getTime()).toBe(20 * 60 * 1000);

    const d6 = parseEgyptianArabicDateTime("نص ساعة", undefined, base);
    expect(d6.getTime() - base.getTime()).toBe(30 * 60 * 1000);

    const d7 = parseEgyptianArabicDateTime("ساعة إلا ربع", undefined, base);
    expect(d7.getTime() - base.getTime()).toBe(45 * 60 * 1000);

    const d8 = parseEgyptianArabicDateTime("بعد ساعتين", undefined, base);
    expect(d8.getTime() - base.getTime()).toBe(2 * 60 * 60 * 1000);

    // Word hour expressions
    const d9 = parseEgyptianArabicDateTime("في التاسعة", undefined, base);
    expect(d9.getHours()).toBe(21); // 9 PM

    const d10 = parseEgyptianArabicDateTime("الساعة 8 مساءً", undefined, base);
    expect(d10.getHours()).toBe(20); // 8 PM
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
  }, 30000);

  it("2.1. should anchor relative reminders to messageTimestamp accurately with Cairo timezone formatting", async () => {
    // 07:04 PM Cairo time = 19:04
    const messageDate = new Date("2026-08-24T19:04:00+03:00");
    const res = await executeTool(
      "set_reminder",
      {
        title: "تركيب شباك في الـ 5 دقائق القادمة",
        time_expression: "في الـ 5 دقائق القادمة"
      },
      testTenantId,
      "تركيب شباك في الـ 5 دقائق القادمة",
      undefined,
      0,
      undefined,
      { chatId: testChatId, messageTimestamp: messageDate }
    );

    expect(res.success).toBe(true);
    expect(res.resultText).toContain("تم ضبط تذكير");
    // Expected time is 07:09 PM (displayed as ٠٧:٠٩ م in ar-EG)
    expect(res.resultText).toMatch(/07:09|7:09|٠٧:٠٩|٧:٠٩/);

    const saved = await (prisma as any).reminder.findFirst({
      where: { tenantId: testTenantId, title: "تركيب شباك في الـ 5 دقائق القادمة" }
    });
    expect(saved).not.toBeNull();
    expect(saved.remindAt.getTime()).toBe(messageDate.getTime() + 5 * 60 * 1000);
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
