import { prisma } from "@/lib/prisma";
// app/api/ai/chat/route.ts
import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getResolvedTenantId } from "@/lib/auth";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: NextRequest) {
  const resolvedTenantId = await getResolvedTenantId(req);
  if (!resolvedTenantId) {
    return new Response(JSON.stringify({ error: "غير مصرح" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { message } = await req.json();

  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "message مطلوب" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1) RAG: هات أقرب معلومات من الـ KB (Prisma) - محدودة بـ take عشان التوكنز
  const kbEntries = await prisma.knowledgeItem.findMany({
    where: {
      AND: [
        resolvedTenantId
          ? { OR: [{ tenantId: resolvedTenantId }, { tenantId: null }] }
          : {},
        {
          OR: [
            { question: { contains: message } },
            { keywords: { contains: message } },
          ],
        },
      ],
    },
    take: 5,
    orderBy: { createdAt: "desc" },
  });


  let tenantName = "";
  if (resolvedTenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: resolvedTenantId } });
    if (tenant) tenantName = tenant.name;
  }

  const companyStr = tenantName ? `بشركة ${tenantName}` : "";

  const context = kbEntries
    .map((item) => `س: ${item.question}\nج: ${item.answer}`)
    .join("\n\n");

  const systemPrompt = `أنت مساعد دعم فني وبيعي ${companyStr}. رد باللهجة المصرية العامية، بسيط ومباشر.
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
