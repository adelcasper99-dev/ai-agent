function normalizePaidAmount(args, userMessageText) {
  const p = Number(args?.price) || 0;
  const q = Number(args?.quantity) || 1;
  const a = Number(args?.amount || args?.total_amount) || (p * q);
  const paidVal = Number(args?.paid_amount);

  if (!isNaN(paidVal) && paidVal > 0 && Math.abs(paidVal - a) > 0.05) {
    const msg = userMessageText || "";
    // Check if user explicitly mentioned custom payment keywords
    const hasCustomPaymentKeywords = /(دفع|مقدم|عربون|آجل|اجل|باقي|متبقي|قسط|مسدد)/i.test(msg);
    if (!hasCustomPaymentKeywords) {
      console.log(`[Auto-Normalize] User prompt "${msg}" has no custom payment terms. Normalizing hallucinated paid_amount (${paidVal}) -> totalAmount (${a}).`);
      args.paid_amount = a;
      args.deferred_amount = 0;
    }
  }
  return args;
}

// Test Case 1: Standard sale with hallucinated paid_amount = 200
const args1 = { item_name: "مسامير", price: 50, quantity: 2, paid_amount: 200 };
const norm1 = normalizePaidAmount(args1, "بعت 2 مسامير ب 100");
console.log("Normalized 1 (Standard Sale):", norm1);
console.assert(norm1.paid_amount === 100, "TEST 1 FAILED: paid_amount should be normalized to 100!");

// Test Case 2: Explicit custom partial payment
const args2 = { item_name: "مسامير", price: 50, quantity: 2, paid_amount: 40, deferred_amount: 60 };
const norm2 = normalizePaidAmount(args2, "بعت 2 مسامير ب 100 دفع 40 والباقي آجل");
console.log("Normalized 2 (Custom Partial Payment):", norm2);
console.assert(norm2.paid_amount === 40, "TEST 2 FAILED: Explicit custom paid_amount (40) should be preserved!");

console.log("\n✅ ALL NORMALIZATION TESTS PASSED!");
