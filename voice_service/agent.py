import os
import sys
import json
import logging
from dotenv import load_dotenv

# Enforce UTF-8 for Windows console stdout & stderr
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# Reconfigure root logging handlers to prevent cp1256/cp1252 charmap crashes on emojis
for handler in logging.root.handlers:
    if hasattr(handler, 'stream') and hasattr(handler.stream, 'reconfigure'):
        try:
            handler.stream.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass

import httpx
from diagnostics import DiagnosticsSession, get_tenant_id_from_room

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import openai, google, silero

load_dotenv()

API_BASE = os.getenv("DASHBOARD_API_URL", "http://localhost:3006/api")
INTERNAL_SECRET = os.getenv("INTERNAL_SERVICE_SECRET", "casper-voice-internal-secret-9988776655")

def get_internal_headers(extra_headers: dict = None, tenant_id: str = None) -> dict:
    headers = {"x-internal-secret": INTERNAL_SECRET}
    if tenant_id:
        headers["x-tenant-id"] = tenant_id
    if extra_headers:
        headers.update(extra_headers)
    return headers

def get_api_client(extra_headers: dict = None, tenant_id: str = None):
    return httpx.AsyncClient(headers=get_internal_headers(extra_headers, tenant_id))


EGYPTIAN_TELEPHONY_PROMPT = """
أنت "المساعد الشخصي الذكي" (Personal ERP Assistant) الخاص بمدير أو صاحب العمل بنظام Casper ERP & POS.
تحدث بالعامية المصرية الراقية، المهنية، والسريعة جداً كأنك مساعد تنفيذي حقيقي بيكلمه في التليفون.

قواعد الألقاب والتعامل المحترف:
- ممنوع منعاً باتاً استخدام كلمة "باشا" أو "يا باشا" في أي سياق.
- التزم دائماً باللقب المحترف: "مستر [اسم العميل/المدير]" أو "أستاذ [اسم العميل/المدير]" (مثال: "تمام مستر محمد", "تحت أمرك أستاذ أحمد").
- إذا لم تكن تعرف اسم المتحدث واستدعى الموقف اللقب، استخدم "أستاذنا" أو "يا فندم".

قواعد التأكيد الصريح عند التعديل (Echo Confirmation Rules):
- عند تعديل أو تحديث أي مصروف، يجب عليك صراحة نطق المبلغ القديم المسجل والمبلغ الجديد! (مثال: "تمام أستاذنا، آخر مصروف بنزين كان مسجل 100 جنيه، عدلته لـ 150 جنيه!"). ممنوع نهائياً حذف أو اختصار المبلغ القديم.
- عند وجود مواعيد متشابهة للعميل نفسه، اذكر الخيارات المتاحة واسأل العميل لاختيار الميعاد قبل التنفيذ.

قواعد استكمال البيانات الناقصة (Active Slot-Filling):
- يمنع منعاً باتاً استدعاء أي أداة (Tool) إذا كانت البيانات الأساسية ناقصة!
- لحجز ميعاد: يلزم (اسم العميل + التاريخ/اليوم + الوقت + نوع الخدمة).
- لتسجيل مصروف: يلزم (المبلغ + السبب).
- لتسجيل بيع: يلزم (اسم المنتج + السعر والكمية).
- لتسجيل مشتريات: يلزم (اسم المورد + الصنف + المبلغ الإجمالي + المدفوع).
- عند نقص أي معلومة، اسأل فوراً بجملة قصيرة مباشرة (لا تتجاوز 7 كلمات) للاستفسار عن المعلومة الناقصة قبل اتخاذ أي إجراء!

قواعد التأكيد والتنفيذ الفعلي (Strict Tool Calling Rules):
- ممنوع منعاً باتاً أن تقول للعميل "سجلت" أو "دفعت" أو "حفظت" أو "حجزت" دون استدعاء الأداة المختصة (`log_purchase`, `log_sale`, `book_appointment`, `log_expense`, `pay_supplier_debt`) واستلام رد نجاح السيرفر أولاً!
- عند تجميع بيانات المشتريات (اسم المورد + الصنف + المبلغ + المدفوع)، قم باستدعاء `log_purchase` فوراً بمجرد تجميعها.
- عند تعديل أي قيمة مالية، التزم بنطق القيمة القديمة والجديدة معاً في الرد الشفهي.
"""


