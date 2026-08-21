import { NextRequest, NextResponse } from "next/server";
import { prismaSystem } from "@/lib/prisma";
import { signMagicLink } from "@/lib/session";
import { sendTelegramAlert } from "@/lib/telegram";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

const forgotPinSchema = z.object({
  phone: z.string().min(8, "رقم الهاتف يجب أن يكون 8 أرقام على الأقل"),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = rateLimit(ip, { limit: 5, windowMs: 15 * 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: "كثرة المحاولات. يرجى الانتظار بضع دقائق." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = forgotPinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "رقم هاتف غير صالح" },
        { status: 400 }
      );
    }

    let phone = parsed.data.phone.trim();
    phone = phone.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());

    // Find customer & tenant by phone
    const customer = await prismaSystem.customer.findFirst({
      where: { phone: { contains: phone } },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "رقم الهاتف غير مسجل بالنظام." },
        { status: 404 }
      );
    }

    const tenant = await prismaSystem.tenant.findFirst({
      where: {
        OR: [
          { id: customer.tenantId },
          { phoneNumber: { contains: phone } },
        ],
      },
    });

    if (!tenant || !tenant.telegramChatId) {
      return NextResponse.json(
        { error: "لم نتمكن من العثور على حساب تيليجرام مرتبط بهذا الرقم. يرجى التواصل مع الدعم الفني." },
        { status: 400 }
      );
    }

    // Generate expiring Magic Link (valid for 30 minutes)
    const token = await signMagicLink(customer.id, 30);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://109.123.247.119:3000";
    const magicLinkUrl = `${appUrl}/api/auth/magic-link?token=${token}`;

    // Send Telegram recovery notification
    await sendTelegramAlert({
      chatId: tenant.telegramChatId,
      text: `🔐 *طلب استعادة رمز الدخول (PIN):*\n\nأهلاً أستاذ/ة *${customer.name || tenant.name}*،\nتم طلب الدخول السريع أو إعادة تعيين الرمز السري من صفحة الويب.\n\n🌐 يمكنك الدخول المباشر إلى لوحة التحكم بالضغط على الزر أدناه:\n\n💡 *ملاحظة:* إذا كنت ترغب في تغيير رمز الـ PIN الحالي، اكتب أمر /pin هنا في الشات وسيتم تغييره فوراً.`,
      idempotencyKey: `forgot_pin:${customer.id}:${Date.now()}`,
      replyMarkup: {
        inline_keyboard: [
          [{ text: "🌐 دخول مباشر للوحة التحكم", url: magicLinkUrl }],
          [{ text: "🔑 تعيين رمز PIN جديد", callback_data: "merchant:set_pin" }],
        ],
      },
    });

    return NextResponse.json({
      success: true,
      message: "تم إرسال رابط الدخول السريع وخيار إعادة تعيين الـ PIN إلى حسابك على التيليجرام بنجاح!",
    });
  } catch (err: any) {
    console.error("[Forgot PIN Route Error]", err);
    return NextResponse.json(
      { error: err?.message || "فشل إرسال طلب استعادة الرمز السري" },
      { status: 500 }
    );
  }
}
