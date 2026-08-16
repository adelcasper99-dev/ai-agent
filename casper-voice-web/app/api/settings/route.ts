// app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptField, decryptField, maskSecret } from "@/lib/crypto";

const KNOWN_KEYS = [
  "VOICE_PROVIDER", // "openai" | "gemini" | "groq_pipeline" | "deepgram_pipeline"
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "DEEPGRAM_API_KEY",
  "FISH_API_KEY",
  "FISH_VOICE_ID",
  "VOICE_TONE",
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
];

const SENSITIVE_KEYS = [
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "DEEPGRAM_API_KEY",
  "FISH_API_KEY",
  "LIVEKIT_API_SECRET",
];

export async function GET() {
  try {
    const rows = await prisma.setting.findMany();
    const map: Record<string, string> = {};

    // 1. افتراضيات من ملف البيئة .env
    for (const k of KNOWN_KEYS) {
      let envVal = process.env[k] || "";
      if (k === "GROQ_API_KEY" && !envVal) {
        envVal = process.env.OPENROUTER_API_KEY || "";
      }
      if (k === "VOICE_PROVIDER" && !envVal) {
        envVal = "groq_pipeline";
      }
      if (k === "VOICE_TONE" && !envVal) {
        envVal = "shakir";
      }
      map[k] = SENSITIVE_KEYS.includes(k) && envVal ? maskSecret(envVal) : envVal;
    }

    // 2. تحديث بالقيم الموجودة في قاعدة البيانات (تأخذ الأولوية إذا كانت غير فارغة)
    for (const row of rows) {
      if (row.value && row.value.trim() !== "") {
        map[row.key] = SENSITIVE_KEYS.includes(row.key)
          ? maskSecret(row.value)
          : row.value;
      }
    }

    return NextResponse.json({ settings: map });
  } catch (err) {
    console.error("[Settings GET Error]", err);
    const fallbackMap: Record<string, string> = {};
    for (const k of KNOWN_KEYS) {
      const val = process.env[k] || "";
      fallbackMap[k] = SENSITIVE_KEYS.includes(k) && val ? maskSecret(val) : val;
    }
    return NextResponse.json({ settings: fallbackMap });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // { OPENAI_API_KEY: "...", LIVEKIT_URL: "...", ... }

    for (const [key, value] of Object.entries(body)) {
      if (!KNOWN_KEYS.includes(key)) continue;
      const strVal = String(value ?? "").trim();
      
      // Don't overwrite existing secret if UI sent back masked placeholder
      if (SENSITIVE_KEYS.includes(key) && strVal.includes("...")) {
        continue;
      }

      const valToSave = SENSITIVE_KEYS.includes(key) && strVal
        ? encryptField(strVal)
        : strVal;

      await prisma.setting.upsert({
        where: { key },
        update: { value: valToSave },
        create: { key, value: valToSave },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "حصل خطأ في الحفظ" }, { status: 500 });
  }
}
