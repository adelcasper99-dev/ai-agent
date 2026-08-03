# STT Multi-Provider Enhancement — Walkthrough

## Summary of Completed Work

We have implemented a multi-provider STT architecture in Casper Voice Agent, adding **Soniox** as a primary high-accuracy STT provider for Arabic/English code-switching alongside existing Deepgram failover, plus audio preprocessing, STT diagnostic telemetry, and confidence fallback.

---

## 🛠️ Changes Made

### 1. Soniox STT Integration & Automatic Failover
- **File**: [`voice_service/agent.py`](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/voice_service/agent.py#L525-L549)
- Added `soniox_pipeline` branch using `soniox.STT` with model `soniox-phone-multilingual` and Arabic/English language hints.
- Added `create_agent_session_with_failover()` function that attempts the primary STT (`soniox_pipeline`) and seamlessly falls back to `STT_FALLBACK_PROVIDER` (`deepgram_pipeline`) if key missing or session creation fails.
> [!WARNING]
> **Failover Initialization Limitation:** The failover mechanism currently only traps session creation/initialization errors. It does not handle mid-call (runtime) WebSocket disconnects or timeouts.
- **File**: [`voice_service/requirements.txt`](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/voice_service/requirements.txt)
- Added `livekit-plugins-soniox>=0.9`.

### 2. Audio Preprocessing via ffmpeg
- **File**: [`voice_service/agent.py`](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/voice_service/agent.py#L438-L457)
- Added `preprocess_audio_with_ffmpeg()` async helper executing `-af "highpass=f=100,loudnorm" -ar 16000` to sanitize low-frequency noise and normalize volume for file-based voice notes (WhatsApp/Telegram).

### 3. A/B Telemetry & Diagnostics
- **File**: [`voice_service/agent.py`](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/voice_service/agent.py#L745-L753)
- Emits `STT_DIAGNOSTIC` data channel events containing `provider`, `confidence`, and `transcript`.
- **File**: [`voice_service/diagnostics.py`](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/voice_service/diagnostics.py#L62-L65)
- Extended `DiagnosticsSession` with `stt_provider` attribute and flushed to diagnostic backend.

### 4. Confidence-Based Clarification Fallback
- **File**: [`voice_service/agent.py`](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/voice_service/agent.py#L756-L766)
- Automatically intercepts transcripts where `confidence < STT_CONFIDENCE_THRESHOLD` (default 0.6) and prompts: `"لم أسمع بوضوح، ممكن تكرر أو تكتب؟"`.

---

## 🧪 Verification Results

- **PyPI Dependency Verification**: `livekit-plugins-soniox` v1.6.7 confirmed.
- **Compilation**: `python -m py_compile voice_service/agent.py voice_service/diagnostics.py` passed with zero errors.
- **Module Import**: `diagnostics` module import verified.
- **Test Artifact**: Recorded in [`test_results.txt`](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/test_results.txt).
