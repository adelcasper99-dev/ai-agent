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
    <div className="space-y-6 max-w-4xl pb-10">
      <UsageIndicator />

      {/* ── AI API Keys ── */}
      <div className="space-y-3">
        <h3 className="font-bold text-base text-gray-800 dark:text-gray-100 flex items-center gap-2">
          🔑 مفاتيح الذكاء الاصطناعي (AI API Keys)
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
      <div className="space-y-3 pt-4">
        <div className="flex justify-between items-center border-t border-gray-200 dark:border-gray-800 pt-4">
          <h3 className="font-bold text-base text-gray-800 dark:text-gray-100 flex items-center gap-2">
            📡 مفاتيح خادم LiveKit (LiveKit Server Keys)
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

      {/* ── Save Button ── */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full px-4 py-3 rounded-xl font-bold transition-all disabled:opacity-50 shadow-md"
        style={{
          background: "var(--color-brand)",
          color: "#fff",
        }}
      >
        {saving ? "جاري حفظ المفاتيح..." : "حفظ المفاتيح والتغييرات 🔑"}
      </button>
      {saved && (
        <p className="text-center font-bold text-sm text-emerald-600">
          تم حفظ المفاتيح بنجاح ✓
        </p>
      )}
    </div>
  );
}
