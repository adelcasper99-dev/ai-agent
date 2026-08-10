import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Query TokenUsage from DB for Gemini
    let geminiUsed = 0;
    try {
      const usageRows = await (prisma as any).tokenUsage.findMany({
        where: { dateStr: today, provider: 'gemini' },
      });
      geminiUsed = usageRows.reduce((acc: number, r: any) => acc + (r.totalTokens || 0), 0);
    } catch (e) {
      // Fallback
    }

    const geminiLimit = 1500000; // 1.5M free tier per day
    const geminiRemaining = Math.max(0, geminiLimit - geminiUsed);
    const geminiPct = Math.min(100, Math.round((geminiUsed / geminiLimit) * 100));

    // Query TokenUsage from DB for Groq
    let groqUsed = 0;
    try {
      const groqRows = await (prisma as any).tokenUsage.findMany({
        where: { dateStr: today, provider: 'groq' },
      });
      groqUsed = groqRows.reduce((acc: number, r: any) => acc + (r.totalTokens || 0), 0);
    } catch (e) {
      // Fallback
    }

    const groqLimit = 14400;
    const groqRemaining = Math.max(0, groqLimit - groqUsed);
    const groqPct = Math.min(100, Math.round((groqUsed / groqLimit) * 100));

    const response = {
      dateStr: today,
      providers: {
        gemini: {
          name: 'Google Gemini 2.0 Flash / Pro',
          usedTokens: geminiUsed,
          limitTokens: geminiLimit,
          remainingTokens: geminiRemaining,
          percentage: geminiPct,
          dashboardUrl: 'https://aistudio.google.com/',
          badge: 'Gemini AI Studio',
        },
        groq: {
          name: 'Groq Cloud (Whisper + Llama 3.3)',
          usedRequests: groqUsed,
          limitRequests: groqLimit,
          remainingRequests: groqRemaining,
          percentage: groqPct,
          dashboardUrl: 'https://console.groq.com/',
          badge: 'Groq Speed LLM',
        },
        livekit: {
          name: 'LiveKit Cloud Server',
          bandwidthUsed: 'Livekit Agent Active',
          bandwidthLimit: '50 GB / mo',
          percentage: 0,
          dashboardUrl: 'https://cloud.livekit.io/',
          badge: 'Realtime Voice Transport',
        },
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error('[Usage API Error]', err);
    return NextResponse.json({ error: 'Failed to fetch usage metrics' }, { status: 500 });
  }
}
