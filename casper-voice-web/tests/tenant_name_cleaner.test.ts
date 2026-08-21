import { describe, it, expect } from "vitest";
import { extractCleanBusinessName } from "../lib/tenant-name-cleaner";

describe("Tenant Name Cleaner Tests", () => {
  it("should return clean short company names as-is", () => {
    expect(extractCleanBusinessName("شركة الأمل للتجارة")).toBe("شركة الأمل للتجارة");
    expect(extractCleanBusinessName("مطعم البرنس")).toBe("مطعم البرنس");
    expect(extractCleanBusinessName("ورشة الأهرام للسيارات")).toBe("ورشة الأهرام للسيارات");
  });

  it("should extract clean name from long conversational intro with greetings and slang", () => {
    const raw = "إزيك يا حموكشة عامل إيه؟ أنا شغال في مجال المطابخ والشبابيك سواء مطابخ خشب، أكريليك، بولي لاك، لاميجلاس، أو ألومنيوم اللي هو كلادين وفايبر، وشغال في جميع إكسسوارات والسيكوريت.";
    const clean = extractCleanBusinessName(raw);
    expect(clean.length).toBeLessThanOrEqual(40);
    expect(clean).toContain("المطابخ والشبابيك");
    expect(clean).not.toContain("حموكشة");
    expect(clean).not.toContain("إزيك");
    expect(clean).not.toContain("عامل إيه");
  });

  it("should handle colloquial phrases like 'أنا فاتح محل موبايلات'", () => {
    const raw = "أنا فاتح محل موبايلات وصيانة أجهزة";
    const clean = extractCleanBusinessName(raw);
    expect(clean.length).toBeLessThanOrEqual(40);
    expect(clean).not.toContain("أنا");
  });

  it("should provide fallback for empty input", () => {
    expect(extractCleanBusinessName("")).toBe("شركة غير محددة");
    expect(extractCleanBusinessName(null)).toBe("شركة غير محددة");
  });
});
