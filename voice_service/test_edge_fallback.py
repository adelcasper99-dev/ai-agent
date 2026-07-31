import asyncio
import os
import sys
import tempfile
import edge_tts
from livekit import rtc
from livekit.agents.utils.audio import audio_frames_from_file

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

async def test_fallback():
    print("Testing EdgeTTS -> LiveKit AudioSource pipeline...")
    text = "يرجى إدخال مفتاح الذكاء الاصطناعي في صفحة الإعدادات أولاً."
    source = rtc.AudioSource(24000, 1)

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        path = f.name

    try:
        comm = edge_tts.Communicate(text, "ar-EG-SalmaNeural")
        await comm.save(path)
        count = 0
        async for frame in audio_frames_from_file(path, sample_rate=24000):
            await source.capture_frame(frame)
            count += 1
        print(f"Successfully captured {count} PCM audio frames into AudioSource!")
    finally:
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass

if __name__ == "__main__":
    asyncio.run(test_fallback())
