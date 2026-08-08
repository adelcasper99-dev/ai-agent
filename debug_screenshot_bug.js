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

function extractAllNumbersFromText(text) {
  const norm = normalizeArabic(text);
  const nums = [];
  const matches = norm.match(/\d+(?:\.\d+)?/g);
  if (matches) {
    for (const m of matches) {
      const n = parseFloat(m);
      if (!isNaN(n)) nums.push(n);
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
    if (norm.includes(word)) nums.push(val);
  }
  return nums;
}

console.log("Extracted nums for 'بعت 2 مسامير ب 100':", extractAllNumbersFromText("بعت 2 مسامير ب 100"));

const p = 125, q = 2, a = 0;
const userNums = extractAllNumbersFromText("بعت 2 مسامير ب 100");
const candidateToolValues = [
  p,
  a,
  p * q,
  a * q,
  q > 0 && p > 0 ? p / q : 0,
  q > 0 && a > 0 ? a / q : 0
].filter((v) => typeof v === "number" && v > 0);

console.log("candidateToolValues:", candidateToolValues);

const isMatch = candidateToolValues.some((tv) =>
  userNums.some((un) => Math.abs(tv - un) < 0.05 || (un > 0 && Math.abs((tv - un) / un) < 0.05))
);

console.log("isMatch:", isMatch);
