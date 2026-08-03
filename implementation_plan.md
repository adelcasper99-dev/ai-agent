# STT Multi-Provider Enhancement — Implementation Plan
## Soniox + Deepgram Failover, Audio Preprocessing, VAD Assessment, Post-Correction

---

## Context

**Target:** `voice_service/agent.py` — specifically `create_agent_session()` (line 437) and the `entrypoint()` function (line 629).

**Existing STT providers already in `create_agent_session()`:**
| Provider Key | STT Engine | LLM | TTS |
|---|---|---|---|
| `groq_pipeline` | Groq Whisper large-v3-turbo | Groq Llama | EdgeTTS |
| `deepgram_pipeline` | **Deepgram nova-2** | Groq Llama | EdgeTTS |
| `fish_audio` | Groq Whisper | Groq Llama | FishAudio |
| `gemini` | Gemini Native Realtime | Gemini | Built-in |
| (default) | — | OpenAI Realtime | — |

**Silero VAD already tuned** at line 447–451:
```python
arabic_vad = silero.VAD.load(
    min_speech_duration=0.1,
    min_silence_duration=0.9,   # already at 900ms — good for Arabic
    prefix_padding_duration=0.3,
)
```
> VAD is already tuned. The spec's recommendation (500-700ms) is LESS aggressive than what's already in place (900ms). **No VAD change needed.**

---

## Rollout Order (from spec §8)

| Phase | What | Files |
|---|---|---|
| **Phase 1** | Soniox provider + failover logic | `agent.py`, `.env`, `requirements.txt` |
| **Phase 2** | Audio preprocessing via `ffmpeg` | `agent.py` (new `preprocess_audio()` helper for voice notes) |
| **Phase 3** | A/B logging (`sttProvider` + `confidence`) | `agent.py` (`on_user_input_transcribed`) |
| **Phase 4** | Post-STT LLM correction pass | Async text/voice-note channel handlers (Next.js) |
| **Phase 5** | Confidence-based clarification fallback | `agent.py` (in `on_user_input_transcribed`) |

---

## Proposed Changes

### Phase 1 — Soniox Provider + Failover

#### [MODIFY] [agent.py](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/voice_service/agent.py)

**Add new `soniox_pipeline` branch** inside `create_agent_session()` after line 500 (after `deepgram_pipeline`).

```python
elif provider == "soniox_pipeline":
    soniox_key = settings.get("SONIOX_API_KEY") or os.getenv("SONIOX_API_KEY")
    fallback_provider = settings.get("STT_FALLBACK_PROVIDER", "deepgram_pipeline")
    if not soniox_key:
        print("[STT Failover] Soniox key missing, falling back to deepgram_pipeline")
        return create_agent_session("deepgram_pipeline", settings)
    if not groq_key:
        raise ValueError("مفتاح Groq API Key مفقود (مطلوب للـ LLM). يرجى إدخاله من صفحة الإعدادات أولاً.")
    
    from livekit.plugins import soniox, groq
    from edge_tts_wrapper import EdgeTTS
    print(f"Using Soniox STT Pipeline (primary) with Voice Tone: {voice_tone} ({selected_voice})")
    tts_engine = EdgeTTS(voice=selected_voice)
    
    return AgentSession(
        stt=soniox.STT(
            api_key=soniox_key,
            model="soniox-phone-multilingual",  # supports Arabic/English code-switching
            language_hints=["ar", "en"],
        ),
        llm=groq.LLM(api_key=groq_key, model="llama-3.3-70b-versatile"),
        tts=tts_engine,
        vad=arabic_vad,
    )
```

**Failover wrapper** — Add `create_agent_session_with_failover()`:
```python
async def create_agent_session_with_failover(provider: str, settings: dict) -> AgentSession:
    """
    Note: This MVP failover catches session creation failures (e.g. invalid API key,
    service unavailable at startup). It does NOT catch runtime streaming blips mid-call.
    """
    primary = settings.get("STT_PROVIDER", provider)
    fallback = settings.get("STT_FALLBACK_PROVIDER", "deepgram_pipeline")
    try:
        session = create_agent_session(primary, settings)
        print(f"[STT Pool] Primary provider active: {primary}")
        return session
    except Exception as e:
        print(f"[STT Failover] Primary {primary} failed: {e}. Falling back to {fallback}")
        return create_agent_session(fallback, settings)
```

