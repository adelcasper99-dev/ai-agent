import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";


function getSystemPrompt(tenantName?: string): string {
  const company = tenantName ? `بشركة ${tenantName}` : "بنظامنا الذكي";
  return `أنت "المساعد الشخصي الذكي" الخاص بمدير أو صاحب العمل ${company}.
تحدث بالعامية المصرية الحية كأنك صديق أو مساعد شخصي بيكلمه في التليفون.
- ممنوع: جمل رسمية مثل "تم تسجيل" أو "بنجاح" أو "يرجى"
- المطلوب: "أهلاً أستاذنا"، "سجلتلك"، "زي الفل يا فندم"، "تحت أمرك"
الإجابات مختصرة ومباشرة (8-15 كلمة فقط).`;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

import { getResolvedTenantId } from "@/lib/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(ip, { limit: 20, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "لقد تجاوزت الحد المسموح به. حاول مجدداً بعد قليل." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }
  try {
    const resolvedTenantId = await getResolvedTenantId(req);
    if (!resolvedTenantId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { message, history = [], tenantName } = await req.json() as {
      message: string;
      history: Message[];
      tenantName?: string;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "الرسالة فارغة" }, { status: 400 });
    }

    let resolvedTenantName = tenantName;
    if (!resolvedTenantName && resolvedTenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: resolvedTenantId } });
      if (tenant) resolvedTenantName = tenant.name;
    }

    const systemPrompt = getSystemPrompt(resolvedTenantName);

    // Load settings
    const dbSettings = await prisma.setting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const row of dbSettings) settingsMap[row.key] = row.value;

    const provider = settingsMap["VOICE_PROVIDER"] || "groq_pipeline";
    const groqKey = settingsMap["GROQ_API_KEY"] || process.env.GROQ_API_KEY || "";
    const geminiKey = settingsMap["GEMINI_API_KEY"] || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    const openaiKey = settingsMap["OPENAI_API_KEY"] || process.env.OPENAI_API_KEY || "";

    const messages: Message[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-10), // last 10 messages for context
      { role: "user", content: message },
    ];

    let reply = "";

    // 1. Try Gemini (text generation)
    if ((provider === "gemini" || (!groqKey && geminiKey)) && geminiKey) {
      try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genai = new GoogleGenerativeAI(geminiKey);
        const model = genai.getGenerativeModel({ model: "gemini-2.0-flash" });
        const chat = model.startChat({
          history: messages.slice(1, -1).map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          systemInstruction: systemPrompt,
        });
        const result = await chat.sendMessage(message);
        reply = result.response.text().trim();
      } catch (e) {
        console.error("Gemini text chat error:", e);
      }
    }

    // 2. Fallback to Groq (Llama 3.3)
    if (!reply && groqKey) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          max_tokens: 200,
          temperature: 0.8,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { choices: Array<{ message: { content: string } }> };
        reply = data.choices[0]?.message?.content?.trim() || "";
      }
    }

    // 3. Fallback to OpenAI
    if (!reply && openaiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 200,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { choices: Array<{ message: { content: string } }> };
        reply = data.choices[0]?.message?.content?.trim() || "";
      }
    }

    if (!reply) {
      return NextResponse.json({ error: "فشل الرد — تأكد من صحة مفاتيح API في الإعدادات" }, { status: 500 });
    }

    // Log conversation
    await prisma.conversation.create({
      data: {
        channel: "text",
        transcript: `User: ${message}\nAssistant: ${reply}`,
        summary: reply.slice(0, 100),
      },
    }).catch(() => {}); // non-blocking

    return NextResponse.json({ reply, provider });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "خطأ داخلي في السيرفر" }, { status: 500 });
  }
}
