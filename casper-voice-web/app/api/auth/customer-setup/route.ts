import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signCustomerSession, hashPin } from "@/lib/session";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

const customerSetupSchema = z.object({
  phone: z.string().min(8, "رقم الهاتف يجب أن يكون 8 أرقام على الأقل"),
  name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل"),
  pin: z.string().min(4, "الرمز السري يجب أن يكون 4 أرقام على الأقل").max(8, "الرمز السري لا يزيد عن 8 أرقام"),
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
    const parsed = customerSetupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات غير صالحة" },
        { status: 400 }
      );
    }

    let phone = parsed.data.phone.trim();
    phone = phone.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

    let pin = parsed.data.pin.trim();
    pin = pin.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

    // Find existing customer by phone
    let customer = await prisma.customer.findFirst({
      where: { phone: { contains: phone } },
    });

    if (customer) {
      // Customer already exists (e.g. created by Cashier/POS). Set their PIN and update name.
      const hashed = await hashPin(pin, customer.id);
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          pinHash: hashed,
          name: parsed.data.name.trim() || customer.name,
        },
      });
    } else {
      // New customer setup
      let defaultTenant = await prisma.tenant.findFirst();
      if (!defaultTenant) {
        defaultTenant = await prisma.tenant.create({
          data: { name: "شركة كاسبر الرئيسية", state: "active" },
        });
      }

      // Create dummy record first to obtain customer.id as salt, or generate ID
      const newCustomer = await prisma.customer.create({
        data: {
          name: parsed.data.name.trim(),
          phone: phone,
          tenantId: defaultTenant.id,
        },
      });

      const hashed = await hashPin(pin, newCustomer.id);
      customer = await prisma.customer.update({
        where: { id: newCustomer.id },
        data: { pinHash: hashed },
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
    console.error("[Customer Setup Error]", err);
    return NextResponse.json(
      { error: err?.message || "فشل تهيئة حساب العميل" },
      { status: 500 }
    );
  }
}