**`.env` additions:**
```
SONIOX_API_KEY=<your-soniox-key>
STT_PROVIDER=soniox_pipeline
STT_FALLBACK_PROVIDER=deepgram_pipeline
```

#### [MODIFY] [requirements.txt](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/voice_service/requirements.txt)
```
livekit-plugins-soniox>=0.9
```

---

### Phase 2 — ffmpeg Audio Preprocessing

#### [MODIFY] [agent.py](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/voice_service/agent.py)

Add standalone async helper (above `create_agent_session`):

```python
async def preprocess_audio_with_ffmpeg(input_path: str, output_path: str) -> bool:
    """
    Applies highpass filter + loudnorm + 16kHz resampling.
    Returns True on success, False on failure (caller can use raw audio).
    """
    import asyncio
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", input_path,
            "-af", "highpass=f=100,loudnorm",
            "-ar", "16000",
            output_path,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(proc.wait(), timeout=10.0)
        return proc.returncode == 0
    except Exception as e:
        print(f"[ffmpeg Preprocess] Failed: {e}")
        return False
```

---

### Phase 3 — A/B Logging

#### [MODIFY] [agent.py](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/voice_service/agent.py)

Extend `on_user_input_transcribed` (line 664) to log `sttProvider`:

```python
@session.on("user_input_transcribed")
def on_user_input_transcribed(ev):
    ...
    # Add after confidence capture:
    asyncio.ensure_future(emit_datachannel_event({
        "type": "STT_DIAGNOSTIC",
        "provider": provider,  # captured from outer scope
        "confidence": conf,
        "transcript": text,
    }))
```

---

### Phase 4 — Post-STT LLM Correction Pass

> [!WARNING]
> **CRITICAL LATENCY SAFEGUARD:** To avoid reverting latency improvements, this correction pass MUST ONLY be implemented in the Next.js API for async text/voice-note channels (WhatsApp/Telegram). **It will NOT be added to `agent.py` for live WebRTC calls.**

```python
async def correct_transcript_with_llm(raw: str, gemini_key: str) -> str:
    """Cheap Gemini correction pass on raw STT output (Async Text/Voice-Notes ONLY)."""
    try:
        import google.generativeai as genai
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-2.5-flash-lite")
        prompt = f"صحح الأخطاء الإملائية والكتابية في النص ده من غير ما تغير المعنى أو تضيف حاجة: {raw}"
        resp = await asyncio.to_thread(model.generate_content, prompt)
        corrected = resp.text.strip()
        print(f"[STT Correction] '{raw}' -> '{corrected}'")
        return corrected
    except Exception as e:
        print(f"[STT Correction] Failed, using raw: {e}")
        return raw
```

---

### Phase 5 — Confidence-Based Clarification

#### [MODIFY] [agent.py](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/voice_service/agent.py)

```python
STT_CONFIDENCE_THRESHOLD = float(os.getenv("STT_CONFIDENCE_THRESHOLD", "0.6"))

if conf is not None and float(conf) < STT_CONFIDENCE_THRESHOLD:
    asyncio.ensure_future(session.say(
        "لم أسمع بوضوح، ممكن تكرر أو تكتب؟",
        allow_interruptions=True
    ))
    return
```

---

## Verification Plan

### Automated
- `python -m pytest voice_service/tests/` (if test suite exists)
- Dependency check: `pip index versions livekit-plugins-soniox` (Verified: v1.6.7 available)

### Manual
1. Set `STT_PROVIDER=soniox_pipeline` → verify Soniox serves the call.
2. Remove `SONIOX_API_KEY` → verify auto-fallback to `deepgram_pipeline` in logs.
3. Speak in quiet voice → verify `loudnorm` preprocessing improves transcript (for voice note path).
4. Speak low-confidence mumble → verify agent replies "لم أسمع بوضوح" instead of guessing.
5. Run 1 week A/B: compare `STT_DIAGNOSTIC` events by provider in dashboard.
