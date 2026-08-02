import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  try {
    const { keyString } = await req.json();
    if (!keyString) {
      return NextResponse.json({ success: false, error: "Missing keyString" });
    }

    // Use SDK directly — handles API versioning automatically
    const genAI = new GoogleGenerativeAI(keyString);

    // Try models in order: newest with free tier first
    const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"];

    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        await model.generateContent("hi");
        return NextResponse.json({
          success: true,
          status: "VALID",
          message: `المفتاح صالح ويعمل بنجاح (${modelName})`
        });
      } catch (err: any) {
        if (err?.status === 429 || err?.message?.includes("429") || err?.message?.includes("Quota")) {
          return NextResponse.json({
            success: false,
            status: "EXHAUSTED",
            message: `الرصيد المجاني مستنفد (429) — المفتاح صالح لكن تجاوز الحصة`
          });
        }
        // 404 = model not available for this key, try next
        if (err?.status === 404 || err?.message?.includes("404") || err?.message?.includes("not found")) {
          continue;
        }
        // Other error (invalid key, etc.)
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
