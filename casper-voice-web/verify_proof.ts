import { prisma } from './lib/prisma';

async function main() {
  console.log('=== RAW DATABASE PROOF ===');
  
  const customer = await prisma.customer.findFirst({
    where: { name: 'أحمد محمد' },
    include: {
      sales: true,
    }
  });

  console.log('CUSTOMER RECORD:', JSON.stringify(customer, null, 2));

  const product = await prisma.product.findFirst({
    where: { name: 'طن حديد تسليح' }
  });

  console.log('PRODUCT RECORD:', JSON.stringify(product, null, 2));
}

main().finally(() => prisma.$disconnect());
