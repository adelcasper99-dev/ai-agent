import { calculateQuotation } from '../lib/alumital/estimator';
import { buildSketchSvg } from '../lib/alumital/media_worker';
import { resolveActiveTools } from '../lib/telegram_llm';

async function main() {
  console.log('----------------------------------------------------');
  console.log('1. اختبار Tool Routing (التعرف على الطلب وتوجيهه):');
  const userPrompt = 'احسبلي مقايسة شباك ألوميتال مقاس 120 في 150 عدد 2 بسعر 1450 للمتر ومقابض زيادة';
  const routing = resolveActiveTools(userPrompt);
  console.log('Active Clusters:', routing.activeClusters);
  console.log('Selected Tool:', routing.activeTools.map(t => t.name).join(', '));

  console.log('\n----------------------------------------------------');
  console.log('2. اختبار محرك الحسابات المالية (Decimal.js Engine):');
  const quote = calculateQuotation({
    width_cm: 120,
    height_cm: 150,
    quantity: 2,
    price_per_meter: 1450,
    extra_items: [
      { name: 'مقبض وكالون أمان تركي', quantity: 2, unit_price: 180 },
      { name: 'دلفة سلك صلب مقاوم للصدأ', quantity: 2, unit_price: 250 }
    ],
    discount_pct: 5
  });

  console.log('الأبعاد: 120 × 150 سم (عدد 2)');
  console.log('مساحة الشباك الواحد:', quote.area_sqm, 'م² (إجمالي المساحة:', (Number(quote.area_sqm) * 2).toFixed(2), 'م²)');
  console.log('سعر قطاع الألوميتال:', quote.window_total, 'ج.م');
  console.log('الإضافات:', quote.extra_items.map(e => `${e.name} (${e.total_price} ج.م)`).join(' + '));
  console.log('الإجمالي قبل الخصم:', quote.subtotal_before_discount, 'ج.م');
  console.log('الخصم (5%):', quote.discount_applied, 'ج.م');
  console.log('💰 الإجمالي النهائي الصافي:', quote.total_price, 'ج.م');

  console.log('\n----------------------------------------------------');
  console.log('3. اختبار توليد الرسم المعماري الهندسي (Vector SVG):');
  const svg = buildSketchSvg({ width_cm: 120, height_cm: 150 });
  console.log('SVG Length:', svg.length, 'bytes');
  console.log('Sample SVG tags generated:', svg.substring(0, 180) + '...');

  console.log('\n----------------------------------------------------');
  console.log('4. نموذج رسالة الرد المباشرة في Telegram:');
  const msgPreview = `📐 *مقايسة ألوميتال مبدئية*
━━━━━━━━━━━━━━━━━━━━
▫️ *العميل:* أحمد محمود
▫️ *المقاس:* 120 × 150 سم (عدد: 2)
▫️ *المساحة:* 1.80 م² (إجمالي: 3.60 م²)
▫️ *سعر المتر:* 1450.00 ج.م
▫️ *قيمة القطاع:* 5220.00 ج.م
▫️ *الإضافات:* مقبض وكالون تركي (360.00 ج.م) + سلك صلب (500.00 ج.م)
▫️ *الإجمالي قبل الخصم:* 6080.00 ج.م
▫️ *الخصم:* 5% (304.00 ج.م)
━━━━━━━━━━━━━━━━━━━━
💰 *الإجمالي الصافي: 5776.00 ج.م*

🔘 [⚡ توليد المقايسة PDF والرسم الهندسي]`;
  console.log(msgPreview);
}

main().catch(console.error);
