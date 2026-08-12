# Task Tracker: Product Catalog Auto-Sync & Arabic Fuzzy Search

- [x] Implement `findProductFuzzy` helper function in `casper-voice-web/lib/telegram_llm.ts`
- [x] Update `log_purchase` handler to auto-upsert products into `Product` table with stock increment
- [x] Update `log_sale` handler to use `findProductFuzzy` for product lookup
