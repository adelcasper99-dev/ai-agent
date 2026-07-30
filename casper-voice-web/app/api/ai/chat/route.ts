// app/api/ai/chat/route.ts
import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const { message, tenantId } = await req.json();

  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "message مطلوب" }), {
      status: 400,
    });
  }

  // 1) RAG: هات أقرب معلومات من الـ KB (Prisma) - محدودة بـ take عشان التوكنز
  const kbEntries = await prisma.knowledgeItem.findMany({
    where: {
      OR: [
        { question: { contains: message } },
        { keywords: { contains: message } },
      ],
    },
    take: 5,
    orderBy: { createdAt: "desc" },
  });


  const context = kbEntries
    .map((e) => `س: ${e.question}\nج: ${e.answer}`)
    .join("\n---\n");

  const systemPrompt = `أنت مساعد دعم فني وبيعي. رد باللهجة المصرية العامية، بسيط ومباشر.
استخدم المعلومات دي لو مرتبطة بسؤال العميل:
${context || "(لا يوجد سياق مطابق - رد بمعلوماتك العامة عن الخدمة)"}`;

  // 2) Gemini 1.5 Flash - Streaming
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContentStream({
    contents: [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "تمام، جاهز أساعد العميل." }] },
      { role: "user", parts: [{ text: message }] },
    ],
  });

  // 3) نحول الـ stream بتاع Gemini لـ ReadableStream عشان الفرونت يقراه
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
