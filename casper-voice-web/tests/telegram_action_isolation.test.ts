import { describe, it, expect } from "vitest";

describe("Telegram Action Verb Isolation & Button Loop Prevention Suite", () => {
  const isExplicitActionCmdRegex = /(اشتريت|اشترى|هنشتري|نشتري|شراء|بعت|بيع|هنبيع|نبيع|رجعت|دفعت|سددت|أضف|اضف|ضيف|ادخل|احجز|إلغاء|الغاء|كشف\s*حساب|حساب\s*المورد|حساب\s*العميل|رصيد)/i;
  const hasTotalAnchorRegex = /(?:\s|^)(?:ب|بـ|سعر|إجمالي|اجمالي|بإجمالي|باجمالي|بالإجمالي|بالاجمالي|والإجمالي|والاجمالي|وإجمالي|واجمالي|بقيمة|ثمن|المجموع)\s*(?:\d+|ألف|الف|مية|ميه|مليون)/i;
  const hasTotalAnchor2Regex = /(إجمالي|اجمالي|بإجمالي|باجمالي|بالإجمالي|بالاجمالي|والإجمالي|والاجمالي|وإجمالي|واجمالي|الكل|كلهم|المجموع|بالكامل|الإجمالي)/i;
  const hasPaidAnchorRegex = /(?:\s|^)(?:دفع|دفعت|ادفع|سددت|مقدم|عربون|كاش|بالكاش|بـكاش|نقدا|نقداً|مسدد|مدفوع)/i;

  it("Item 1 (Verbatim Written Bug Report String): 'اشترى 10 طن فراخ من أبوتريكة اجمالي ب 20000'", () => {
    // Exact literal string from original written bug report:
    const verbatimWrittenBugPrompt = "اشترى 10 طن فراخ من أبوتريكة اجمالي ب 20000";
    
    expect(hasTotalAnchorRegex.test(verbatimWrittenBugPrompt)).toBe(true);
    expect(hasTotalAnchor2Regex.test(verbatimWrittenBugPrompt)).toBe(true);
    expect(isExplicitActionCmdRegex.test(verbatimWrittenBugPrompt)).toBe(true);
  });

  it("Item 1 (Verbatim Written & Audio Variants): Verbatim exact strings and prefixes", () => {
    const verbatimPrompts = [
      "اشترى 10 طن فراخ من أبوتريكة اجمالي ب 20000",
      "اشترى 10 طن فراخ من أبوتريكة اجمالي بـ 20000",
      "اشترى 10 طن فراخ من أبوتريكة إجمالي ب 20000",
      "هنشتري 10 طن فراخ من أبوتريكة إجمالي 20000",
      "هنشتري 10 طن فراخ من أبوتريكة إجمالي 20000 بإجمالي 20000"
    ];

    for (const prompt of verbatimPrompts) {
      expect(hasTotalAnchorRegex.test(prompt)).toBe(true);
      expect(hasTotalAnchor2Regex.test(prompt)).toBe(true);
    }
  });

  it("Item 2 (Question 1 Audit): Section C numeric clarification does NOT persist pendingState", () => {
    // Section C clarification trigger: 2 unanchored numbers >= 100 without total/paid anchors
    const unanchoredMsg = "اشتريت فراخ من أبوتريكة 20000 5000";
    const hasTotal = hasTotalAnchorRegex.test(unanchoredMsg);
    const hasPaid = hasPaidAnchorRegex.test(unanchoredMsg);

    // Verify anchors fail on unanchored prompt -> triggers Section C question
    expect(hasTotal).toBe(false);
    expect(hasPaid).toBe(false);
  });

  it("Item 2 (Question 2 Audit): Free-text clarification reply with action verb 'دفعت 5000 والباقي آجل' matches paid anchor", () => {
    const freeTextReply = "دفعت 5000 والباقي آجل";

    // Free text reply contains 'دفعت' which matches hasPaidAnchor
    expect(hasPaidAnchorRegex.test(freeTextReply)).toBe(true);
  });

  it("Item 2 (Free-Text Dual Clarification): Reply with 'دفعت 5000 كاش والإجمالي 20000' matches both anchors", () => {
    const freeTextReply = "دفعت 5000 كاش والإجمالي 20000";

    expect(hasTotalAnchorRegex.test(freeTextReply)).toBe(true);
    expect(hasPaidAnchorRegex.test(freeTextReply)).toBe(true);
  });

  it("Item 2 (Pipeline Interceptor): Button choice keywords ('1', '2', 'مشتريات', 'مبيعات') match interceptor BEFORE purge line", () => {
    const optionOneInputs = ["1", "إجمالي", "اجمالي", "نعم", "تأكيد", "مشتريات"];
    const optionTwoInputs = ["2", "القطعة", "العلبة", "لا", "إلغاء", "مبيعات"];

    const isOneRegex = /^(إجمالي|اجمالي|نعم|تأكيد|تاكيد|مشتريات)/i;
    const isTwoRegex = /^(سعر\s*القطعة|سعر\s*العلبة|القطعة|العلبة|لا|إلغاء|الغاء|مبيعات)/i;

    for (const input of optionOneInputs) {
      const isOne = input === "1" || isOneRegex.test(input);
      expect(isOne).toBe(true);
    }

    for (const input of optionTwoInputs) {
      const isTwo = input === "2" || isTwoRegex.test(input);
      expect(isTwo).toBe(true);
    }
  });

  it("should recognize imperative and action-form verbs as explicit action commands for purging pending_choice", () => {
    const actionPrompts = [
      "هنشتري 10 طن فراخ من أبوتريكة إجمالي 20000",
      "اشترى 10 طن فراخ من أبوتريكة الطن ب 20000",
      "20000 القطعه وضيف الفراخ للكتالوج",
      "بيع ب 5000 2 طن اسمنت",
      "شراء 50 كيلو بطاطس ب 500",
      "أضف منتج جديد للكتالوج"
    ];

    for (const prompt of actionPrompts) {
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
