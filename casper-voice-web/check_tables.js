const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  try {
    const count = await p.chatMessage.count();
    console.log('✅ ChatMessage table EXISTS — row count:', count);
    const sample = await p.chatMessage.findMany({ take: 2 });
    console.log('Sample rows:', JSON.stringify(sample, null, 2));
  } catch (e) {
    console.error('❌ ChatMessage table ERROR:', e.message);
  }

  try {
    const csCount = await p.conversationState.count();
    console.log('✅ ConversationState table EXISTS — row count:', csCount);
  } catch (e) {
    console.error('❌ ConversationState table ERROR:', e.message);
  }

  await p.$disconnect();
}
main();
