// app/api/conversations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// الـ agent (صوت أو واتساب) يبعت هنا آخر المكالمة/المحادثة
export async function POST(req: NextRequest) {
  try {
    const { channel, transcript, summary } = await req.json();

    if (!channel || !transcript) {
      return NextResponse.json({ error: "channel و transcript مطلوبين" }, { status: 400 });
    }

    const convo = await prisma.conversation.create({
      data: { channel, transcript, summary: summary || null },
    });

    return NextResponse.json({ success: true, convo });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "حصل خطأ في السيرفر" }, { status: 500 });
  }
}

export async function GET() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ conversations });
}
