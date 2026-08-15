import { describe, it, expect } from "vitest";

describe("Telegram Action Verb Isolation Suite", () => {
  const isExplicitActionCmdRegex = /(اشتريت|اشترى|شراء|بعت|بيع|رجعت|دفعت|سددت|أضف|اضف|ضيف|ادخل|احجز|إلغاء|الغاء|كشف\s*حساب|حساب\s*المورد|حساب\s*العميل|رصيد)/i;

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
});
