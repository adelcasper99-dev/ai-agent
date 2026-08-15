import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { validateMemoryFact, executeTool } from "../lib/telegram_llm";
import { consolidateMerchantMemories } from "../scripts/consolidate_merchant_memories";

const prisma = new PrismaClient();

describe("Merchant Memory Fact Engine Suite", () => {
  const tenantA = "test_tenant_a_" + Date.now();
  const tenantB = "test_tenant_b_" + Date.now();

  beforeEach(async () => {
    await prisma.merchantMemoryFact.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } }
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA, tenantB] } }
    });

    await prisma.tenant.create({ data: { id: tenantA, name: "Tenant A" } });
    await prisma.tenant.create({ data: { id: tenantB, name: "Tenant B" } });
  });

  afterAll(async () => {
    await prisma.merchantMemoryFact.deleteMany({
      where: { tenantId: { in: [tenantA, tenantB] } }
    });
    await prisma.tenant.deleteMany({
      where: { id: { in: [tenantA, tenantB] } }
    });
    await prisma.$disconnect();
  });

  it("1. validateMemoryFact rejects financial amounts and allows pure text", () => {
    expect(() => validateMemoryFact("5000 جنيه")).toThrow();
    expect(() => validateMemoryFact("سددت 1200 EGP")).toThrow();
    expect(() => validateMemoryFact("خصم 250 LE")).toThrow();

    expect(() => validateMemoryFact("أبوتريكة")).not.toThrow();
    expect(() => validateMemoryFact("عميل الهرم المفضّل")).not.toThrow();
  });

  it("2. Tenant Isolation: Tenant B cannot access Tenant A memories", async () => {
    await prisma.merchantMemoryFact.create({
      data: {
        tenantId: tenantA,
        factType: "alias",
        aliasOrKey: "أبوتريكة",
        entityName: "محمد محمد أقيم",
        value: "محمد محمد أقيم",
        sourceMessageId: "msg_a_1"
      }
    });

    const resultA = await executeTool(
      "lookup_merchant_memory",
      { query: "أبوتريكة" },
      tenantA,
      "أبوتريكة"
    );
    expect(resultA.success).toBe(true);
    expect(resultA.resultText).toContain("محمد محمد أقيم");

    const resultB = await executeTool(
      "lookup_merchant_memory",
      { query: "أبوتريكة" },
      tenantB,
      "أبوتريكة"
    );
    expect(resultB.success).toBe(false);
    expect(resultB.resultText).toContain("لم نجد أي ذاكرة");
  });

  it("3. Consolidation Script supersedes older duplicate alias facts", async () => {
    const fact1 = await prisma.merchantMemoryFact.create({
      data: {
        tenantId: tenantA,
        factType: "alias",
        aliasOrKey: "الكابتن",
        entityName: "سامح حسني القديم",
        value: "سامح حسني القديم",
        sourceMessageId: "msg_c_1"
      }
    });

    // Short pause to ensure timestamp order
    await new Promise((r) => setTimeout(r, 50));

    const fact2 = await prisma.merchantMemoryFact.create({
      data: {
        tenantId: tenantA,
        factType: "alias",
        aliasOrKey: "الكابتن",
        entityName: "سامح حسني الجديد",
        value: "سامح حسني الجديد",
        sourceMessageId: "msg_c_2"
      }
    });

    const res = await consolidateMerchantMemories(tenantA);
    expect(res.supersededCount).toBeGreaterThanOrEqual(1);

    const updatedFact1 = await prisma.merchantMemoryFact.findUnique({
      where: { id: fact1.id }
    });
    expect(updatedFact1?.supersededById).toBe(fact2.id);

    const lookupRes = await executeTool(
      "lookup_merchant_memory",
      { query: "الكابتن" },
      tenantA,
      "الكابتن"
    );
    expect(lookupRes.success).toBe(true);
    expect(lookupRes.resultText).toContain("سامح حسني الجديد");
    expect(lookupRes.resultText).not.toContain("سامح حسني القديم");
  });
});
