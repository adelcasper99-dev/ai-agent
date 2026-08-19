import { NextRequest, NextResponse } from "next/server";
import { prisma, prismaSystem } from "@/lib/prisma";
import { signCustomerSession, verifyPin } from "@/lib/session";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

const customerLoginSchema = z.object({
  phone: z.string().min(8, "رقم الهاتف يجب أن يكون 8 أرقام على الأقل"),
  pin: z.string().optional(),
  checkOnly: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(ip, { limit: 15, windowMs: 15 * 60 * 1000 });
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
    // Normalize arabic digits to standard english digits
    phone = phone.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

    // Find customer by phone (pre-auth cross-tenant lookup)
    const customer = await prismaSystem.customer.findFirst({
      where: { phone: { contains: phone } },
    });

    // If checkOnly step: returns whether customer exists and whether they have a PIN set
    if (parsed.data.checkOnly) {
      if (!customer) {
        return NextResponse.json({
          exists: false,
          hasPin: false,
        });
      }
      return NextResponse.json({
        exists: true,
        hasPin: Boolean(customer.pinHash),
        customerName: customer.name,
      });
    }

    // Actual Login Attempt
    if (!customer) {
      return NextResponse.json(
        { error: "رقم الهاتف غير مسجل. يرجى استكمال التهيئة أولاً." },
        { status: 404 }
      );
    }

    // If customer has no PIN set yet, require setup
    if (!customer.pinHash) {
      return NextResponse.json(
        { requiresSetup: true, message: "يرجى تعيين رمز سري لحسابك أولاً" },
        { status: 400 }
      );
    }

    const providedPin = parsed.data.pin?.trim();
    if (!providedPin) {
      return NextResponse.json(
        { error: "يرجى إدخال الرمز السري (PIN)" },
        { status: 400 }
      );
    }

    const isPinValid = await verifyPin(providedPin, customer.pinHash, customer.id);
    if (!isPinValid) {
      return NextResponse.json(
        { error: "الرمز السري غير صحيح" },
        { status: 401 }
      );
    }

    // Issue tamper-proof customer_session
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
