import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const THRESHOLDS = {
  llmLatencyMs: 1500,
  ttsLatencyMs: 800,
  sttConfidence: 0.7,
  vadCutoffs: 1,
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      channel,
      sessionId,
      tenantId,
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

    // Resolve tenantId if missing or fallback to default tenant
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId || resolvedTenantId === "default-tenant") {
      const tenants: any[] = await prisma.$queryRaw`SELECT id FROM Tenant LIMIT 1`;
      if (!tenants || tenants.length === 0) {
        const id = `cuid_${Date.now()}`;
        await prisma.$executeRaw`INSERT INTO Tenant (id, name, state, createdAt, updatedAt) VALUES (${id}, 'شركة التجربة الرئيسية', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
        resolvedTenantId = id;
      } else {
        resolvedTenantId = tenants[0].id;
      }
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
      // Fallback to raw SQL insertion for SQLite compatibility
      await prisma.$executeRaw`
        INSERT INTO InteractionDiagnostics (
          id, channel, sessionId, tenantId, audioSnrDb, audioClipping,
          vadCutoffs, silenceDurationMs, sttConfidence, rawTranscript,
          correctedTranscript, correctionApplied, llmLatencyMs, ttsLatencyMs,
          hasIssue, createdAt
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
    const { searchParams } = new URL(req.url);
    const channel = searchParams.get("channel");
    const onlyIssues = searchParams.get("onlyIssues") === "true";
    const tenantId = searchParams.get("tenantId");

    let records: any[] = [];
    if ((prisma as any).interactionDiagnostics) {
      records = await (prisma as any).interactionDiagnostics.findMany({
        where: {
          ...(channel ? { channel } : {}),
          ...(onlyIssues ? { hasIssue: true } : {}),
          ...(tenantId ? { tenantId } : {}),
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
