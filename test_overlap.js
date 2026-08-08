function isArabicFuzzyMatch(toolWord, msgWords) {
  const tw = toolWord.replace(/^(ال|و|ب|ك|ف)/, "");
  if (tw.length <= 2) return false;
  const set1 = new Set(tw);
  return msgWords.some((mw) => {
    const cleanMw = mw.replace(/^(ال|و|ب|ك|ف)/, "");
    if (cleanMw === tw) return true;
    if (cleanMw.includes(tw) || tw.includes(cleanMw)) return true;
    
    // Character overlap ratio (handles Arabic broken plurals like مسمار -> مسامير, قلم -> اقلام)
    const set2 = new Set(cleanMw);
    let match = 0;
    for (const char of set1) {
      if (set2.has(char)) match++;
    }
    const ratio = match / Math.max(set1.size, set2.size);
    return ratio >= 0.7;
  });
}

console.log("Overlap مسمار vs مسامير:", isArabicFuzzyMatch("مسامير", ["مسمار"]));
console.log("Overlap قلم vs اقلام:", isArabicFuzzyMatch("اقلام", ["قلم"]));
console.log("Overlap زيت vs عسل:", isArabicFuzzyMatch("زيت", ["عسل"]));
