# Research Findings: Best Practices for Token-Efficient Prompting & Customer Measurements Architecture

## 1. Executive Summary & Industry Benchmarks
- **Problem Space:** Multi-turn conversational voice/chat assistants for ERP/POS frequently bleed tokens and hallucinate apologetic essays when encountering queries outside standard accounting.
- **Goal:**
  1. System Prompt Hardening (Caveman Directive): Enforce strict token-economy constraints (< 25 words per standard reply, zero apologies, zero internal system mechanics disclosure).
  2. Technical Specifications & Dimension Architecture: Provide a dedicated, schema-isolated model (`CustomerMeasurement`) that captures arbitrary manufacturing dimensions (width, height, type, notes) while cleanly coexisting with financial `Quotation` workflows.

## 2. Token-Efficient System Prompt Best Practices
- **Negative Constraints Formulation:** Standard LLMs (Gemini Flash / GPT-4o) react strongly to positive imperative brevity constraints combined with clear negative rules:
  - `ممنوع تماماً الاعتذارات أو ذكر "أنا ذكاء اصطناعي" أو شرح السيستم الداخلي.`
  - `الردود قصيرة جداً (سطر أو سطرين كحد أقصى) ومباشرة بالعامية المصرية.`
  - `في حال عدم العثور على مقاس أو حساب، أجب مباشرة: "مش مسجل مقاسات لـ [الاسم]. تحب أسجلها دلوقتي؟"`

## 3. Schema & Tool Design for Customer Measurements
- **Model `CustomerMeasurement` Attributes:**
  - `id`: String @id @default(cuid())
  - `tenantId`: String (Indexed with tenant isolation)
  - `customerName`: String (Indexed)
  - `customerId`: String? (Optional link to Customer model)
  - `itemType`: String (e.g. "شباك", "باب", "مطبخ", "تاندة", "واجهة")
  - `width_cm`: Decimal? or Float
  - `height_cm`: Decimal? or Float
  - `quantity`: Int @default(1)
  - `notes`: String? (e.g. "قطاع جامبو دبل عسلي بسلك")
  - `createdAt`: DateTime @default(now())
- **Tools Definition:**
  1. `save_customer_measurement`: Extracts customer name, item type, dimensions (width/height), quantity, and technical notes.
  2. `get_customer_measurements`: Queries measurements by customer name with fuzzy match and formats an ultra-concise summary.

## 4. Conflict-Free Coexistence with Quotations
- `Quotation` is used when pricing / financial computation is involved (`calculate_alumital_quotation`).
- `CustomerMeasurement` is used when recording or retrieving technical dimensions without pricing.
- Both tools reside in `ALUMITAL` / `MEASUREMENTS` cluster to allow Gemini to pick the precise tool based on intent.
