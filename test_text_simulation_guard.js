function sanitizeNonToolReply(text) {
  const forbiddenPatterns = [
    /تم\s*تسجيل\s*(بيع|مصروف|مشتريات|سداد|مرتجع)/i,
    /تم\s*حجز\s*موعد/i
  ];
  if (forbiddenPatterns.some(p => p.test(text))) {
    return "عشان أسجلك العملية دي محتاج تفاصيل أكتر (اسم الصنف والسعر والكمية) 💰";
  }
  return text;
}

console.log("Test Fake Text 1:", sanitizeNonToolReply("تم تسجيل بيع 2 مسامير إجمالي 250 جنيه (مدفوع: 250، متبقي: 0) بنجاح!"));
console.log("Test Normal Text 2:", sanitizeNonToolReply("أهلاً بيك يا فندم، أقدر أساعدك في إيه؟"));
