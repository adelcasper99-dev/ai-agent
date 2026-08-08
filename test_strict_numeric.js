function normalizeArabic(s) {
  return String(s ?? "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function extractAllNumbersFromArabicText(text) {
  const normalized = normalizeArabic(text);
  const numbers = [];

  const matches = normalized.match(/\d+(?:\.\d+)?/g);
  if (matches) {
    for (const m of matches) {
      const n = parseFloat(m);
      if (!isNaN(n)) numbers.push(n);
    }
  }

  const WORD_TO_NUM = {
    "نص": 0.5, "نصف": 0.5, "ربع": 0.25, "تلت": 0.333, "ثلت": 0.333,
    "واحد": 1, "اتنين": 2, "إتنين": 2, "تلاتة": 3, "ثلاثة": 3, "اربعة": 4, "أربعة": 4,
    "خمسة": 5, "ستة": 6, "سبعة": 7, "تمنية": 8, "ثمانية": 8, "تسعة": 9, "عشرة": 10,
    "عشرين": 20, "تلاتين": 30, "اربعين": 40, "خمسين": 50, "ستين": 60, "سبعين": 70, "تمانين": 80, "تسعين": 90,
    "مية": 100, "ميه": 100, "مائة": 100, "ميتين": 200, "مائتين": 200,
    "تلتميه": 300, "ثلاثمائة": 300, "ربعميه": 400, "أربعمائة": 400, "خمسميه": 500, "خمسمائة": 500,
    "ستميه": 600, "سبعميه": 700, "تمنميه": 800, "تسعميه": 900,
    "الف": 1000, "ألف": 1000, "الفين": 2000, "ألفين": 2000, "مليون": 1000000
  };

  for (const [word, val] of Object.entries(WORD_TO_NUM)) {
    if (normalized.includes(word)) {
      numbers.push(val);
    }
  }

  return numbers;
}

function isNumericValueGrounded(price, quantity, amount, userMsg) {
  const userNumbers = extractAllNumbersFromArabicText(userMsg);
  if (userNumbers.length === 0) return false;

  const qty = Number(quantity) || 1;
  const p = Number(price) || 0;
  const a = Number(amount) || 0;

  const candidateToolValues = [
    p,
    a,
    p * qty,
    a * qty,
    qty > 0 ? p / qty : 0,
    qty > 0 ? a / qty : 0
  ].filter((v) => typeof v === "number" && v > 0);

  return candidateToolValues.some((tv) =>
    userNumbers.some((un) => Math.abs(tv - un) < 0.05 || (un > 0 && Math.abs((tv - un) / un) < 0.05))
  );
}

// Tests:
console.log("Test A: '2 مسمار ب100' with price=125, qty=2 ->", isNumericValueGrounded(125, 2, 0, "2 مسمار ب100")); // FAIL (false)
console.log("Test B: '2 مسمار ب100' with price=50, qty=2 ->", isNumericValueGrounded(50, 2, 0, "2 مسمار ب100"));  // PASS (true)
console.log("Test C: 'بعت 5 شاشات الواحدة بـ 2000' with price=2000, qty=5 ->", isNumericValueGrounded(2000, 5, 0, "بعت 5 شاشات الواحدة بـ 2000")); // PASS (true)
console.log("Test D: 'اشتريت بـ 500' with amount=750 ->", isNumericValueGrounded(0, 1, 750, "اشتريت بـ 500")); // FAIL (false)
