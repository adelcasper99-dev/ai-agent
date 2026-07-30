// app/api/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const KNOWN_KEYS = [
  "VOICE_PROVIDER", // "openai" | "gemini"
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
];

export async function GET() {
  const rows = await prisma.setting.findMany();
  const map: Record<string, string> = {};
  for (const k of KNOWN_KEYS) map[k] = ""; // نضمن كل المفاتيح موجودة في الرد حتى لو فاضية
  for (const row of rows) map[row.key] = row.value;
  return NextResponse.json({ settings: map });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json(); // { OPENAI_API_KEY: "...", LIVEKIT_URL: "...", ... }

    for (const [key, value] of Object.entries(body)) {
      if (!KNOWN_KEYS.includes(key)) continue;
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "حصل خطأ في الحفظ" }, { status: 500 });
  }
}
