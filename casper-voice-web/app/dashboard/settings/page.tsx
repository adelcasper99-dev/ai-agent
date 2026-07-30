// app/dashboard/settings/page.tsx
"use client";

import { useEffect, useState } from "react";

const FIELDS = [
  { key: "OPENAI_API_KEY", label: "OpenAI API Key", group: "OPENAI" },
  { key: "GEMINI_API_KEY", label: "Gemini API Key", group: "GEMINI" },
  { key: "GROQ_API_KEY", label: "Groq API Key (Whisper + Llama)", group: "GROQ" },
  { key: "DEEPGRAM_API_KEY", label: "Deepgram API Key (Nova-2 AI Noise-Free STT)", group: "DEEPGRAM" },
  { key: "FISH_API_KEY", label: "Fish Audio API Key (Zero-Shot Voice Clone 🐟)", group: "FISH" },
  { key: "LIVEKIT_URL", label: "LiveKit URL", group: "LIVEKIT" },
  { key: "LIVEKIT_API_KEY", label: "LiveKit API Key", group: "LIVEKIT" },
  { key: "LIVEKIT_API_SECRET", label: "LiveKit API Secret", group: "LIVEKIT" },
];

import VoiceNotePlayer from "@/components/VoiceNotePlayer";
import { UsageIndicator } from "@/components/UsageIndicator";

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checkStatus, setCheckStatus] = useState<Record<string, { valid: boolean; message: string }>>({});
  const [checking, setChecking] = useState<Record<string, boolean>>({});

  const [demoText, setDemoText] = useState("خلاص يا باشا، سجلتلك 50 جنيه بنزين في المصاريف وزي الفل!");
  const [demoVoice, setDemoVoice] = useState("salma");
  const [playingDemo, setPlayingDemo] = useState(false);
  const [copiedDemo, setCopiedDemo] = useState(false);
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

  async function verifyKey(provider: string) {
    setChecking((p) => ({ ...p, [provider]: true }));
    try {
      let key = values["OPENAI_API_KEY"];
      if (provider === "GEMINI") key = values["GEMINI_API_KEY"];
      if (provider === "GROQ") key = values["GROQ_API_KEY"];
      if (provider === "DEEPGRAM") key = values["DEEPGRAM_API_KEY"];
      if (provider === "FISH") key = values["FISH_API_KEY"];

      const body = {
        provider,
        key,
        secret: values["LIVEKIT_API_SECRET"],
        url: values["LIVEKIT_URL"],
      };
      
      if (provider === "LIVEKIT") {
        body.key = values["LIVEKIT_API_KEY"];
      }

      const res = await fetch("/api/settings/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setCheckStatus((p) => ({ ...p, [provider]: data }));
    } catch (e) {
      setCheckStatus((p) => ({ ...p, [provider]: { valid: false, message: "فشل الاتصال بالخادم" } }));
    } finally {
      setChecking((p) => ({ ...p, [provider]: false }));
    }
  }

  if (loading) return <p>جاري التحميل...</p>;

  const safeValues = values || {};

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <UsageIndicator />

      <div>
        <label className="block text-sm font-medium mb-1">مزود الصوت المستخدم دلوقتي</label>
        <select
          value={safeValues["VOICE_PROVIDER"] || "openai"}
          onChange={(e) => setValues({ ...safeValues, VOICE_PROVIDER: e.target.value })}
          className="w-full border rounded-lg px-3 py-2 bg-white font-bold text-blue-900"
        >
          <option value="openai">OpenAI Realtime (صوت مباشر)</option>
          <option value="gemini">Gemini Realtime (صوت مباشر)</option>
          <option value="groq_pipeline">Groq Pipeline (Whisper STT + Llama 3.3 + EdgeTTS المصرية 🚀)</option>
          <option value="deepgram_pipeline">Deepgram STT (Nova-2 AI Noise-Free ⚡) + Llama 3.3 + EdgeTTS</option>
          <option value="fish_audio">Fish Audio (Zero-Shot Voice Clone 🐟) + Llama 3.3 + Groq STT</option>
        </select>
      </div>

      <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-200 space-y-3">
        <label className="block text-sm font-bold text-blue-950 flex items-center gap-1.5">
          <span>🎙️</span> اختيار نبرة وتنغيم الصوت المفضلة (Voice Tone)
        </label>
        <select
          value={safeValues["VOICE_TONE"] || "shakir"}
          onChange={(e) => {
            setValues({ ...safeValues, VOICE_TONE: e.target.value });
            setDemoVoice(e.target.value === "salma" ? "salma" : "shakir");
          }}
          className="w-full border rounded-lg px-3 py-2 bg-white font-bold text-slate-800 text-sm"
        >
          <option value="shakir">شاكر المصري 👨 (صوت رجل أعمال دافئ)</option>
          <option value="salma">سلمى المصرية 👩 (صوت مساعد أنثوي ناعم)</option>
          <option value="custom_clone">👑 صوتك الشخصي المستنسخ (Fish Audio / Voice Clone ID)</option>
        </select>

        {(safeValues["VOICE_TONE"] === "custom_clone" || safeValues["VOICE_PROVIDER"] === "fish_audio") && (
          <div className="pt-2 space-y-1">
            <label className="block text-xs font-bold text-slate-700">
              معرف بصمة صوتك الشخصي المستنسخ (Reference Voice ID)
            </label>
            <input
              type="text"
              placeholder="ضع معرف الصوت هنا (مثال: 7f8a9b0c1d...)"
              value={safeValues["FISH_VOICE_ID"] || ""}
              onChange={(e) => setValues({ ...safeValues, FISH_VOICE_ID: e.target.value })}
              className="w-full border bg-white rounded-lg px-3 py-2 font-mono text-xs text-slate-800"
            />
            <p className="text-[11px] text-slate-500">
              يمكنك رفع تسجيل 10 ثواني بصوتك على fish.audio ونسخ الـ Reference ID ووضعه هنا ليتحول السيستم لصوتك فوراً!
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4 border-t pt-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">مفاتيح الذكاء الاصطناعي</h3>
        </div>
        
        {FIELDS.filter(f => f.group !== "LIVEKIT").map((f) => (
          <div key={f.key} className="space-y-1 bg-slate-50 p-3 rounded-xl border">
            <div className="flex justify-between">
              <label className="block text-sm font-medium">{f.label}</label>
              <button 
                onClick={() => verifyKey(f.group)} 
                disabled={checking[f.group]}
                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
              >
                {checking[f.group] ? "جاري الفحص..." : "فحص المفتاح"}
              </button>
            </div>
            <input
              type="password"
              value={values[f.key] || ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className="w-full border rounded-lg px-3 py-2 font-mono"
            />
            {checkStatus[f.group] && (
              <div className={`mt-2 p-2 rounded-lg text-xs font-bold border flex items-center justify-between ${
                checkStatus[f.group].valid 
                  ? 'bg-green-100 text-green-800 border-green-300' 
                  : 'bg-red-100 text-red-800 border-red-300'
              }`}>
                <span>{checkStatus[f.group].message}</span>
                <span className="text-base">{checkStatus[f.group].valid ? '✅' : '🚨'}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-4 border-t pt-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">مفاتيح خادم LiveKit</h3>
          <button 
            onClick={() => verifyKey("LIVEKIT")} 
            disabled={checking["LIVEKIT"]}
            className="text-xs bg-purple-100 text-purple-700 px-3 py-1.5 rounded-lg font-bold hover:bg-purple-200"
          >
            {checking["LIVEKIT"] ? "جاري فحص اتصال LiveKit..." : "فحص جودة الاتصال بـ LiveKit"}
          </button>
        </div>
        
        {checkStatus["LIVEKIT"] && (
          <div className={`p-2 rounded-lg text-sm font-bold border ${checkStatus["LIVEKIT"].valid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {checkStatus["LIVEKIT"].message}
          </div>
        )}

        {FIELDS.filter(f => f.group === "LIVEKIT").map((f) => (
          <div key={f.key}>
            <label className="block text-sm font-medium mb-1">{f.label}</label>
            <input
              type={f.key.includes('SECRET') ? 'password' : 'text'}
              value={values[f.key] || ""}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
        ))}
      </div>

      {/* Egyptian Voice Audio Preview & Copy Card */}
      <div className="space-y-3 border-t pt-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <span>🔊</span> اختبار ومعاينة نبرة الصوت المصرية
          </h3>
          <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
            عامية حية 100%
          </span>
        </div>

        <p className="text-xs text-slate-600">
          يمكنك الاستماع فوراً لكيفية نطق المساعد للجملة بالعامية الحية، ونسخ النص لمشاركته في الشات للتحليل والتعديل.
        </p>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={demoVoice}
            onChange={(e) => setDemoVoice(e.target.value)}
            className="border bg-white text-xs font-bold rounded-lg px-3 py-2 text-slate-700"
          >
            <option value="salma">سلمى المصرية 👩 (أنثوي ناعم)</option>
            <option value="shakir">شاكر المصري 👨 (ذكوري إنساني)</option>
          </select>
          <input
            type="text"
            value={demoText}
            onChange={(e) => setDemoText(e.target.value)}
            className="border bg-white text-xs rounded-lg px-3 py-2 flex-1 font-medium text-slate-800 dir-rtl"
            placeholder="اكتب أي جملة بالعامية لمعاينتها..."
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={playAudioDemo}
            disabled={playingDemo}
            className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition shadow-sm disabled:opacity-50"
          >
            <span>{playingDemo ? "🎙️ جاري توليد الرسالة الصوتية..." : "توليد وسماع الرسالة الصوتية 🎙️🔊"}</span>
          </button>
        </div>

        {/* WhatsApp Style Voice Note Player Widget */}
        <div className="pt-2">
          <VoiceNotePlayer
            audioUrl={audioDemoUrl}
            text={demoText}
            senderName={demoVoice === 'shakir' ? 'شاكر المصري 👨' : 'سلمى المصرية 👩'}
            onPlayDemo={playAudioDemo}
            isLoading={playingDemo}
          />
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-blue-600 text-white px-4 py-3 rounded-xl font-bold shadow-md hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
      </button>
      {saved && <p className="text-green-600 font-bold text-center">تم الحفظ بنجاح ✓</p>}
    </div>
  );
}
