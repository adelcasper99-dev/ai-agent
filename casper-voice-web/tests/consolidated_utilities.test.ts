import { describe, it, expect, afterAll } from "vitest";
import { prismaSystem as prisma } from "@/lib/prisma";
import { createAuditLog } from "../lib/audit-logger";
import { searchKnowledgeBase } from "../lib/rag-search";
import { sanitizeEgyptianPhone } from "../lib/phone-sanitizer";

describe("Consolidated Utilities Test Suite", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("1. Egyptian Phone Sanitizer", () => {
    it("normalizes Egyptian mobile numbers (+20)", () => {
      const vodafone = sanitizeEgyptianPhone("01012345678");
      expect(vodafone.isValid).toBe(true);
      expect(vodafone.normalized).toBe("+201012345678");
      expect(vodafone.operator).toBe("Vodafone");

      const orange = sanitizeEgyptianPhone("201212345678");
      expect(orange.isValid).toBe(true);
      expect(orange.normalized).toBe("+201212345678");
      expect(orange.operator).toBe("Orange");

      const etisalat = sanitizeEgyptianPhone("01112345678");
      expect(etisalat.isValid).toBe(true);
      expect(etisalat.operator).toBe("Etisalat");

      const we = sanitizeEgyptianPhone("01512345678");
      expect(we.isValid).toBe(true);
      expect(we.operator).toBe("WE");
    });

    it("rejects invalid phone numbers", () => {
      const invalid = sanitizeEgyptianPhone("01912345678");
      expect(invalid.isValid).toBe(false);
      expect(invalid.error).toBeDefined();
    });
  });

  describe("2. Audit Logger Database Operations", () => {
    it("writes audit log entry to SQLite database", async () => {
      await createAuditLog({
        tenantId: "tenant-test-123",
        userId: "user-test-456",
        action: "TENANT_APPROVAL",
        entity: "PendingTenantRequest",
        details: { approvedBy: "admin-999" },
      });

      const log = await (prisma as any).auditLog.findFirst({
        where: { action: "TENANT_APPROVAL" },
        orderBy: { createdAt: "desc" },
      });

      expect(log).not.toBeNull();
      expect(log.tenantId).toBe("tenant-test-123");
      expect(log.entity).toBe("PendingTenantRequest");

      // Cleanup
      await (prisma as any).auditLog.deleteMany({ where: { tenantId: "tenant-test-123" } });
    });
  });

  describe("3. RAG Knowledge Base Search", () => {
    it("queries KnowledgeItem table and returns relevant answers", async () => {
      const item = await prisma.knowledgeItem.create({
        data: {
          question: "ازاي اعمل مرتجع مبيعات؟",
          answer: "يدخل الكاشير على قائمة الفواتير ثم اختيار الفاتورة والضغط على زر إرجاع.",
          keywords: "مرتجع,مبيعات,فاتورة",
        },
      });

      const results = await searchKnowledgeBase("ازاي اعمل مرتجع");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].solution).toContain("إرجاع");

      // Cleanup
      await prisma.knowledgeItem.delete({ where: { id: item.id } });
    });
  });
});
