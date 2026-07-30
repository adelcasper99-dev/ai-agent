import sys
import os
import json
import asyncio
import edge_tts

# Force UTF-8 encoding on standard streams for Windows
if sys.platform == 'win32':
    sys.stdin.reconfigure(encoding='utf-8')
    sys.stdout.reconfigure(encoding='utf-8')

async def main():
    try:
        raw_input = sys.stdin.read()
        payload = json.loads(raw_input)
        text = payload.get("text", "اختبار")
        voice = payload.get("voice", "ar-EG-SalmaNeural")
        if voice not in ["ar-EG-SalmaNeural", "ar-EG-ShakirNeural"]:
            voice = "ar-EG-SalmaNeural"
        out_path = payload.get("out_path", "demo.mp3")
        provider = payload.get("provider", "")
        gemini_key = payload.get("gemini_key", "") or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        fish_key = payload.get("fish_key", "")
        fish_voice_id = payload.get("fish_voice_id", "")

        from egyptian_number_normalizer import normalize_egyptian_numbers
        normalized_text = normalize_egyptian_numbers(text)
        formatted_text = normalized_text.strip().replace("\n", " ").replace(".", "...").replace("!", "...").replace("،", ",")

        # 1. Try Gemini Realtime TTS if gemini_key or gemini provider is active
        if gemini_key or provider == "gemini":
            try:
                from google import genai
                from google.genai import types

                client = genai.Client(api_key=gemini_key)
                prompt = f"اقرأ النص التالي بنبرة صوت بشرية دافئة وطبيعية جداً بالعامية المصرية:\n{formatted_text}"
                resp = client.models.generate_content(
                    model="gemini-2.5-flash-preview-tts",
                    contents=prompt,
                    config=types.GenerateContentConfig(response_modalities=["AUDIO"])
                )
                if resp and resp.candidates and resp.candidates[0].content and resp.candidates[0].content.parts:
                    for part in resp.candidates[0].content.parts:
                        if hasattr(part, "inline_data") and part.inline_data and part.inline_data.data:
                            with open(out_path, "wb") as f:
                                f.write(part.inline_data.data)
                            return
            except Exception as ge:
                print(f"Gemini TTS demo error, falling back: {ge}", file=sys.stderr)

        # 2. Try Fish Audio synthesis if fish_key or fish_audio provider is active
        if fish_key or provider == "fish_audio":
            try:
                import urllib.request
                import urllib.error

                tts_url = "https://api.fish.audio/v1/tts"
                headers = {
                    "Authorization": f"Bearer {fish_key}",
                    "Content-Type": "application/json"
                }
                body_data = {
                    "text": formatted_text,
                    "format": "mp3"
                }
                if fish_voice_id:
                    body_data["reference_id"] = fish_voice_id

                json_bytes = json.dumps(body_data).encode("utf-8")
                req = urllib.request.Request(tts_url, data=json_bytes, headers=headers, method="POST")

                with urllib.request.urlopen(req) as resp:
                    if resp.status == 200:
                        audio_data = resp.read()
                        with open(out_path, "wb") as f:
                            f.write(audio_data)
                        return
            except Exception as fe:
                print(f"Fish Audio demo error, falling back to EdgeTTS: {fe}", file=sys.stderr)

        # Fallback to EdgeTTS with prosody formatting and plain text fallback
        try:
            communicate = edge_tts.Communicate(formatted_text, voice, rate="-7%", pitch="+1Hz")
            await communicate.save(out_path)
        except Exception:
            clean_text = text.strip().replace(".", "...").replace("!", "...")
            communicate = edge_tts.Communicate(clean_text, voice)
            await communicate.save(out_path)
    except Exception as e:
        print(f"Error in gen_demo.py: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
