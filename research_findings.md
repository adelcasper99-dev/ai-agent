# Research Findings: Product Catalog Sync & Arabic Fuzzy Search Architecture

## 1. Product Catalog Auto-Sync Pattern (Odoo / ERPNext Standard)

In enterprise POS and inventory management systems (Odoo, ERPNext, Casper POS), purchase orders (`log_purchase`) serve as primary inventory ingestion channels.

### Key Architectural Constraints:
- **Inventory Ingestion:** Every completed purchase order MUST update the `Product` table.
- **Stock Increment:** If `Product` exists for `tenantId` + `normalized(name)`, update `stockQuantity = stockQuantity + purchaseQty`.
- **Catalog Ingestion:** If `Product` does not exist, automatically insert a new `Product` record with `isStockItem = true`, `stockQuantity = purchaseQty`, and `unitPrice = price_per_unit || (total_amount / qty)`.
- **Financial Precision:** Stock quantities and monetary valuations must be calculated using `Decimal.js` to guarantee zero float rounding errors.

---

## 2. Arabic Fuzzy Match Engine (`findProductFuzzy`)

Standard SQL `LIKE %item%` or Prisma `contains` queries fail on Egyptian Arabic speech/text due to character normalization gaps:

| Variation Type | Examples | Resolution Strategy |
| :--- | :--- | :--- |
| **Alef Normalization** | `أسمنت` vs `اسمنت` vs `إسمنت` | Standardize `[أإآ]` -> `ا` |
| **Marboota / Haa** | `كرتونة` vs `كرتونه` | Standardize `ة` -> `ه` |
| **Al-Ta'reef Prefix** | `الاسمنت` vs `اسمنت` | Strip leading `(ال|و|ب|ك|ف)` prefixes |
| **Yaa / Alef Maqsoora** | `علي` vs `على` | Standardize `ى` -> `ي` |
| **Token Overlap** | `اسمنت ممتاز 50` vs `اسمنت ممتاز` | Perform split-token substring & character ratio matching |

---

## 3. Implementation Blueprint
- **Files Modified:** [casper-voice-web/lib/telegram_llm.ts](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/lib/telegram_llm.ts)
- **Functions Introduced:** `findProductFuzzy(tx, tenantId, rawItemName)`
- **Functions Modified:** `log_purchase` (adds Product upsert), `log_sale` (uses `findProductFuzzy`).
