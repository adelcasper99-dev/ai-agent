"""
diagnostics.py

Unified Diagnostic Module for Voice Calls & Interactions
"""

import time
import contextlib
import json
import numpy as np
import httpx

DIAGNOSTICS_ENDPOINT = "http://localhost:3000/api/diagnostics"
INTERNAL_SECRET = "casper-voice-internal-secret-9988776655"


def get_tenant_id_from_room(ctx) -> str | None:
    try:
        metadata_raw = getattr(ctx.room, "metadata", None)
        if not metadata_raw:
            return None
        metadata = json.loads(metadata_raw)
        return metadata.get("tenantId")
    except Exception as e:
        print(f"[diagnostics] failed to read tenantId from room metadata: {e}")
        return None


class DiagnosticsSession:
    def __init__(self, session_id: str, tenant_id: str | None = None, channel: str = "voice_call"):
        self.session_id = session_id
        self.tenant_id = tenant_id or "default-tenant"
        self.channel = channel
        self.latencies_ms: dict[str, int] = {}
        self.vad_cutoffs = 0
        self.silence_duration_ms: int | None = None
        self.audio_snr_db: float | None = None
        self.audio_clipping: bool | None = None
        self.raw_transcript: str | None = None
        self.corrected_transcript: str | None = None
        self.correction_applied = False
        self.stt_confidence: float | None = None

    @contextlib.contextmanager
    def timer(self, stage: str):
        """stage: 'vad' | 'stt' | 'llm' | 'tts'"""
        start = time.monotonic()
        try:
            yield
        finally:
            elapsed_ms = int((time.monotonic() - start) * 1000)
            self.latencies_ms[stage] = elapsed_ms

    def record_vad_cutoff(self):
        self.vad_cutoffs += 1

    def set_silence_duration(self, ms: int):
        self.silence_duration_ms = ms

    def set_audio_quality(self, audio_frame: np.ndarray):
        try:
            frame = audio_frame.astype(np.float32)
            signal_power = np.mean(frame ** 2)
            noise_floor = np.percentile(np.abs(frame), 10) ** 2
            if noise_floor > 0:
                snr = 10 * np.log10(signal_power / noise_floor)
                self.audio_snr_db = round(float(snr), 1)
            max_val = np.max(np.abs(frame))
            threshold = 0.98 * (32767 if frame.dtype != np.float32 else 1.0)
            self.audio_clipping = bool(np.mean(np.abs(frame) > threshold) > 0.01)
        except Exception:
            pass

    def set_stt_confidence(self, confidence: float | None):
        self.stt_confidence = confidence

    def set_transcript(self, raw: str, corrected: str | None = None):
        self.raw_transcript = raw
        if corrected and corrected != raw:
            self.corrected_transcript = corrected
            self.correction_applied = True

    async def flush(self):
        payload = {
            "channel": self.channel,
            "sessionId": self.session_id,
            "tenantId": self.tenant_id,
            "audioSnrDb": self.audio_snr_db,
            "audioClipping": self.audio_clipping,
            "vadCutoffs": self.vad_cutoffs,
            "silenceDurationMs": self.silence_duration_ms,
            "sttConfidence": self.stt_confidence,
            "rawTranscript": self.raw_transcript,
            "correctedTranscript": self.corrected_transcript,
            "correctionApplied": self.correction_applied,
            "llmLatencyMs": self.latencies_ms.get("llm"),
            "ttsLatencyMs": self.latencies_ms.get("tts"),
        }
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                await client.post(
                    DIAGNOSTICS_ENDPOINT,
                    json=payload,
                    headers={"x-internal-secret": INTERNAL_SECRET}
                )
        except Exception as e:
            print(f"[diagnostics] failed to flush: {e}")
