// app/dashboard/keys/page.tsx
"use client";

import { useEffect, useState } from "react";
import { UsageIndicator } from "@/components/UsageIndicator";

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

export default function KeysPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checkStatus, setCheckStatus] = useState<Record<string, { valid: boolean; message: string }>>({});
  const [checking, setChecking] = useState<Record<string, boolean>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setValues(d?.settings || {}))
      .catch(() => setValues({}))
      .finally(() => setLoading(false));
  }, []);

  const copyToClipboard = (keyName: string, textValue: string) => {
    if (!textValue) return;
    navigator.clipboard.writeText(textValue);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleShowKey = (keyName: string) => {
    setShowKey((p) => ({ ...p, [keyName]: !p[keyName] }));
  };

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
    <div className="space-y-6 max-w-4xl pb-10" dir="rtl">
      <div className="flex items-center justify-between bg-zinc-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl mb-6">
        <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
          <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">🔑</span>
          المفاتيح والاستخدام
        </h2>
      </div>

      <UsageIndicator />

      {/* ── AI API Keys ── */}
      <div className="space-y-4">
        <h3 className="font-bold text-lg text-white flex items-center gap-2">
          🔑 مفاتيح الذكاء الاصطناعي (AI API Keys)
        </h3>

        {FIELDS.filter(f => f.group !== "LIVEKIT").map((f) => (
          <div key={f.key} className="bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-3xl p-5 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-bold text-zinc-200">
                {f.label}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleShowKey(f.key)}
                  className="text-xs px-3 py-1.5 rounded-xl font-bold transition-all bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10"
                >
                  {showKey[f.key] ? "🙈 إخفاء" : "👁️ إظهار"}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(f.key, safeValues[f.key] || "")}
                  className="text-xs px-3 py-1.5 rounded-xl font-bold transition-all bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white"
                >
                  {copiedKey === f.key ? "تم النسخ ✓" : "📋 نسخ"}
                </button>
                <button
                  type="button"
                  onClick={() => verifyKey(f.group)}
                  disabled={checking[f.group]}
                  className="text-xs px-3 py-1.5 rounded-xl font-bold transition-all bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500 hover:text-black disabled:opacity-50"
                >
                  {checking[f.group] ? "جاري الفحص..." : "فحص المفتاح"}
                </button>
              </div>
            </div>
            <input
              type={showKey[f.key] ? "text" : "password"}
              value={safeValues[f.key] || ""}
              onChange={(e) => setValues({ ...safeValues, [f.key]: e.target.value })}
              className="w-full h-12 px-4 bg-zinc-900/50 border border-white/10 text-white font-mono text-sm rounded-2xl outline-none focus:border-white transition-all"
            />
            {checkStatus[f.group] && (
              <div
                className={`p-3 rounded-2xl text-xs font-bold flex items-center justify-between border ${
                  checkStatus[f.group].valid
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                }`}
              >
                <span>{checkStatus[f.group].message}</span>
                <span>{checkStatus[f.group].valid ? "✅" : "🚨"}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── LiveKit Keys ── */}
      <div className="space-y-4 pt-4">
        <div className="flex justify-between items-center border-t border-white/10 pt-6">
          <h3 className="font-bold text-lg text-white flex items-center gap-2">
            📡 مفاتيح خادم LiveKit (LiveKit Server Keys)
          </h3>
          <button
            type="button"
            onClick={() => verifyKey("LIVEKIT")}
            disabled={checking["LIVEKIT"]}
            className="text-xs px-4 py-2 rounded-xl font-bold transition-all bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500 hover:text-black disabled:opacity-50"
          >
            {checking["LIVEKIT"] ? "جاري فحص اتصال LiveKit..." : "فحص جودة الاتصال بـ LiveKit"}
          </button>
        </div>

        {checkStatus["LIVEKIT"] && (
          <div
            className={`p-3 rounded-2xl text-sm font-bold border ${
              checkStatus["LIVEKIT"].valid
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            {checkStatus["LIVEKIT"].message}
          </div>
        )}

        {FIELDS.filter(f => f.group === "LIVEKIT").map((f) => (
          <div key={f.key} className="bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-3xl p-5 space-y-3 shadow-2xl">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-bold text-zinc-200">
                {f.label}
              </label>
              <div className="flex items-center gap-2">
                {f.key.includes("SECRET") && (
                  <button
                    type="button"
                    onClick={() => toggleShowKey(f.key)}
                    className="text-xs px-3 py-1.5 rounded-xl font-bold transition-all bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10"
                  >
                    {showKey[f.key] ? "🙈 إخفاء" : "👁️ إظهار"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => copyToClipboard(f.key, safeValues[f.key] || "")}
                  className="text-xs px-3 py-1.5 rounded-xl font-bold transition-all bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white"
                >
                  {copiedKey === f.key ? "تم النسخ ✓" : "📋 نسخ"}
                </button>
              </div>
            </div>
            <input
              type={f.key.includes("SECRET") && !showKey[f.key] ? "password" : "text"}
              value={safeValues[f.key] || ""}
              onChange={(e) => setValues({ ...safeValues, [f.key]: e.target.value })}
              className="w-full h-12 px-4 bg-zinc-900/50 border border-white/10 text-white font-mono text-sm rounded-2xl outline-none focus:border-white transition-all"
            />
          </div>
        ))}
      </div>

      {/* ── Save Button ── */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full h-14 rounded-2xl font-black transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(245,158,11,0.4)] text-black bg-amber-500 hover:bg-amber-400 text-sm"
      >
        {saving ? "جاري حفظ المفاتيح..." : "حفظ المفاتيح والتغييرات 🔑"}
      </button>
      {saved && (
        <p className="text-center font-bold text-sm text-emerald-400 animate-pulse">
          تم حفظ المفاتيح بنجاح ✓
        </p>
      )}
    </div>
  );
}
