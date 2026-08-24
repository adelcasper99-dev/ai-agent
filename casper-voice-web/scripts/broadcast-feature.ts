import { prismaSystem } from "../lib/prisma";
import { sendTelegramAlert, getAdminChatId } from "../lib/telegram";

async function main() {
  const args = process.argv.slice(2);
  const preview = args.includes("--preview");

  console.log("==================================================");
  console.log("📢 CASPER TELEGRAM FEATURE BROADCAST UTILITY");
  console.log("==================================================");

  const title = "محرك التذكيرات والتنبيهات الذكية المجدولة ⏰";
  const description = "تقدر دلوقتي تطلب من كاسبر يفكرك بأي مواعيد أو فواتير أو تسليم مقاسات للعملاء في أي وقت محدد!";
  const examples = [
    { label: "تذكير بموعد محدد بالاسم", prompt: "فكرني بكرة الساعة 5 اكلم المهندس محمود" },
    { label: "تنبيه بعد مدة زمنية محددة", prompt: "نبهني بعد ساعتين بفلوس المورد" },
    { label: "استعراض كافة التذكيرات المجدولة", prompt: "ايه التذكيرات اللي عندي يا كاسبر؟" }
  ];

  const exampleLines = examples.map((ex, idx) => `💡 *مثال ${idx + 1}:* \`${ex.prompt}\`\n   ↳ _${ex.label}_`).join('\n\n');
  const cardText = `🚀 *تحديث وميزة جديدة في كاسبر:*\n━━━━━━━━━━━━━━━━\n✨ *${title}*\n\n${description}\n\n📋 *أمثلة حية للاستخدام:*\n${exampleLines}\n━━━━━━━━━━━━━━━━\n👇 اضغط على أحد الأزرار لتجربة الميزة فوراً:`;

  if (preview) {
    const adminChatId = await getAdminChatId();
    if (!adminChatId) {
      console.error("❌ ADMIN_CHAT_ID not configured.");
      process.exit(1);
    }
    console.log(`[PREVIEW] Sending test broadcast card to Admin (${adminChatId})...`);

    const inlineButtons = examples.map((ex, idx) => [
      { text: `🧪 جرب: "${ex.prompt.slice(0, 25)}"`, callback_data: `try_f_preview_${idx}` }
    ]);

    await sendTelegramAlert({
      chatId: adminChatId,
      text: `[معاينة تجريبية للأدمن]\n\n${cardText}`,
      idempotencyKey: `cli_preview_${Date.now()}`,
      replyMarkup: { inline_keyboard: inlineButtons }
    });
    console.log("✅ Preview card delivered to Admin Telegram chat successfully.");
    return;
  }

  // Live Broadcast
  const release = await (prismaSystem as any).featureRelease.create({
    data: {
      title,
      description,
      examples: JSON.stringify(examples),
      targetType: "all",
      status: "sending"
    }
  });

  const tenants = await (prismaSystem as any).tenant.findMany({
    where: { state: "active", telegramChatId: { not: null } },
    select: { id: true, name: true, merchantName: true, telegramChatId: true }
  });

  console.log(`[BROADCAST] Target active merchants: ${tenants.length}`);

  const inlineButtons = examples.map((ex, idx) => [
    { text: `🧪 جرب: "${ex.prompt.slice(0, 25)}"`, callback_data: `try_f_${release.id}_${idx}` }
  ]);

  let sent = 0;
  let failed = 0;

  for (const t of tenants) {
    try {
      await sendTelegramAlert({
        chatId: t.telegramChatId,
        text: cardText,
        idempotencyKey: `cli_rel_${release.id}_${t.id}`,
        replyMarkup: { inline_keyboard: inlineButtons }
      });
      sent++;
      console.log(`  ✓ Sent to ${t.merchantName || t.name} (${t.telegramChatId})`);
    } catch (err) {
      failed++;
      console.error(`  ✗ Failed for ${t.id}:`, err);
    }
    await new Promise(r => setTimeout(r, 50));
  }

  await (prismaSystem as any).featureRelease.update({
    where: { id: release.id },
    data: { status: "completed", sentCount: sent, failedCount: failed }
  });

  console.log("\n==================================================");
  console.log(`🎉 BROADCAST COMPLETED: ${sent} Sent, ${failed} Failed.`);
  console.log("==================================================");
}

main().catch(console.error);
