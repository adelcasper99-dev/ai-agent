import { prisma } from "./lib/prisma";

async function main() {
  try {
    const results = await (prisma as any).rejectedToolCall.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        toolName: true,
        rejectedArgs: true,
        originalMessage: true,
        reason: true,
        createdAt: true
      }
    });
    console.log("REJECTED_TOOL_CALLS_RESULT:", JSON.stringify(results, null, 2));
  } catch (err) {
    console.error("Query Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
