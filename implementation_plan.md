# Implementation Plan: Product Catalog Auto-Sync on Purchase & Arabic Fuzzy Search

Fix the issue where products purchased via `log_purchase` are not automatically upserted into the `Product` catalog table, and implement `findProductFuzzy` to ensure flexible Arabic name resolution in `log_sale`.

## Proposed Changes

### [casper-voice-web/lib/telegram_llm.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/lib/telegram_llm.ts)

#### 1. Implement `findProductFuzzy(tx, tenantId, rawItemName)`
- Normalizes `rawItemName` and all products for `tenantId`.
- Normalizes Arabic alef/hamza (`أإآ` -> `ا`), marboota (`ة` -> `ه`), yaa (`ى` -> `ي`).
- Strips prefixes (`ال`, `و`, `ب`).
- Matches exact normalized name, `contains` substring, or token overlap.

#### 2. Update `log_purchase` Handler
- Inside the transaction, after creating/getting `Supplier` and `Purchase`:
- Search for product using `findProductFuzzy(tx, tenantId, item_name)`.
- If found: Increment `stockQuantity += quantity`. If unit price is 0, update `unitPrice = calculatedUnitPrice`.
- If not found: Create a new `Product` row:
  - `tenantId`
  - `name: String(item_name).trim()`
  - `isStockItem: true`
  - `stockQuantity: quantity`
  - `unitPrice: calculatedUnitPrice`

#### 3. Update `log_sale` Handler
- Replace exact `tx.product.findFirst` with `findProductFuzzy(tx, tenantId, itemNameTrimmed)`.

---

## Verification Plan

### Automated Tests
- Run `npx ts-node scripts/manual-sim/test_all_tools.ts` to verify all 36 test scenarios pass.
- Run new custom test scenario reproducing the exact steps from the screenshot.

### Manual Verification
- Purchase 50 tons of "اسمنت" from supplier.
- Sell 5 tons of "اسمنت ممتاز" to customer.
- Verify product stock decreases from 50 to 45 and sale succeeds without "Item not in catalog" error.
