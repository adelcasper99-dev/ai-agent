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
        keywords: Array.isArray(keywords) ? keywords : [],
      },
    });

    return NextResponse.json({ success: true, item });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "حصل خطأ في الحفظ" }, { status: 500 });
  }
}

export async function GET() {
  const items = await prisma.knowledgeItem.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ items });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  await prisma.knowledgeItem.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
