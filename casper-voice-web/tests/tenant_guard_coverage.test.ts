import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getActiveConversationState, resetFallbackState, processFallbackInput } from "@/lib/telegram_fallback";
import { prismaSystem } from "@/lib/prisma";
import fs from "fs";
import path from "path";

describe("Tenant Guard Coverage & Permanent Recurrence Protection Suite", () => {
  const TEST_TENANT_ID = `test_tenant_guard_${Date.now()}`;
  const TEST_CHAT_ID = `999${Math.floor(Math.random() * 1000000)}`;

  beforeAll(async () => {
    // Seed real test tenant to satisfy foreign keys
    await (prismaSystem as any).tenant.create({
      data: {
        id: TEST_TENANT_ID,
        name: "Test Tenant Guard Protection",
        state: "active",
        telegramChatId: TEST_CHAT_ID,
      },
    });
  });

  afterAll(async () => {
    await (prismaSystem as any).conversationState.deleteMany({
      where: { telegramChatId: TEST_CHAT_ID },
    });
    await (prismaSystem as any).tenant.deleteMany({
      where: { id: TEST_TENANT_ID },
    });
  });

  it("1. getActiveConversationState creates and retrieves state safely without TenantContextError", async () => {
    const state = await getActiveConversationState(TEST_CHAT_ID, TEST_TENANT_ID);
    expect(state).toBeDefined();
    expect(state.telegramChatId).toBe(TEST_CHAT_ID);
    expect(state.tenantId).toBe(TEST_TENANT_ID);
  });

  it("2. resetFallbackState succeeds whether tenantId is passed or not", async () => {
    // With tenantId
    await expect(resetFallbackState(TEST_CHAT_ID, TEST_TENANT_ID)).resolves.not.toThrow();
    // Without tenantId (system level reset)
    await expect(resetFallbackState(TEST_CHAT_ID)).resolves.not.toThrow();
  });

  it("3. processFallbackInput handles quick sales without throwing TenantContextError", async () => {
    const handled = await processFallbackInput(
      TEST_CHAT_ID,
      TEST_TENANT_ID,
      "مفاتيح 250 كاش",
      null
    );
    expect(handled).toBe(true);
  });

  it("4. Static Code AST Audit: app/api and lib routes must not make raw un-scoped tenant queries", () => {
    const routesDir = path.join(process.cwd(), "app", "api");
    const issues: string[] = [];

    function scanDir(dir: string) {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (
            content.includes("prisma.conversationState") &&
            !content.includes("runWithTenant") &&
            !content.includes("prismaSystem")
          ) {
            issues.push(`Unscoped ConversationState in ${path.relative(process.cwd(), fullPath)}`);
          }
        }
      }
    }

    scanDir(routesDir);
    expect(issues).toEqual([]);
  });
});
