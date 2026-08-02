import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const keys = await prisma.apiKeyPool.findMany({
      orderBy: { addedAt: "desc" }
    });
    return NextResponse.json({ success: true, keys });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { provider, keyString } = await req.json();
    if (!provider || !keyString) {
      return NextResponse.json({ success: false, error: "provider and keyString are required" }, { status: 400 });
    }
    const newKey = await prisma.apiKeyPool.create({
      data: {
        provider,
        keyString
      }
    });
    return NextResponse.json({ success: true, newKey });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
    }
    await prisma.apiKeyPool.delete({
      where: { id }
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH: Reset all exhausted keys back to active (manual admin override)
export async function PATCH(req: Request) {
  try {
    const { provider = "gemini" } = await req.json().catch(() => ({}));
    const result = await prisma.apiKeyPool.updateMany({
      where: { provider, isExhausted: true },
      data: { isExhausted: false, exhaustedAt: null }
    });
    return NextResponse.json({ success: true, resetCount: result.count });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

