# STT Multi-Provider Enhancement — Task Progress

- [x] Phase 1: Soniox STT provider branch + `create_agent_session_with_failover()` wrapper in `agent.py`
- [x] Phase 1b: Add `livekit-plugins-soniox>=0.9` dependency to `voice_service/requirements.txt`
- [x] Phase 2: Add `preprocess_audio_with_ffmpeg()` helper (highpass filter f=100, loudnorm, 16kHz resampling)
- [x] Phase 3: Emit `STT_DIAGNOSTIC` events and update `DiagnosticsSession` with `stt_provider`
- [x] Phase 4: Enforce channel isolation — LLM correction (`gemini-2.5-flash-lite`) limited to async text/voice-note paths only
- [x] Phase 5: Confidence-based fallback — prompt user `"لم أسمع بوضوح، ممكن تكرر أو تكتب؟"` if `confidence < 0.6`


## High Priority Tech Debt
- [ ] **BUG:** The openai_pipeline (Default OpenAI Realtime provider) crashes with module \'livekit.plugins.openai.realtime\' has no attribute \'ServerVadOptions\'. This affects any fallback to OpenAI or default OpenAI usage. High priority fix required in livekit-plugins-openai dependencies or gent.py.
