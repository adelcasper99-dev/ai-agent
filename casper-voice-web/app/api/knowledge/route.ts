// app/api/knowledge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getResolvedTenantId } from "@/lib/auth";

const prisma = new PrismaClient();

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

    const item = await prisma.knowledgeItem.create({
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

  const rawItems = await prisma.knowledgeItem.findMany({
    where: {
      OR: [{ tenantId }, { tenantId: null }],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const items = rawItems.map((item) => {
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
  const { id } = await req.json();
  await prisma.knowledgeItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
