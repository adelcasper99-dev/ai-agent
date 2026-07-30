import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Fetch token usage for today
    const usageRecords = await prisma.tokenUsage.findMany({
      where: { dateStr: today },
    });

    let geminiTokens = 0;
    let geminiRequests = 0;
    let groqRequests = 0;
    let openaiTokens = 0;

    for (const record of usageRecords) {
      if (record.provider === "gemini") {
        geminiTokens += record.totalTokens;
        geminiRequests += record.requestCount;
      } else if (record.provider === "groq") {
        groqRequests += record.requestCount;
      } else if (record.provider === "openai") {
        openaiTokens += record.totalTokens;
      }
    }

    const GEMINI_DAILY_LIMIT = 1000000; // 1M tokens/day
    const GROQ_DAILY_LIMIT = 14400;     // 14.4k req/day

    const geminiPercent = Math.min(100, Number(((geminiTokens / GEMINI_DAILY_LIMIT) * 100).toFixed(1)));
    const groqPercent = Math.min(100, Number(((groqRequests / GROQ_DAILY_LIMIT) * 100).toFixed(1)));

    return NextResponse.json({
      dateStr: today,
      providers: {
        gemini: {
          name: "Google Gemini Realtime API 🌟",
          usedTokens: geminiTokens,
          limitTokens: GEMINI_DAILY_LIMIT,
          remainingTokens: Math.max(0, GEMINI_DAILY_LIMIT - geminiTokens),
          percentage: geminiPercent,
          requestCount: geminiRequests,
          dashboardUrl: "https://aistudio.google.com/app/plan_information",
          badge: "1M Tokens / Day Free",
        },
        groq: {
          name: "Groq Telephony Pipeline (Llama 3.3)",
          usedRequests: groqRequests,
          limitRequests: GROQ_DAILY_LIMIT,
          remainingRequests: Math.max(0, GROQ_DAILY_LIMIT - groqRequests),
          percentage: groqPercent,
          dashboardUrl: "https://console.groq.com/settings/limits",
          badge: "14.4k Requests / Day Free",
        },
        livekit: {
          name: "LiveKit Realtime Voice Mesh",
          bandwidthUsed: "0.2 GB",
          bandwidthLimit: "50 GB / Month",
          dashboardUrl: "https://cloud.livekit.io",
          badge: "50 GB / Month Free",
        }
      }
    });
  } catch (error) {
    console.error("Error fetching usage data:", error);
    return NextResponse.json({ error: "فشل استعلام التوكنز" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { provider = "gemini", modelName = "default", inputTokens = 0, outputTokens = 0 } = await req.json();
    const today = new Date().toISOString().split("T")[0];
    const total = inputTokens + outputTokens;

    const record = await prisma.tokenUsage.create({
      data: {
        provider,
        modelName,
        inputTokens,
        outputTokens,
        totalTokens: total,
        requestCount: 1,
        dateStr: today,
      }
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    console.error("Error logging token usage:", error);
    return NextResponse.json({ error: "فشل تسجيل التوكنز" }, { status: 500 });
  }
}
