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

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-4 pb-10">
        {[1,2,3,4].map(i => (
          <div key={i} className="bento-card p-4 space-y-2">
            <div className="shimmer h-6 w-1/3 rounded-md" />
            <div className="shimmer h-4 w-1/4 rounded-md" />
          </div>
        ))}
      </div>
    );
  }
  
  if (conversations.length === 0) {
    return (
      <div className="w-full max-w-7xl mx-auto pb-10 text-center py-20 font-bold" style={{ color: "var(--color-text-muted)" }}>
        لسه مفيش محادثات مسجلة
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-3 pb-10" dir="rtl">
      {conversations.map((c) => (
        <div key={c.id} className="bento-card p-4 sm:p-5 transition-all">
          <div
            className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 cursor-pointer group"
            onClick={() => setOpen(open === c.id ? null : c.id)}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm"
                style={{
                  background: c.channel === "voice" ? "rgba(128,82,255,0.15)" : "rgba(31,201,164,0.15)",
                  color: c.channel === "voice" ? "var(--color-brand)" : "#1fc9a4"
                }}
              >
                {c.channel === "voice" ? "📞" : "💬"}
              </div>
              <div>
                <h3 className="font-bold text-base" style={{ color: "var(--color-text-primary)" }}>
                  {c.channel === "voice" ? "مكالمة هاتفية" : "محادثة واتساب"}
                </h3>
                <span className="text-xs font-mono" style={{ color: "var(--color-text-muted)" }}>
                  {new Date(c.createdAt).toLocaleString("ar-EG")}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 mr-12 sm:mr-0">
              <span className="text-xs px-3 py-1.5 rounded-lg font-bold" style={{ background: "rgba(255,255,255,0.05)", color: "var(--color-text-secondary)" }}>
                {c.transcript.length} حرف
              </span>
              <span 
                className={`text-sm transition-transform duration-300 ${open === c.id ? 'rotate-180' : ''}`} 
                style={{ color: "var(--color-text-muted)" }}
              >
                ▼
              </span>
            </div>
          </div>
          
          {c.summary && (
            <p className="text-sm mt-3 leading-relaxed mr-12" style={{ color: "var(--color-text-secondary)" }}>
              {c.summary}
            </p>
          )}
          
          {open === c.id && (
            <div className="mt-4 pt-4 mr-12" style={{ borderTop: "1px solid var(--color-border-glass)" }}>
              <pre className="nested-card p-4 rounded-xl text-sm leading-relaxed whitespace-pre-wrap font-sans" style={{ color: "var(--color-text-primary)" }}>
                {c.transcript}
              </pre>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
