import { NextResponse } from 'next/server';
import { AccessToken } from 'livekit-server-sdk';
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const rows = await prisma.setting.findMany();
    const settings: Record<string, string> = {};
    for (const row of rows) settings[row.key] = row.value;

    const apiKey = settings["LIVEKIT_API_KEY"] || process.env.LIVEKIT_API_KEY || 'devkey';
    const apiSecret = settings["LIVEKIT_API_SECRET"] || process.env.LIVEKIT_API_SECRET || 'secret';
    const wsUrl = settings["LIVEKIT_URL"] || process.env.LIVEKIT_URL || 'wss://your-url';

    console.log("Using API Key:", apiKey);
    console.log("Using API Secret:", apiSecret);
    console.log("Using WS URL:", wsUrl);

    if (!apiKey || apiKey === 'devkey' || !wsUrl) {
      return NextResponse.json({ error: 'لم يتم إعداد مفاتيح LiveKit في لوحة التحكم بعد.' }, { status: 400 });
    }

    const roomName = `test-room-${Math.floor(Math.random() * 1000)}`;
    const identity = `admin-user-${Math.floor(Math.random() * 1000)}`;

    const body = await req.json().catch(() => ({}));
    const requestedTenantId = body.tenantId;

    let tenantId = requestedTenantId;
    if (!tenantId) {
      let defaultTenant = await prisma.tenant.findFirst();
      if (!defaultTenant) {
        defaultTenant = await prisma.tenant.create({
          data: {
            name: "شركة كاسبر الرئيسية",
            state: "active",
          },
        });
      }
      tenantId = defaultTenant.id;
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity,
      name: "مدير النظام",
      metadata: JSON.stringify({ tenantId }),
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const jwtToken = await at.toJwt();

    return NextResponse.json({
      success: true,
      token: jwtToken,
      wsUrl,
      roomName,
    });
  } catch (error: any) {
    console.error('[LiveKit Token API Error]:', error);
    return NextResponse.json({ error: 'فشل استخراج التوكن.' }, { status: 500 });
  }
}
