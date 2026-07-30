// app/api/knowledge/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { question, answer, keywords } = await req.json();

    if (!question || !answer) {
      return NextResponse.json({ error: "question و answer مطلوبين" }, { status: 400 });
    }

    const item = await prisma.knowledgeItem.create({
      data: {
        question,
        answer,
        keywords: JSON.stringify(Array.isArray(keywords) ? keywords : []),
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "حصل خطأ في الحفظ" }, { status: 500 });
  }
}

export async function GET() {
  const rawItems = await prisma.knowledgeItem.findMany({
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
