// app/api/knowledge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getResolvedTenantId } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const resolvedTenantId = await getResolvedTenantId(req);
    if (!resolvedTenantId) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }

    const body = await req.json();
    const { question, answer, keywords } = body;

    if (!question || !answer) {
      return NextResponse.json({ error: "question و answer مطلوبين" }, { status: 400 });
    }

    const item = await (prisma as any).knowledgeItem.create({
      data: {
        question,
        answer,
        keywords: JSON.stringify(Array.isArray(keywords) ? keywords : []),
        tenantId: resolvedTenantId,
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "حصل خطأ في الحفظ" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const tenantId = await getResolvedTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  // Explicit OR: tenant-specific items + global shared items (tenantId: null)
  // The extension auto-injection would conflict with this OR clause, so tenantId is passed explicitly.
  const rawItems = await (prisma as any).knowledgeItem.findMany({
    where: {
      OR: [{ tenantId }, { tenantId: null }],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const items = rawItems.map((item: any) => {
    let keywords: string[] = [];
    const rawKw: unknown = item.keywords;

    if (typeof rawKw === "string" && rawKw.trim().length > 0) {
      try {
        const parsed = JSON.parse(rawKw);
        keywords = Array.isArray(parsed) ? parsed.map(String) : [String(rawKw)];
      } catch {
        keywords = String(rawKw).split(",").map((k) => k.trim()).filter(Boolean);
      }
    } else if (Array.isArray(rawKw)) {
      keywords = rawKw.map(String);
    }

    return { ...item, keywords };
  });

  return NextResponse.json({ items });
}

export async function DELETE(req: NextRequest) {
  // Guard: only delete items belonging to the authenticated tenant (prevents cross-tenant deletion)
  const tenantId = await getResolvedTenantId(req);
  if (!tenantId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "id مطلوب" }, { status: 400 });
  }

  // Verify ownership before delete
  const item = await (prisma as any).knowledgeItem.findFirst({
    where: { id, tenantId },
  });
  if (!item) {
    return NextResponse.json(
      { error: "العنصر غير موجود أو لا تملك صلاحية حذفه" },
      { status: 404 }
    );
  }

  await (prisma as any).knowledgeItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
