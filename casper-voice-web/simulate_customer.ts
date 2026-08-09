import { PrismaClient } from '@prisma/client';
import { processTelegramMessageWithLLM } from './lib/telegram_llm';

const prisma = new PrismaClient();

async function run() {
  console.log('--- Starting Customer Simulation ---\\n');
  
  // 1. Create a dummy tenant and customer for the test
  const tenant = await prisma.tenant.upsert({
    where: { id: 'sim_tenant_1' },
    update: {},
    create: {
      id: 'sim_tenant_1',
      name: 'محلات الشروق للمقاولات',
      businessType: 'مستلزمات بناء',
      workingHours: '9 ص لـ 9 م'
    }
  });

  const customer = await prisma.customer.upsert({
    where: { 
      tenantId_phone: {
        tenantId: tenant.id,
        phone: '01011122233'
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'أحمد محمد',
      phone: '01011122233',
    }
  });

  const product = await prisma.product.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: 'طن حديد تسليح'
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'طن حديد تسليح',
      unitPrice: 50000,
      stockQuantity: 100
    }
  });

  console.log('[+] Tenant, Customer, and Product Ready.\\n');

  const messages = [
    'سجل بيع 10 طن حديد تسليح لأحمد محمد بـ 500000 دفع كاش 200000 والباقي آجل',
    'استعلم عن حساب أحمد محمد',
    'أحمد رجع 1 طن حديد تسليح بـ 50000 عشان كان فيه عيب'
  ];

  for (const msg of messages) {
    console.log(`========================================`);
    console.log(`🗣️ العميل (التاجر): ${msg}`);
    console.log(`========================================`);
    
    try {
      // Simulate Telegram Chat ID: 99999999
      const result = await processTelegramMessageWithLLM(
        msg,
        tenant.id,
        tenant.name,
        tenant.businessType,
        tenant.workingHours,
        "99999999",
        undefined
      );
      console.log(`\\n🤖 المساعد الذكي:\\n${result.text}\\n`);
    } catch (err: any) {
      console.error(`\\n[!] Error: ${err.message}\\n`);
    }
  }

  console.log('--- Simulation Complete ---');
}

run().finally(() => prisma.$disconnect());
