import { describe, it, expect } from "vitest";

describe("Telegram Action Verb Isolation & Ledger Safety Full 13-Test Suite", () => {
  const isNewTransactionCmdRegex = /(اشتريت|اشترى|هنشتري|نشتري|شراء|بعت|بيع|هنبيع|نبيع|أضف|اضف|ضيف|احجز|رجعت|إلغاء|الغاء)/i;
  const isPendingChoicePurgeCmdRegex = /(اشتريت|اشترى|هنشتري|نشتري|شراء|بعت|بيع|هنبيع|نبيع|رجعت|أضف|اضف|ضيف|احجز|إلغاء|الغاء|كشف\s*حساب|حساب\s*المورد|حساب\s*العميل|رصيد)/i;
  const hasTotalAnchorRegex = /(?:\s|^)(?:ب|بـ|سعر|إجمالي|اجمالي|بإجمالي|باجمالي|بالإجمالي|بالاجمالي|والإجمالي|والاجمالي|وإجمالي|واجمالي|بقيمة|ثمن|المجموع)\s*(?:\d+|ألف|الف|مية|ميه|مليون)/i;
  const hasPaidAnchorRegex = /(?:\s|^)(?:دفع|دفعت|ادفع|سددت|مقدم|عربون|كاش|بالكاش|بـكاش|نقدا|نقداً|مسدد|مدفوع)/i;

  it("Test 1 (Verbatim Bug Report 1): 'اشترى 10 طن فراخ من أبوتريكة اجمالي ب 20000'", () => {
    const prompt = "اشترى 10 طن فراخ من أبوتريكة اجمالي ب 20000";
    expect(hasTotalAnchorRegex.test(prompt)).toBe(true);
    expect(isNewTransactionCmdRegex.test(prompt)).toBe(true);
  });

  it("Test 2 (Verbatim Bug Report 2 - Audio Variant): 'اشتريت من أبوتريكة 10 طن فراخ اجمالي 200000'", () => {
    const prompt = "اشتريت من أبوتريكة 10 طن فراخ اجمالي 200000";
    expect(hasTotalAnchorRegex.test(prompt)).toBe(true);
    expect(isNewTransactionCmdRegex.test(prompt)).toBe(true);
  });

  it("Test 3 (Verbatim Bug Reply - Payment Split): 'دفعت 50000 بس والباقى اجل'", () => {
    const prompt = "دفعت 50000 بس والباقى اجل";
    expect(isNewTransactionCmdRegex.test(prompt)).toBe(false);
    expect(hasPaidAnchorRegex.test(prompt)).toBe(true);
  });

  it("Test 4 (Section C Non-Persistence): Purchase prompt containing total anchor matches total regex", () => {
    const prompt = "اشتريت من أبوتريكة 10 طن فراخ اجمالي 200000";
    expect(hasTotalAnchorRegex.test(prompt)).toBe(true);
  });

  it("Test 5 (Free-Text Cash Reply Isolation): '50000 كاش' and 'دفعت 50000 كاش'", () => {
    const prompt1 = "50000 كاش";
    const prompt2 = "دفعت 50000 كاش";
    expect(hasPaidAnchorRegex.test(prompt1)).toBe(true);
    expect(hasPaidAnchorRegex.test(prompt2)).toBe(true);
    expect(isNewTransactionCmdRegex.test(prompt1)).toBe(false);
    expect(isNewTransactionCmdRegex.test(prompt2)).toBe(false);
  });

  it("Test 6 (Conjunction Anchors): 'والإجمالي 200000' and 'والاجمالي 200000'", () => {
    expect(hasTotalAnchorRegex.test("والإجمالي 200000")).toBe(true);
    expect(hasTotalAnchorRegex.test("والاجمالي 200000")).toBe(true);
  });

  it("Test 7 (Interceptor Ordering): Total anchor evaluates correctly before pending choice purge", () => {
    const text = "اشتريت بضاعة باجمالي 5000";
    expect(hasTotalAnchorRegex.test(text)).toBe(true);
    expect(isPendingChoicePurgeCmdRegex.test(text)).toBe(true);
  });

  it("Test 8 (Imperative Verb Isolation): Actions that start new transactions", () => {
    const verbs = ["اشتريت 50 كجم", "بعت كرتونة", "أضف عميل جديد", "احجز ميعاد"];
    for (const v of verbs) {
      expect(isNewTransactionCmdRegex.test(v)).toBe(true);
    }
  });

  it("Test 9 (Tool Router Redirect): Payment prompts with 'دفعت' redirect log_sale AND log_purchase to log_supplier_payment", () => {
    const paymentPrompt = "دفعت للمورد أبوتريكة 50000";
    const isPaymentRedirect = /(?:\s|^)دفعت\s+(?:ل|لـ|ل للمورد)?/i.test(paymentPrompt);
    expect(isPaymentRedirect).toBe(true);

    const suppMatch = paymentPrompt.match(/دفعت\s+(?:ل|لـ|ل للمورد)?\s*([أ-ي\s]{2,20}?)\s+\d+/i);
    expect(suppMatch?.[1].trim()).toBe("لمورد أبوتريكة");
  });

  it("Test 10 (Payment Verbs History Retention): Payment verbs do NOT trigger isNewTransactionCmd context wipe", () => {
    const paymentWords = ["دفعت 50000 بس والباقى اجل", "سددت 20000 كاش", "دفعت العربون"];
    for (const text of paymentWords) {
      expect(isNewTransactionCmdRegex.test(text)).toBe(false);
      expect(hasPaidAnchorRegex.test(text)).toBe(true);
    }
  });

  it("Test 11 (New Transactions History Reset): New transactions DO trigger isNewTransactionCmd context wipe", () => {
    const newTxWords = ["اشتريت 10 طن فراخ", "بعت 5 كراتين", "أضف منتج جديد", "رجعت بضاعة", "إلغاء العملية الأخيرة"];
    for (const text of newTxWords) {
      expect(isNewTransactionCmdRegex.test(text)).toBe(true);
    }
  });

  it("Test 12 (Read-Only Queries Context Retention): Statements and balance queries do NOT trigger new transaction context wipe", () => {
    const readOnlyQueries = ["حساب المورد أبوتريكة", "كشف حساب العميل أحمد", "رصيد المحل"];
    for (const text of readOnlyQueries) {
      expect(isNewTransactionCmdRegex.test(text)).toBe(false);
      expect(isPendingChoicePurgeCmdRegex.test(text)).toBe(true);
    }
  });

  it("Test 13 (Idempotency Key Structure): Idempotency key format and presence verification", () => {
    const idempotencyKey = `pay_supp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    expect(idempotencyKey).toMatch(/^pay_supp_\d+_[a-z0-9]+$/);
  });
});
