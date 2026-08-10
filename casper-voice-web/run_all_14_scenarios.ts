import { execSync } from "child_process";

const testFiles = [
  "test_financial_sanity_and_grounding.js",
  "test_purchase_messy_arabic.ts",
  "test_expense.ts",
  "test_raw_user_slang_purchase.ts",
  "test_supplier_payment.ts",
  "test_supplier_balance_and_customer_payment.ts",
  "test_purchase_return_and_add_product.ts",
  "test_stock_and_customer_statement.ts",
  "test_daily_summary_and_add_customer.ts",
  "test_ambiguity_and_arabic_numerals.ts",
  "test_ambiguous_numeric_clarification.ts",
  "test_arabi_clean_ledger_verification.ts",
  "test_purchase_return_cash_vs_credit.ts",
  "test_user_supplier_payment_slang.ts"
];

console.log("==========================================================================");
console.log("🚀 STARTING AUTOMATED COMPREHENSIVE RE-TEST OF 14 CUSTOMER ENGAGEMENT SCENARIOS");
console.log("==========================================================================\n");

const results: { file: string; status: "PASSED" | "FAILED"; output: string; durationMs: number }[] = [];

for (const file of testFiles) {
  console.log(`\n--------------------------------------------------------------------------`);
  console.log(`▶ EXECUTING SCENARIO SCRIPT: ${file}`);
  console.log(`--------------------------------------------------------------------------`);
  const start = Date.now();
  try {
    const cmd = `npx tsx ${file}`;
    const output = execSync(cmd, { cwd: __dirname, encoding: "utf-8", stdio: "pipe" });
    const durationMs = Date.now() - start;
    console.log(output);
    console.log(`✅ ${file} PASSED (${durationMs}ms)`);
    results.push({ file, status: "PASSED", output, durationMs });
  } catch (err: any) {
    const durationMs = Date.now() - start;
    const output = err.stdout || err.message;
    console.error(output);
    console.error(`❌ ${file} FAILED (${durationMs}ms)`);
    results.push({ file, status: "FAILED", output, durationMs });
  }
}

console.log("\n==========================================================================");
console.log("📊 14 CUSTOMER ENGAGEMENT SCENARIOS TEST SUMMARY");
console.log("==========================================================================");
let passedCount = 0;
results.forEach((r, idx) => {
  if (r.status === "PASSED") passedCount++;
  console.log(`${idx + 1}. [${r.status}] ${r.file} (${r.durationMs}ms)`);
});

console.log(`\nFINAL SCORE: ${passedCount}/${results.length} PASSED`);
if (passedCount < results.length) {
  process.exit(1);
}
