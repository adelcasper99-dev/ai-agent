import { processTelegramMessageWithLLM } from "@/lib/telegram_llm";
import { prisma } from "@/lib/prisma";

async function main() {
  console.log("=== Testing Appointment Tools #4 (book) #5 (list) #6 (update) #7 (cancel) ===");
  const tenantId = "sim_tenant_1";
  const TODAY = new Date().toISOString().slice(0, 10);

  // Function #4: book_appointment
  const prompt4 = `«ÕÃ“ „Ì⁄«œ ·⁄„Ì· «”„Â Œ«·œ „Õ„Êœ ${TODAY} «·”«⁄… 04:00 „”«¡`;
  console.log(`\n??? Test Function #4 (book_appointment): "${prompt4}"`);
  const res4 = await processTelegramMessageWithLLM(prompt4, tenantId, "‘—ﬂ…  Ã—Ì»Ì…", "retail", "9am-5pm", "999888777");
  console.log("?? Response #4:\n", JSON.stringify(res4, null, 2));

  const booked = await prisma.appointment.findFirst({
    where: { tenantId, customerName: { contains: "Œ«·œ" } },
    orderBy: { createdAt: "desc" }
  });
  console.log("\n=== RAW DB EVIDENCE (BOOKED) ===");
  console.log(JSON.stringify(booked ? { id: booked.id, customerName: booked.customerName, date: booked.date, time: booked.time } : null, null, 2));

  // Function #5: get_appointments_list
  const prompt5 = "›Ì‰ «·„Ê«⁄Ìœ «··Ì ⁄‰œ‰« œ·Êﬁ Ìø";
  console.log(`\n??? Test Function #5 (get_appointments_list): "${prompt5}"`);
  const res5 = await processTelegramMessageWithLLM(prompt5, tenantId, "‘—ﬂ…  Ã—Ì»Ì…", "retail", "9am-5pm", "999888777");
  console.log("?? Response #5:\n", JSON.stringify(res5, null, 2));

  // Function #6 NEW: update_appointment
  const prompt6 = `⁄œ¯· „Ì⁄«œ Œ«·œ „Õ„Êœ «·”«⁄… 06:00 „”«¡`;
  console.log(`\n??? Test Function #6 (update_appointment): "${prompt6}"`);
  const res6 = await processTelegramMessageWithLLM(prompt6, tenantId, "‘—ﬂ…  Ã—Ì»Ì…", "retail", "9am-5pm", "999888777");
  console.log("?? Response #6:\n", JSON.stringify(res6, null, 2));

  const updated = await prisma.appointment.findFirst({
    where: { tenantId, customerName: { contains: "Œ«·œ" } },
    orderBy: { createdAt: "desc" }
  });
  console.log("\n=== RAW DB EVIDENCE (UPDATED) ===");
  console.log(JSON.stringify(updated ? { id: updated.id, customerName: updated.customerName, date: updated.date, time: updated.time } : null, null, 2));

  // Function #7 NEW: cancel_appointment
  const prompt7 = "«·€ˆ „Ì⁄«œ Œ«·œ „Õ„Êœ";
  console.log(`\n??? Test Function #7 (cancel_appointment): "${prompt7}"`);
  const res7 = await processTelegramMessageWithLLM(prompt7, tenantId, "‘—ﬂ…  Ã—Ì»Ì…", "retail", "9am-5pm", "999888777");
  console.log("?? Response #7:\n", JSON.stringify(res7, null, 2));

  const cancelled = await prisma.appointment.findFirst({
    where: { tenantId, customerName: { contains: "Œ«·œ" } }
  });
  console.log("\n=== RAW DB EVIDENCE (CANCELLED ó MUST BE NULL) ===");
  console.log(JSON.stringify(cancelled, null, 2));

  // ADVERSARIAL: cancel non-existent appointment
  const promptAdv = "«·€ˆ „Ì⁄«œ ⁄„Ì· ÊÂ„Ì „‘ „ÊÃÊœ";
  console.log(`\n??? ADVERSARIAL (cancel non-existent): "${promptAdv}"`);
  const resAdv = await processTelegramMessageWithLLM(promptAdv, tenantId, "‘—ﬂ…  Ã—Ì»Ì…", "retail", "9am-5pm", "999888777");
  console.log("?? ADVERSARIAL Response (must be error, NOT crash):\n", JSON.stringify(resAdv, null, 2));

  await prisma.$disconnect();
  console.log("\n? All Appointment Tool Tests Completed.");
}

main().catch(console.error);
