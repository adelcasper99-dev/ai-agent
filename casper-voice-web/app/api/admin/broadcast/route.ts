import { NextRequest, NextResponse } from "next/server";
import { prismaSystem } from "@/lib/prisma";
import { sendTelegramAlert, getAdminChatId } from "@/lib/telegram";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BroadcastSchema = z.object({
  title: z.string().min(3, "عنوان التحديث مطلوب"),
  description: z.string().min(5, "شرح الميزة مطلوب"),
  examples: z.array(
    z.object({
      label: z.string().min(1),
      prompt: z.string().min(1)
    })
  ).min(1, "يجب توفير مثال واحد على الأقل للاستخدام"),
  targetType: z.enum(["all", "business_type", "selected"]).default("all"),
  businessType: z.string().optional(),
  previewOnly: z.boolean().default(false)
});

function formatBroadcastCard(title: string, description: string, examples: { label: string; prompt: string }[]) {
  const exampleLines = examples.map((ex, idx) => `💡 *مثال ${idx + 1}:* \`${ex.prompt}\`\n   ↳ _${ex.label}_`).join('\n\n');

  return `🚀 *تحديث وميزة جديدة في كاسبر:*\n━━━━━━━━━━━━━━━━\n✨ *${title}*\n\n${description}\n\n📋 *أمثلة حية للاستخدام:*\n${exampleLines}\n━━━━━━━━━━━━━━━━\n👇 اضغط على أحد الأزرار لتجربة الميزة فوراً:`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = BroadcastSchema.parse(body);

    const { title, description, examples, targetType, businessType, previewOnly } = parsed;

    if (previewOnly) {
      const adminChatId = await getAdminChatId();
      if (!adminChatId) {
        return NextResponse.json({ success: false, error: "ADMIN_CHAT_ID is not configured" }, { status: 400 });
      }

      const cardText = formatBroadcastCard(title, description, examples);
      const inlineButtons = examples.slice(0, 3).map((ex, idx) => [
        { text: `🧪 جرب: "${ex.prompt.slice(0, 25)}"`, callback_data: `try_f_preview_${idx}` }
      ]);

      await sendTelegramAlert({
        chatId: adminChatId,
        text: `[معاينة تجريبية للأدمن]\n\n${cardText}`,
        idempotencyKey: `broadcast_preview_${Date.now()}`,
        replyMarkup: { inline_keyboard: inlineButtons }
      });

      return NextResponse.json({ success: true, mode: "preview", sentTo: adminChatId });
    }

    // 1. Create FeatureRelease record in DB
    const release = await (prismaSystem as any).featureRelease.create({
      data: {
        title,
        description,
        examples: JSON.stringify(examples),
        targetType,
        status: "sending"
      }
    });

    // 2. Query target active tenants
    const whereClause: any = {
      state: "active",
      telegramChatId: { not: null }
    };
    if (targetType === "business_type" && businessType) {
      whereClause.businessType = { contains: businessType };
    }

    const tenants = await (prismaSystem as any).tenant.findMany({
      where: whereClause,
      select: { id: true, name: true, merchantName: true, telegramChatId: true }
    });

    const cardText = formatBroadcastCard(title, description, examples);
    const inlineButtons = examples.slice(0, 3).map((ex, idx) => [
      { text: `🧪 جرب: "${ex.prompt.slice(0, 25)}"`, callback_data: `try_f_${release.id}_${idx}` }
    ]);

    let sentCount = 0;
    let failedCount = 0;

    // 3. Batch dispatch with rate-limiting
    const BATCH_SIZE = 20;
    for (let i = 0; i < tenants.length; i += BATCH_SIZE) {
      const batch = tenants.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (t: any) => {
          if (!t.telegramChatId) return;
          try {
            await sendTelegramAlert({
              chatId: t.telegramChatId,
              text: cardText,
              idempotencyKey: `feat_rel_${release.id}_${t.id}`,
              replyMarkup: { inline_keyboard: inlineButtons }
            });
            sentCount++;
          } catch (err) {
            console.error(`[Broadcast Delivery Error] tenantId=${t.id}:`, err);
            failedCount++;
          }
        })
      );
      if (i + BATCH_SIZE < tenants.length) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    // 4. Update FeatureRelease status
    await (prismaSystem as any).featureRelease.update({
      where: { id: release.id },
      data: {
        status: "completed",
        sentCount,
        failedCount
      }
    });

    return NextResponse.json({
      success: true,
      releaseId: release.id,
      recipients: tenants.length,
      sentCount,
      failedCount
    });
  } catch (err: any) {
    console.error("[Broadcast API Error]:", err);
    return NextResponse.json({ success: false, error: err?.message }, { status: 400 });
  }
}
