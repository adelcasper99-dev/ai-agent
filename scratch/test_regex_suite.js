function normalizeArabicDigits(str) {
  return str.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

function isIllegalAlumitalCalculationText(text) {
  const norm = normalizeArabicDigits(text);
  
  // 1. Table check
  const tablePattern = /\|[^\n]*(?:شباك|باب|مطبخ|قطاع|متر|إجمالي|اجمالي|المقاس|البيان)[^\n]*\|[\s\S]*\|[^\n]*\d+[x×*]\d+[^\n]*\|/i;
  if (tablePattern.test(norm)) return true;

  // 2. Price amount & currency pattern
  const pricePattern = /(?:\d{3,7}|\d+[\.,]\d+)\s*(?:جنيه|ج\.م|ج(?=[\s.,!؟،)]|$)(?!دول|هاز|ديد|نب))/i;
  if (!pricePattern.test(norm)) return false;

  // 3. Alumital context & calculation keywords
  const hasAlumitalKeyword = /(?:مقايسة|شباك|باب|ألوميتال|الوميتال|المتر|أمتار|الأمتار)/i.test(norm);
  const hasCalcKeyword = /(?:(?:ال)?(?:إجمالي|اجمالي|تكلفة|سعر|حسبة|حساب)|(?:يكلف|تكلف|هيكلفك))/i.test(norm);

  return hasAlumitalKeyword && hasCalcKeyword;
}

const tests = [
  { text: '67000 جنيه هو إجمالي مقايسة الشباك بتاعتك', shouldMatch: true },
  { text: 'هيكلفك 67000 جنيه عشان الشباك ده في المقايسة', shouldMatch: true },
  { text: 'الإجمالي لمقايسة الشباك 67,830 جنيه', shouldMatch: true },
  { text: 'الإجمالي لمقايسة الشباك هيبقى ٦٧٨٣٠ جنيه', shouldMatch: true },
  { text: 'الإجمالي لمقايسة الشباك هيبقى حوالي 67000 جنيه.', shouldMatch: true },
  { text: 'مقايسة الشباك الإجمالي هيبقى 67000 ج.م.', shouldMatch: true },
  { text: 'شباك ألوميتال جديد في المخزن', shouldMatch: false },
  { text: 'شباك ألوميتال والسعر تقريبا 500 جدول', shouldMatch: false },
  { text: 'عندي في المخزن 500 كرتونة مسامير وسعرها 3000 جنيه', shouldMatch: false }
];

let allPass = true;
tests.forEach((t, i) => {
  const matched = isIllegalAlumitalCalculationText(t.text);
  const passed = matched === t.shouldMatch;
  if (!passed) allPass = false;
  console.log(`Test ${i+1}: expected=${t.shouldMatch}, actual=${matched}, pass=${passed}`);
});
console.log(`ALL TESTS PASS: ${allPass}`);
if (!allPass) process.exit(1);