class CasperAgent(Agent):
    def __init__(self, room=None, tenant_id=None):
        super().__init__(instructions=EGYPTIAN_TELEPHONY_PROMPT)
        self.room = room
        self.tenant_id = tenant_id

    def _get_client(self, extra_headers: dict = None):
        return get_api_client(extra_headers, tenant_id=self.tenant_id)

    async def _emit_success(self, title: str, text: str):
        if self.room:
            try:
                import json as _json
                payload_data = {
                    "type": "ACTION_SUCCESS",
                    "title": title,
                    "text": text,
                }
                payload_bytes = _json.dumps(payload_data, ensure_ascii=False).encode("utf-8")
                await self.room.local_participant.publish_data(payload_bytes, reliable=True, topic="casper-voice-events")
            except Exception as e:
                print(f"[Emit Success Error] {e}")

    @function_tool
    async def log_expense(self, amount: float, description: str, category: str = "عام"):
        """تسجيل مصروف جديد فقط! ممنوع استخدام هذه الأداة لتعديل مصروف سابق (لتعديل مصروف، استخدم update_expense)."""
        if not amount or amount <= 0:
            return "دعت كام يا فندم؟ لابد من تحديد المبلغ."
        if not description or description.strip() == "":
            return "المبلغ ده اتدفع في إيه أستاذنا؟"

        async with self._get_client() as client:
            r = await client.post(
                f"{API_BASE}/expenses",
                json={"amount": amount, "description": description, "category": category, "tenantId": self.tenant_id},
                timeout=5,
            )
        if r.status_code == 200:
            await self._emit_success("✅ تم تسجيل المصروف", f"تمام أستاذنا، سجلت {amount} جنيه ({description}) في المصاريف!")
            return f"تمام أستاذنا، سجلتلك {amount} جنيه {description} في المصاريف وزي الفل!"
        return "حصل خطأ في تسجيل المصروف"


    @function_tool
    async def log_sale(self, item_name: str, price: float, quantity: int = 1, customer_name: str = "", paid_amount: float = None):
        """تسجيل عملية بيع لعميل (كاش أو آجل أو مع تسجيل اسم العميل)"""
        if not item_name or item_name.strip() == "":
            return "بعنا صنف إيه يا فندم؟"
        if not price or price <= 0:
            return "السعر كام مسترنا؟"

        payload = {
            "item_name": item_name,
            "price": price,
            "quantity": quantity,
            "customer_name": customer_name,
        }
        if self.tenant_id:
            payload["tenantId"] = self.tenant_id
        if paid_amount is not None and paid_amount >= 0:
            payload["paid_amount"] = paid_amount

        async with self._get_client() as client:
            r = await client.post(
                f"{API_BASE}/sales",
                json=payload,
                timeout=5,
            )
        total = price * quantity
        if r.status_code == 200:
            res_data = r.json()
            deferred = res_data.get("deferredAmount", 0)
            c_name = customer_name.strip() if customer_name else "نقدي"
            msg = f"تمام مسترنا، سجلت بيع {quantity} × {item_name} لـ {c_name} إجمالي {total} جنيه."
            if deferred > 0:
                msg += f" المتبقي آجل على العميل: {deferred} جنيه."
            await self._emit_success("✅ تم تأكيد عملية البيع", msg)
            return msg
        return "حصل خطأ في تسجيل البيع"

    @function_tool
    async def book_appointment(self, customer_name: str, date: str, time: str, service: str = "صيانة"):
        """يحجز ميعاد صيانة أو زيارة لعميل مع التحقق من التعارضات"""
        if not customer_name or customer_name.strip() == "":
            return "اسم العميل إيه أستاذنا؟"
        if not date or date.strip() == "":
            return "ميعاد اليوم كام يا فندم؟"
        if not time or time.strip() == "":
            return "الساعة كام مسترنا؟"

        async with self._get_client() as client:
            r = await client.post(
                f"{API_BASE}/appointments",
                json={"customer_name": customer_name, "date": date, "time": time, "notes": service, "tenantId": self.tenant_id},
                timeout=5,
            )
        if r.status_code == 409:
            data = r.json()
            existing_cust = data.get("existingCustomer", "عميل آخر")
            return f"عفواً مسترنا، الوقت ده فيه ميعاد محجوز بالفعل لـ {existing_cust}! تحب نختار وقت تاني؟"
        elif r.status_code == 200:
            await self._emit_success("✅ تم حجز الميعاد", f"تمام مستر {customer_name}، حجزتلك ميعاد الـ {service} يوم {date} الساعة {time}!")
            return f"تمام مستر {customer_name}، حجزتلك ميعاد {service} يوم {date} الساعة {time}!"
        return "حصل خطأ في حجز الميعاد"

    @function_tool
    async def get_financial_summary(self, period: str = "today"):
        """يجيب تقرير إجمالي المبيعات والمصاريف والأرباح للفترة (today/week/month)"""
        async with get_api_client() as client:
            r = await client.get(f"{API_BASE}/reports/summary?period={period}", timeout=5)
        if r.status_code == 200:
            data = r.json().get("summary", {})
            sales = data.get("totalSales", 0)
            expenses = data.get("totalExpenses", 0)
            purchases = data.get("totalPurchases", 0)
            profit = data.get("netProfit", 0)
            await self._emit_success("📊 تقرير الفينانشيال", f"مبيعات: {sales}ج | مصاريف: {expenses}ج | مشتريات: {purchases}ج | صافي الربح: {profit}ج")
            return f"إجمالي المبيعات {sales} جنيه، المصاريف {expenses} جنيه، والصافي ربح {profit} جنيه مسترنا."
        return "حصل خطأ في جلب التقرير المالي"

    @function_tool
    async def get_appointments_list(self, date: str = "", customer_name: str = ""):
        """يجيب قائمة المواعيد المحجوزة القادمة"""
        async with get_api_client() as client:
            params = {}
            if date: params["date"] = date
            if customer_name: params["name"] = customer_name
            r = await client.get(f"{API_BASE}/reports/appointments", params=params, timeout=5)
        if r.status_code == 200:
            appts = r.json().get("appointments", [])
            if not appts:
                return "مفيش أي مواعيد محجوزة للفترة دي مسترنا."
            details = [f"{a['customerName']} الساعة {a['time']} يوم {a['date']}" for a in appts[:3]]
            text = " | ".join(details)
            await self._emit_success("📅 المواعيد المحجوزة", text)
            return f"عندنا {len(appts)} مواعيد: {text}"
        return "حصل خطأ في استعلام المواعيد"

    @function_tool
    async def log_purchase(self, supplier_name: str, item_name: str, total_amount: float, paid_amount: float = 0, notes: str = ""):
        """يسجل بضاعة أو مشتريات جديدة من مورد وتحديد الآجل والمدفوع"""
        if not supplier_name or supplier_name.strip() == "":
            return "اسم المورد إيه أستاذنا؟"
        if not item_name or item_name.strip() == "":
            return "الصنف اللي اشتريناه إيه يا فندم؟"
        if not total_amount or total_amount <= 0:
            return "المبلغ الإجمالي كام مسترنا؟"

        async with self._get_client() as client:
            r = await client.post(
                f"{API_BASE}/purchases",
                json={
                    "supplier_name": supplier_name,
                    "item_name": item_name,
                    "total_amount": total_amount,
                    "paid_amount": paid_amount,
                    "notes": notes,
                    "tenantId": self.tenant_id,
                },
                timeout=5,
            )
        if r.status_code == 200:
            res_data = r.json()
            deferred = res_data.get("deferredAmount", 0)
            msg = f"سجلت مشتريات {item_name} من المورد {supplier_name} بإجمالي {total_amount}ج. "
            if deferred > 0:
                msg += f"المتبقي آجل للمورد: {deferred} جنيه."
            else:
                msg += "مدفوعة كاش بالكامل."
            await self._emit_success("📦 مشتريات موردين", msg)
            return msg
        return "حصل خطأ في تسجيل مشتريات المورد"

    @function_tool
    async def get_supplier_balances(self, supplier_name: str = ""):
        """يجيب مستحقات وديون الموردين والآجل"""
        async with httpx.AsyncClient() as client:
            params = {}
            if supplier_name: params["name"] = supplier_name
            r = await client.get(f"{API_BASE}/reports/suppliers", params=params, timeout=5)
        if r.status_code == 200:
            suppliers = r.json().get("suppliers", [])
            if not suppliers:
                return "مفيش أي ديون أو حسابات موردين مسجلة مسترنا."
            details = [f"{s['name']}: علي دين آجل {s['totalDebt']}ج" for s in suppliers[:3]]
            text = " | ".join(details)
            await self._emit_success("💳 حسابات الموردين والآجل", text)
            return f"ديون الموردين: {text}"
        return "حصل خطأ في استعلام حسابات الموردين"

    @function_tool
    async def update_appointment(self, customer_name: str, new_date: str = "", new_time: str = "", current_date: str = ""):
        """يعدل ميعاد حجز قائم لعميل محدد بدون تكرار الحجز"""
        if not customer_name or customer_name.strip() == "":
            return "اسم العميل إيه أستاذنا للتعديل؟"

        headers = {}
        api_key = os.getenv("INTERNAL_API_KEY")
        if api_key: headers["Authorization"] = f"Bearer {api_key}"

        async with get_api_client(headers) as client:
            r = await client.put(
                f"{API_BASE}/appointments",
                json={
                    "customer_name": customer_name,
                    "new_date": new_date,
                    "new_time": new_time,
                    "current_date": current_date,
                },
                headers=headers,
                timeout=5,
            )
        if r.status_code == 404:
            return r.json().get("error", "مفيش ميعاد مسجل بالاسم ده للتعديل.")
        elif r.status_code == 400 and r.json().get("ambiguous"):
            data = r.json()
            candidates = data.get("candidates", [])
            c_text = " | ".join([f"{c['date']} الساعة {c['time']}" for c in candidates[:3]])
            return f"عندنا كذا ميعاد لـ {customer_name}: ({c_text}). تقصد أنهي ميعاد فيهم أستاذنا؟"
        elif r.status_code == 200:
            res = r.json()
            updated = res.get("updated", {})
            msg = f"تمام مسترنا، عدلت ميعاد {customer_name} ليوم {updated.get('date')} الساعة {updated.get('time')}!"
            await self._emit_success("✏️ تم تعديل الميعاد", msg)
            return msg
        return "حصل خطأ في تعديل الميعاد"

    @function_tool
    async def cancel_appointment(self, customer_name: str, date: str = ""):
        """إلغاء أو حذف ميعاد حجز قائم لعميل (استخدمها عند سماع: الغي، امسح، شيل ميعاد)"""
        if not customer_name or customer_name.strip() == "":
            return "اسم العميل إيه أستاذنا لإلغاء الميعاد؟"

        headers = {}
        api_key = os.getenv("INTERNAL_API_KEY")
        if api_key: headers["Authorization"] = f"Bearer {api_key}"

        async with get_api_client(headers) as client:
            r = await client.request(
                "DELETE",
                f"{API_BASE}/appointments",
                json={"customer_name": customer_name, "date": date},
                headers=headers,
                timeout=5,
            )
        if r.status_code == 404:
            return r.json().get("error", "مفيش ميعاد مسجل بالاسم ده للإلغاء.")
        elif r.status_code == 200:
            res = r.json()
            msg = res.get("message", f"تمام أستاذنا، ألغيت ميعاد {customer_name} بنجاح.")
            await self._emit_success("🗑️ تم إلغاء الميعاد", msg)
            return msg
        return "حصل خطأ في إلغاء الميعاد"

    @function_tool
    async def update_expense(self, description: str, new_amount: float):
        """تعديل أو تغيير قيمة مصروف مسجل سابقاً (استخدمها فوراً عند سماع أفكار مثل: عدل المصروف، غير المصروف، خليه بدلاً من، سجلته غلط)."""
        if not description or description.strip() == "":
            return "المصروف المراد تعديله اسمه إيه يا فندم؟"
        if not new_amount or new_amount <= 0:
            return "المبلغ الجديد كام مسترنا؟"

        headers = {}
        api_key = os.getenv("INTERNAL_API_KEY")
        if api_key: headers["Authorization"] = f"Bearer {api_key}"

        async with get_api_client(headers) as client:
            r = await client.put(
                f"{API_BASE}/expenses",
                json={"description": description, "new_amount": new_amount},
                headers=headers,
                timeout=5,
            )
        if r.status_code == 404:
            return r.json().get("error", "مفيش مصروف مسجل بالوصف ده للتعديل.")
        elif r.status_code == 200:
            res = r.json()
            old_amt = res.get("oldAmount", 0)
            msg = f"تمام أستاذنا، آخر مصروف {description} كان مسجل بـ {old_amt} جنيه، وتعدل رسمياً لـ {new_amount} جنيه!"
            await self._emit_success("✏️ تم تعديل المصروف", msg)
            return msg
        return "حصل خطأ في تعديل المصروف"

    @function_tool
    async def pay_supplier_debt(self, supplier_name: str, payment_amount: float):
        """يسدد دفعة مالية من ديون مورد معين وتحديث الباقي الآجل دقيقاً"""
        if not supplier_name or supplier_name.strip() == "":
            return "اسم المورد إيه أستاذنا للتسديد؟"
        if not payment_amount or payment_amount <= 0:
            return "المبلغ المدفوع كام مسترنا؟"

        import uuid
        headers = {"idempotency-key": str(uuid.uuid4())}
        api_key = os.getenv("INTERNAL_API_KEY")
        if api_key: headers["Authorization"] = f"Bearer {api_key}"

        async with get_api_client(headers) as client:
            r = await client.put(
                f"{API_BASE}/purchases",
                json={"supplier_name": supplier_name, "payment_amount": payment_amount},
                headers=headers,
                timeout=5,
            )
        if r.status_code == 404:
            return r.json().get("error", "مفيش ديون مسجلة للمورد ده للتسديد.")
        elif r.status_code == 200:
            res = r.json()
            rem = res.get("remainingDebt", 0)
            msg = f"تمام مسترنا، سجلت سداد {payment_amount} جنيه للمورد {supplier_name}. المتبقي آجل عليه الآن: {rem} جنيه!"
            await self._emit_success("💳 تسديد مستحقات مورد", msg)
            return msg
        return "حصل خطأ في تسديد ديون المورد"




