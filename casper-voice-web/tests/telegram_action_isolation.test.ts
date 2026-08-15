import { describe, it, expect } from "vitest";

describe("Telegram Action Verb Isolation & Button Loop Prevention Suite", () => {
  const isExplicitActionCmdRegex = /(اشتريت|اشترى|شراء|بعت|بيع|رجعت|دفعت|سددت|أضف|اضف|ضيف|ادخل|احجز|إلغاء|الغاء|كشف\s*حساب|حساب\s*المورد|حساب\s*العميل|رصيد)/i;
  const hasTotalAnchorRegex = /(?:\s|^)(?:ب|بـ|سعر|إجمالي|اجمالي|بإجمالي|باجمالي|بالإجمالي|بالاجمالي|بقيمة|ثمن|المجموع)\s*(?:\d+|ألف|الف|مية|ميه|مليون)/i;
  const hasTotalAnchor2Regex = /(إجمالي|اجمالي|بإجمالي|باجمالي|بالإجمالي|بالاجمالي|الكل|كلهم|المجموع|بالكامل|الإجمالي)/i;
  const hasPaidAnchorRegex = /(?:\s|^)(?:دفع|دفعت|ادفع|سددت|مقدم|عربون|كاش|بالكاش|بـكاش|نقدا|نقداً|مسدد|مدفوع)/i;

  it("should recognize all imperative and command-form verbs as explicit action commands", () => {
    const prompts = [
      "اشترى 10 طن فراخ من أبوتريكة الطن ب 20000",
      "20000 القطعه وضيف الفراخ للكتالوج",
      "اشترى 10 طن فراخ من أبوتريكة اجمالي ب 20000",
      "بيع ب 5000 2 طن اسمنت",
      "شراء 50 كيلو بطاطس ب 500",
      "أضف منتج جديد للكتالوج"
    ];

    for (const prompt of prompts) {
      const matches = isExplicitActionCmdRegex.test(prompt);
      expect(matches).toBe(true);
    }
  });

  it("should not match pure casual conversation or vague queries", () => {
    const nonActionPrompts = [
      "أهلا إزيك عامل ايه",
      "ممكن مساعدة؟",
      "شكرا جدا لك"
    ];

    for (const prompt of nonActionPrompts) {
      const matches = isExplicitActionCmdRegex.test(prompt);
      expect(matches).toBe(false);
    }
  });

  it("Item 2: Literal Bug Report Prompt - should match prefixed total anchor 'بإجمالي 20000'", () => {
    // Exact user audio transcript prompt confirmation step:
    // "هنشتري 10 طن فراخ من أبوتريكة إجمالي 20000" + button click 1 ("الإجمالي 20000") -> appends "بإجمالي 20000"
    const confirmedMsg = "هنشتري 10 طن فراخ من أبوتريكة إجمالي 20000 بإجمالي 20000";

    expect(hasTotalAnchorRegex.test(confirmedMsg)).toBe(true);
    expect(hasTotalAnchor2Regex.test(confirmedMsg)).toBe(true);
  });

  it("should match prefixed cash anchors like 'بالكاش', 'بـكاش', 'نقداً'", () => {
    const cashPrompts = [
      "دفعت 5000 بالكاش",
      "سددت 2000 بـكاش",
      "دفعت 3000 نقداً",
      "المبلغ المدفوع 1000 نقدا"
    ];

    for (const prompt of cashPrompts) {
      expect(hasPaidAnchorRegex.test(prompt)).toBe(true);
    }
  });
});
