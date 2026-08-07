// app/dashboard/voice/page.tsx
"use client";

import { useEffect, useState } from "react";
import VoiceNotePlayer from "@/components/VoiceNotePlayer";

export default function VoiceSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [demoText, setDemoText] = useState("خلاص يا باشا، سجلتلك 50 جنيه بنزين في المصاريف وزي الفل!");
  const [demoVoice, setDemoVoice] = useState("salma");
  const [playingDemo, setPlayingDemo] = useState(false);
  const [audioDemoUrl, setAudioDemoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setValues(d?.settings || {}))
      .catch(() => setValues({}))
      .finally(() => setLoading(false));
  }, []);

  async function playAudioDemo() {
    if (!demoText) return;
    setPlayingDemo(true);
    try {
      if (audioDemoUrl) {
        try { URL.revokeObjectURL(audioDemoUrl); } catch (e) {}
      }
      setAudioDemoUrl(null);

      const res = await fetch("/api/voice/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: demoText, voice: demoVoice }),
      });
      if (!res.ok) throw new Error("Failed to generate demo");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioDemoUrl(url);
    } catch (e) {
      console.error(e);
      alert("فشل توليد العينة الصوتية. حاول مرة أخرى.");
    } finally {
      setPlayingDemo(false);
    }
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl">
        <div className="bento-card p-6 space-y-4">
          <div className="shimmer h-4 w-48 rounded-full" style={{ background: "#e2e8f0" }} />
          {[1,2,3].map(i => <div key={i} className="shimmer h-10 w-full rounded-xl" style={{ background: "#f1f5f9" }} />)}
        </div>
      </div>
    );
  }

  const safeValues = values || {};

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <h2 className="text-xl font-extrabold text-gray-800 dark:text-gray-100 flex items-center gap-2">
        🎙️ إعدادات المساعد ونبرة الصوت
      </h2>

      {/* ── Voice Provider ── */}
      <div className="bento-card p-5 space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
          🎙️ مزود الصوت المستخدم بالمنصة
        </label>
        <select
          value={safeValues["VOICE_PROVIDER"] || "gemini"}
          onChange={(e) => setValues({ ...safeValues, VOICE_PROVIDER: e.target.value })}
          className="glass-input font-bold"
        >
          <option value="gemini">Google Gemini Realtime (صوت مباشر 🌟)</option>
          <option value="groq_pipeline">Groq Pipeline (Whisper + Llama3 + EdgeTTS)</option>
          <option value="deepgram_pipeline">Deepgram STT (Nova-2 AI Noise-Free ⚡) + Llama 3.3 + EdgeTTS</option>
          <option value="fish_audio">Fish Audio (Zero-Shot Voice Clone 🐟) + Llama 3.3 + Groq STT</option>
        </select>
      </div>

      {/* ── Voice Tone ── */}
      <div className="bento-card p-5 space-y-3 bg-pastel-purple border-0">
        <label className="block text-sm font-bold flex items-center gap-1.5 text-gray-800 dark:text-gray-100">
          🗣️ اختيار نبرة وتنغيم الصوت المفضلة (Voice Tone)
        </label>
        <select
          value={safeValues["VOICE_TONE"] || "shakir"}
          onChange={(e) => {
            setValues({ ...safeValues, VOICE_TONE: e.target.value });
            setDemoVoice(e.target.value === "salma" ? "salma" : "shakir");
          }}
          className="glass-input font-bold text-sm"
        >
          <option value="shakir">شاكر المصري 👨 (صوت رجل أعمال دافئ)</option>
          <option value="salma">سلمى المصرية 👩 (صوت مساعد أنثوي ناعم)</option>
          <option value="custom_clone">👑 صوتك الشخصي المستنسخ (Fish Audio / Voice Clone ID)</option>
        </select>

        {(safeValues["VOICE_TONE"] === "custom_clone" || safeValues["VOICE_PROVIDER"] === "fish_audio") && (
          <div className="pt-2 space-y-1">
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
              معرف بصمة صوتك الشخصي المستنسخ (Reference Voice ID)
            </label>
            <input
              type="text"
              placeholder="ضع معرف الصوت هنا (مثال: 7f8a9b0c1d...)"
              value={safeValues["FISH_VOICE_ID"] || ""}
              onChange={(e) => setValues({ ...safeValues, FISH_VOICE_ID: e.target.value })}
              className="glass-input font-mono text-xs"
            />
            <p className="text-xs text-gray-500">
              يمكنك رفع تسجيل 10 ثواني بصوتك على fish.audio ونسخ الـ Reference ID ووضعه هنا ليتحول السيستم لصوتك فوراً!
            </p>
          </div>
        )}
      </div>

      {/* ── Voice Demo Card ── */}
      <div className="bento-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2 text-gray-800 dark:text-gray-100">
            🔊 اختبار ومعاينة نبرة الصوت المصرية
          </h3>
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300"
          >
            عامية حية 100%
          </span>
        </div>

        <p className="text-xs text-gray-500">
          يمكنك الاستماع فوراً لكيفية نطق المساعد للجملة بالعامية الحية، ونسخ النص لمشاركته في الشات للتحليل والتعديل.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={demoVoice}
            onChange={(e) => setDemoVoice(e.target.value)}
            className="glass-input text-xs font-bold"
            style={{ width: "auto", minWidth: "160px" }}
          >
            <option value="salma">سلمى المصرية 👩 (أنثوي ناعم)</option>
            <option value="shakir">شاكر المصري 👨 (ذكوري إنساني)</option>
          </select>
          <input
            type="text"
            value={demoText}
            onChange={(e) => setDemoText(e.target.value)}
            className="glass-input flex-1 text-xs"
            placeholder="اكتب أي جملة بالعامية لمعاينتها..."
          />
        </div>

        <button
          onClick={playAudioDemo}
          disabled={playingDemo}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm"
        >
          {playingDemo ? "🎙️ جاري توليد الرسالة الصوتية..." : "توليد وسماع الرسالة الصوتية 🎙️🔊"}
        </button>

        <div className="pt-1">
          <VoiceNotePlayer
            audioUrl={audioDemoUrl}
            text={demoText}
            senderName={demoVoice === "shakir" ? "شاكر المصري 👨" : "سلمى المصرية 👩"}
            onPlayDemo={playAudioDemo}
            isLoading={playingDemo}
          />
        </div>
      </div>

      {/* ── Save ── */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full px-4 py-3 rounded-xl font-bold transition-all disabled:opacity-50 shadow-md text-white bg-blue-600 hover:bg-blue-700"
      >
        {saving ? "جاري حفظ إعدادات الصوت..." : "حفظ إعدادات الصوت 🎙️"}
      </button>
      {saved && (
        <p className="text-center font-bold text-sm text-emerald-600">
          تم حفظ إعدادات الصوت بنجاح ✓
        </p>
      )}
    </div>
  );
}
