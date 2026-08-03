# Research Findings — STT Multi-Provider & Audio Quality Enhancement

## 1. LiveKit Soniox STT Plugin (`livekit-plugins-soniox`)
- **Package Status**: Verified available on PyPI (latest version `1.6.7`).
- **Class Usage**: `from livekit.plugins import soniox` -> `soniox.STT(api_key=..., model="soniox-phone-multilingual", language_hints=["ar", "en"])`.
- **Code-Switching**: `soniox-phone-multilingual` natively handles mixed Egyptian Arabic and English terminology (POS, ERP, invoice, client names).

## 2. Dynamic Failover Strategy in LiveKit Agents
- **Session-Level Resilience**: Wrapping `create_agent_session()` in a failover mechanism allows automatic fallback to `deepgram_pipeline` if Soniox API key is missing or initialization fails.
- **Provider Identification**: Active STT provider name is passed into event emitters and captured in `DiagnosticsSession` to facilitate A/B evaluation.

## 3. Audio Preprocessing via ffmpeg
- **Filter Chain**: `-af "highpass=f=100,loudnorm" -ar 16000`
  - `highpass=f=100`: Removes low-frequency background hum (air conditioners, traffic).
  - `loudnorm`: Standardizes audio volume across heterogeneous mobile recordings.
  - `-ar 16000`: Matches native sample rate expected by Soniox & Deepgram.
- **Scope Limit**: Applicable to file-based audio inputs (WhatsApp/Telegram voice notes). Live WebRTC audio relies on LiveKit WebRTC client-side noise suppression.

## 4. Post-STT LLM Cleanup & Latency Guardrails
- **Model Selection**: `gemini-2.5-flash-lite` for cost-effective spelling/grammar correction.
- **Latency Protection**: Restrict LLM post-correction to asynchronous voice-note channels only. Live WebRTC voice sessions bypass LLM cleanup to maintain zero extra latency (<300ms turn time).

## 5. Confidence-Based Fallback Rules
- **Threshold**: Set default `STT_CONFIDENCE_THRESHOLD = 0.6`.
- **Action**: When `confidence < threshold`, trigger spoken prompt: `"لم أسمع بوضوح، ممكن تكرر أو تكتب؟"` rather than attempting logic processing on distorted transcripts.
