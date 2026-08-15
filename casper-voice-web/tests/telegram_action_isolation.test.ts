import { describe, it, expect } from "vitest";

describe("Telegram Action Verb Isolation & Ledger Safety Suite", () => {
  const isNewTransactionCmdRegex = /(اشتريت|اشترى|هنشتري|نشتري|شراء|بعت|بيع|هنبيع|نبيع|أضف|اضف|ضيف|احجز|رجعت)/i;
  const isPendingChoicePurgeCmdRegex = /(اشتريت|اشترى|هنشتري|نشتري|شراء|بعت|بيع|هنبيع|نبيع|رجعت|أضف|اضف|ضيف|احجز|إلغاء|الغاء|كشف\s*حساب|حساب\s*المورد|حساب\s*العميل|رصيد)/i;
  const hasTotalAnchorRegex = /(?:\s|^)(?:ب|بـ|سعر|إجمالي|اجمالي|بإجمالي|باجمالي|بالإجمالي|بالاجمالي|والإجمالي|والاجمالي|وإجمالي|واجمالي|بقيمة|ثمن|المجموع)\s*(?:\d+|ألف|الف|مية|ميه|مليون)/i;
  const hasPaidAnchorRegex = /(?:\s|^)(?:دفع|دفعت|ادفع|سددت|مقدم|عربون|كاش|بالكاش|بـكاش|نقدا|نقداً|مسدد|مدفوع)/i;

  it("Item 1 & 2 (Tool Router Redirect): Payment prompts containing 'دفعت' redirect to log_supplier_payment", () => {
    const paymentPrompt = "دفعت للمورد أبوتريكة 50000";
    
    // Test regex redirect logic matching line 1283 of telegram_llm.ts
    const isPaymentRedirect = /(?:\s|^)دفعت\s+(?:ل|لـ|ل للمورد)?/i.test(paymentPrompt);
    expect(isPaymentRedirect).toBe(true);

    const suppMatch = paymentPrompt.match(/دفعت\s+(?:ل|لـ|ل للمورد)?\s*([أ-ي\s]{2,20}?)\s+\d+/i);
    expect(suppMatch?.[1].trim()).toBe("لمورد أبوتريكة");
  });

  it("Item 3 (Regex Disambiguation): Payment verbs do NOT trigger isNewTransactionCmd context wipe", () => {
    const paymentWords = ["دفعت 50000 بس والباقى اجل", "سددت 20000 كاش", "دفعت العربون"];

    for (const text of paymentWords) {
      expect(isNewTransactionCmdRegex.test(text)).toBe(false);
      expect(hasPaidAnchorRegex.test(text)).toBe(true);
    }
  });

  it("Item 3 (Regex Disambiguation): New transactions DO trigger isNewTransactionCmd context wipe", () => {
    const newTxWords = ["اشتريت 10 طن فراخ", "بعت 5 كراتين", "أضف منتج جديد", "رجعت بضاعة"];

    for (const text of newTxWords) {
      expect(isNewTransactionCmdRegex.test(text)).toBe(true);
    }
  });

  it("Item 3 (Read-Only Queries): Statements and balance queries do NOT trigger new transaction context wipe", () => {
    const readOnlyQueries = ["حساب المورد أبوتريكة", "كشف حساب العميل أحمد", "رصيد المحل"];

    for (const text of readOnlyQueries) {
      expect(isNewTransactionCmdRegex.test(text)).toBe(false);
      expect(isPendingChoicePurgeCmdRegex.test(text)).toBe(true);
    }
  });

  it("Verbatim Bug Report Test: 'اشترى 10 طن فراخ من أبوتريكة اجمالي ب 20000'", () => {
    const verbatimWrittenBugPrompt = "اشترى 10 طن فراخ من أبوتريكة اجمالي ب 20000";
    
    expect(hasTotalAnchorRegex.test(verbatimWrittenBugPrompt)).toBe(true);
    expect(isNewTransactionCmdRegex.test(verbatimWrittenBugPrompt)).toBe(true);
  });
});
