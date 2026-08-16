import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RoomServiceClient } from "livekit-server-sdk";
import { enforceSubscriptionExpiry } from "@/lib/subscription-guard";
import { resolveDecryptedSettings } from "@/lib/crypto";

export async function GET() {
  void enforceSubscriptionExpiry();
  const diagnostics: Record<string, { status: "OK" | "FAIL"; detail: string }> = {};

  // 1. Check Internal Middleware Auth Header Secret
  const secret = process.env.INTERNAL_SERVICE_SECRET;
  if (secret) {
    diagnostics["INTERNAL_AUTH"] = { status: "OK", detail: "سري الخدمة الداخلية معرف بنجاح" };
  } else {
    diagnostics["INTERNAL_AUTH"] = { status: "FAIL", detail: "سري الخدمة الداخلية غير معرف" };
  }

  // 2. Check Database & Settings Load
  let settings: Record<string, string> = {};
  try {
    const rows = await prisma.setting.findMany();
    settings = resolveDecryptedSettings(rows);
    diagnostics["DATABASE"] = { status: "OK", detail: `تم الاتصال بقاعدة البيانات (${rows.length} إعداد مسجل)` };
  } catch (e: any) {
    diagnostics["DATABASE"] = { status: "FAIL", detail: `فشل الاتصال بقاعدة البيانات: ${e.message}` };
  }

  // 3. Check LiveKit Credentials
  const lkUrl = settings["LIVEKIT_URL"] || process.env.LIVEKIT_URL;
  const lkKey = settings["LIVEKIT_API_KEY"] || process.env.LIVEKIT_API_KEY;
  const lkSecret = settings["LIVEKIT_API_SECRET"] || process.env.LIVEKIT_API_SECRET;

  if (lkUrl && lkKey && lkSecret) {
    try {
      const client = new RoomServiceClient(lkUrl, lkKey, lkSecret);
      await client.listRooms();
      diagnostics["LIVEKIT"] = { status: "OK", detail: "سيرفر LiveKit متصل والشفرات صحيحة" };
    } catch (e: any) {
      diagnostics["LIVEKIT"] = { status: "FAIL", detail: `فشل LiveKit: ${e.message || "خطأ مفاتيح"}` };
    }
  } else {
    diagnostics["LIVEKIT"] = { status: "FAIL", detail: "مفاتيح سيرفر LiveKit ناقصة" };
  }

  // 4. Check Active Voice Provider & Key
  const provider = settings["VOICE_PROVIDER"] || "groq_pipeline";
  diagnostics["ACTIVE_PROVIDER"] = { status: "OK", detail: `المزود المختار حالياً: ${provider.toUpperCase()}` };

  if (provider === "gemini") {
    const geminiKey = settings["GEMINI_API_KEY"] || process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      diagnostics["GEMINI_KEY"] = { status: "FAIL", detail: "مفتاح Gemini API غير موجود" };
    } else if (!geminiKey.startsWith("AIzaSy")) {
      diagnostics["GEMINI_KEY"] = { status: "FAIL", detail: "مفتاح Gemini الحالي لا يبتدئ بـ AIzaSy (مطلوب مفتاح Google AI Studio)" };
    } else {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          diagnostics["GEMINI_KEY"] = { status: "OK", detail: "مفتاح Gemini شغال ومتصل بسيرفر جوجل" };
        } else {
          diagnostics["GEMINI_KEY"] = { status: "FAIL", detail: `سيرفر جوجل ارجع رمز خطا ${res.status}` };
        }
      } catch (e: any) {
        diagnostics["GEMINI_KEY"] = { status: "FAIL", detail: "انقطاع الاتصال بسيرفر جوجل Gemini" };
      }
    }
  } else if (provider === "groq_pipeline") {
    const groqKey = settings["GROQ_API_KEY"] || process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!groqKey) {
      diagnostics["GROQ_KEY"] = { status: "FAIL", detail: "مفتاح Groq API غير موجود" };
    } else {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${groqKey}` },
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          diagnostics["GROQ_KEY"] = { status: "OK", detail: "مفتاح Groq شغال ومتصل بنجاح" };
        } else {
          diagnostics["GROQ_KEY"] = { status: "FAIL", detail: `مفتاح Groq غير صالح (${res.status})` };
        }
      } catch {
        diagnostics["GROQ_KEY"] = { status: "FAIL", detail: "فشل الاتصال بسيرفر Groq" };
      }
    }
  }

  const allPassed = Object.values(diagnostics).every((d) => d.status === "OK");

  return NextResponse.json({
    status: allPassed ? "HEALTHY" : "UNHEALTHY",
    timestamp: new Date().toISOString(),
    diagnostics,
  });
}
