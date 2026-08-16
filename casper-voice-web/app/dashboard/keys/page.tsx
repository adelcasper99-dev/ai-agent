// app/dashboard/keys/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Key, Eye, EyeOff, Copy, Check, Activity, Radio, Sparkles, CheckCircle2 } from "lucide-react";
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
          <span className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Key className="w-5 h-5" />
          </span>
          المفاتيح والاستخدام
        </h2>
      </div>

      <UsageIndicator />

      {/* ── AI API Keys ── */}
      <div className="space-y-4">
        <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          مفاتيح الذكاء الاصطناعي (AI API Keys)
        </h3>

        {FIELDS.filter(f => f.group !== "LIVEKIT").map((f) => (
          <div key={f.key} className="glass-card-lg border border-slate-700/60 rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-bold text-slate-200">
                {f.label}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleShowKey(f.key)}
                  className="text-xs px-3 py-1.5 rounded-xl font-bold transition-all bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1.5"
                >
                  {showKey[f.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>{showKey[f.key] ? "إخفاء" : "إظهار"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(f.key, safeValues[f.key] || "")}
                  className="text-xs px-3 py-1.5 rounded-xl font-bold transition-all bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white flex items-center gap-1.5"
                >
                  {copiedKey === f.key ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedKey === f.key ? "تم النسخ ✓" : "نسخ"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => verifyKey(f.group)}
                  disabled={checking[f.group]}
                  className="text-xs px-3 py-1.5 rounded-xl font-bold transition-all bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500 hover:text-black disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Activity size={14} className={checking[f.group] ? "animate-spin" : ""} />
                  <span>{checking[f.group] ? "جاري الفحص..." : "فحص المفتاح"}</span>
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
                className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between border ${
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
        <div className="flex justify-between items-center border-t border-slate-700/60 pt-6">
          <h3 className="font-extrabold text-lg text-slate-100 flex items-center gap-2">
            <Radio className="w-5 h-5 text-cyan-400" />
            مفاتيح خادم LiveKit (LiveKit Server Keys)
          </h3>
          <button
            type="button"
            onClick={() => verifyKey("LIVEKIT")}
            disabled={checking["LIVEKIT"]}
            className="text-xs px-4 py-2 rounded-xl font-bold transition-all bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500 hover:text-black disabled:opacity-50 flex items-center gap-1.5"
          >
            <Activity size={14} className={checking["LIVEKIT"] ? "animate-spin" : ""} />
            <span>{checking["LIVEKIT"] ? "جاري فحص اتصال LiveKit..." : "فحص جودة الاتصال بـ LiveKit"}</span>
          </button>
        </div>

        {checkStatus["LIVEKIT"] && (
          <div
            className={`p-3.5 rounded-xl text-xs font-bold border ${
              checkStatus["LIVEKIT"].valid
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            {checkStatus["LIVEKIT"].message}
          </div>
        )}

        {FIELDS.filter(f => f.group === "LIVEKIT").map((f) => (
          <div key={f.key} className="glass-card-lg border border-slate-700/60 rounded-2xl p-5 space-y-3 shadow-xl">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-bold text-slate-200">
                {f.label}
              </label>
              <div className="flex items-center gap-2">
                {f.key.includes("SECRET") && (
                  <button
                    type="button"
                    onClick={() => toggleShowKey(f.key)}
                    className="text-xs px-3 py-1.5 rounded-xl font-bold transition-all bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1.5"
                  >
                    {showKey[f.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                    <span>{showKey[f.key] ? "إخفاء" : "إظهار"}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => copyToClipboard(f.key, safeValues[f.key] || "")}
                  className="text-xs px-3 py-1.5 rounded-xl font-bold transition-all bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white flex items-center gap-1.5"
                >
                  {copiedKey === f.key ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedKey === f.key ? "تم النسخ ✓" : "نسخ"}</span>
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

      {/* ── Save Button ── */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full h-12 rounded-xl font-extrabold transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(6,182,212,0.4)] text-black bg-cyan-500 hover:bg-cyan-400 text-sm hover:scale-[1.01] active:scale-[0.99]"
      >
        {saving ? "جاري حفظ المفاتيح..." : "حفظ المفاتيح والتغييرات 🔑"}
      </button>
      {saved && (
        <p className="text-center font-bold text-sm text-emerald-400 flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" />
          تم حفظ المفاتيح بنجاح ✓
        </p>
      )}
    </div>
  );
}
