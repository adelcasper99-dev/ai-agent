import path from 'path';
import fs from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import Decimal from 'decimal.js';
import { prisma } from '@/lib/prisma';

export interface SketchItem {
  itemIndex: number;
  itemType: string;
  width_cm: number;
  height_cm: number;
  quantity: number;
  svgPath: string;
  pngPath: string;
  url: string;
  pngBase64: string;
}

export interface MediaRenderJob {
  quoteId: string;
  tenantId?: string;
  pdfPath?: string;
  sketchPngPath?: string;
  sketchSvgPath?: string;
  pdfUrl?: string;
  sketchUrl?: string;
  sketches?: SketchItem[];
  status: 'completed' | 'failed';
  error?: string;
}

export interface SketchDimensions {
  width_cm: number;
  height_cm: number;
  customerRef?: string;
  profile_type?: string;
  item_type?: string;
  quantity?: number;
  item_index?: number;
}

// ==================== CONCURRENCY MUTEX & SINGLETON BROWSER ====================
let browserInstance: any = null;
let browserIdleTimer: NodeJS.Timeout | null = null;
const BROWSER_IDLE_TIMEOUT_MS = 60000; // Close browser after 60s of inactivity to keep 0MB idle RAM

let renderMutexPromise: Promise<void> = Promise.resolve();

async function withRenderMutex<T>(fn: () => Promise<T>): Promise<T> {
  let unlock: () => void;
  const nextLock = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  const prevLock = renderMutexPromise;
  renderMutexPromise = nextLock;

  await prevLock;
  try {
    return await fn();
  } finally {
    unlock!();
  }
}

