const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const outDir = path.join(__dirname, '..', 'samples');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Generate SVG Technical Sketch (PNG-ready vector diagram)
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 650" width="100%" height="100%" style="background:#0f172a; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <defs>
    <linearGradient id="frameGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="50%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#0284c7" stop-opacity="0.08"/>
    </linearGradient>
    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8"/>
    </marker>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#0284c7" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Title & Metadata -->
  <text x="400" y="45" fill="#f8fafc" font-size="22" font-weight="bold" text-anchor="middle">كروكي مقايسة فنية - شباك ألوميتال قطاع جامبو</text>
  <text x="400" y="75" fill="#94a3b8" font-size="14" text-anchor="middle">رقم المقايسة: #QTE-2026-0891 | المساحة: 1.68 م² | الكمية: 2</text>

  <!-- Dimension Arrow: Top Width -->
  <line x1="220" y1="110" x2="580" y2="110" stroke="#38bdf8" stroke-width="2" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
  <rect x="340" y="95" width="120" height="30" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="1"/>
  <text x="400" y="115" fill="#38bdf8" font-size="14" font-weight="bold" text-anchor="middle">العرض: 120 سم</text>

  <!-- Dimension Arrow: Left Height -->
  <line x1="170" y1="150" x2="170" y2="510" stroke="#38bdf8" stroke-width="2" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
  <rect x="90" y="315" width="130" height="30" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="1"/>
  <text x="155" y="335" fill="#38bdf8" font-size="14" font-weight="bold" text-anchor="middle">الارتفاع: 140 سم</text>

  <!-- Outer Aluminum Frame -->
  <rect x="220" y="150" width="360" height="360" rx="4" fill="url(#frameGrad)" stroke="#475569" stroke-width="8" filter="url(#glow)"/>

  <!-- Inner Aluminum Profile Bevel -->
  <rect x="236" y="166" width="328" height="328" rx="2" fill="none" stroke="#64748b" stroke-width="3"/>

  <!-- Window Sashes (2 Sliding Panels) -->
  <!-- Left Sash -->
  <rect x="242" y="172" width="160" height="316" fill="url(#glassGrad)" stroke="#475569" stroke-width="6"/>
  <!-- Right Sash -->
  <rect x="398" y="172" width="166" height="316" fill="url(#glassGrad)" stroke="#334155" stroke-width="6"/>

  <!-- Glass Light Reflection Lines -->
  <line x1="260" y1="190" x2="380" y2="350" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.4" stroke-dasharray="80 15"/>
  <line x1="420" y1="190" x2="540" y2="350" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.4" stroke-dasharray="80 15"/>

  <!-- Center Interlock Profile & Locks -->
  <rect x="394" y="172" width="12" height="316" fill="#1e293b" stroke="#64748b" stroke-width="1"/>
  <!-- Lock Handles -->
  <rect x="388" y="315" width="8" height="30" rx="3" fill="#e2e8f0" stroke="#0f172a" stroke-width="1"/>
  <rect x="410" y="315" width="8" height="30" rx="3" fill="#e2e8f0" stroke="#0f172a" stroke-width="1"/>

  <!-- Technical Specs Legend Footer -->
  <g transform="translate(180, 545)">
    <rect x="0" y="0" width="440" height="70" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1"/>
    <text x="220" y="25" fill="#f8fafc" font-size="13" font-weight="bold" text-anchor="middle">المواصفات الفنية المعتمدة</text>
    <text x="220" y="45" fill="#94a3b8" font-size="12" text-anchor="middle">القطاع: ألوميتال جامبو عازل للصوت | الزجاج: دبل 24 مم شفاف عازل</text>
    <text x="220" y="60" fill="#38bdf8" font-size="11" text-anchor="middle">الإكسسوارات: مقابض أصلية + سلك صلب مانع للحشرات</text>
  </g>
