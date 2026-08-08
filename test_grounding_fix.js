const ARABIC_NUMBER_WORDS = ["صفر","واحد","اتنين","إتنين","تلاتة","ثلاثة","اربعة","أربعة","خمسة","ستة","سبعة","تمنية","ثمانية","تسعة","عشرة","عشرين","تلاتين","اربعين","خمسين","ستين","سبعين","تمانين","تسعين","مية","ميه","مائة","ميتين","مائتين","تلتميه","ثلاثمائة","ربعميه","أربعمائة","خمسميه","خمسمائة","ستميه","سبعميه","تمنميه","تسعميه","الف","ألف","الفين","ألفين","الاف","آلاف","مليون","ملايين","نص","نصف","ربع","تلت","ثلت"];

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

function messageHasAnyNumber(msg) {
  const normalized = normalizeArabic(msg);
  if (/\d/.test(normalized)) return true;
  return ARABIC_NUMBER_WORDS.some((w) => normalized.includes(normalizeArabic(w)));
}

function isArabicFuzzyMatch(toolWord, msgWords) {
  const tw = toolWord.replace(/^(ال|و|ب|ك|ف)/, "");
  if (tw.length <= 2) return false;
  return msgWords.some((mw) => {
    const cleanMw = mw.replace(/^(ال|و|ب|ك|ف)/, "");
    if (cleanMw === tw) return true;
    if (cleanMw.includes(tw) || tw.includes(cleanMw)) return true;
    if (cleanMw.length >= 3 && tw.length >= 3 && cleanMw.slice(0, 3) === tw.slice(0, 3)) {
      return true;
    }
    return false;
  });
}

function groundingCheck(toolName, args, userMessageText) {
  const msg = userMessageText || "";
  const normalizedMsg = normalizeArabic(msg);
  const msgWords = normalizedMsg.split(" ").filter((w) => w.length > 1);

  const textFields = ["item_name"];
  for (const field of textFields) {
    const val = args?.[field];
    if (val && String(val).trim().length > 1) {
      const normalizedVal = normalizeArabic(String(val));
      const words = normalizedVal.split(" ").filter((w) => w.length > 1);
      const anyWordFound = words.length === 0 || words.some((w) => normalizedMsg.includes(w) || isArabicFuzzyMatch(w, msgWords));
      if (!anyWordFound) {
        return { ok: false, reason: `القيمة "${val}" في الحقل ${field} مش موجودة في رسالة المستخدم الأصلية` };
      }
    }
  }

  const numericCandidates = [args?.price, args?.amount, args?.total_amount, args?.paid_amount];
  const hasNonZeroNumeric = numericCandidates.some((v) => typeof v === "number" && v > 0);
  if (hasNonZeroNumeric && !messageHasAnyNumber(msg)) {
    return { ok: false, reason: "الأداة رجّعت مبلغ رقمي لكن رسالة المستخدم لا تحتوي على أي رقم" };
  }

  return { ok: true };
}

console.log("Test 1 (كرتونه مسامير ب ٥٠):", groundingCheck("log_sale", { item_name: "مسامير", price: 50 }, "كرتونه مسامير ب ٥٠"));
console.log("Test 2 (٢ مسمار ب ١٠٠):", groundingCheck("log_sale", { item_name: "مسامير", price: 50, quantity: 2 }, "٢ مسمار ب ١٠٠"));
console.log("Test 3 (بعت ٢ مسامير ب ١٠٠):", groundingCheck("log_sale", { item_name: "مسامير", price: 50, quantity: 2 }, "بعت ٢ مسامير ب ١٠٠"));
