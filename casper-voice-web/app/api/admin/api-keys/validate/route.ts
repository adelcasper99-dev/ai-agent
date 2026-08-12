import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

export async function POST(req: Request) {
  try {
    const { keyString, provider } = await req.json();
    if (!keyString) {
      return NextResponse.json({ success: false, error: "Missing keyString" });
    }

    const isGroq = provider?.toLowerCase() === "groq" || keyString.trim().startsWith("gsk_");

    if (isGroq) {
      // Validate Groq Key via Groq SDK
      try {
        const groq = new Groq({ apiKey: keyString.trim() });
        await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: "hi" }],
          max_tokens: 5,
        });
        return NextResponse.json({
          success: true,
          status: "VALID",
          message: "مفتاح Groq صالح ويعمل بنجاح (Llama 3.3 70B)"
        });
      } catch (err: any) {
        if (err?.status === 429 || err?.statusCode === 429 || /429|rate_limit|quota/i.test(err?.message || "")) {
          return NextResponse.json({
            success: false,
            status: "EXHAUSTED",
            message: "رصيد Groq مستنفد (429) — المفتاح صالح لكن تجاوز الحصة"
          });
        }
        return NextResponse.json({
          success: false,
          status: "INVALID",
          message: err?.message || "مفتاح Groq غير صالح"
        });
      }
    }

    // Use Gemini SDK for Google keys (Groq code untouched!)
    const genAI = new GoogleGenerativeAI(keyString.trim());
    const modelsToTry = ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];

    let lastGeminiError = "";
    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        await model.generateContent("hi");
        return NextResponse.json({
          success: true,
          status: "VALID",
          message: `مفتاح Gemini صالح ويعمل بنجاح (${modelName})`
        });
      } catch (err: any) {
        lastGeminiError = err?.message || String(err);
        if (err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("Quota")) {
          return NextResponse.json({
            success: false,
            status: "EXHAUSTED",
            message: `الرصيد المجاني مستنفد (429) — المفتاح صالح لكن تجاوز الحصة اليومية`
          });
        }
        if (err?.message?.includes("API_KEY_INVALID") || err?.message?.includes("API key not valid") || err?.status === 400) {
          return NextResponse.json({
            success: false,
            status: "INVALID",
            message: "مفتاح Gemini غير صالح أو خاطئ (API_KEY_INVALID). يرجى التأكد من نسخته من Google AI Studio."
          });
        }
        if (err?.status === 404 || err?.message?.includes("404") || err?.message?.includes("not found")) {
          continue;
        }
        return NextResponse.json({
          success: false,
          status: "INVALID",
          message: err?.message || "مفتاح Gemini غير صالح"
        });
      }
    }

    return NextResponse.json({
      success: false,
      status: "INVALID",
      message: `لم نتمكن من الوصول للموديل: ${lastGeminiError || "تأكد من تفعيل الموديلات في حساب Google AI Studio"}`
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, status: "ERROR", message: error.message });
  }
}