</svg>`;

const svgPath = path.join(outDir, 'sample_quotation_sketch.svg');
fs.writeFileSync(svgPath, svgContent, 'utf-8');

// 2. Generate PDF Quotation (PDFKit)
const doc = new PDFDocument({ margin: 40, size: 'A4' });
const pdfPath = path.join(outDir, 'sample_quotation.pdf');
const writeStream = fs.createWriteStream(pdfPath);
doc.pipe(writeStream);

// Primary Palette
const primaryColor = '#0f172a';
const accentColor = '#0284c7';
const lightBg = '#f8fafc';
const borderColor = '#cbd5e1';

// Header Banner
doc.rect(40, 40, 515, 80).fill('#0f172a');
doc.fillColor('#ffffff').fontSize(20).text('CASPER ALUMITAL ERP', 60, 55, { align: 'left' });
doc.fontSize(10).fillColor('#94a3b8').text('Specialized Architectural Aluminum Systems', 60, 80);
doc.fontSize(12).fillColor('#38bdf8').text('QUOTATION / عرض أسعار', 380, 55, { align: 'right' });
doc.fontSize(9).fillColor('#ffffff').text('Invoice #: QTE-2026-0891\nDate: 23/08/2026', 380, 75, { align: 'right' });

// Customer Info Box
doc.rect(40, 135, 515, 60).fill(lightBg).stroke(borderColor);
doc.fillColor('#0f172a').fontSize(11).text('Customer / العميل: المهندس أحمد محمود', 55, 145);
doc.fontSize(10).fillColor('#475569').text('Phone: 01012345678 | Project: فيلا التجمع الخامس', 55, 162);
doc.text('Sales Rep: فرع المعادي | Currency: EGP (جنيه مصري)', 55, 177);

// Items Table Header
let tableTop = 210;
doc.rect(40, tableTop, 515, 25).fill('#1e293b');
doc.fillColor('#ffffff').fontSize(10);
doc.text('Item Description / البيان', 50, tableTop + 7);
doc.text('Dims (WxH)', 230, tableTop + 7);
doc.text('Area / Qty', 310, tableTop + 7);
doc.text('Unit Rate', 390, tableTop + 7);
doc.text('Total (EGP)', 470, tableTop + 7);

// Item 1: Window Quote
tableTop += 30;
doc.rect(40, tableTop, 515, 45).fill('#ffffff').stroke(borderColor);
doc.fillColor('#0f172a').fontSize(10).text('شباك ألوميتال سحاب قطاع جامبو عازل', 50, tableTop + 8);
doc.fontSize(8).fillColor('#64748b').text('زجاج دبل 24 مم + كاوتش EPDM مانع للأتربة', 50, tableTop + 22);

doc.fontSize(9).fillColor('#0f172a');
doc.text('120 x 140 cm', 230, tableTop + 14);
doc.text('1.68 m2 (x2)', 310, tableTop + 14);
doc.text('1,500.00', 390, tableTop + 14);
doc.fillColor(accentColor).text('5,040.00', 470, tableTop + 14);

// Item 2: Extra Items (Handles & Locks)
tableTop += 50;
doc.rect(40, tableTop, 515, 30).fill('#ffffff').stroke(borderColor);
doc.fillColor('#0f172a').fontSize(9).text('مقبض مستورد + كالون أمان تركي (Handle & Lock)', 50, tableTop + 10);
doc.text('Standard', 230, tableTop + 10);
doc.text('2 pcs', 310, tableTop + 10);
doc.text('150.00', 390, tableTop + 10);
doc.fillColor(accentColor).text('300.00', 470, tableTop + 10);

// Item 3: Flyscreen Net
tableTop += 35;
doc.rect(40, tableTop, 515, 30).fill('#ffffff').stroke(borderColor);
doc.fillColor('#0f172a').fontSize(9).text('دلفة سلك صلب مانع للحشرات (Flyscreen Panel)', 50, tableTop + 10);
doc.text('60 x 140 cm', 230, tableTop + 10);
doc.text('2 pcs', 310, tableTop + 10);
doc.text('200.00', 390, tableTop + 10);
doc.fillColor(accentColor).text('400.00', 470, tableTop + 10);

// Financial Summary Box
tableTop += 45;
doc.rect(320, tableTop, 235, 110).fill(lightBg).stroke(borderColor);
doc.fillColor('#475569').fontSize(10);
doc.text('Subtotal / الإجمالي الفرعي:', 330, tableTop + 12);
doc.text('5,740.00 EGP', 470, tableTop + 12, { align: 'right', width: 75 });

doc.text('Discount (5%) / الخصم:', 330, tableTop + 32);
doc.fillColor('#dc2626').text('- 287.00 EGP', 470, tableTop + 32, { align: 'right', width: 75 });

doc.fillColor('#475569').text('VAT (14%) / ض.ق.م:', 330, tableTop + 52);
doc.text('763.42 EGP', 470, tableTop + 52, { align: 'right', width: 75 });

doc.rect(320, tableTop + 72, 235, 38).fill('#0f172a');
doc.fillColor('#ffffff').fontSize(11).text('NET TOTAL / الإجمالي:', 330, tableTop + 85);
doc.fillColor('#38bdf8').fontSize(12).text('6,216.42 EGP', 440, tableTop + 85, { align: 'right', width: 105 });

// Terms & Footer
doc.fillColor('#64748b').fontSize(8);
doc.text('• العرض ساري لمدة 7 أيام من تاريخ الإصدار.\n• الدفعة المقدمة 50% عند التعاقد، و 40% عند التوريد، و 10% بعد التركيب والتسليم.\n• جميع المقاسات تؤكد بعد المعاينة الفعلية في موقع العمل.', 40, 540);

doc.rect(40, 610, 515, 1).fill(borderColor);
doc.fillColor('#94a3b8').fontSize(8).text('Casper AI POS & ERP Systems | Powered by Antigravity Core', 40, 620, { align: 'center', width: 515 });

doc.end();

writeStream.on('finish', () => {
  console.log('PDF and SVG generated successfully in samples directory.');
});
