// app/dashboard/settings/page.tsx
"use client";

import { useEffect, useState } from "react";
import VoiceNotePlayer from "@/components/VoiceNotePlayer";

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [adminPin, setAdminPin] = useState<string | null>(null);
  const [adminPinExpiry, setAdminPinExpiry] = useState<string | null>(null);
  const [generatingPin, setGeneratingPin] = useState(false);

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

  const generateAdminPin = async () => {
    setGeneratingPin(true);
    try {
      const res = await fetch("/api/dashboard/settings/admin-link/generate", {
        method: "POST",
      });
      const data = await res.json();
      if (data.code) {
        setAdminPin(data.code);
        setAdminPinExpiry(data.expiresAt);
      }
    } catch (err) {
      console.error("Failed to generate Admin PIN", err);
    } finally {
      setGeneratingPin(false);
    }
  };

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

  const actionBtn = (variant: "default" | "success" | "brand") => ({
    default: {
      background: "#fff",
      color: "var(--color-text-secondary)",
      border: "1px solid var(--color-border-subtle)",
    },
    success: {
      background: "#ecfdf5",
      color: "#059669",
      border: "1px solid #a7f3d0",
    },
    brand: {
      background: "#eff6ff",
      color: "var(--color-brand)",
      border: "1px solid #bfdbfe",
    },
  }[variant]);

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <h2 className="text-xl font-extrabold text-gray-800 dark:text-gray-100 flex items-center gap-2">
        ⚙️ إعدادات الأدمن والمساعد الصوتي
      </h2>

      {/* ── Telegram Admin Linking Card ── */}
      <div className="bento-card p-5 space-y-3 bg-pastel-blue border-0 shadow-sm">
        <div className="flex justify-between items-center">
          <label className="block text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--color-text-primary)" }}>
            📲 ربط وتحديث حساب الأدمن المباشر للتليجرام (Telegram Admin OTP Link)
          </label>
          <button
            type="button"
            onClick={generateAdminPin}
            disabled={generatingPin}
            className="px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm transition-all"
            style={actionBtn("brand")}
          >
            {generatingPin ? "جاري التوليد..." : "⚡ توليد كود ربط جديد (PIN)"}
          </button>
        </div>

        {adminPin ? (
          <div className="p-4 rounded-xl bg-white border border-blue-200 text-center space-y-2">
            <p className="text-xs text-gray-500 font-medium">افتح التليجرام وارسل هذا الكود للبوت المشترك قبل انتهاء الصلاحية (5 دقائق):</p>
            <div className="text-3xl font-extrabold font-mono tracking-widest text-blue-600 select-all">
              {adminPin}
            </div>
            <p className="text-xs text-blue-500">ينتهي الكود في: {new Date(adminPinExpiry || "").toLocaleTimeString("ar-EG")}</p>
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            انقر على "توليد كود ربط جديد" لإنشاء كود من 4 أرقام مدته 5 دقائق. بمجرد إرسال الكود للبوت في التليجرام يتم ربط حسابك كأدمن مباشر فورياً.
          </p>
        )}
      </div>

      {/* ── Voice Provider ── */}
      <div className="bento-card p-5 space-y-2">
        <label className="block text-sm font-bold" style={{ color: "var(--color-text-secondary)" }}>
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
        <label className="block text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--color-text-primary)" }}>
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
            <label className="block text-xs font-bold" style={{ color: "var(--color-text-muted)" }}>
              معرف بصمة صوتك الشخصي المستنسخ (Reference Voice ID)
            </label>
            <input
              type="text"
              placeholder="ضع معرف الصوت هنا (مثال: 7f8a9b0c1d...)"
              value={safeValues["FISH_VOICE_ID"] || ""}
              onChange={(e) => setValues({ ...safeValues, FISH_VOICE_ID: e.target.value })}
              className="glass-input font-mono text-xs"
            />
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              يمكنك رفع تسجيل 10 ثواني بصوتك على fish.audio ونسخ الـ Reference ID ووضعه هنا ليتحول السيستم لصوتك فوراً!
            </p>
          </div>
        )}
      </div>

      {/* ── Telegram Admin & Bot Config ── */}
      <div className="bento-card p-5 space-y-4">
        <h3 className="font-bold text-base text-gray-800 dark:text-gray-100 flex items-center gap-2">
          🤖 إعدادات التليجرام وبوت المنصة
        </h3>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
            Admin Telegram Chat ID 📲 (معرف التليجرام المسجل حالياً لاستقبال التنبيهات)
          </label>
          <input
            type="text"
            value={safeValues["ADMIN_TELEGRAM_CHAT_ID"] || ""}
            onChange={(e) => setValues({ ...safeValues, ADMIN_TELEGRAM_CHAT_ID: e.target.value })}
            className="glass-input font-mono text-sm"
            placeholder="يتم تحديثه تلقائياً عند إدخال الـ PIN للبوت..."
          />
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">
            Telegram Allowed Chat IDs (المسموح لهم بالتفاعل مع البوت)
          </label>
          <input
            type="text"
            value={safeValues["TELEGRAM_ALLOWED_CHAT_IDS"] || ""}
            onChange={(e) => setValues({ ...safeValues, TELEGRAM_ALLOWED_CHAT_IDS: e.target.value })}
            className="glass-input font-mono text-sm"
            placeholder="مثال: 12345678, 87654321"
          />
        </div>
      </div>

      {/* ── Voice Demo Card ── */}
      <div className="bento-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2" style={{ color: "var(--color-text-primary)" }}>
            🔊 اختبار ومعاينة نبرة الصوت المصرية
          </h3>
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{
              background: "#ecfdf5",
              color: "#059669",
              border: "1px solid #a7f3d0",
            }}
          >
            عامية حية 100%
          </span>
        </div>

        <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
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
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          style={{
            background: "var(--color-success)",
            color: "#fff",
          }}
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
        className="w-full px-4 py-3 rounded-xl font-bold transition-all disabled:opacity-50 shadow-md"
        style={{
          background: "var(--color-brand)",
          color: "#fff",
        }}
      >
        {saving ? "جاري الحفظ..." : "حفظ إعدادات الأدمن والنظام ⚙️"}
      </button>
      {saved && (
        <p className="text-center font-bold text-sm text-emerald-600">
          تم حفظ الإعدادات بنجاح ✓
        </p>
      )}
    </div>
  );
}
