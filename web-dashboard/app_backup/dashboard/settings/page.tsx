// app/dashboard/settings/page.tsx
"use client";

import { useEffect, useState } from "react";

const FIELDS = [
  { key: "OPENAI_API_KEY", label: "OpenAI API Key" },
  { key: "GEMINI_API_KEY", label: "Gemini API Key" },
  { key: "LIVEKIT_URL", label: "LiveKit URL" },
  { key: "LIVEKIT_API_KEY", label: "LiveKit API Key" },
  { key: "LIVEKIT_API_SECRET", label: "LiveKit API Secret" },
];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setValues(d.settings))
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) return <p>جاري التحميل...</p>;

  return (
    <div className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-medium mb-1">مزود الصوت المستخدم دلوقتي</label>
        <select
          value={values["VOICE_PROVIDER"] || "openai"}
          onChange={(e) => setValues({ ...values, VOICE_PROVIDER: e.target.value })}
          className="w-full border rounded-lg px-3 py-2"
        >
          <option value="openai">OpenAI Realtime</option>
          <option value="gemini">Gemini Realtime</option>
        </select>
      </div>
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="block text-sm font-medium mb-1">{f.label}</label>
          <input
            type="password"
            value={values[f.key] || ""}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>
      ))}
      <button
        onClick={save}
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
      >
        {saving ? "جاري الحفظ..." : "حفظ"}
      </button>
      {saved && <p className="text-green-600 text-sm">تم الحفظ ✓</p>}
    </div>
  );
}
