import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawNumber = searchParams.get("number");

    if (!rawNumber) {
      return NextResponse.json({ error: "رقم التليفون مطلوب" }, { status: 400 });
    }

    const cleanNumber = rawNumber.trim().replace(/[^\d+]/g, "");
    const altNumber = cleanNumber.startsWith("+") ? cleanNumber.slice(1) : `+${cleanNumber}`;

    // Lookup Tenant by phone number
    const tenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { phoneNumber: cleanNumber },
          { phoneNumber: altNumber }
        ]
      }
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: "لم يتم العثور على شركة مرتبطة برقم التليفون" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      tenantId: tenant.id,
      name: tenant.name,
      state: tenant.state
    });
  } catch (err: any) {
    console.error("[api/tenants/by-phone error]:", err);
    return NextResponse.json({ error: "فشل الاستعلام عن الشركة", detail: err.message }, { status: 500 });
  }
}