async function getBrowser() {
  if (browserIdleTimer) {
    clearTimeout(browserIdleTimer);
    browserIdleTimer = null;
  }

  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }

  const puppeteerCore: any = await import('puppeteer-core').catch(() => null);
  const puppeteer = puppeteerCore ? (puppeteerCore.default || puppeteerCore) : null;

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

  const possiblePaths = [
    process.env.CHROMIUM_PATH,
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  if (puppeteer && typeof puppeteer.launch === 'function') {
    for (const p of possiblePaths) {
      if (p && existsSync(p)) {
        try {
          browserInstance = await puppeteer.launch({
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

// ==================== 2D VECTOR BLUEPRINT GENERATOR ====================
export function buildSketchSvg(dim: SketchDimensions): string {
  const w = Number(dim.width_cm) || 100;
  const h = Number(dim.height_cm) || 100;
  const itemType = (dim.item_type || 'شباك').trim();
  const itemIndex = dim.item_index || 1;
  const qty = dim.quantity || 1;

  const hasDoorKeyword = /باب|door/i.test(itemType);
  const hasWindowKeyword = /شباك|نافذة|window/i.test(itemType);
  const hasCustomKeyword = /مطبخ|فاصل|تندة|واجهة|قاطع|kitchen|partition|facade/i.test(itemType);

  let isDoor = false;
  let isWindow = false;

  if (hasDoorKeyword) {
    isDoor = true;
  } else if (hasWindowKeyword) {
    isWindow = true;
  } else if (hasCustomKeyword) {
    // Custom architectural panel
    isDoor = false;
    isWindow = false;
  } else if (h >= 180 && w <= 110) {
    isDoor = true;
  } else if (!itemType || itemType === 'شباك' || h < 180) {
    isWindow = true;
  }

  // Aspect ratio scaling inside a 600x500 viewport
  const maxW = 440;
  const maxH = 330;
  const ratio = Math.min(maxW / w, maxH / h);
  const drawW = Math.max(80, Math.round(w * ratio));
  const drawH = Math.max(100, Math.round(h * ratio));

  const startX = Math.round((600 - drawW) / 2);
  const startY = Math.round((460 - drawH) / 2) + 20;
  const frameThickness = Math.max(10, Math.round(drawW * 0.05));
  const areaM2 = ((w * h) / 10000).toFixed(2);

  // Door specific elements vs Window specific elements
  let interiorSvg = '';
  let typeLabel = '';

  if (isDoor) {
    typeLabel = `باب ألوميتال`;
    const innerW = drawW - frameThickness * 2;
    const innerH = drawH - frameThickness * 2;
    const handleY = startY + Math.round(drawH * 0.55);
    const handleX = startX + drawW - frameThickness - 18;

    interiorSvg = `
      <!-- Door Main Leaf -->
      <rect x="${startX + frameThickness}" y="${startY + frameThickness}" 
            width="${innerW}" height="${innerH}" 
            fill="url(#glassGrad)" stroke="#38bdf8" stroke-width="1.5" rx="2" />
      
      <!-- Door Top Glass Panel & Lower Kickplate -->
      <rect x="${startX + frameThickness + 10}" y="${startY + frameThickness + 10}" 
            width="${innerW - 20}" height="${Math.round(innerH * 0.55)}" 
            fill="#0284c7" fill-opacity="0.25" stroke="#38bdf8" stroke-width="1" />
      <rect x="${startX + frameThickness + 10}" y="${startY + frameThickness + Math.round(innerH * 0.65)}" 
            width="${innerW - 20}" height="${Math.round(innerH * 0.3)}" 
            fill="#1e293b" stroke="#64748b" stroke-width="1" />

      <!-- Door Handle & Keyhole Knob -->
      <circle cx="${handleX}" cy="${handleY}" r="7" fill="#f8fafc" stroke="#0284c7" stroke-width="2" />
      <rect x="${handleX - 3}" cy="${handleY - 14}" width="6" height="28" rx="3" fill="#cbd5e1" stroke="#475569" stroke-width="1" />
      
      <!-- Door Swing Arc Indicator -->
      <path d="M ${startX + frameThickness} ${startY + drawH - frameThickness} A ${innerW} ${innerW} 0 0 0 ${startX + drawW - frameThickness} ${startY + drawH - frameThickness}" 
            fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="6 6" stroke-opacity="0.6" />
    `;
  } else if (isWindow) {
    typeLabel = `شباك ألوميتال`;
    const midX = startX + Math.round(drawW / 2);
    const sashW = Math.round((drawW - frameThickness * 3) / 2);
    const sashH = drawH - frameThickness * 2;

    interiorSvg = `
      <!-- Left Glass Sash -->
      <rect x="${startX + frameThickness}" y="${startY + frameThickness}" 
            width="${sashW}" height="${sashH}" 
            fill="url(#glassGrad)" stroke="#38bdf8" stroke-width="1.5" rx="2" />

      <!-- Right Glass Sash -->
      <rect x="${midX + Math.round(frameThickness / 2)}" y="${startY + frameThickness}" 
            width="${sashW}" height="${sashH}" 
            fill="url(#glassGrad)" stroke="#38bdf8" stroke-width="1.5" rx="2" />

      <!-- Middle Mullion Interlock -->
      <rect x="${midX - Math.round(frameThickness / 2)}" y="${startY}" 
            width="${frameThickness}" height="${drawH}" 
            fill="url(#frameGrad)" stroke="#64748b" stroke-width="1" />

      <!-- Glass reflection light glare -->
      <line x1="${startX + frameThickness + 15}" y1="${startY + frameThickness + 15}" 
            x2="${startX + Math.round(drawW * 0.35)}" y2="${startY + drawH - frameThickness - 20}" 
            stroke="#ffffff" stroke-width="2" stroke-opacity="0.3" stroke-dasharray="10 15" />
      <line x1="${midX + frameThickness + 15}" y1="${startY + frameThickness + 15}" 
            x2="${midX + Math.round(drawW * 0.35)}" y2="${startY + drawH - frameThickness - 20}" 
            stroke="#ffffff" stroke-width="2" stroke-opacity="0.3" stroke-dasharray="10 15" />
    `;
  } else {
    // Custom / Universal Architectural Panel (Kitchen, Partition, Facade, etc.)
    typeLabel = itemType;
    const innerW = drawW - frameThickness * 2;
    const innerH = drawH - frameThickness * 2;

    interiorSvg = `
      <!-- Neutral Panel Body -->
      <rect x="${startX + frameThickness}" y="${startY + frameThickness}" 
            width="${innerW}" height="${innerH}" 
            fill="url(#glassGrad)" stroke="#38bdf8" stroke-width="1.5" rx="2" />
      
      <!-- Architectural Grid Lines -->
      <line x1="${startX + frameThickness}" y1="${startY + Math.round(drawH / 2)}" 
            x2="${startX + drawW - frameThickness}" y2="${startY + Math.round(drawH / 2)}" 
            stroke="#64748b" stroke-width="1.5" stroke-dasharray="5 5" />
      <line x1="${startX + Math.round(drawW / 2)}" y1="${startY + frameThickness}" 
            x2="${startX + Math.round(drawW / 2)}" y2="${startY + drawH - frameThickness}" 
            stroke="#64748b" stroke-width="1.5" stroke-dasharray="5 5" />
    `;
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 500" width="600" height="500" style="background:#0f172a; font-family:'Cairo', 'Noto Sans Arabic', 'DejaVu Sans', Tahoma, sans-serif;">
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

  <!-- Background Canvas -->
  <rect width="100%" height="100%" fill="#0f172a" />
  <rect width="100%" height="100%" fill="url(#grid)" />

  <!-- Top Title Bar -->
  <rect x="25" y="16" width="550" height="42" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1" />
  <text x="555" y="43" fill="#38bdf8" font-size="16" font-weight="bold" text-anchor="end">بند ${itemIndex}: ${itemType} (${qty} قطع)</text>
  <text x="45" y="43" fill="#94a3b8" font-size="14" font-weight="600" text-anchor="start">المقاس: ${w} × ${h} سم</text>

  <!-- Outer Aluminum Profile Frame -->
  <rect x="${startX}" y="${startY}" width="${drawW}" height="${drawH}" rx="4" fill="url(#frameGrad)" stroke="#94a3b8" stroke-width="2" />

  <!-- Dynamic Interior Architecture -->
  ${interiorSvg}

  <!-- Top Width Dimension Line -->
  <line x1="${startX}" y1="${startY - 22}" x2="${startX + drawW}" y2="${startY - 22}" 
        stroke="#38bdf8" stroke-width="2" marker-start="url(#arrow)" marker-end="url(#arrow)" />
  <line x1="${startX}" y1="${startY - 30}" x2="${startX}" y2="${startY - 4}" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2 2" />
  <line x1="${startX + drawW}" y1="${startY - 30}" x2="${startX + drawW}" y2="${startY - 4}" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2 2" />
  
  <!-- Width Label Badge -->
  <rect x="${startX + Math.round(drawW / 2) - 65}" y="${startY - 42}" width="130" height="26" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" />
  <text x="${startX + Math.round(drawW / 2)}" y="${startY - 25}" fill="#f8fafc" font-size="13" font-weight="bold" text-anchor="middle">العرض: ${w} سم</text>

  <!-- Right Height Dimension Line -->
  <line x1="${startX + drawW + 24}" y1="${startY}" x2="${startX + drawW + 24}" y2="${startY + drawH}" 
        stroke="#38bdf8" stroke-width="2" marker-start="url(#arrow)" marker-end="url(#arrow)" />
  <line x1="${startX + drawW + 4}" y1="${startY}" x2="${startX + drawW + 32}" y2="${startY}" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2 2" />
  <line x1="${startX + drawW + 4}" y1="${startY + drawH}" x2="${startX + drawW + 32}" y2="${startY + drawH}" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2 2" />

  <!-- Height Label Badge -->
  <rect x="${startX + drawW + 32}" y="${startY + Math.round(drawH / 2) - 14}" width="130" height="28" rx="6" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5" />
  <text x="${startX + drawW + 97}" y="${startY + Math.round(drawH / 2) + 5}" fill="#f8fafc" font-size="13" font-weight="bold" text-anchor="middle">الارتفاع: ${h} سم</text>

  <!-- Footer Info Specs -->
  <rect x="25" y="445" width="550" height="38" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1" />
  <text x="555" y="469" fill="#94a3b8" font-size="13" text-anchor="end">قطاع ألوميتال هندسي معتمد — ${typeLabel}</text>
  <text x="45" y="469" fill="#38bdf8" font-size="13" font-weight="bold" text-anchor="start">مساحة الوحدة: ${areaM2} م² | الإجمالي: ${(Number(areaM2) * qty).toFixed(2)} م²</text>
</svg>
  `.trim();
}

// ==================== ARABIC HTML & PDF QUOTATION TEMPLATE ====================
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
  items?: Array<any>;
  extra_items?: Array<{ name: string; quantity: number; unit_price: string; line_total: string }>;
  subtotal_before_discount: string;
  discount_applied: string;
  total_price: string;
  sketches?: Array<{ itemIndex: number; itemType: string; width_cm: number; height_cm: number; quantity: number; pngBase64: string }>;
  sketchPngBase64?: string;
}): string {
  const isMultiItem = data.items && data.items.length > 1;
  const itemsList = data.items && data.items.length > 0 ? data.items : [
    {
      item_type: 'شباك',
      width_cm: data.width_cm,
      height_cm: data.height_cm,
      quantity: data.quantity,
      price_per_meter: data.price_per_meter,
      total_billable_area_sqm: data.area_sqm,
      line_total: data.window_total,
    }
  ];

  const itemRows = itemsList
    .map(
      (item, idx) => `
    <tr>
      <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
      <td>
        <strong style="color:#0f172a;">${item.item_type || 'شباك'} (${item.width_cm} × ${item.height_cm} سم)</strong><br>
        <span style="font-size:11px; color:#64748b;">مساحة إجمالية: ${item.total_billable_area_sqm || item.total_actual_area_sqm} م² ${item.unit_billable_area_sqm === '1.00' ? '(حد أدنى 1م²)' : ''}</span>
      </td>
      <td style="text-align:center; font-weight:600;">${item.quantity}</td>
      <td style="text-align:center;">${item.price_per_meter || data.price_per_meter} ج.م</td>
      <td style="text-align:center; font-weight:bold; color:#0284c7;">${item.line_total} ج.م</td>
    </tr>`
    )
    .join('');

  const extraRows = (data.extra_items || [])
    .map(
      (item, idx) => `
    <tr>
      <td style="text-align:center;">${itemsList.length + idx + 1}</td>
      <td>${item.name}</td>
      <td style="text-align:center;">${item.quantity}</td>
      <td style="text-align:center;">${item.unit_price} ج.م</td>
      <td style="text-align:center; font-weight:bold;">${item.line_total} ج.م</td>
    </tr>`
    )
    .join('');

  // Visual Sketch Cards Layout (Single page compact matrix for <= 6 items)
  let sketchesHtml = '';
  const sketchesToRender = data.sketches && data.sketches.length > 0 ? data.sketches : (data.sketchPngBase64 ? [{ itemIndex: 1, itemType: 'شباك', width_cm: data.width_cm, height_cm: data.height_cm, quantity: data.quantity, pngBase64: data.sketchPngBase64 }] : []);

  if (sketchesToRender.length === 1) {
    sketchesHtml = `
    <div class="sketch-single" onclick="openSketchModal('data:image/png;base64,${sketchesToRender[0].pngBase64}', 'المخطط الهندسي والمعاينة التفصيلية')" title="انقر للتكبير بملء الشاشة">
      <div class="sketch-header">📐 الرسم الفني والمنظور الهندسي المعتمد <span class="zoom-badge">🔍 انقر للتكبير</span></div>
      <img src="data:image/png;base64,${sketchesToRender[0].pngBase64}" alt="رسم هندسي" style="max-height: 200px; cursor: pointer;" />
    </div>`;
  } else if (sketchesToRender.length > 1 && sketchesToRender.length <= 6) {
    const gridCols = sketchesToRender.length === 2 ? 'repeat(2, 1fr)' : sketchesToRender.length <= 4 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)';
    const cards = sketchesToRender
      .map(
        (sk) => `
      <div class="sketch-card" onclick="openSketchModal('data:image/png;base64,${sk.pngBase64}', 'بند ${sk.itemIndex}: ${sk.itemType} (${sk.width_cm} × ${sk.height_cm} سم)')" title="انقر للتكبير بملء الشاشة">
        <div class="sketch-card-title">بند ${sk.itemIndex}: ${sk.itemType} (${sk.width_cm}×${sk.height_cm}) 🔍</div>
        <img src="data:image/png;base64,${sk.pngBase64}" alt="بند ${sk.itemIndex}" />
      </div>`
      )
      .join('');

    sketchesHtml = `
    <div class="sketch-matrix-section">
      <div class="sketch-header">📐 المخططات الهندسية للأصناف (${sketchesToRender.length} بنود) <span class="zoom-badge">🔍 انقر على أي بند للتكبير</span></div>
      <div class="sketch-grid" style="grid-template-columns: ${gridCols};">
        ${cards}
      </div>
    </div>`;
  }

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>عرض سعر ألوميتال #${data.quoteId.slice(0, 8)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Noto+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * { 
      box-sizing: border-box; 
      margin: 0; 
      padding: 0; 
      font-family: 'Cairo', 'Noto Sans Arabic', 'DejaVu Sans', Tahoma, sans-serif; 
    }
    body { 
      background-color: #ffffff; 
      color: #1e293b; 
      padding: 0; 
      font-size: 13px; 
      line-height: 1.4;
    }
    .page-container { 
      max-width: 780px; 
      margin: 0 auto; 
      background: #ffffff; 
      padding: 10px 14px;
    }
    .header { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      border-bottom: 2px solid #0284c7; 
      padding-bottom: 10px; 
      margin-bottom: 12px; 
    }
    .company-title { font-size: 20px; font-weight: 800; color: #0f172a; }
    .company-sub { font-size: 12px; color: #64748b; margin-top: 2px; }
    .quote-badge { 
      background: #f0f9ff; 
      border: 1px solid #bae6fd; 
      color: #0284c7; 
      padding: 6px 14px; 
      border-radius: 8px; 
      text-align: left; 
    }
    .quote-badge h3 { font-size: 14px; font-weight: 700; margin: 0; }
    .quote-badge p { font-size: 11px; color: #64748b; margin: 1px 0 0 0; }
    
    .meta-grid { 
      display: grid; 
      grid-template-columns: repeat(4, 1fr); 
      gap: 8px; 
      margin-bottom: 12px; 
      background: #f8fafc; 
      padding: 10px 12px; 
      border-radius: 8px; 
      border: 1px solid #e2e8f0; 
    }
    .meta-item { display: flex; flex-direction: column; font-size: 12px; }
    .meta-label { color: #64748b; font-weight: 600; font-size: 11px; margin-bottom: 2px; }
    .meta-val { color: #0f172a; font-weight: 700; }

    /* Sketches Layout & Hover Effects */
    .sketch-single { 
      margin-bottom: 12px; 
      text-align: center; 
      background: #0f172a; 
      padding: 8px; 
      border-radius: 8px; 
      page-break-inside: avoid;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .sketch-single:hover {
      transform: scale(1.02);
      box-shadow: 0 10px 25px rgba(2, 132, 199, 0.3);
    }
    .sketch-single img { max-width: 100%; height: auto; border-radius: 4px; }
    
    .sketch-matrix-section {
      margin-bottom: 12px;
      background: #0f172a;
      padding: 8px 10px;
      border-radius: 8px;
      page-break-inside: avoid;
    }
    .sketch-header { 
      color: #38bdf8; 
      font-size: 12px; 
      font-weight: 700; 
      margin-bottom: 6px; 
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .zoom-badge {
      font-size: 10px;
      color: #94a3b8;
      background: #1e293b;
      padding: 2px 8px;
      border-radius: 10px;
      border: 1px solid #334155;
    }
    .sketch-grid {
      display: grid;
      gap: 8px;
    }
    .sketch-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 4px;
      text-align: center;
      cursor: pointer;
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      position: relative;
    }
    .sketch-card:hover {
      transform: scale(1.08);
      border-color: #38bdf8;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
      z-index: 10;
    }
    .sketch-card-title {
      font-size: 10px;
      font-weight: 700;
      color: #f8fafc;
      margin-bottom: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sketch-card img {
      width: 100%;
      height: auto;
      max-height: 105px;
      border-radius: 4px;
      object-fit: contain;
      transition: transform 0.2s ease;
    }
    .sketch-card:hover img {
      transform: scale(1.04);
    }

    /* Lightbox Modal Backdrop & Container */
    .sketch-modal-backdrop {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(8px);
      z-index: 99999;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      padding: 20px;
      box-sizing: border-box;
      opacity: 0;
      transition: opacity 0.25s ease;
    }
    .sketch-modal-backdrop.active {
      display: flex;
      opacity: 1;
    }
    .sketch-modal-content {
      max-width: 90vw;
      max-height: 85vh;
      background: #1e293b;
      border: 2px solid #0284c7;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }
    .sketch-modal-content img {
      max-width: 85vw;
      max-height: 70vh;
      object-fit: contain;
      border-radius: 6px;
    }
    .sketch-modal-title {
      color: #38bdf8;
      font-size: 16px;
      font-weight: 700;
      margin-bottom: 12px;
      text-align: center;
    }
    .sketch-modal-close {
      position: absolute;
      top: -12px;
      left: -12px;
      background: #e11d48;
      color: #ffffff;
      border: 2px solid #ffffff;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .sketch-modal-hint {
      color: #94a3b8;
      font-size: 11px;
      margin-top: 8px;
    }

    /* Print Isolation */
    @media print {
      .sketch-modal-backdrop { display: none !important; }
      .sketch-card { transform: none !important; box-shadow: none !important; cursor: default !important; }
      .sketch-single { transform: none !important; box-shadow: none !important; cursor: default !important; }
      .zoom-badge { display: none !important; }
    }

    /* Table & Pricing */
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; page-break-inside: avoid; }
    th { background: #0f172a; color: #f8fafc; font-weight: 700; padding: 8px 10px; font-size: 12px; text-align: right; }
    td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    tr:nth-child(even) { background: #f8fafc; }

    .summary-box { 
      display: flex; 
      justify-content: flex-end; 
      margin-top: 8px; 
      page-break-inside: avoid;
    }
    .summary-table { width: 320px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
    .summary-table tr td { padding: 6px 12px; font-size: 12px; }
    .summary-table .total-row { background: #0284c7; color: #ffffff; font-size: 14px; font-weight: 800; }
    .summary-table .total-row td { border-bottom: none; color: #ffffff; }

    .footer { 
      margin-top: 14px; 
      padding-top: 8px; 
      border-top: 1px dashed #cbd5e1; 
      display: flex; 
      justify-content: space-between; 
      font-size: 11px; 
      color: #64748b; 
      page-break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="header">
      <div>
        <div class="company-title">${data.tenantName || 'ورشة الألوميتال المتطورة'}</div>
        <div class="company-sub">عرض سعر هندسي تفصيلي ومقايسة معتمدة</div>
      </div>
      <div class="quote-badge">
        <h3>عرض سعر #${data.quoteId.slice(0, 8)}</h3>
        <p>التاريخ: ${data.dateStr}</p>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item"><span class="meta-label">العميل / الإشارة:</span><span class="meta-val">${data.customerRef || 'عميل نقدي'}</span></div>
      <div class="meta-item"><span class="meta-label">${isMultiItem ? 'عدد الأصناف:' : 'المقاس الهندسي:'}</span><span class="meta-val">${isMultiItem ? `${itemsList.length} بنود مختلفة` : `${data.width_cm} × ${data.height_cm} سم`}</span></div>
      <div class="meta-item"><span class="meta-label">إجمالي الوحدات:</span><span class="meta-val">${data.quantity} قطعة</span></div>
      <div class="meta-item"><span class="meta-label">إجمالي المساحة:</span><span class="meta-val">${data.area_sqm} م²</span></div>
    </div>

    ${sketchesHtml}

    <table>
      <thead>
        <tr>
          <th style="width:36px; text-align:center;">#</th>
          <th>البيان والمواصفات الهندسية</th>
          <th style="width:70px; text-align:center;">الكمية</th>
          <th style="width:100px; text-align:center;">سعر الوحدة</th>
          <th style="width:110px; text-align:center;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        ${extraRows}
      </tbody>
    </table>

    <div class="summary-box">
      <table class="summary-table">
        <tr>
          <td>المجموع قبل الخصم:</td>
          <td style="text-align:left; font-weight:bold;">${data.subtotal_before_discount} ج.م</td>
        </tr>
        ${
          new Decimal(data.discount_applied || 0).greaterThan(0)
            ? `
        <tr style="color:#e11d48;">
          <td>الخصم المطبق:</td>
          <td style="text-align:left; font-weight:bold;">- ${data.discount_applied} ج.م</td>
        </tr>`
            : ''
        }
        <tr class="total-row">
          <td>صافي المبلغ الإجمالي:</td>
          <td style="text-align:left;">${data.total_price} ج.م</td>
        </tr>
      </table>
    </div>

    <div class="footer">
      <div>صلاحية هذا العرض 15 يوماً من تاريخ الإصدار.</div>
      <div>نظام Casper Voice ERP — الإدارة السحابية والذكاء الاصطناعي</div>
    </div>
  </div>

  <!-- Interactive Lightbox Modal -->
  <div id="sketchModal" class="sketch-modal-backdrop" onclick="closeSketchModal(event)">
    <div class="sketch-modal-content" onclick="event.stopPropagation()">
      <button class="sketch-modal-close" onclick="closeSketchModal(event)" title="إغلاق">×</button>
      <div id="sketchModalTitle" class="sketch-modal-title">معاينة الرسم الفني</div>
      <img id="sketchModalImg" src="" alt="مخطط مكبر" />
      <div class="sketch-modal-hint">انقر في أي مكان خارج الصورة أو اضغط على مفتاح ESC للإغلاق</div>
    </div>
  </div>

  <script>
    function openSketchModal(imgSrc, title) {
      var modal = document.getElementById('sketchModal');
      var modalImg = document.getElementById('sketchModalImg');
      var modalTitle = document.getElementById('sketchModalTitle');
      if (modal && modalImg && modalTitle) {
        modalImg.src = imgSrc;
        modalTitle.innerText = title || 'المخطط الهندسي المعاين';
        modal.classList.add('active');
      }
    }
    function closeSketchModal(event) {
      if (event) event.stopPropagation();
      var modal = document.getElementById('sketchModal');
      if (modal) {
        modal.classList.remove('active');
      }
    }
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeSketchModal();
      }
    });
  </script>
</body>
</html>
  `.trim();
}

// ==================== PROCESS MEDIA JOB (E2E) ====================
export async function processMediaJob(quoteId: string, tenantId?: string): Promise<MediaRenderJob> {
  return withRenderMutex(async () => {
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

      // Parse items array
      let parsedItems: any[] = [];
      if (quote.items) {
        try {
          parsedItems = typeof quote.items === 'string' ? JSON.parse(quote.items) : (quote.items as any);
        } catch {
          parsedItems = [];
        }
      }

      if (parsedItems.length === 0) {
        parsedItems = [
          {
            item_type: 'شباك',
            width_cm: Number(quote.width_cm),
            height_cm: Number(quote.height_cm),
            quantity: quote.quantity,
            price_per_meter: Number(quote.price_per_meter),
            total_billable_area_sqm: new Decimal(quote.area_sqm).toFixed(2),
            line_total: new Decimal(quote.window_total).toFixed(2),
          },
        ];
      }

      let parsedExtras: any[] = [];
      if (quote.extra_items) {
        try {
          parsedExtras = typeof quote.extra_items === 'string' ? JSON.parse(quote.extra_items) : (quote.extra_items as any);
        } catch {
          parsedExtras = [];
        }
      }

      const browser = await getBrowser();
      const page = await browser.newPage();

      try {
        const sketchItems: SketchItem[] = [];

        // Sequential multi-item sketch generation in single tab (Tab Reuse)
        await page.setViewport({ width: 600, height: 500, deviceScaleFactor: 2 });

        for (let i = 0; i < parsedItems.length; i++) {
          const item = parsedItems[i];
          const itemWidth = Number(item.width_cm) || Number(quote.width_cm) || 100;
          const itemHeight = Number(item.height_cm) || Number(quote.height_cm) || 100;
          const itemType = String(item.item_type || 'شباك');
          const itemQty = Number(item.quantity) || 1;

          // 1. Build crisp SVG blueprint
          const svgContent = buildSketchSvg({
            width_cm: itemWidth,
            height_cm: itemHeight,
            item_type: itemType,
            quantity: itemQty,
            item_index: i + 1,
            customerRef: quote.customerRef || undefined,
          });

          const svgPath = path.join(storageDir, `sketch_${quoteId}_item_${i + 1}.svg`);
          await fs.writeFile(svgPath, svgContent, 'utf-8');

          // 2. Render SVG via Headless Chrome with native HarfBuzz Arabic font shaping
          await page.setContent(
            `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Noto+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; font-family:'Cairo', 'Noto Sans Arabic', 'DejaVu Sans', Tahoma, sans-serif; }
    body { background:#0f172a; overflow:hidden; display:flex; align-items:center; justify-content:center; }
    svg { display:block; width:600px; height:500px; }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`,
            { waitUntil: 'load', timeout: 15000 }
          );

          const pngBuffer = await page.screenshot({ type: 'png', omitBackground: false });
          const pngPath = path.join(storageDir, `sketch_${quoteId}_item_${i + 1}.png`);
          await fs.writeFile(pngPath, pngBuffer);

          const pngUrl = `/storage/${tId}/quotations/${quoteId}/sketch_${quoteId}_item_${i + 1}.png`;
          const pngBase64 = pngBuffer.toString('base64');

          sketchItems.push({
            itemIndex: i + 1,
            itemType,
            width_cm: itemWidth,
            height_cm: itemHeight,
            quantity: itemQty,
            svgPath,
            pngPath,
            url: pngUrl,
            pngBase64,
          });
        }

        // Backwards compatibility primary sketch
        const primarySketch = sketchItems[0];
        const legacyPngPath = path.join(storageDir, `sketch_${quoteId}.png`);
        const legacySvgPath = path.join(storageDir, `sketch_${quoteId}.svg`);
        if (primarySketch) {
          await fs.copyFile(primarySketch.pngPath, legacyPngPath).catch(() => {});
          await fs.copyFile(primarySketch.svgPath, legacySvgPath).catch(() => {});
        }

        // 3. Build & Render Arabic HTML Quotation into Single-Page PDF
        const htmlContent = buildArabicQuotationHtml({
          quoteId: quote.id,
          tenantName: quote.tenant?.name || 'ورشة الألوميتال المتطورة',
          customerRef: quote.customerRef || undefined,
          dateStr: new Date(quote.createdAt).toLocaleDateString('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          width_cm: Number(quote.width_cm),
          height_cm: Number(quote.height_cm),
          quantity: quote.quantity,
          price_per_meter: new Decimal(quote.price_per_meter).toFixed(2),
          area_sqm: new Decimal(quote.area_sqm).toFixed(2),
          window_total: new Decimal(quote.window_total).toFixed(2),
          items: parsedItems,
          extra_items: parsedExtras,
          subtotal_before_discount: new Decimal(quote.subtotal_before_discount).toFixed(2),
          discount_applied: new Decimal(quote.discount_amount || 0).toFixed(2),
          total_price: new Decimal(quote.total_price).toFixed(2),
          sketches: sketchItems,
          sketchPngBase64: primarySketch ? primarySketch.pngBase64 : undefined,
        });

        await page.setContent(htmlContent, { waitUntil: 'load', timeout: 30000 });
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '8mm', right: '10mm', bottom: '8mm', left: '10mm' },
        });

        const pdfPath = path.join(storageDir, `quote_${quoteId}.pdf`);
        await fs.writeFile(pdfPath, pdfBuffer);

        const pdfUrl = `/storage/${tId}/quotations/${quoteId}/quote_${quoteId}.pdf`;
        const sketchUrl = `/storage/${tId}/quotations/${quoteId}/sketch_${quoteId}_item_1.png`;

        // 4. Update Database
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
          sketchPngPath: primarySketch ? primarySketch.pngPath : undefined,
          sketchSvgPath: primarySketch ? primarySketch.svgPath : undefined,
          pdfUrl,
          sketchUrl,
          sketches: sketchItems,
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
  });
}
