// app/dashboard/settings/page.tsx
"use client";

import { useEffect, useState } from "react";

const FIELDS = [
  { key: "OPENAI_API_KEY", label: "OpenAI API Key", group: "OPENAI" },
  { key: "GEMINI_API_KEY", label: "Gemini API Key", group: "GEMINI" },
  { key: "GROQ_API_KEY", label: "Groq API Key (Whisper + Llama)", group: "GROQ" },
  { key: "DEEPGRAM_API_KEY", label: "Deepgram API Key (Nova-2 AI Noise-Free STT)", group: "DEEPGRAM" },
  { key: "FISH_API_KEY", label: "Fish Audio API Key (Zero-Shot Voice Clone 🐟)", group: "FISH" },
  { key: "TELEGRAM_BOT_TOKEN", label: "Telegram Bot Token 🤖 (لبوت التليجرام والموافقات)", group: "TELEGRAM" },
  { key: "ADMIN_TELEGRAM_CHAT_ID", label: "Admin Telegram Chat ID 📲 (رقم التليجرام الخاص بك لاستقبال الإشعارات والطلب)", group: "TELEGRAM" },
  { key: "TELEGRAM_ALLOWED_CHAT_IDS", label: "Telegram Allowed Chat IDs (المسموح لهم بالتفاعل)", group: "TELEGRAM" },
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
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (keyName: string, textValue: string) => {
    if (!textValue) return;
    navigator.clipboard.writeText(textValue);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleShowKey = (keyName: string) => {
    setShowKey((p) => ({ ...p, [keyName]: !p[keyName] }));
  };

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

  async function verifyKey(provider: string) {
    setChecking((p) => ({ ...p, [provider]: true }));
    try {
      let key = values["OPENAI_API_KEY"];
      if (provider === "GEMINI") key = values["GEMINI_API_KEY"];
      if (provider === "GROQ") key = values["GROQ_API_KEY"];
      if (provider === "DEEPGRAM") key = values["DEEPGRAM_API_KEY"];
      if (provider === "FISH") key = values["FISH_API_KEY"];
      if (provider === "TELEGRAM") key = values["TELEGRAM_BOT_TOKEN"];

      const body: Record<string, string | undefined> = {
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

  // ── Shared inline styles ───────────────────────────────────────────────────
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
      <UsageIndicator />

      {/* ── Voice Provider ── */}
      <div className="bento-card p-5 space-y-2">
        <label className="block text-sm font-bold" style={{ color: "var(--color-text-secondary)" }}>
          مزود الصوت المستخدم دلوقتي
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
          🎙️ اختيار نبرة وتنغيم الصوت المفضلة (Voice Tone)
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

      {/* ── AI API Keys ── */}
      <div className="space-y-3">
        <h3
          className="font-bold text-base"
          style={{
            color: "var(--color-text-primary)",
            borderTop: "1px solid var(--color-border-subtle)",
            paddingTop: "16px",
          }}
        >
          مفاتيح الذكاء الاصطناعي
        </h3>

        {FIELDS.filter(f => f.group !== "LIVEKIT").map((f) => (
          <div key={f.key} className="nested-card p-4 space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
                {f.label}
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => toggleShowKey(f.key)}
                  className="text-xs px-2 py-1 rounded font-bold transition-all"
                  style={actionBtn("default")}
                >
                  {showKey[f.key] ? "🙈 إخفاء" : "👁️ إظهار"}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(f.key, safeValues[f.key] || "")}
                  className="text-xs px-2 py-1 rounded font-bold transition-all"
                  style={actionBtn("success")}
                >
                  {copiedKey === f.key ? "تم النسخ ✓" : "📋 نسخ"}
                </button>
                <button
                  type="button"
                  onClick={() => verifyKey(f.group)}
                  disabled={checking[f.group]}
                  className="text-xs px-2 py-1 rounded font-bold transition-all disabled:opacity-50"
                  style={actionBtn("brand")}
                >
                  {checking[f.group] ? "جاري الفحص..." : "فحص المفتاح"}
                </button>
              </div>
            </div>
            <input
              type={showKey[f.key] ? "text" : "password"}
              value={safeValues[f.key] || ""}
              onChange={(e) => setValues({ ...safeValues, [f.key]: e.target.value })}
              className="glass-input font-mono text-sm"
            />
            {checkStatus[f.group] && (
              <div
                className="p-2 rounded-lg text-xs font-bold flex items-center justify-between"
                style={{
                  background: checkStatus[f.group].valid ? "#ecfdf5" : "#fef2f2",
                  border: `1px solid ${checkStatus[f.group].valid ? "#a7f3d0" : "#fca5a5"}`,
                  color: checkStatus[f.group].valid ? "#059669" : "#dc2626",
                }}
              >
                <span>{checkStatus[f.group].message}</span>
                <span>{checkStatus[f.group].valid ? "✅" : "🚨"}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── LiveKit Keys ── */}
      <div className="space-y-3">
        <div
          className="flex justify-between items-center"
          style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "16px" }}
        >
          <h3 className="font-bold text-base" style={{ color: "var(--color-text-primary)" }}>
            مفاتيح خادم LiveKit
          </h3>
          <button
            type="button"
            onClick={() => verifyKey("LIVEKIT")}
            disabled={checking["LIVEKIT"]}
            className="text-xs px-3 py-1.5 rounded-full font-bold transition-all disabled:opacity-50"
            style={actionBtn("brand")}
          >
            {checking["LIVEKIT"] ? "جاري فحص اتصال LiveKit..." : "فحص جودة الاتصال بـ LiveKit"}
          </button>
        </div>

        {checkStatus["LIVEKIT"] && (
          <div
            className="p-2.5 rounded-xl text-sm font-bold"
            style={{
              background: checkStatus["LIVEKIT"].valid ? "#ecfdf5" : "#fef2f2",
              border: `1px solid ${checkStatus["LIVEKIT"].valid ? "#a7f3d0" : "#fca5a5"}`,
              color: checkStatus["LIVEKIT"].valid ? "#059669" : "#dc2626",
            }}
          >
            {checkStatus["LIVEKIT"].message}
          </div>
        )}

        {FIELDS.filter(f => f.group === "LIVEKIT").map((f) => (
          <div key={f.key} className="nested-card p-4 space-y-2">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium" style={{ color: "var(--color-text-secondary)" }}>
                {f.label}
              </label>
              <div className="flex items-center gap-1.5">
                {f.key.includes("SECRET") && (
                  <button
                    type="button"
                    onClick={() => toggleShowKey(f.key)}
                    className="text-xs px-2 py-1 rounded font-bold transition-all"
                    style={actionBtn("default")}
                  >
                    {showKey[f.key] ? "🙈 إخفاء" : "👁️ إظهار"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => copyToClipboard(f.key, safeValues[f.key] || "")}
                  className="text-xs px-2 py-1 rounded font-bold transition-all"
                  style={actionBtn("success")}
                >
                  {copiedKey === f.key ? "تم النسخ ✓" : "📋 نسخ"}
                </button>
              </div>
            </div>
            <input
              type={f.key.includes("SECRET") && !showKey[f.key] ? "password" : "text"}
              value={safeValues[f.key] || ""}
              onChange={(e) => setValues({ ...safeValues, [f.key]: e.target.value })}
              className="glass-input font-mono text-sm"
            />
          </div>
        ))}
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
        className="w-full px-4 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
        style={{
          background: "var(--color-brand)",
          color: "#fff",
          boxShadow: saving ? "none" : "0 4px 12px rgba(0,0,0,0.1)",
        }}
      >
        {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
      </button>
      {saved && (
        <p className="text-center font-bold text-sm" style={{ color: "#059669" }}>
          تم الحفظ بنجاح ✓
        </p>
      )}
    </div>
  );
}