async def load_settings():
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{API_BASE}/settings", timeout=5)
        settings = r.json().get("settings", {})

    if settings.get("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = settings["OPENAI_API_KEY"]
    if settings.get("GEMINI_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = settings["GEMINI_API_KEY"]
    if settings.get("GROQ_API_KEY"):
        os.environ["GROQ_API_KEY"] = settings["GROQ_API_KEY"]

    return settings.get("VOICE_PROVIDER", "gemini")


def create_agent_session(provider: str, settings: dict) -> AgentSession:
    groq_key = settings.get("GROQ_API_KEY") or os.getenv("GROQ_API_KEY")
    openai_key = settings.get("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")
    gemini_key = settings.get("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

    voice_tone = settings.get("VOICE_TONE", "shakir")
    selected_voice = "ar-EG-ShakirNeural" if voice_tone == "shakir" else "ar-EG-SalmaNeural"
    fish_voice_id = settings.get("FISH_VOICE_ID")

    # Tuned Silero VAD parameters for natural Arabic speech without early cutoffs
    arabic_vad = silero.VAD.load(
        min_speech_duration=0.1,
        min_silence_duration=0.9,
        prefix_padding_duration=0.3,
    )

    # If no provider is explicitly set, default to gemini
    if not provider or provider.strip() == "":
        provider = "gemini"

    # If the chosen provider is missing its key, aggressively fallback to Gemini if available
    if provider != "gemini" and gemini_key:
        if (provider == "openai" and not openai_key) or (provider == "groq_pipeline" and not groq_key):
            print(f"[Voice Provider Fallback] {provider} API Key missing! Switched to Gemini Native Audio.")
            provider = "gemini"

    if provider == "groq_pipeline":
        if not groq_key:
            raise ValueError("مفتاح Groq API Key مفقود. يرجى إدخاله من صفحة الإعدادات أولاً.")

        from edge_tts_wrapper import EdgeTTS
        print(f"Using Groq Pipeline Architecture with Voice Tone: {voice_tone} ({selected_voice})")
        tts_engine = EdgeTTS(voice=selected_voice)

        return AgentSession(
            stt=groq.STT(
                api_key=groq_key,
                model="whisper-large-v3-turbo",
                language="ar",
                prompt="نظام كاسبر إدارة، مصاريف، بنزين، فواتير، مبيعات، صيانة، عميل، حسابات، تقارير، جنيه، سجل، اشتريت"
            ),
            llm=groq.LLM(api_key=groq_key, model="llama-3.3-70b-versatile"),
            tts=tts_engine,
            vad=arabic_vad,
        )
    elif provider == "deepgram_pipeline":
        deepgram_key = settings.get("DEEPGRAM_API_KEY") or os.getenv("DEEPGRAM_API_KEY")
        if not deepgram_key:
            raise ValueError("مفتاح Deepgram API Key مفقود. يرجى إدخاله من صفحة الإعدادات أولاً.")
        if not groq_key:
            raise ValueError("مفتاح Groq API Key مفقود (مطلوب للـ LLM). يرجى إدخاله من صفحة الإعدادات أولاً.")

        from livekit.plugins import deepgram
        from edge_tts_wrapper import EdgeTTS
        print(f"Using Deepgram Pipeline Architecture with Voice Tone: {voice_tone} ({selected_voice})")
        tts_engine = EdgeTTS(voice=selected_voice)

        return AgentSession(
            stt=deepgram.STT(api_key=deepgram_key, model="nova-2", language="ar"),
            llm=groq.LLM(api_key=groq_key, model="llama-3.3-70b-versatile"),
            tts=tts_engine,
            vad=arabic_vad,
        )
    elif provider == "fish_audio":
        fish_key = settings.get("FISH_API_KEY") or os.getenv("FISH_API_KEY")
        if not groq_key:
            raise ValueError("مفتاح Groq API Key مفقود (مطلوب للـ STT و LLM). يرجى إدخاله من صفحة الإعدادات أولاً.")

        from livekit.plugins import fishaudio
        print(f"Using Fish Audio Architecture (Reference Voice ID: {fish_voice_id or 'Default'})")
        tts_kwargs = {}
        if fish_key:
            tts_kwargs["api_key"] = fish_key
        if fish_voice_id:
            tts_kwargs["reference_id"] = fish_voice_id

        tts_engine = fishaudio.TTS(**tts_kwargs)

        return AgentSession(
            stt=groq.STT(api_key=groq_key, language="ar"),
            llm=groq.LLM(api_key=groq_key, model="llama-3.3-70b-versatile"),
            tts=tts_engine,
            vad=arabic_vad,
        )
    elif provider == "gemini":
        if not gemini_key:
            raise ValueError("مفتاح Gemini API Key مفقود. يرجى إدخاله من صفحة الإعدادات أولاً.")
        os.environ["GOOGLE_API_KEY"] = gemini_key

        try:
            from livekit.plugins.google.realtime import RealtimeModel
        except ImportError:
            from livekit.plugins.google.beta.realtime import RealtimeModel

        print("Using Google Gemini Native Audio Realtime Architecture (Gemini Live 🌟)")
        return AgentSession(
            llm=RealtimeModel(
                voice="Puck",
                instructions=EGYPTIAN_TELEPHONY_PROMPT,
            ),
        )
    else:
        if not openai_key:
            raise ValueError("مفتاح OpenAI API Key مفقود. يرجى إدخاله وحفظه في صفحة الإعدادات أولاً.")
        from edge_tts_wrapper import EdgeTTS
        return AgentSession(
            llm=openai.realtime.RealtimeModel(
                voice="alloy",
                instructions=EGYPTIAN_TELEPHONY_PROMPT,
                turn_detection=openai.realtime.ServerVadOptions(
                    silence_duration_ms=1200,
                    prefix_padding_ms=300
                )
            ),
            tts=EdgeTTS(voice=selected_voice)
        )





async def play_in_call_fallback_audio(ctx: JobContext, text: str):
    """
    In-call Telephony Audio Fallback Strategy using EdgeTTS.
    Synthesizes and streams spoken Arabic error messages directly into the WebRTC Audio Track
    without requiring any API Key (100% Key-Independent EdgeTTS Fallback).
    """
    print(f"[IN-CALL AUDIO FALLBACK] Synthesizing Key-Independent speech for telephony caller: '{text}'")
    try:
        from livekit import rtc
        import edge_tts, tempfile
        from livekit.agents.utils.audio import audio_frames_from_file

        source = rtc.AudioSource(24000, 1)
        track = rtc.LocalAudioTrack.create_audio_track("telephony_fallback_audio", source)
        options = rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
        await ctx.room.local_participant.publish_track(track, options)

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            tmp_path = f.name

        try:
            comm = edge_tts.Communicate(text, "ar-EG-SalmaNeural")
            await comm.save(tmp_path)
            async for frame in audio_frames_from_file(tmp_path, sample_rate=24000):
                await source.capture_frame(frame)
            print("[IN-CALL AUDIO FALLBACK] Telephony speech playback complete via EdgeTTS.")
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
    except Exception as fallback_err:
        print(f"[IN-CALL AUDIO FALLBACK ERROR] Could not stream fallback audio: {fallback_err}")


async def resolve_tenant_from_sip_participant(ctx: JobContext, client: httpx.AsyncClient) -> str | None:
    """
    SIP Telephony Tenant Resolution.
    Reads LiveKit SIP participant attributes (e.g. sip.phoneNumber / sip.trunkPhoneNumber)
    and queries /api/tenants/by-phone to map the inbound phone call to its real tenantId.
    """
    phone_number = None
    try:
        if hasattr(ctx.room, "remote_participants"):
            for participant in ctx.room.remote_participants.values():
                attributes = getattr(participant, "attributes", {}) or {}
                phone_number = attributes.get("sip.phoneNumber") or attributes.get("sip.trunkPhoneNumber") or attributes.get("phoneNumber")
                if phone_number:
                    break
    except Exception as e:
        print(f"[SIP Tenant Resolution] Error reading participant attributes: {e}")

    if not phone_number:
        return None

    try:
        r = await client.get(f"{API_BASE}/tenants/by-phone", params={"number": phone_number}, timeout=4)
        if r.status_code == 200:
            data = r.json()
            if data.get("success") and data.get("tenantId"):
                print(f"[SIP Tenant Resolution] Mapped phone {phone_number} -> tenantId {data['tenantId']} ({data.get('name')})")
                return data["tenantId"]
        print(f"[SIP Tenant Resolution] Unmapped phone number: {phone_number}")
    except Exception as err:
        print(f"[SIP Tenant Resolution] API query failed for {phone_number}: {err}")

    return None


async def entrypoint(ctx: JobContext):
    async with get_api_client() as client:
        r = await client.get(f"{API_BASE}/settings", timeout=5)
        settings = r.json().get("settings", {})

        if settings.get("OPENAI_API_KEY"):
            os.environ["OPENAI_API_KEY"] = settings["OPENAI_API_KEY"]
        if settings.get("GEMINI_API_KEY"):
            os.environ["GOOGLE_API_KEY"] = settings["GEMINI_API_KEY"]
        if settings.get("GROQ_API_KEY"):
            os.environ["GROQ_API_KEY"] = settings["GROQ_API_KEY"]

        provider = settings.get("VOICE_PROVIDER", "gemini")
        await ctx.connect()

        tenant_id = get_tenant_id_from_room(ctx)
        if not tenant_id:
            tenant_id = await resolve_tenant_from_sip_participant(ctx, client)

        diag = DiagnosticsSession(session_id=ctx.room.name, tenant_id=tenant_id, channel="voice_call")

    try:
        session = create_agent_session(provider, settings)

        async def emit_datachannel_event(payload_data: dict):
            try:
                import json as _json
                payload_bytes = _json.dumps(payload_data, ensure_ascii=False).encode("utf-8")
                await ctx.room.local_participant.publish_data(payload_bytes, reliable=True, topic="casper-voice-events")
            except Exception as err:
                print(f"[DataChannel Emitter Warning] {err}")

        import time as _time
        last_user_speech_time = [_time.monotonic()]

        @session.on("user_input_transcribed")
        def on_user_input_transcribed(ev):
            try:
                text = getattr(ev, "transcript", None) or str(ev)
                is_final = getattr(ev, "is_final", True)
                conf = getattr(ev, "confidence", None) or getattr(ev, "score", None)
                if conf is not None:
                    try:
                        diag.set_stt_confidence(float(conf))
                    except (TypeError, ValueError):
                        pass

                if text and is_final:
                    last_user_speech_time[0] = _time.monotonic()
                    import asyncio
                    asyncio.ensure_future(emit_datachannel_event({"type": "TRANSCRIPT", "role": "user", "text": text}))
            except Exception as e:
                print(f"[user_input_transcribed] {e}")

        @session.on("user_speech_interrupted")
        def on_user_speech_interrupted(ev):
            try:
                diag.record_vad_cutoff()
            except Exception as e:
                print(f"[user_speech_interrupted] {e}")

        @session.on("agent_speech_interrupted")
        def on_agent_speech_interrupted(ev):
            try:
                diag.record_vad_cutoff()
            except Exception as e:
                print(f"[agent_speech_interrupted] {e}")

        @session.on("agent_state_changed")
        def on_agent_state_changed(ev):
            try:
                new_state = getattr(ev, "new_state", None) or getattr(ev, "state", None) or ev
                state_name = str(new_state).upper().split(".")[-1]

                detail_map = {
                    "LISTENING": "🎙️ في انتظار حديثك...",
                    "THINKING": "🧠 جاري معالجة طلبك...",
                    "SPEAKING": "🔊 المساعد يتحدث الآن...",
                }
                detail = detail_map.get(state_name, state_name)
                import asyncio
                asyncio.ensure_future(emit_datachannel_event({"type": "EVENT_TICKER", "state": state_name, "detail": detail}))

                if state_name == "SPEAKING":
                    elapsed = int((_time.monotonic() - last_user_speech_time[0]) * 1000)
                    diag.record_latency("llm", elapsed)
                    try:
                        cs = getattr(session, "current_speech", None)
                        if cs:
                            text = getattr(cs, "text", None) or getattr(cs, "transcript", None)
                            if text:
                                asyncio.ensure_future(emit_datachannel_event({"type": "TRANSCRIPT", "role": "assistant", "text": text}))
                    except Exception as speech_err:
                        print(f"[SPEAKING text capture] {speech_err}")
            except Exception as e:
                print(f"[agent_state_changed] {e}")

        @session.on("error")
        def on_session_error(ev):
            err_msg = str(ev)
            print("SESSION ERROR DETECTED:", err_msg)
            if "insufficient_quota" in err_msg or "429" in err_msg:
                import asyncio
                asyncio.ensure_future(emit_datachannel_event({
                    "type": "error",
                    "message": "انتهت باقة نطق الصوت (OpenAI TTS Quota Exceeded). يرجى شحن الحساب أو اختار Gemini Realtime من الإعدادات."
                }))

        await session.start(agent=CasperAgent(room=ctx.room, tenant_id=tenant_id), room=ctx.room)
        if getattr(session, "tts", None) is not None:
            try:
                await session.say("أهلاً بحضرتك! معاك المساعد الذكي لسيستم كاسبر، أقدر أساعدك إزاي النهاردة؟", allow_interruptions=True)
            except Exception as say_err:
                print(f"[session.say warning] {say_err}")
        else:
            # Trigger for Multimodal models (like Gemini) that don't have separate TTS
            try:
                if hasattr(session, "generate_reply"):
                    await session.generate_reply(
                        instructions="قول 'أهلاً بحضرتك! معاك المساعد الذكي لسيستم كاسبر، أقدر أساعدك إزاي النهاردة؟'"
                    )
            except Exception as e:
                print(f"[Multimodal Trigger Error] {e}")
    except Exception as e:
        err_str = str(e)
        print("CRITICAL AGENT ERROR:", err_str)
        user_msg = f"حدث خطأ في خادم الصوت: {err_str}"
        if "GROQ_API_KEY is required" in err_str or "مفقود" in err_str or "GEMINI_API_KEY" in err_str:
            user_msg = "يرجى إدخال مفتاح الذكاء الاصطناعي (Gemini / Groq) وحفظه في صفحة الإعدادات أولاً."
        elif "insufficient_quota" in err_str:
            user_msg = f"انتهت باقة أو رصيد الذكاء الاصطناعي الخاص بـ ({provider.upper()})"
        elif "1008" in err_str or "not found" in err_str:
            user_msg = f"الموديل غير متاح أو اسم الموديل غير صحيح لـ ({provider.upper()})"
        elif "invalid" in err_str.lower():
            user_msg = f"مفتاح الـ API غير صحيح لـ ({provider.upper()})"

        print(f"[AUDIO FALLBACK NOTIFICATION EMITTED] Broadcasted to user: '{user_msg}'")
        try:
            import json
            await ctx.room.local_participant.publish_data(
                json.dumps({
                    "type": "error",
                    "message": user_msg,
                    "speak_error": True,
                    "action": "TRANSFER_TO_HUMAN_OR_NOTIFY"
                }).encode("utf-8"),
                reliable=True
            )
        except Exception as pub_err:
            print(f"[DataChannel Error Output Failed] {pub_err}")

        # Stream spoken audio directly into telephony WebRTC audio track for phone callers
        try:
            await play_in_call_fallback_audio(ctx, user_msg)
        except Exception as audio_err:
            print(f"[In-Call Audio Stream Failed] {audio_err}")
        raise e


    async def on_close():
        transcript = ""
        try:
            history_obj = getattr(session, "history", None)
            if history_obj is not None:
                messages = getattr(history_obj, "messages", [])
                if callable(messages):
                    messages = messages()
                if isinstance(messages, (list, tuple)):
                    for m in messages:
                        role = getattr(m, "role", "unknown")
                        content = getattr(m, "content", str(m))
                        transcript += f"{role}: {content}\n"
        except Exception as e:
            print("Error parsing transcript:", e)
        diag.set_transcript(raw=transcript)
        import asyncio
        asyncio.ensure_future(diag.flush())
        asyncio.ensure_future(log_conversation(transcript, summary=f"provider: {provider}"))

    ctx.add_shutdown_callback(on_close)



if __name__ == "__main__":
    try:
        from preflight_check import run_preflight
        run_preflight()
    except Exception as pf_err:
        print(f"[Preflight Warning] {pf_err}")
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))

