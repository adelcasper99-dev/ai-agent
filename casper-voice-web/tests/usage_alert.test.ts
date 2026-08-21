import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatTenantName, checkAndAlertTokenUsage, sentDailyUsageMilestones, getMilestoneKey } from "../lib/usage-alert";
import { prisma } from "../lib/prisma";
import * as telegramModule from "../lib/telegram";

describe("Token Usage Alert Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentDailyUsageMilestones.clear();
  });

  it("should format short and long tenant names correctly", () => {
    expect(formatTenantName("مطابخ المستقبل")).toBe("مطابخ المستقبل");
    expect(formatTenantName(null)).toBe("شركة غير محددة");
    expect(formatTenantName("")).toBe("شركة غير محددة");

    const longName = "إزيك يا حموكشة عامل إيه؟ أنا شغال في مجال المطابخ والشبابيك سواء مطابخ خشب، أكريليك، بولي لاك، لاميجلاس";
    const formatted = formatTenantName(longName);
    expect(formatted.length).toBeLessThanOrEqual(50);
    expect(formatted.endsWith("...")).toBe(true);
  });

  it("should not alert if daily token usage is below 50,000 threshold", async () => {
    vi.spyOn((prisma as any).tokenUsage, "aggregate").mockResolvedValueOnce({
      _sum: { totalTokens: 35000 },
    });
    const sendSpy = vi.spyOn(telegramModule, "sendTelegramAlert");

    const alerted = await checkAndAlertTokenUsage("tenant-123");
    expect(alerted).toBe(false);
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("should alert once at 50,000 milestone and suppress repetitive calls until 100,000", async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    vi.spyOn((prisma as any).tenant, "findUnique").mockResolvedValue({
      id: "tenant-123",
      name: "شركة النور للزجاج والمطابخ الحديثة",
    });
    vi.spyOn(telegramModule, "getAdminChatId").mockResolvedValue("123456789");
    const sendSpy = vi.spyOn(telegramModule, "sendTelegramAlert").mockResolvedValue({
      success: true,
      attempts: 1,
      usedMarkdownFallback: false,
    });

    // 1st call: 62,112 tokens (Milestone 50,000)
    vi.spyOn((prisma as any).tokenUsage, "aggregate").mockResolvedValueOnce({
      _sum: { totalTokens: 62112 },
    });
    let result = await checkAndAlertTokenUsage("tenant-123");
    expect(result).toBe(true);
    expect(sendSpy).toHaveBeenCalledTimes(1);

    // 2nd call 2 minutes later: 71,623 tokens (still in 50,000 tier -> skipped)
    vi.spyOn((prisma as any).tokenUsage, "aggregate").mockResolvedValueOnce({
      _sum: { totalTokens: 71623 },
    });
    result = await checkAndAlertTokenUsage("tenant-123");
    expect(result).toBe(false);
    expect(sendSpy).toHaveBeenCalledTimes(1);

    // 3rd call: 81,592 tokens (still in 50,000 tier -> skipped)
    vi.spyOn((prisma as any).tokenUsage, "aggregate").mockResolvedValueOnce({
      _sum: { totalTokens: 81592 },
    });
    result = await checkAndAlertTokenUsage("tenant-123");
    expect(result).toBe(false);
    expect(sendSpy).toHaveBeenCalledTimes(1);

    // 4th call: reaches 105,000 tokens (New milestone 100,000 -> Alerts again!)
    vi.spyOn((prisma as any).tokenUsage, "aggregate").mockResolvedValueOnce({
      _sum: { totalTokens: 105000 },
    });
    result = await checkAndAlertTokenUsage("tenant-123");
    expect(result).toBe(true);
    expect(sendSpy).toHaveBeenCalledTimes(2);
  });
});
