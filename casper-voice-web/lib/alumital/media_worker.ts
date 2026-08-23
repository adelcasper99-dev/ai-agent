import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import Decimal from 'decimal.js';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';

export interface MediaRenderJob {
  quoteId: string;
  tenantId?: string;
  pdfPath?: string;
  sketchPngPath?: string;
  sketchSvgPath?: string;
  pdfUrl?: string;
  sketchUrl?: string;
  status: 'completed' | 'failed';
  error?: string;
}

export interface SketchDimensions {
  width_cm: number;
  height_cm: number;
  customerRef?: string;
  profile_type?: string;
}

// ==================== SINGLETON BROWSER MANAGEMENT ====================
let browserInstance: any = null;
let browserIdleTimer: NodeJS.Timeout | null = null;
const BROWSER_IDLE_TIMEOUT_MS = 60000; // Close browser after 60s of inactivity to save RAM

async function getBrowser() {
  if (browserIdleTimer) {
    clearTimeout(browserIdleTimer);
    browserIdleTimer = null;
  }

  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  // Only puppeteer-core is installed on the VPS (puppeteer full pkg not required).
  // serverExternalPackages in next.config.ts prevents Turbopack from statically bundling it.
  const puppeteerCore = await import('puppeteer-core').catch(() => null);

  const launchOptions = {
    headless: true as const,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-extensions',
    ],
  };

  // Check known browser paths for Linux VPS and Windows dev machine
  const possiblePaths = [
    process.env.CHROMIUM_PATH,
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);


  if (puppeteerCore && puppeteerCore.default) {
    for (const p of possiblePaths) {
      if (p && existsSync(p)) {
        try {
          browserInstance = await puppeteerCore.default.launch({
            ...launchOptions,
            executablePath: p,
          });
          return browserInstance;
        } catch {
          // try next
        }
      }
    }
  }

  throw new Error('Chromium/Chrome binary not found for PDF rendering');
}

function scheduleBrowserIdleClose() {
  if (browserIdleTimer) clearTimeout(browserIdleTimer);
  browserIdleTimer = setTimeout(async () => {
    if (browserInstance) {
      try {
        await browserInstance.close();
      } catch (err) {
        console.error('[MediaWorker] Error closing idle browser:', err);
      }
      browserInstance = null;
    }
  }, BROWSER_IDLE_TIMEOUT_MS);
}

