# Alumital Estimator — Telegram Integration & Media Worker (Remediation)

## Context

The financial math core (`estimator.ts`) is complete and passing all tests. The feature is **disconnected** from the bot: no tool declaration, no dispatch handler, no real PDF/SVG generation.

## Scope

Three surgical file mutations. Zero schema changes required (Quotation model already exists).

---

## Proposed Changes

### File 1 — `casper-voice-web/lib/telegram_llm.ts`

#### [MODIFY] Tool Declaration (insert before line 401)

Add `const calculateAlumitalQuotationTool: FunctionDeclaration` with:
- `name`: `"calculate_alumital_quotation"`
- Arabic description
- Parameters: `width_cm`, `height_cm`, `quantity`, `price_per_meter`, `apply_min_area`, `discount_pct`, `discount_amount`, `extra_items` (array)
- `required`: `["width_cm", "height_cm", "price_per_meter"]`

#### [MODIFY] ALL_TOOLS array (line 409)

Append `calculateAlumitalQuotationTool` to the array.

#### [MODIFY] New ClusterKey 'ALUMITAL' (line 412)

Add `'ALUMITAL'` to the `ClusterKey` union type.
Add `ALUMITAL_TOOLS` array + keywords (`"أوفر", "أوفرة", "ألومتال", "نافذة", "باب", "كوتيشن", "عرض سعر", "احسبلي", "حسابات", "مقاس"`).

#### [MODIFY] Dispatch handler (insert before line 3038)

```typescript
if (name === "calculate_alumital_quotation") {
  // 1. Parse & validate via Zod
  // 2. Call calculateQuotation() from estimator.ts
  // 3. Persist Quotation record in DB (status: 'draft')
  // 4. Fire-and-forget: processMediaJob() → generates PDF + SVG
  // 5. Return formatted Arabic reply with result breakdown
}
```

---

### File 2 — `src/lib/alumital/media_worker.ts`

Full replacement of 32-line stub with:

1. **Atomic state lock**: `prisma.quotation.updateMany({ where: { id, status: 'draft' }, data: { status: 'processing_media' } })` — if 0 rows updated → skip (already processing)
2. **SVG sketch generator**: Pure string template, proportional 2D rectangle with dimension labels
3. **Arabic HTML template**: Inline Cairo font, RTL layout, full quotation breakdown table
4. **PDF via Puppeteer**: `browser.newPage()` → `setContent(html)` → `pdf({ format: 'A4' })`
5. **fs.writeFile**: Save to `casper-voice-web/public/storage/{tenantId}/quotations/{quoteId}/`
6. **State finalize**: `prisma.quotation.update({ status: 'completed', pdfUrl, sketchUrl })`
7. **Error recovery**: `status: 'media_failed'` on catch

---

### File 3 — `package.json` (casper-voice-web)

Add `puppeteer` to dependencies for server-side PDF rendering.

---

## Verification Plan

### Automated Tests
```bash
npx vitest run tests/alumital_estimator.test.ts   # 4 tests — must stay GREEN
npx vitest run tests/alumital_telegram_e2e.test.ts # 3 tests — must stay GREEN
npx tsc --noEmit                                   # 0 TS errors
```

### Manual Verification
Send bot message: `"احسبلي شباك 150x200 بسعر 280 جنيه للمتر"` → expect:
- Arabic calculation summary reply
- PDF attachment in chat
- 2D sketch attachment

---

## Risk Map

| Risk | Mitigation |
|---|---|
| Puppeteer binary missing on VPS | `puppeteer` bundles Chromium by default — works on Ubuntu VPS |
| Arabic font not rendering | Embed Cairo font as base64 in HTML template |
| Atomic lock race condition | `updateMany WHERE status='draft'` → `count.updated === 0` → bail |
| Public storage path collision | `{tenantId}/{quoteId}` path uniqueness guaranteed by UUID |
| Tool routing miss | Add ALUMITAL keywords to cluster router |
