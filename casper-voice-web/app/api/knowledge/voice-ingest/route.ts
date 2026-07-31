// app/api/knowledge/voice-ingest/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import Groq from "groq-sdk";

export const runtime = "nodejs";
export const maxDuration = 60; // 60s max execution time

const MAX_SIZE = 4 * 1024 * 1024; // 4MB hard limit for Vercel body size
const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    // 1. Content-length validation guard
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > MAX_SIZE) {
      return NextResponse.json({ error: "حجم الملف كبير جداً (الأقصى 4 ميجابايت)" }, { status: 413 });
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return NextResponse.json({ error: "لم يتم رفع أي ملف صوتي" }, { status: 400 });
    }

    // 2. Actual file.size validation guard
    if (audioFile.size > MAX_SIZE) {
      return NextResponse.json({ error: "حجم الملف تجاوز 4 ميجابايت" }, { status: 413 });
    }

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return NextResponse.json({ error: "مفتاح GROQ_API_KEY غير متاح" }, { status: 500 });
    }

    const groq = new Groq({ apiKey: groqKey });

    // 3. Groq Whisper Transcription
    const fileBuffer = Buffer.from(await audioFile.arrayBuffer());
    // Convert buffer to File-like object for Groq SDK
    const audioBlob = new Blob([fileBuffer], { type: audioFile.type || "audio/webm" });
    const fileForGroq = new File([audioBlob], audioFile.name || "voice_ingest.webm", {
      type: audioFile.type || "audio/webm",
    });

    const transcription = await groq.audio.transcriptions.create({
      file: fileForGroq,
      model: "whisper-large-v3-turbo",
      language: "ar",
      prompt: "تغذية قاعدة المعرفة لنظام كاسبر، أسئلة وأجوبة تفاصيل المشروع والخدمات والعملاء",
    });

    const rawText = transcription.text;
    if (!rawText || rawText.trim().length < 5) {
      return NextResponse.json({ error: "لم يتم التعرف على أي كلام في الملف الصوتي" }, { status: 400 });
    }

    // 4. LLM Q&A JSON Extraction via Groq Llama 3.3 70B
    const prompt = `
أنت خبير استخراج المعرفة لنظام Casper ERP & POS.
حلل النص المفرغ من التسجيل الصوتي التالي، واستخرج منه أهم الأسئلة والأجوبة المحتملة التي قد يسألها العملاء أو مدير العمل.

النص المفرغ:
"""
${rawText}
"""

المطلوب:
إرجاع JSON Array يحتوي على كائنات بالصيغة التالية فقط بدون أي كلام جانبي:
[
  {
    "question": "السؤال المتوقع",
    "answer": "الإجابة الشافية والدقيقة بناءً على النص",
    "keywords": ["كلمة1", "كلمة2"]
  }
]
`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
    });

    let itemsToInsert: Array<{ question: string; answer: string; keywords?: string[] }> = [];
    const content = completion.choices[0]?.message?.content || "";

    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        itemsToInsert = parsed;
      } else if (parsed.items && Array.isArray(parsed.items)) {
        itemsToInsert = parsed.items;
      } else if (parsed.qa_pairs && Array.isArray(parsed.qa_pairs)) {
        itemsToInsert = parsed.qa_pairs;
      } else {
        // Fallback single object or list in keys
        const firstKey = Object.keys(parsed)[0];
        if (Array.isArray(parsed[firstKey])) {
          itemsToInsert = parsed[firstKey];
        }
      }
    } catch (parseErr) {
      console.warn("[Voice Ingest JSON Parse Fallback]", parseErr);
    }

    // Fallback: If JSON parsing didn't yield items, create 1 item from raw text
    if (itemsToInsert.length === 0) {
      itemsToInsert = [
        {
          question: "معلومات عامة من التسجيل الصوتي",
          answer: rawText,
          keywords: ["تعديل_صوتي", "فويس"],
        },
      ];
    }

    const headerTenantId = req.headers.get("x-tenant-id");
    const formDataTenantId = formData.get("tenantId") as string;
    const resolvedTenantId = formDataTenantId || headerTenantId || undefined;

    // 5. Bulk insert into KnowledgeItem DB table
    const createdItems = [];
    for (const item of itemsToInsert) {
      if (item.question && item.answer) {
        const created = await prisma.knowledgeItem.create({
          data: {
            question: item.question.trim(),
            answer: item.answer.trim(),
            keywords: JSON.stringify(item.keywords || []),
            ...(resolvedTenantId && { tenantId: resolvedTenantId }),
          },
        });
        createdItems.push(created);
      }
    }

    return NextResponse.json({
      success: true,
      rawTranscript: rawText,
      extractedCount: createdItems.length,
      items: createdItems,
    });
  } catch (err: any) {
    console.error("[Voice Ingest Error]", err);
    return NextResponse.json({ error: err.message || "حصل خطأ أثناء معالجة الصوت" }, { status: 500 });
  }
}
