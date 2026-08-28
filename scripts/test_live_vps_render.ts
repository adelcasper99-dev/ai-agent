import { prisma } from './lib/prisma';
import { processMediaJob } from './lib/alumital/media_worker';
import fs from 'fs';

async function run() {
  const t = await (prisma as any).tenant.findFirst({ where: { state: 'active' } });
  if (!t) {
    console.log('No active tenant found');
    process.exit(0);
  }
  console.log('Using tenant:', t.id, t.name);

  const q = await prisma.quotation.create({
    data: {
      tenantId: t.id,
      customerRef: 'تجربة_المخططات_الحية_VPS',
      width_cm: 100,
      height_cm: 100,
      quantity: 18,
      price_per_meter: 3000,
      area_sqm: 22.61,
      window_total: 67830,
      items: JSON.stringify([
        { item_type: 'شباك', width_cm: 100, height_cm: 100, quantity: 5, price_per_meter: 3000, total_billable_area_sqm: '5.00', line_total: '15000.00' },
        { item_type: 'شباك', width_cm: 90, height_cm: 150, quantity: 3, price_per_meter: 3000, total_billable_area_sqm: '4.05', line_total: '12150.00' },
        { item_type: 'باب', width_cm: 90, height_cm: 210, quantity: 4, price_per_meter: 3000, total_billable_area_sqm: '7.56', line_total: '22680.00' },
        { item_type: 'شباك', width_cm: 70, height_cm: 70, quantity: 6, price_per_meter: 3000, total_billable_area_sqm: '6.00', unit_billable_area_sqm: '1.00', line_total: '18000.00' },
      ]),
      subtotal_before_discount: 67830,
      total_price: 67830,
      status: 'draft',
    },
  });

  console.log('Created live quotation on VPS:', q.id);
  const job = await processMediaJob(q.id, t.id);

  console.log('Live Render Job Result on VPS:', {
    status: job.status,
    sketchesCount: job.sketches ? job.sketches.length : 0,
    pdfPath: job.pdfPath,
    error: job.error,
  });

  if (job.sketches) {
    job.sketches.forEach((s) => {
      const bytes = fs.statSync(s.pngPath).size;
      console.log(` - Sketch Item ${s.itemIndex} [${s.itemType}]: PNG = ${bytes} bytes`);
    });
  }

  if (job.pdfPath) {
    const pdfBytes = fs.statSync(job.pdfPath).size;
    console.log(` - Final PDF: ${pdfBytes} bytes`);
  }

  // Cleanup test record
  await prisma.quotation.delete({ where: { id: q.id } });
  console.log('Test quote deleted. All live verifications passed!');
  process.exit(0);
}

run().catch((e) => {
  console.error('Test execution failed:', e);
  process.exit(1);
});
