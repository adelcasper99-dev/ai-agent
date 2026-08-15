import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signCustomerSession } from "@/lib/session";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

const customerLoginSchema = z.object({
  phone: z.string().min(8, "رقم الهاتف يجب أن يكون 8 أرقام على الأقل"),
  name: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(ip, { limit: 10, windowMs: 15 * 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "كثرة المحاولات. يرجى المحاولة بعد قليل." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = customerLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    let phone = parsed.data.phone.trim();
    // Normalize arabic digits if any
    phone = phone.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

    // Find customer by phone across tenants or default tenant
    let customer = await prisma.customer.findFirst({
      where: { phone: { contains: phone } },
    });

    // If not found, create a new customer record linked to default tenant
    if (!customer) {
      let defaultTenant = await prisma.tenant.findFirst();
      if (!defaultTenant) {
        defaultTenant = await prisma.tenant.create({
          data: { name: "شركة كاسبر الرئيسية", state: "active" },
        });
      }

      customer = await prisma.customer.create({
        data: {
          name: parsed.data.name?.trim() || `عميل (${phone.slice(-4)})`,
          phone: phone,
          tenantId: defaultTenant.id,
        },
      });
    }

    const token = await signCustomerSession(customer.id);

    const response = NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
      },
    });

    response.cookies.set("customer_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("[Customer Login Error]", err);
    return NextResponse.json(
      { error: err?.message || "فشل تسجيل دخول العميل" },
      { status: 500 }
    );
  }
}
