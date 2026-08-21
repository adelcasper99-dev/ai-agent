/**
 * tenant-name-cleaner.ts — Cleans and extracts concise business names from conversational user input
 */

export function extractCleanBusinessName(rawText: string | null | undefined): string {
  if (!rawText || !rawText.trim()) return "شركة غير محددة";
  
  let cleaned = rawText
    .replace(/^["'«»“”]+/g, '')
    .replace(/["'«»“”]+$/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();

  // 1. If text is already a clean short title (<= 35 chars) without conversational noise
  const conversationalTriggers = [
    /^(إزيك|ازيك|مرحبا|اهلا|أهلاً|صباح الخير|مساء الخير|السلام عليكم|هاي|يا فندم|يا باشا)/i,
    /^(أنا|انا)\s+(شغال|فاتح|بشتغل|عندي|صاحب)/i,
    /(عامل إيه|عامل ايه|أخبار|اخبارك|حموكشة|حبيبي)/i,
    /(مجال|شغال في|بشتغل في)/i,
  ];

  const isConversational = conversationalTriggers.some((rx) => rx.test(cleaned));

  if (cleaned.length <= 35 && !isConversational) {
    return cleaned;
  }

  // 2. Remove greetings, questions, and conversational headers
  let extracted = cleaned
    .replace(/^(إزيك|ازيك|مرحبا|اهلا|أهلاً|صباح الخير|مساء الخير|السلام عليكم|هاي)[^؟!\.]*([؟!\.]|$)/gi, ' ')
    .trim();

  // Remove self-introductions ("أنا شغال في مجال...", "فاتح محل...")
  extracted = extracted
    .replace(/^(أنا|انا|إحنا|احنا)\s+(شغالين|شغال|فاتح|بشتغل|عندي|صاحب|بنشتغل)\s+(في\s+)?(مجال\s+)?/gi, '')
    .replace(/^في\s+مجال\s+/gi, '')
    .replace(/^شركة\s+في\s+مجال\s+/gi, '')
    .replace(/^مجال\s+/gi, '')
    .trim();

  // If text contains "سواء" or "اللي هو" or detailed breakdown, take the core title before it
  const splitKeywords = [
    /\s+سواء\s+/i,
    /\s+اللي هو\s+/i,
    /\s+اللي هي\s+/i,
    /\s+يعني\s+/i,
    /\s+ببيع\s+/i,
    /\s+وبعمل\s+/i,
    /\s+وكمان\s+/i,
    /,|،|\.|\n/
  ];

  for (const rx of splitKeywords) {
    const parts = extracted.split(rx);
    if (parts[0] && parts[0].trim().length >= 4) {
      extracted = parts[0].trim();
      break;
    }
  }

  // Prefix "مؤسسة" if purely descriptive
  if (extracted.startsWith("المطابخ") || extracted.startsWith("الملابس") || extracted.startsWith("السيارات") || extracted.startsWith("الشبابيك")) {
    extracted = `مؤسسة ${extracted}`;
  }

  // Final length guard (max 40 chars)
  if (extracted.length > 40) {
    extracted = extracted.slice(0, 37).trim() + "...";
  }

  return extracted || "مؤسسة تجارية";
}
