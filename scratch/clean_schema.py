import pathlib

schema_path = pathlib.Path(r'c:\Users\TheExpert\Downloads\casper-voice-project\casper-voice-project\casper-voice-web\prisma\schema.prisma')
lines = schema_path.read_text(encoding='utf-8').splitlines()

# Find the first occurrence of model MerchantMemoryFact and keep it clean
clean_lines = []
stop = False
for i, line in enumerate(lines):
    if i > 450 and "model MerchantMemoryFact {" in line:
        # Keep this model definition up to its closing brace
        clean_lines.append(line)
        # Add the fields of MerchantMemoryFact
        clean_lines.extend([
            "  id              String   @id @default(cuid())",
            "  tenantId        String",
            "  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)",
            "",
            "  factType        String   // \"alias\" | \"preference\" | \"note\"",
            "  entityName      String   // الاسم الرسمي (اسم العميل أو المورد الرسمي)",
            "  aliasOrKey      String   // اللقب أو المفتاح (\"أبوتريكة\", \"طريقة الدفع\")",
            "  value           String   // القيمة الوصفية (بدون أرقام مالية!)",
            "",
            "  partyId         String?  // رابط اختياري بالـ Customer أو Supplier",
            "  sourceMessageId String?  // لمنع التكرار من الـ retries",
            "",
            "  supersededById  String?  @unique // حقل الدمج والتنظيف الدوري",
            "  supersededBy    MerchantMemoryFact?  @relation(\"FactHistory\", fields: [supersededById], references: [id])",
            "  supersedingFact MerchantMemoryFact?  @relation(\"FactHistory\")",
            "",
            "  createdAt       DateTime @default(now())",
            "  updatedAt       DateTime @updatedAt",
            "",
            "  @@index([tenantId, aliasOrKey])",
            "  @@unique([tenantId, sourceMessageId])",
            "}",
            "",
            "// ── الجلسات الملغاة (Session Blacklist / Revocation) ────────────────",
            "model RevokedSession {",
            "  jti       String   @id",
            "  revokedAt DateTime @default(now())",
            "  expiresAt DateTime",
            "",
            "  @@index([expiresAt])",
            "}",
            "",
            "// ── مقايسات الألوميتال (Alumital Estimator & Quotations) ────────────",
            "model Quotation {",
            "  id                       String   @id @default(uuid())",
            "  tenantId                 String",
            "  tenant                   Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)",
            "  customerRef              String?",
            "  width_cm                 Decimal",
            "  height_cm                Decimal",
            "  quantity                 Int      @default(1)",
            "  price_per_meter          Decimal",
            "  area_sqm                 Decimal",
            "  window_total             Decimal",
            "  extra_items              String?  // JSON string: [{ name, unit_price, quantity, line_total }]",
            "  discount_pct             Decimal?",
            "  discount_amount          Decimal?",
            "  subtotal_before_discount  Decimal",
            "  total_price              Decimal",
            "  status                   String   @default(\"draft\") // draft | processing_media | confirmed | media_failed | sent | cancelled",
            "  pdfUrl                   String?",
            "  sketchUrl                String?",
            "  createdAt                DateTime @default(now())",
            "  updatedAt                DateTime @updatedAt",
            "",
            "  @@index([tenantId, status])",
            "  @@index([tenantId, createdAt])",
            "}"
        ])
        break
    else:
        clean_lines.append(line)

schema_path.write_text("\n".join(clean_lines) + "\n", encoding='utf-8')
print("Cleaned schema.prisma written.")
