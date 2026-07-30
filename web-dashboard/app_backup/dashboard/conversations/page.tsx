// app/dashboard/conversations/page.tsx
"use client";

import { useEffect, useState } from "react";

type Convo = {
  id: string;
  channel: string;
  transcript: string;
  summary: string | null;
  createdAt: string;
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Convo[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>جاري التحميل...</p>;
  if (conversations.length === 0) return <p className="text-gray-500">لسه مفيش محادثات مسجلة</p>;

  return (
    <div className="space-y-2">
      {conversations.map((c) => (
        <div key={c.id} className="border rounded-lg p-3">
          <div
            className="flex justify-between items-center cursor-pointer"
            onClick={() => setOpen(open === c.id ? null : c.id)}
          >
            <span className="font-medium">
              {c.channel === "voice" ? "📞 مكالمة" : "💬 واتساب"} —{" "}
              {new Date(c.createdAt).toLocaleString("ar-EG")}
            </span>
            <span className="text-sm text-gray-500">{open === c.id ? "▲" : "▼"}</span>
          </div>
          {c.summary && <p className="text-sm text-gray-600 mt-1">{c.summary}</p>}
          {open === c.id && (
            <pre className="mt-2 bg-gray-50 p-2 rounded text-sm whitespace-pre-wrap">
              {c.transcript}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
