import { prisma } from "./lib/prisma";

async function cleanupCorruptedAppointments() {
  console.log("Cleaning up corrupted appointment records...");
  const deleted = await prisma.appointment.deleteMany({
    where: {
      OR: [
        { date: { contains: "الجاي" } },
        { date: { contains: "لم يُحدد" } },
        { time: { contains: "未提及" } },
        { time: { contains: "لم يُحدد" } },
        { time: "" },
        { date: "" }
      ]
    }
  });
  console.log(`Deleted ${deleted.count} corrupted appointment records from DB!`);
}

cleanupCorruptedAppointments().catch(console.error);
