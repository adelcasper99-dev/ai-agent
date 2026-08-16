// app/dashboard/voice/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Mic, Volume2, Sparkles, CheckCircle2 } from "lucide-react";
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
        <div className="glass-card-lg p-6 space-y-4 animate-pulse">
          <div className="h-5 w-48 rounded-full bg-slate-700/50" />
          {[1,2,3].map(i => <div key={i} className="h-12 w-full rounded-xl bg-slate-700/30" />)}
        </div>
      </div>
    );
  }

  const safeValues = values || {};

  return (
    <div className="space-y-6 max-w-4xl pb-10" dir="rtl">
      <div className="flex items-center justify-between glass-card-lg p-6 rounded-2xl border border-slate-700/60 shadow-xl mb-6">
        <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Mic className="w-5 h-5" />
          </span>
          إعدادات المساعد ونبرة الصوت
        </h2>
      </div>

      {/* ── Voice Provider ── */}
      <div className="glass-card-lg border border-slate-700/60 rounded-2xl p-6 space-y-3 shadow-xl">
        <label className="block text-sm font-bold text-slate-100 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          مزود الصوت المستخدم بالمنصة
        </label>
        <select
          value={safeValues["VOICE_PROVIDER"] || "gemini"}
          onChange={(e) => setValues({ ...safeValues, VOICE_PROVIDER: e.target.value })}
          className="glass-input font-bold text-sm cursor-pointer"
        >
          <option value="gemini" className="bg-slate-900 text-white">Google Gemini Realtime (صوت مباشر 🌟)</option>
          <option value="groq_pipeline" className="bg-slate-900 text-white">Groq Pipeline (Whisper + Llama3 + EdgeTTS)</option>
          <option value="deepgram_pipeline" className="bg-slate-900 text-white">Deepgram STT (Nova-2 AI Noise-Free ⚡) + Llama 3.3 + EdgeTTS</option>
          <option value="fish_audio" className="bg-slate-900 text-white">Fish Audio (Zero-Shot Voice Clone 🐟) + Llama 3.3 + Groq STT</option>
        </select>
      </div>

      {/* ── Voice Tone ── */}
      <div className="glass-card-lg border border-slate-700/60 rounded-2xl p-6 space-y-4 shadow-xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-cyan-500/10 transition-colors" />
        <label className="block text-sm font-bold flex items-center gap-2 text-slate-100 relative z-10">
          <Volume2 className="w-4 h-4 text-cyan-400" />
          اختيار نبرة وتنغيم الصوت المفضلة (Voice Tone)
        </label>
        <select
          value={safeValues["VOICE_TONE"] || "shakir"}
          onChange={(e) => {
            setValues({ ...safeValues, VOICE_TONE: e.target.value });
            setDemoVoice(e.target.value === "salma" ? "salma" : "shakir");
          }}
          className="glass-input font-bold text-sm cursor-pointer relative z-10"
        >
          <option value="shakir" className="bg-slate-900 text-white">شاكر المصري 👨 (صوت رجل أعمال دافئ)</option>
          <option value="salma" className="bg-slate-900 text-white">سلمى المصرية 👩 (صوت مساعد أنثوي ناعم)</option>
          <option value="custom_clone" className="bg-slate-900 text-white">👑 صوتك الشخصي المستنسخ (Fish Audio / Voice Clone ID)</option>
        </select>

        {(safeValues["VOICE_TONE"] === "custom_clone" || safeValues["VOICE_PROVIDER"] === "fish_audio") && (
          <div className="pt-2 space-y-2 relative z-10">
            <label className="block text-xs font-bold text-slate-200">
              معرف بصمة صوتك الشخصي المستنسخ (Reference Voice ID)
            </label>
            <input
              type="text"
              placeholder="ضع معرف الصوت هنا (مثال: 7f8a9b0c1d...)"
              value={safeValues["FISH_VOICE_ID"] || ""}
              onChange={(e) => setValues({ ...safeValues, FISH_VOICE_ID: e.target.value })}
              className="glass-input font-mono text-xs"
            />
            <p className="text-xs text-slate-400">
              يمكنك رفع تسجيل 10 ثواني بصوتك على fish.audio ونسخ الـ Reference ID ووضعه هنا ليتحول السيستم لصوتك فوراً!
            </p>
          </div>
        )}
      </div>

      {/* ── Voice Demo Card ── */}
      <div className="glass-card-lg border border-slate-700/60 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2 text-slate-100">
            <Volume2 className="w-5 h-5 text-cyan-400" />
            اختبار ومعاينة نبرة الصوت المصرية
          </h3>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            عامية حية 100%
          </span>
        </div>

        <p className="text-xs text-slate-400">
          يمكنك الاستماع فوراً لكيفية نطق المساعد للجملة بالعامية الحية، ونسخ النص لمشاركته في الشات للتحليل والتعديل.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={demoVoice}
            onChange={(e) => setDemoVoice(e.target.value)}
            className="glass-input font-bold text-xs cursor-pointer sm:w-48"
          >
            <option value="salma" className="bg-slate-900 text-white">سلمى المصرية 👩 (أنثوي ناعم)</option>
            <option value="shakir" className="bg-slate-900 text-white">شاكر المصري 👨 (ذكوري إنساني)</option>
          </select>
          <input
            type="text"
            value={demoText}
            onChange={(e) => setDemoText(e.target.value)}
            className="glass-input flex-1 text-xs font-bold"
            placeholder="اكتب أي جملة بالعامية لمعاينتها..."
          />
        </div>

        <button
          onClick={playAudioDemo}
          disabled={playingDemo}
          className="w-full h-12 rounded-xl font-bold transition-all disabled:opacity-50 text-white bg-cyan-600 hover:bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)] text-xs flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
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
        className="w-full h-12 rounded-xl font-extrabold transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(6,182,212,0.4)] text-black bg-cyan-500 hover:bg-cyan-400 text-sm hover:scale-[1.01] active:scale-[0.99]"
      >
        {saving ? "جاري حفظ إعدادات الصوت..." : "حفظ إعدادات الصوت 🎙️"}
      </button>
      {saved && (
        <p className="text-center font-bold text-sm text-emerald-400 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" />
          تم حفظ إعدادات الصوت بنجاح ✓
        </p>
      )}
    </div>
  );
}
