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

    // Use Gemini SDK for Google keys
    const genAI = new GoogleGenerativeAI(keyString.trim());
    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];

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
        if (err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("Quota")) {
          return NextResponse.json({
            success: false,
            status: "EXHAUSTED",
            message: `الرصيد المجاني مستنفد (429) — المفتاح صالح لكن تجاوز الحصة`
          });
        }
        if (err?.status === 404 || err?.message?.includes("404") || err?.message?.includes("not found")) {
          continue;
        }
        return NextResponse.json({
          success: false,
          status: "INVALID",
          message: err?.message || "مفتاح غير صالح"
        });
      }
    }

    return NextResponse.json({
      success: false,
      status: "INVALID",
      message: "لا يوجد موديل متاح لهذا المفتاح — تأكد من صحة المفتاح وصلاحياته"
    });

  } catch (error: any) {
    return NextResponse.json({ success: false, status: "ERROR", message: error.message });
  }
}
