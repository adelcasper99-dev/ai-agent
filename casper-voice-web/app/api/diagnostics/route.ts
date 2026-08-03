import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResolvedTenantId } from "@/lib/auth";

const THRESHOLDS = {
  llmLatencyMs: 1500,
  ttsLatencyMs: 800,
  sttConfidence: 0.7,
  vadCutoffs: 1,
};

export async function POST(req: NextRequest) {
  try {
    const resolvedTenantId = await getResolvedTenantId(req);
    if (!resolvedTenantId) {
      return NextResponse.json({ error: "Unauthorized: Invalid session or internal secret" }, { status: 401 });
    }

    const body = await req.json();
    const {
      channel,
      sessionId,
      audioSnrDb,
      audioClipping,
      vadCutoffs,
      silenceDurationMs,
      sttConfidence,
      rawTranscript,
      correctedTranscript,
      correctionApplied,
      llmLatencyMs,
      ttsLatencyMs,
    } = body;

    if (!channel || !sessionId) {
      return NextResponse.json(
        { error: "channel و sessionId مطلوبين" },
        { status: 400 }
      );
    }

    const hasIssue =
      (llmLatencyMs ?? 0) > THRESHOLDS.llmLatencyMs ||
      (ttsLatencyMs ?? 0) > THRESHOLDS.ttsLatencyMs ||
      (sttConfidence !== undefined && sttConfidence !== null && sttConfidence < THRESHOLDS.sttConfidence) ||
      (vadCutoffs ?? 0) >= THRESHOLDS.vadCutoffs;

    const recordId = `diag_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    if ((prisma as any).interactionDiagnostics) {
      await (prisma as any).interactionDiagnostics.create({
        data: {
          id: recordId,
          channel,
          sessionId,
          tenantId: resolvedTenantId,
          audioSnrDb: audioSnrDb ?? null,
          audioClipping: audioClipping ?? null,
          vadCutoffs: vadCutoffs ?? 0,
          silenceDurationMs: silenceDurationMs ?? null,
          sttConfidence: sttConfidence ?? null,
          rawTranscript: rawTranscript ?? null,
          correctedTranscript: correctedTranscript ?? null,
          correctionApplied: Boolean(correctionApplied),
          llmLatencyMs: llmLatencyMs ?? null,
          ttsLatencyMs: ttsLatencyMs ?? null,
          hasIssue,
        },
      });
    } else {
      // Fallback to raw SQL insertion for PostgreSQL/SQLite compatibility
      await prisma.$executeRaw`
        INSERT INTO "InteractionDiagnostics" (
          "id", "channel", "sessionId", "tenantId", "audioSnrDb", "audioClipping",
          "vadCutoffs", "silenceDurationMs", "sttConfidence", "rawTranscript",
          "correctedTranscript", "correctionApplied", "llmLatencyMs", "ttsLatencyMs",
          "hasIssue", "createdAt"
        ) VALUES (
          ${recordId}, ${channel}, ${sessionId}, ${resolvedTenantId}, ${audioSnrDb ?? null}, ${audioClipping ? 1 : 0},
          ${vadCutoffs ?? 0}, ${silenceDurationMs ?? null}, ${sttConfidence ?? null}, ${rawTranscript ?? null},
          ${correctedTranscript ?? null}, ${correctionApplied ? 1 : 0}, ${llmLatencyMs ?? null}, ${ttsLatencyMs ?? null},
          ${hasIssue ? 1 : 0}, CURRENT_TIMESTAMP
        )
      `;
    }

    return NextResponse.json({ success: true, id: recordId, hasIssue });
  } catch (err: any) {
    console.error("diagnostics route error:", err);
    return NextResponse.json({ error: "فشل حفظ التشخيص", detail: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getResolvedTenantId(req);
    if (!tenantId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const channel = searchParams.get("channel");
    const onlyIssues = searchParams.get("onlyIssues") === "true";

    let records: any[] = [];
    if ((prisma as any).interactionDiagnostics) {
      records = await (prisma as any).interactionDiagnostics.findMany({
        where: {
          ...(channel ? { channel } : {}),
          ...(onlyIssues ? { hasIssue: true } : {}),
          tenantId,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    } else {
      records = await prisma.$queryRaw`
        SELECT * FROM "InteractionDiagnostics"
        ORDER BY "createdAt" DESC
        LIMIT 100
      `;
    }

    return NextResponse.json(records);
  } catch (err: any) {
    return NextResponse.json({ error: "فشل جلب السجلات", detail: err.message }, { status: 500 });
  }
}
