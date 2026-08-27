import { processMediaJob } from '../casper-voice-web/lib/alumital/media_worker';
import { prisma } from '../casper-voice-web/lib/prisma';

async function run() {
  const quote = await prisma.quotation.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  if (!quote) {
    console.log('No quotation found in database');
    return;
  }
  console.log('Testing processMediaJob for Quote:', {
    id: quote.id,
    customerRef: quote.customerRef,
    status: quote.status,
    total_price: quote.total_price.toString(),
  });

  const result = await processMediaJob(quote.id, quote.tenantId);
  console.log('processMediaJob RESULT:', result);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
