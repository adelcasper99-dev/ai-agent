-- Data-preserving Float to Decimal & Multi-tenant SQLite migration script
PRAGMA foreign_keys=OFF;
PRAGMA defer_foreign_keys=ON;

-- 1. Product (unitPrice: Float -> Decimal)
CREATE TABLE IF NOT EXISTS "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isStockItem" BOOLEAN NOT NULL DEFAULT true,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("id", "tenantId", "name", "isStockItem", "stockQuantity", "unitPrice", "createdAt", "updatedAt")
SELECT "id", "tenantId", "name", "isStockItem", "stockQuantity", "unitPrice", "createdAt", "updatedAt" FROM "Product";
DROP TABLE IF EXISTS "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX IF NOT EXISTS "Product_tenantId_name_key" ON "Product"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "Product_tenantId_idx" ON "Product"("tenantId");

-- 2. Sale (price, total, paidAmount, deferredAmount: Float -> Decimal)
CREATE TABLE IF NOT EXISTS "new_Sale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "customerId" TEXT,
    "itemName" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total" DECIMAL NOT NULL,
    "customerName" TEXT NOT NULL DEFAULT '',
    "paidAmount" DECIMAL NOT NULL DEFAULT 0,
    "deferredAmount" DECIMAL NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("id", "tenantId", "customerId", "itemName", "price", "quantity", "total", "customerName", "paidAmount", "deferredAmount", "idempotencyKey", "createdAt", "updatedAt")
SELECT "id", "tenantId", "customerId", "itemName", "price", "quantity", "total", "customerName", "paidAmount", "deferredAmount", "idempotencyKey", "createdAt", "updatedAt" FROM "Sale";
DROP TABLE IF EXISTS "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE UNIQUE INDEX IF NOT EXISTS "Sale_tenantId_idempotencyKey_key" ON "Sale"("tenantId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "Sale_tenantId_idx" ON "Sale"("tenantId");

-- 3. Purchase (totalAmount, paidAmount, deferredAmount: Float -> Decimal)
CREATE TABLE IF NOT EXISTS "new_Purchase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "supplierId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "paidAmount" DECIMAL NOT NULL DEFAULT 0,
    "deferredAmount" DECIMAL NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Purchase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Purchase" ("id", "tenantId", "supplierId", "itemName", "totalAmount", "paidAmount", "deferredAmount", "notes", "createdAt", "updatedAt")
SELECT "id", "tenantId", "supplierId", "itemName", "totalAmount", "paidAmount", "deferredAmount", "notes", "createdAt", "updatedAt" FROM "Purchase";
DROP TABLE IF EXISTS "Purchase";
ALTER TABLE "new_Purchase" RENAME TO "Purchase";
CREATE INDEX IF NOT EXISTS "Purchase_tenantId_idx" ON "Purchase"("tenantId");

-- 4. Expense (amount: Float -> Decimal)
CREATE TABLE IF NOT EXISTS "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "amount" DECIMAL NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'عام',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("id", "tenantId", "amount", "description", "category", "createdAt", "updatedAt")
SELECT "id", "tenantId", "amount", "description", "category", "createdAt", "updatedAt" FROM "Expense";
DROP TABLE IF EXISTS "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX IF NOT EXISTS "Expense_tenantId_idx" ON "Expense"("tenantId");

-- 5. SupplierPayment (amount: Float -> Decimal)
CREATE TABLE IF NOT EXISTS "new_SupplierPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "supplierId" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplierPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SupplierPayment" ("id", "tenantId", "supplierId", "amount", "notes", "createdAt")
SELECT "id", "tenantId", "supplierId", "amount", "notes", "createdAt" FROM "SupplierPayment";
DROP TABLE IF EXISTS "SupplierPayment";
ALTER TABLE "new_SupplierPayment" RENAME TO "SupplierPayment";
CREATE INDEX IF NOT EXISTS "SupplierPayment_tenantId_idx" ON "SupplierPayment"("tenantId");
CREATE INDEX IF NOT EXISTS "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");

-- 6. CustomerLedgerEntry (amount: Float -> Decimal)
CREATE TABLE IF NOT EXISTS "new_CustomerLedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "customerId" TEXT NOT NULL,
    "saleId" TEXT,
    "entryType" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerLedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomerLedgerEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CustomerLedgerEntry_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CustomerLedgerEntry" ("id", "tenantId", "customerId", "saleId", "entryType", "amount", "description", "idempotencyKey", "createdAt", "updatedAt")
SELECT "id", "tenantId", "customerId", "saleId", "entryType", "amount", "description", "idempotencyKey", "createdAt", "updatedAt" FROM "CustomerLedgerEntry";
DROP TABLE IF EXISTS "CustomerLedgerEntry";
ALTER TABLE "new_CustomerLedgerEntry" RENAME TO "CustomerLedgerEntry";
CREATE INDEX IF NOT EXISTS "CustomerLedgerEntry_tenantId_idx" ON "CustomerLedgerEntry"("tenantId");
CREATE INDEX IF NOT EXISTS "CustomerLedgerEntry_customerId_idx" ON "CustomerLedgerEntry"("customerId");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerLedgerEntry_idempotencyKey_key" ON "CustomerLedgerEntry"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerLedgerEntry_saleId_entryType_key" ON "CustomerLedgerEntry"("saleId", "entryType");

-- 7. JournalEntry (debit, credit: Float -> Decimal)
CREATE TABLE IF NOT EXISTS "new_JournalEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "accountCode" TEXT NOT NULL,
    "debit" DECIMAL NOT NULL DEFAULT 0,
    "credit" DECIMAL NOT NULL DEFAULT 0,
    "referenceId" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_JournalEntry" ("id", "tenantId", "accountCode", "debit", "credit", "referenceId", "description", "createdAt")
SELECT "id", "tenantId", "accountCode", "debit", "credit", "referenceId", "description", "createdAt" FROM "JournalEntry";
DROP TABLE IF EXISTS "JournalEntry";
ALTER TABLE "new_JournalEntry" RENAME TO "JournalEntry";
CREATE INDEX IF NOT EXISTS "JournalEntry_tenantId_idx" ON "JournalEntry"("tenantId");
CREATE INDEX IF NOT EXISTS "JournalEntry_accountCode_idx" ON "JournalEntry"("accountCode");
CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_referenceId_accountCode_key" ON "JournalEntry"("referenceId", "accountCode");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
