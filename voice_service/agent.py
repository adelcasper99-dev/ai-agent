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

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import openai, google, groq, silero

load_dotenv()

API_BASE = os.getenv("DASHBOARD_API_URL", "http://localhost:3000/api")

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
    def __init__(self, room=None):
        super().__init__(instructions=EGYPTIAN_TELEPHONY_PROMPT)
        self.room = room

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

        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{API_BASE}/expenses",
                json={"amount": amount, "description": description, "category": category},
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
        if paid_amount is not None and paid_amount >= 0:
            payload["paid_amount"] = paid_amount

        async with httpx.AsyncClient() as client:
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

        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{API_BASE}/appointments",
                json={"customer_name": customer_name, "date": date, "time": time, "notes": service},
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
        async with httpx.AsyncClient() as client:
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
        async with httpx.AsyncClient() as client:
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

        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{API_BASE}/purchases",
                json={
                    "supplier_name": supplier_name,
                    "item_name": item_name,
                    "total_amount": total_amount,
                    "paid_amount": paid_amount,
                    "notes": notes,
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

        async with httpx.AsyncClient() as client:
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

        async with httpx.AsyncClient() as client:
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

        async with httpx.AsyncClient() as client:
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

        async with httpx.AsyncClient() as client:
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

    return settings.get("VOICE_PROVIDER", "openai")


def create_agent_session(provider: str, settings: dict) -> AgentSession:
    groq_key = settings.get("GROQ_API_KEY") or os.getenv("GROQ_API_KEY")
    openai_key = settings.get("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY")

    voice_tone = settings.get("VOICE_TONE", "shakir")
    selected_voice = "ar-EG-ShakirNeural" if voice_tone == "shakir" else "ar-EG-SalmaNeural"
    fish_voice_id = settings.get("FISH_VOICE_ID")

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
            vad=silero.VAD.load(
                min_speech_duration=0.15,
                min_silence_duration=0.5,
                prefix_padding_duration=0.2,
            ),
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
            vad=silero.VAD.load(
                min_speech_duration=0.15,
                min_silence_duration=0.5,
                prefix_padding_duration=0.2,
            ),
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
            vad=silero.VAD.load(
                min_speech_duration=0.15,
                min_silence_duration=0.5,
                prefix_padding_duration=0.2,
            ),
        )
    elif provider == "gemini":
        gemini_key = settings.get("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not gemini_key:
            raise ValueError("مفتاح Gemini API Key مفقود. يرجى إدخاله من صفحة الإعدادات أولاً.")
        os.environ["GOOGLE_API_KEY"] = gemini_key

        from edge_tts_wrapper import EdgeTTS
        print("Using Google Gemini Native Audio Realtime Architecture (Gemini Live 🌟)")
        return AgentSession(
            llm=google.beta.realtime.RealtimeModel(
                voice="Puck",
                modalities=["AUDIO"],
                instructions=EGYPTIAN_TELEPHONY_PROMPT,
            ),
        )
    else:
        from edge_tts_wrapper import EdgeTTS
        return AgentSession(
            llm=openai.realtime.RealtimeModel(
                voice="alloy",
                instructions=EGYPTIAN_TELEPHONY_PROMPT,
            ),
            tts=EdgeTTS(voice=selected_voice)
        )


async def log_conversation(transcript: str, summary: str = ""):
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{API_BASE}/conversations",
            json={"channel": "voice", "transcript": transcript, "summary": summary},
            timeout=5,
        )


async def entrypoint(ctx: JobContext):
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{API_BASE}/settings", timeout=5)
        settings = r.json().get("settings", {})

    if settings.get("OPENAI_API_KEY"):
        os.environ["OPENAI_API_KEY"] = settings["OPENAI_API_KEY"]
    if settings.get("GEMINI_API_KEY"):
        os.environ["GOOGLE_API_KEY"] = settings["GEMINI_API_KEY"]
    if settings.get("GROQ_API_KEY"):
        os.environ["GROQ_API_KEY"] = settings["GROQ_API_KEY"]

    provider = settings.get("VOICE_PROVIDER", "openai")
    await ctx.connect()

    try:
        session = create_agent_session(provider, settings)

        async def emit_datachannel_event(payload_data: dict):
            try:
                import json as _json
                payload_bytes = _json.dumps(payload_data, ensure_ascii=False).encode("utf-8")
                await ctx.room.local_participant.publish_data(payload_bytes, reliable=True, topic="casper-voice-events")
            except Exception as err:
                print(f"[DataChannel Emitter Warning] {err}")

        @session.on("user_input_transcribed")
        def on_user_input_transcribed(ev):
            try:
                text = getattr(ev, "transcript", None) or str(ev)
                is_final = getattr(ev, "is_final", True)
                if text and is_final:
                    import asyncio
                    asyncio.ensure_future(emit_datachannel_event({"type": "TRANSCRIPT", "role": "user", "text": text}))
            except Exception as e:
                print(f"[user_input_transcribed] {e}")

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

        await session.start(agent=CasperAgent(room=ctx.room), room=ctx.room)
        if getattr(session, "tts", None) is not None:
            try:
                await session.say("أهلاً بحضرتك! معاك المساعد الذكي لسيستم كاسبر، أقدر أساعدك إزاي النهاردة؟", allow_interruptions=True)
            except Exception as say_err:
                print(f"[session.say warning] {say_err}")
    except Exception as e:
        err_str = str(e)
        print("CRITICAL AGENT ERROR:", err_str)
        user_msg = f"حدث خطأ في خادم الصوت: {err_str}"
        if "GROQ_API_KEY is required" in err_str or "مفقود" in err_str:
            user_msg = "يرجى إدخال مفتاح Groq API Key وحفظه في صفحة الإعدادات أولاً."
        elif "insufficient_quota" in err_str:
            user_msg = f"انتهت باقة أو رصيد الذكاء الاصطناعي الخاص بـ ({provider.upper()})"
        elif "1008" in err_str or "not found" in err_str:
            user_msg = f"الموديل غير متاح أو اسم الموديل غير صحيح لـ ({provider.upper()})"
        elif "invalid" in err_str.lower():
            user_msg = f"مفتاح الـ API غير صحيح لـ ({provider.upper()})"

        try:
            import json
            await ctx.room.local_participant.publish_data(
                json.dumps({"type": "error", "message": user_msg}).encode("utf-8"),
                reliable=True
            )
        except Exception:
            pass
        raise e

    async def on_close():
        transcript = ""
        try:
            if hasattr(session, "history"):
                for m in getattr(session.history, "messages", []):
                    transcript += f"{m.role}: {m.content}\n"
        except Exception as e:
            print("Error parsing transcript:", e)
        await log_conversation(transcript, summary=f"provider: {provider}")

    ctx.add_shutdown_callback(on_close)



if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
