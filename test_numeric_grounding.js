const ARABIC_NUMBER_WORDS = [
  "صفر","واحد","اتنين","إتنين","تلاتة","ثلاثة","اربعة","أربعة","خمسة","ستة","سبعة","تمنية","ثمانية","تسعة","عشرة",
  "عشرين","تلاتين","اربعين","خمسين","ستين","سبعين","تمانين","تسعين",
  "مية","ميه","مائة","ميتين","مائتين","تلتميه","ثلاثمائة","ربعميه","أربعمائة","خمسميه","خمسمائة",
  "ستميه","سبعميه","تمنميه","تسعميه",
  "الف","ألف","الفين","ألفين","الاف","آلاف",
  "مليون","ملايين",
  "نص","نصف","ربع","تلت","ثلت"
];

function normalizeArabic(s) {
  return String(s ?? "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function messageHasAnyNumber(msg) {
  const normalized = normalizeArabic(msg);
  if (/\d/.test(normalized)) return true;
  return ARABIC_NUMBER_WORDS.some((w) => normalized.includes(normalizeArabic(w)));
}

console.log("Test 1 (ميتين):", messageHasAnyNumber("بعت كرتونة بميتين جنيه"));
console.log("Test 2 (نص):", messageHasAnyNumber("اشتريت نص كيلو عسل"));
console.log("Test 3 (الفين):", messageHasAnyNumber("سددت الفين للمورد"));
console.log("Test 4 (كرتونتين):", messageHasAnyNumber("بعت كرتونتين مسامير")); // "كرتونتين" -> doesn't have a number word, but the LLM returns quantity=2!
