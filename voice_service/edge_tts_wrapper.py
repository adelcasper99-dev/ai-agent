import os
import tempfile
import edge_tts
from livekit.agents import APIConnectOptions, DEFAULT_API_CONNECT_OPTIONS, tts
from livekit.agents.utils.audio import audio_frames_from_file

class EdgeTTS(tts.TTS):
    def __init__(self, voice: str = "ar-EG-SalmaNeural", sample_rate: int = 24000):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=sample_rate,
            num_channels=1,
        )
        self.voice = voice

    def synthesize(self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS) -> tts.ChunkedStream:
        return EdgeTTSChunkedStream(tts=self, text=text, voice=self.voice, sample_rate=self.sample_rate, conn_options=conn_options)


class EdgeTTSChunkedStream(tts.ChunkedStream):
    def __init__(self, *, tts: tts.TTS, text: str, voice: str, sample_rate: int, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS):
        super().__init__(tts=tts, input_text=text, conn_options=conn_options)
        self._text = text
        self._voice = voice
        self._sample_rate = sample_rate

    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        if not self._text.strip():
            return

        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            tmp_path = f.name

        try:
            from egyptian_number_normalizer import normalize_egyptian_numbers
            normalized_text = normalize_egyptian_numbers(self._text)

            # Soften periods to ellipses for natural spoken cadence
            formatted_text = normalized_text.strip().replace(".", "...").replace("!", "...").replace("،", ",")
            communicate = edge_tts.Communicate(formatted_text, self._voice, rate="-7%", pitch="+1Hz")
            await communicate.save(tmp_path)

            output_emitter.initialize(
                request_id="edge-tts-req",
                sample_rate=self._sample_rate,
                num_channels=1,
                mime_type="audio/pcm",
            )

            async for frame in audio_frames_from_file(tmp_path, sample_rate=self._sample_rate):
                output_emitter.push(frame.data.tobytes())

            output_emitter.flush()
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass
