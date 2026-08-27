# نتائج أبحاث أفضل الممارسات الهندسية (Research Findings - Multi-Item Alumital Guardrails)

## 1. تصميم هياكل استدعاء الأدوات للبنود المتعددة (Multi-Item Tool Schemas in Gemini & Groq)
* **المشكلة:** عندما تحتوي الرسالة الصوتية على 4 أو 5 مقاسات مختلفة، وتعريف الأداة يحتوي على حقل واحد فقط (`width_cm`, `height_cm`)، فإن نموذج الذكاء الاصطناعي (LLM) يعجز عن تكرار الاستدعاء بشكل متوازٍ في رسالة واحدة ويلجأ لتوليد جدول نصي وهمي (Hallucination).
* **أفضل ممارسة (Industry Standard):**
  - تعريف مصفوفة `items` مرنة داخل الأداة:
    ```json
    "items": {
      "type": "ARRAY",
      "description": "قائمة البنود والفتحات المطلوبة في المقايسة",
      "items": {
        "type": "OBJECT",
        "properties": {
          "item_type": { "type": "STRING", "description": "نوع البند (شباك، باب، مطبخ، دلفة)" },
          "width_cm": { "type": "NUMBER", "description": "العرض بالسنتيمتر" },
          "height_cm": { "type": "NUMBER", "description": "الارتفاع بالسنتيمتر" },
          "quantity": { "type": "NUMBER", "description": "العدد المطلوب" },
          "price_per_meter": { "type": "NUMBER", "description": "سعر المتر المخصص للبند إن وجد" }
        },
        "required": ["width_cm", "height_cm"]
      }
    }
    ```
  - دعم التوافق العكسي (Backwards Compatibility): إذا مرر النموذج `width_cm` و `height_cm` مباشرة على المستوى الأول (Single Item)، يتم تحويله تلقائياً إلى عنصر داخل `items`.

---

## 2. الدقة المالية وقاعدة الحد الأدنى للقطعة (Deterministic Decimal.js & Minimum Area Floor)
* **قاعدة عرف الألوميتال:**
  - يتم حساب المساحة الفعلية للقطعة: $\text{actual} = \frac{W}{100} \times \frac{H}{100}$.
  - يتم حساب المساحة المحاسبية للقطعة: $\text{billable} = \max(\text{actual}, 1.00)$ عند تفعيل `apply_min_area`.
  - إجمالي البند: $\text{line\_total} = \text{billable} \times \text{quantity} \times \text{price\_per\_meter}$.
  - **قاعدة صارمة:** منع أي عمليات ضرب أو جمع عائمة في جافاسكريبت واستخدام `Decimal.js` حصراً مع التقريب المعياري `ROUND_HALF_UP`.

---

## 3. حوكمة التيليجرام والأزرار التفاعلية (Interactive Telegram State Guardrails)
* **دورة حياة المقايسة:**
  1. حفظ المقايسة في قاعدة البيانات بحالة `draft`.
  2. إرسال كارت ملخص جذاب يتضمن:
     - جدول البنود التفصيلي مع بيان الأمتار المحاسبية.
     - إجمالي الأمتار، سعر المتر، الخصومات، والمبلغ الإجمالي.
     - لوحة أزرار مدمجة (`InlineKeyboardMarkup`):
       - `[✅ اعتماد وتوليد PDF والرسم]` ➔ `confirm_quote_<id>`
       - `[✏️ تعديل المقاس]` ➔ `edit_quote_dim_<id>`
       - `[💵 تعديل السعر / الخصم]` ➔ `edit_quote_price_<id>`
       - `[❌ إلغاء المسودة]` ➔ `cancel_quote_<id>`
  3. عند ضغط زر الاعتماد، يتم قفل المسودة ذرياً (`status: 'processing_media'`) وتوليد الرسم الفني وملف الـ PDF الرسمي وإرسالهما للمستخدم.

---

## 4. حارس منع الهلوسة الحسابية النصية (Anti-Hallucination Guardrail)
* **في الـ System Prompt:** نص صريح وحاسم يمنع توليد جداول مالية نصية لأي مقايسة ألوميتال ويفرض استدعاء `calculate_alumital_quotation`.
* **في معالج الردود (`sanitizeNonToolReply`):** اعتراض أي نص يحتوي على جداول ومقايسات ألوميتال لم تمر عبر الأداة وتوجيهها لمعالج الأدوات أو تنبيه التاجر.