// ==================== 2D VECTOR SKETCH GENERATOR ====================
export function buildSketchSvg(dim: SketchDimensions): string {
  const w = Number(dim.width_cm) || 100;
  const h = Number(dim.height_cm) || 120;

  // Aspect ratio scaling inside a 600x500 viewport with 80px margins
  const maxW = 440;
  const maxH = 340;
  const ratio = Math.min(maxW / w, maxH / h);
  const drawW = Math.round(w * ratio);
  const drawH = Math.round(h * ratio);

  const startX = Math.round((600 - drawW) / 2);
  const startY = Math.round((500 - drawH) / 2) - 10;
  const frameThickness = Math.max(12, Math.round(drawW * 0.05));
  const midX = startX + Math.round(drawW / 2);

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 500" width="600" height="500" style="background:#0f172a; font-family:'Cairo', 'Segoe UI', Tahoma, sans-serif;">
  <defs>
    <!-- Background grid -->
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" stroke-width="1" />
    </pattern>
    <!-- Glass gradient -->
    <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.35" />
      <stop offset="40%" stop-color="#0284c7" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#0369a1" stop-opacity="0.30" />
    </linearGradient>
    <!-- Aluminum frame gradient -->
    <linearGradient id="frameGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#475569" />
      <stop offset="50%" stop-color="#64748b" />
      <stop offset="100%" stop-color="#334155" />
    </linearGradient>
    <!-- Dimension arrow marker -->
    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#38bdf8" />
    </marker>
  </defs>

  <rect width="100%" height="100%" fill="#0f172a" />
  <rect width="100%" height="100%" fill="url(#grid)" />

  <!-- Outer Aluminum Frame -->
  <rect x="${startX}" y="${startY}" width="${drawW}" height="${drawH}" rx="4" fill="url(#frameGrad)" stroke="#94a3b8" stroke-width="2" />

  <!-- Inner Left Glass Panel -->
  <rect x="${startX + frameThickness}" y="${startY + frameThickness}" 
        width="${Math.round((drawW - frameThickness * 3) / 2)}" 
        height="${drawH - frameThickness * 2}" 
        fill="url(#glassGrad)" stroke="#38bdf8" stroke-width="1.5" />

  <!-- Inner Right Glass Panel (Sliding / Fixed) -->
  <rect x="${midX + Math.round(frameThickness / 2)}" y="${startY + frameThickness}" 
        width="${Math.round((drawW - frameThickness * 3) / 2)}" 
        height="${drawH - frameThickness * 2}" 
        fill="url(#glassGrad)" stroke="#38bdf8" stroke-width="1.5" />

  <!-- Middle Mullion / Interlock Profile -->
  <rect x="${midX - Math.round(frameThickness / 2)}" y="${startY}" 
        width="${frameThickness}" height="${drawH}" 
        fill="url(#frameGrad)" stroke="#64748b" stroke-width="1" />

  <!-- Glass reflection light glare lines -->
  <line x1="${startX + frameThickness + 15}" y1="${startY + frameThickness + 15}" 
        x2="${startX + Math.round(drawW * 0.35)}" y2="${startY + drawH - frameThickness - 20}" 
        stroke="#ffffff" stroke-width="2" stroke-opacity="0.25" stroke-dasharray="10 15" />
  <line x1="${midX + frameThickness + 15}" y1="${startY + frameThickness + 15}" 
        x2="${midX + Math.round(drawW * 0.35)}" y2="${startY + drawH - frameThickness - 20}" 
        stroke="#ffffff" stroke-width="2" stroke-opacity="0.25" stroke-dasharray="10 15" />

  <!-- Top Width Dimension Line -->
  <line x1="${startX}" y1="${startY - 25}" x2="${startX + drawW}" y2="${startY - 25}" 
        stroke="#38bdf8" stroke-width="2" marker-start="url(#arrow)" marker-end="url(#arrow)" />
  <line x1="${startX}" y1="${startY - 35}" x2="${startX}" y2="${startY - 5}" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2 2" />
  <line x1="${startX + drawW}" y1="${startY - 35}" x2="${startX + drawW}" y2="${startY - 5}" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2 2" />
  
  <!-- Width Label Badge -->
  <rect x="${startX + Math.round(drawW / 2) - 55}" y="${startY - 44}" width="110" height="26" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" />
  <text x="${startX + Math.round(drawW / 2)}" y="${startY - 26}" fill="#f8fafc" font-size="14" font-weight="bold" text-anchor="middle">ط§ظ„ط¹ط±ط¶: ${w} ط³ظ…</text>

  <!-- Right Height Dimension Line -->
  <line x1="${startX + drawW + 25}" y1="${startY}" x2="${startX + drawW + 25}" y2="${startY + drawH}" 
        stroke="#38bdf8" stroke-width="2" marker-start="url(#arrow)" marker-end="url(#arrow)" />
  <line x1="${startX + drawW + 5}" y1="${startY}" x2="${startX + drawW + 35}" y2="${startY}" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2 2" />
  <line x1="${startX + drawW + 5}" y1="${startY + drawH}" x2="${startX + drawW + 35}" y2="${startY + drawH}" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2 2" />

  <!-- Height Label Badge -->
  <rect x="${startX + drawW + 35}" y="${startY + Math.round(drawH / 2) - 14}" width="115" height="28" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" />
  <text x="${startX + drawW + 92}" y="${startY + Math.round(drawH / 2) + 5}" fill="#f8fafc" font-size="14" font-weight="bold" text-anchor="middle">ط§ظ„ط§ط±طھظپط§ط¹: ${h} ط³ظ…</text>

  <!-- Footer Info Specs -->
  <rect x="30" y="445" width="540" height="40" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1" />
  <text x="550" y="470" fill="#94a3b8" font-size="13" text-anchor="end">ظ‚ط·ط§ط¹ ط£ظ„ظˆظ…ظٹطھط§ظ„ ظ‡ظ†ط¯ط³ظٹ ظ…ط¹طھظ…ط¯</text>
  <text x="50" y="470" fill="#38bdf8" font-size="13" font-weight="bold" text-anchor="start">ط§ظ„ظ…ط³ط§ط­ط©: ${( (w * h) / 10000 ).toFixed(2)} ظ…آ²</text>
</svg>
  `.trim();
}

// ==================== ARABIC HTML QUOTATION TEMPLATE ====================
export function buildArabicQuotationHtml(data: {
  quoteId: string;
  tenantName: string;
  customerRef?: string;
  dateStr: string;
  width_cm: number;
  height_cm: number;
  quantity: number;
  price_per_meter: string;
  area_sqm: string;
  window_total: string;
  extra_items?: Array<{ name: string; quantity: number; unit_price: string; line_total: string }>;
  subtotal_before_discount: string;
  discount_applied: string;
  total_price: string;
  sketchPngBase64?: string;
}): string {
  const extraRows = (data.extra_items || [])
    .map(
      (item, idx) => `
    <tr>
      <td style="text-align:center;">${idx + 1}</td>
      <td>${item.name}</td>
      <td style="text-align:center;">${item.quantity}</td>
      <td style="text-align:center;">${item.unit_price} ط¬.ظ…</td>
      <td style="text-align:center; font-weight:bold;">${item.line_total} ط¬.ظ…</td>
    </tr>`
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>ط¹ط±ط¶ ط³ط¹ط± ط£ظ„ظˆظ…ظٹطھط§ظ„ #${data.quoteId.slice(0, 8)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', Tahoma, sans-serif; }
    body { background-color: #f8fafc; color: #1e293b; padding: 24px; font-size: 14px; }
    .container { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 18px; margin-bottom: 24px; }
    .company-title { font-size: 24px; font-weight: 800; color: #0f172a; }
    .company-sub { font-size: 13px; color: #64748b; margin-top: 4px; }
    .quote-badge { background: #f0f9ff; border: 1px solid #bae6fd; color: #0284c7; padding: 8px 16px; border-radius: 8px; text-align: left; }
    .quote-badge h3 { font-size: 16px; font-weight: 700; margin: 0; }
    .quote-badge p { font-size: 12px; color: #64748b; margin: 2px 0 0 0; }
    
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
    .meta-item { display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; }
    .meta-label { color: #64748b; font-weight: 600; }
    .meta-val { color: #0f172a; font-weight: 700; }

    .sketch-section { margin-bottom: 28px; text-align: center; background: #0f172a; padding: 16px; border-radius: 10px; }
    .sketch-section img { max-width: 100%; height: auto; max-height: 280px; border-radius: 6px; }
    .sketch-title { color: #38bdf8; font-size: 14px; font-weight: 700; margin-bottom: 10px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #0f172a; color: #f8fafc; font-weight: 700; padding: 10px 12px; font-size: 13px; text-align: right; }
    td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    tr:nth-child(even) { background: #f8fafc; }

    .summary-box { display: flex; justify-content: flex-end; margin-top: 16px; }
    .summary-table { width: 340px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
    .summary-table tr td { padding: 8px 14px; }
    .summary-table .total-row { background: #0284c7; color: #ffffff; font-size: 16px; font-weight: 800; }
    .summary-table .total-row td { border-bottom: none; color: #ffffff; }

    .footer { margin-top: 36px; padding-top: 16px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="company-title">${data.tenantName || 'Casper POS â€” ظ…ظ‚ط§ظٹط³ط§طھ ط§ظ„ط£ظ„ظˆظ…ظٹطھط§ظ„'}</div>
        <div class="company-sub">ط¹ط±ط¶ ط³ط¹ط± ظ‡ظ†ط¯ط³ظٹ طھظپطµظٹظ„ظٹ ظˆظ…ظ‚ط§ظٹط³ط© ظ…ط¹طھظ…ط¯ط©</div>
      </div>
      <div class="quote-badge">
        <h3>ط¹ط±ط¶ ط³ط¹ط± #${data.quoteId.slice(0, 8)}</h3>
        <p>ط§ظ„طھط§ط±ظٹط®: ${data.dateStr}</p>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><span class="meta-label">ط§ظ„ط¹ظ…ظٹظ„ / ط§ظ„ط¥ط´ط§ط±ط©:</span><span class="meta-val">${data.customerRef || 'ط¹ظ…ظٹظ„ ظ†ظ‚ط¯ظٹ'}</span></div>
      <div class="meta-item"><span class="meta-label">ط§ظ„ظ…ظ‚ط§ط³ ط§ظ„ظ‡ظ†ط¯ط³ظٹ:</span><span class="meta-val">${data.width_cm} أ— ${data.height_cm} ط³ظ…</span></div>
      <div class="meta-item"><span class="meta-label">ط§ظ„ط¹ط¯ط¯ / ط§ظ„ظƒظ…ظٹط©:</span><span class="meta-val">${data.quantity} ظ‚ط·ط¹ط©</span></div>
      <div class="meta-item"><span class="meta-label">ط¥ط¬ظ…ط§ظ„ظٹ ط§ظ„ظ…ط³ط§ط­ط©:</span><span class="meta-val">${data.area_sqm} ظ…آ²</span></div>
    </div>

    ${
      data.sketchPngBase64
        ? `
    <div class="sketch-section">
      <div class="sketch-title">ًں“گ ط§ظ„ط±ط³ظ… ط§ظ„ظپظ†ظٹ ظˆط§ظ„ظ…ظ†ط¸ظˆط± ط§ظ„ظ‡ظ†ط¯ط³ظٹ ظ„ظ„ظ†ط§ظپط°ط© / ط§ظ„ط¨ط§ط¨</div>
      <img src="data:image/png;base64,${data.sketchPngBase64}" alt="ط±ط³ظ… ظ‡ظ†ط¯ط³ظٹ ظ„ظ„ظ…ظ‚ط§ظٹط³ط©" />
    </div>`
        : ''
    }

    <table>
      <thead>
        <tr>
          <th style="width:40px; text-align:center;">#</th>
          <th>ط§ظ„ط¨ظٹط§ظ† ظˆط§ظ„ظ…ظˆط§طµظپط§طھ</th>
          <th style="width:80px; text-align:center;">ط§ظ„ظƒظ…ظٹط©</th>
          <th style="width:110px; text-align:center;">ط³ط¹ط± ط§ظ„ظˆط­ط¯ط©</th>
          <th style="width:120px; text-align:center;">ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-align:center;">1</td>
          <td>
            <strong>ط¨ظ†ط¯ ظ‚ط·ط§ط¹ ط§ظ„ط£ظ„ظˆظ…ظٹطھط§ظ„ ظˆط§ظ„ط²ط¬ط§ط¬ (${data.width_cm}أ—${data.height_cm} ط³ظ…)</strong><br>
            <span style="font-size:11px; color:#64748b;">ظ…ط³ط§ط­ط© ط¥ط¬ظ…ط§ظ„ظٹط©: ${data.area_sqm} ظ…آ² ط¨ط³ط¹ط± ط§ظ„ظ…طھط± ط§ظ„ظ…ط±ط¨ط¹</span>
          </td>
          <td style="text-align:center;">${data.quantity}</td>
          <td style="text-align:center;">${data.price_per_meter} ط¬.ظ…</td>
          <td style="text-align:center; font-weight:bold;">${data.window_total} ط¬.ظ…</td>
        </tr>
        ${extraRows}
      </tbody>
    </table>

    <div class="summary-box">
      <table class="summary-table">
        <tr>
          <td>ط§ظ„ظ…ط¬ظ…ظˆط¹ ظ‚ط¨ظ„ ط§ظ„ط®طµظ…:</td>
          <td style="text-align:left; font-weight:bold;">${data.subtotal_before_discount} ط¬.ظ…</td>
        </tr>
        ${
          new Decimal(data.discount_applied || 0).greaterThan(0)
            ? `
        <tr style="color:#e11d48;">
          <td>ط§ظ„ط®طµظ… ط§ظ„ظ…ط·ط¨ظ‚:</td>
          <td style="text-align:left; font-weight:bold;">- ${data.discount_applied} ط¬.ظ…</td>
        </tr>`
            : ''
        }
        <tr class="total-row">
          <td>طµط§ظپظٹ ط§ظ„ظ…ط¨ظ„ط؛ ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ:</td>
          <td style="text-align:left;">${data.total_price} ط¬.ظ…</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <div>طµظ„ط§ط­ظٹط© ظ‡ط°ط§ ط§ظ„ط¹ط±ط¶ 15 ظٹظˆظ…ط§ظ‹ ظ…ظ† طھط§ط±ظٹط® ط§ظ„ط¥طµط¯ط§ط±.</div>
      <div>ظ†ط¸ط§ظ… Casper Voice ERP â€” ط§ظ„ط¥ط¯ط§ط±ط© ط§ظ„ط³ط­ط§ط¨ظٹط© ظˆط§ظ„ط°ظƒط§ط، ط§ظ„ط§طµط·ظ†ط§ط¹ظٹ</div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

// ==================== PROCESS MEDIA JOB (E2E) ====================
export async function processMediaJob(quoteId: string, tenantId?: string): Promise<MediaRenderJob> {
  try {
    const quote = await prisma.quotation.findUnique({
      where: { id: quoteId },
      include: { tenant: true },
    });

    if (!quote) {
      throw new Error(`Quotation with id ${quoteId} not found`);
    }

    const tId = tenantId || quote.tenantId || 'global';
    const storageDir = path.resolve(process.cwd(), 'public', 'storage', tId, 'quotations', quoteId);
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }

    const widthCm = Number(quote.width_cm);
    const heightCm = Number(quote.height_cm);

    // 1. Generate 2D Vector SVG Sketch
    const svgContent = buildSketchSvg({
      width_cm: widthCm,
      height_cm: heightCm,
      customerRef: quote.customerRef || undefined,
    });
    const svgPath = path.join(storageDir, `sketch_${quoteId}.svg`);
    await fs.writeFile(svgPath, svgContent, 'utf-8');

    // 2. Convert SVG -> PNG using sharp
    const pngBuffer = await sharp(Buffer.from(svgContent)).png().toBuffer();
    const pngPath = path.join(storageDir, `sketch_${quoteId}.png`);
    await fs.writeFile(pngPath, pngBuffer);
    const pngBase64 = pngBuffer.toString('base64');

    // 3. Generate Arabic HTML
    let parsedExtras: any[] = [];
    if (quote.extra_items) {
      try {
        parsedExtras = typeof quote.extra_items === 'string' ? JSON.parse(quote.extra_items) : (quote.extra_items as any);
      } catch {
        parsedExtras = [];
      }
    }

    const htmlContent = buildArabicQuotationHtml({
      quoteId: quote.id,
      tenantName: quote.tenant?.name || 'ظˆط±ط´ط© ط§ظ„ط£ظ„ظˆظ…ظٹطھط§ظ„ ط§ظ„ظ…طھط·ظˆط±ط©',
      customerRef: quote.customerRef || undefined,
      dateStr: new Date(quote.createdAt).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      width_cm: widthCm,
      height_cm: heightCm,
      quantity: quote.quantity,
      price_per_meter: new Decimal(quote.price_per_meter).toFixed(2),
      area_sqm: new Decimal(quote.area_sqm).toFixed(2),
      window_total: new Decimal(quote.window_total).toFixed(2),
      extra_items: parsedExtras,
      subtotal_before_discount: new Decimal(quote.subtotal_before_discount).toFixed(2),
      discount_applied: new Decimal(quote.discount_amount || 0).toFixed(2),
      total_price: new Decimal(quote.total_price).toFixed(2),
      sketchPngBase64: pngBase64,
    });

    // 4. Render PDF with Chromium
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 30000 });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      });

      const pdfPath = path.join(storageDir, `quote_${quoteId}.pdf`);
      await fs.writeFile(pdfPath, pdfBuffer);

      const pdfUrl = `/storage/${tId}/quotations/${quoteId}/quote_${quoteId}.pdf`;
      const sketchUrl = `/storage/${tId}/quotations/${quoteId}/sketch_${quoteId}.png`;

      // 5. Update DB Status -> completed
      await prisma.quotation.update({
        where: { id: quoteId },
        data: {
          status: 'completed',
          pdfUrl,
          sketchUrl,
        },
      });

      return {
        quoteId,
        tenantId: tId,
        pdfPath,
        sketchPngPath: pngPath,
        sketchSvgPath: svgPath,
        pdfUrl,
        sketchUrl,
        status: 'completed',
      };
    } finally {
      await page.close().catch(() => {});
      scheduleBrowserIdleClose();
    }
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown rendering failure';
    console.error(`[MediaWorker Error for Quote ${quoteId}]:`, err);

    await prisma.quotation
      .update({
        where: { id: quoteId },
        data: { status: 'media_failed' },
      })
      .catch(() => {});

    return {
      quoteId,
      tenantId,
      status: 'failed',
      error: errorMessage,
    };
  }
}
