# voice_service/tools.py
# نضيفها لملف الـ agent الموجود عندك، بدون ما نغيّر المعمارية (LiveKit + Deepgram + GPT-4o-mini)

from livekit.agents import llm
import httpx
import os

API_BASE = os.getenv("DASHBOARD_API_URL", "http://localhost:3001/api")


class CasperVoiceTools(llm.FunctionContext):

    @llm.ai_callable(description="يسجل مصروف جديد لما العميل يقول اشترى حاجة أو دفع فلوس")
    async def log_expense(
        self,
        amount: float,
        description: str,
        category: str = "عام",
    ):
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{API_BASE}/expenses",
                json={"amount": amount, "description": description, "category": category},
                timeout=5,
            )
        return "تم تسجيل المصروف" if r.status_code == 200 else "حصل خطأ في تسجيل المصروف"

    @llm.ai_callable(description="يسجل عملية بيع لما العميل يقول باع منتج أو قطعة غيار")
    async def log_sale(
        self,
        item_name: str,
        price: float,
        quantity: int = 1,
    ):
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{API_BASE}/sales",
                json={"item_name": item_name, "price": price, "quantity": quantity},
                timeout=5,
            )
        return "تم تسجيل عملية البيع" if r.status_code == 200 else "حصل خطأ في تسجيل البيع"

    @llm.ai_callable(description="يحجز موعد صيانة أو زيارة عميل في تاريخ ووقت معين")
    async def book_appointment(
        self,
        customer_name: str,
        date: str,   # مثال: "2026-08-01"
        time: str,   # مثال: "14:00"
        notes: str = "",
    ):
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{API_BASE}/appointments",
                json={"customer_name": customer_name, "date": date, "time": time, "notes": notes},
                timeout=5,
            )
        return "تم حجز الموعد" if r.status_code == 200 else "حصل خطأ في الحجز"


# --- في ملف الـ agent الرئيسي بتاعك، غيّر سطر إنشاء الـ VoicePipelineAgent كده: ---
#
# from tools import CasperVoiceTools
#
# agent = VoicePipelineAgent(
#     vad=silero.VAD.load(),
#     stt=deepgram.STT(model="nova-2-general", language="ar"),
#     llm=openai.LLM(model="gpt-4o-mini"),
#     tts=openai.TTS(voice="alloy"),
#     chat_ctx=initial_ctx,          # فيه EGYPTIAN_TELEPHONY_PROMPT بتاعك
#     fnc_ctx=CasperVoiceTools(),    # <-- السطر الجديد الوحيد المطلوب
# )
