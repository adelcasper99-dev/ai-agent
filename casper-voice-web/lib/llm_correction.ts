import Groq from "groq-sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Performs a fast Post-STT LLM correction pass on raw transcribed text.
 * Fixes spelling errors and merges incorrectly split words without changing meaning.
 * 
 * Fails open (returns rawText) if the API fails or takes > 3000ms.
 */
export async function correctTranscriptWithLLM(rawText: string): Promise<string> {
  if (!rawText || rawText.trim().length < 2) return rawText;

  try {
    let groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
       const setting = await (prisma as any).setting.findUnique({ where: { key: "GROQ_API_KEY" } });
       if (setting) groqKey = setting.value;
    }
    
    if (!groqKey) {
      console.warn("[LLM Correction] GROQ_API_KEY missing, skipping correction.");
      return rawText;
    }

    const groq = new Groq({ apiKey: groqKey });

    const prompt = `أنت مصحح لغوي ذكي مخصص لنظام مبيعات وحسابات كاسبر (Casper POS & ERP).
النص التالي مفرغ صوتياً من رسالة عامية مصرية لتاجر أو مدير عمل.

قواعد التصحيح الصارمة:
1. قم فقط بإصلاح الأخطاء الإملائية والعدبية الواضحة (مثل: تلاته -> 3، كرتونه -> كرتونة، جني -> جنيه، مسمور -> مسمار).
2. إذا كانت هناك كلمة غامضة أو اسم صنف/عميل غير مألوف، اتركه كما هو بالضبط ولا تحاول التكهن أو اختراع كلمات بديلة من عندك (مثال: ممنوع تحويل "تلتا" إلى "تلت أوقات").
3. حافظ على المعنى والبنية والكلمات الأصلية كما هي تماماً دون زيادة أو تغيير للمفهوم.
4. أرجع النص المصحح فقط بدون أي مقدمات أو شروحات.

النص: "${rawText}"`;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, 3000); // 3-second hard timeout for ultra-low latency

    try {
      const completion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: "llama-3.1-8b-instant",
        temperature: 0.1, // Low temperature for deterministic correction
        max_tokens: 500,
      }, { signal: controller.signal as any }); // Cast as any because the type definition might not include signal, but node-fetch underlying it often does

      clearTimeout(timeout);

      let correctedText = completion.choices[0]?.message?.content || "";
      correctedText = correctedText.trim();
      
      // Strip potential hallucinations like "Sure", "Here is", "النص المصحح:"
      correctedText = correctedText.replace(/^النص المصحح:\s*/i, "");
      correctedText = correctedText.replace(/^"|"$/g, ""); // Remove wrapping quotes if present
      
      if (correctedText.length > 0) {
        return correctedText;
      }
      return rawText;
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === 'AbortError') {
         console.warn("[LLM Correction] Timeout exceeded (3000ms), failing open.");
      } else {
         console.error("[LLM Correction] API Error:", err.message);
      }
      return rawText;
    }
  } catch (outerErr: any) {
    console.error("[LLM Correction] Unexpected Error:", outerErr.message);
    return rawText;
  }
}
