// app/dashboard/logs/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";

interface ParsedLog {
  id: number;
  time: string;
  type: 'error' | 'warning' | 'info' | 'user' | 'assistant' | 'success';
  title: string;
  detail: string;
  raw: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'translated' | 'raw'>('translated');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const [clearing, setClearing] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  async function fetchLogs() {
    try {
      const res = await fetch("/api/logs");
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error("Failed to fetch logs", e);
    }
  }

  async function clearLogs() {
    if (!confirm("هل أنت متأكد من تصفير ومسح السجلات القديمة؟")) return;
    setClearing(true);
    try {
      await fetch("/api/logs", { method: "DELETE" });
      setLogs(["تم تصفير السجلات بنجاح ✨"]);
    } catch (e) {
      console.error("Failed to clear logs", e);
    } finally {
      setClearing(false);
    }
  }

  function copyLogs() {
    const text = logs.join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchLogs();
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  useEffect(() => {
    if (autoRefresh) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoRefresh, viewMode]);

  // Translator parser
  const parsedLogs: ParsedLog[] = [];
  logs.forEach((line, idx) => {
    if (!line.trim()) return;

    const timeMatch = line.match(/\d{2}:\d{2}:\d{2}/);
    const time = timeMatch ? timeMatch[0] : "";

    if (line.includes("insufficient_quota") || line.includes("exceeded your current quota")) {
      parsedLogs.push({
        id: idx, time, type: 'error',
        title: '🚨 انتهى رصيد الـ API (Quota Exceeded)',
        detail: 'رصيد حساب OpenAI أو المزود الحالي قد انتهى. يرجى شحن الرصيد أو التبديل لـ Groq Pipeline من الإعدادات.',
        raw: line
      });
    } else if (line.includes("DefaultCredentialsError")) {
      parsedLogs.push({
        id: idx, time, type: 'warning',
        title: '⚠️ اعتمادات Google Cloud مفقودة',
        detail: 'محرك Google TTS يحتاج اعتمادات سحابية GCP. تم التبديل التلقائي لمحرك آخر لتفادي التعطيل.',
        raw: line
      });
    } else if (line.includes("GROQ_API_KEY is required")) {
      parsedLogs.push({
        id: idx, time, type: 'error',
        title: '🚨 مفتاح Groq مفقود',
        detail: 'يرجى كتابة مفتاح Groq API Key وحفظه من صفحة الإعدادات أولاً.',
        raw: line
      });
    } else if (line.includes("user_transcript")) {
      const match = line.match(/"user_transcript":\s*"([^"]+)"/);
      const text = match ? match[1] : line;
      parsedLogs.push({
        id: idx, time, type: 'user',
        title: '🗣️ العميل يـتحدث:',
        detail: `"${text}"`,
        raw: line
      });
    } else if (line.includes("conversation_item_added") && line.includes('"assistant"')) {
      const match = line.match(/"text":\s*"([^"]+)"/);
      const text = match ? match[1] : line;
      parsedLogs.push({
        id: idx, time, type: 'assistant',
        title: '🤖 المساعد الصوتي يـرد:',
        detail: `"${text}"`,
        raw: line
      });
    } else if (line.includes("registered worker") || line.includes("starting worker")) {
      parsedLogs.push({
        id: idx, time, type: 'success',
        title: '🟢 سيرفر الصوت متصل وجاهز',
        detail: 'المساعد جاهز لاستقبال المكالمات والربط مع LiveKit بنجاح.',
        raw: line
      });
    } else if (line.includes("received job request")) {
      parsedLogs.push({
        id: idx, time, type: 'info',
        title: '📞 مكالمة جديدة بدأت الآن',
        detail: 'جاري فتح الخط وتوصيل العميل بالمساعد الصوتي...',
        raw: line
      });
    } else if (line.includes("closing agent session")) {
      parsedLogs.push({
        id: idx, time, type: 'info',
        title: '📴 انتهت المكالمة',
        detail: 'تم إغلاق الخط وحفظ المحادثة بنجاح.',
        raw: line
      });
    } else if (line.includes("ERROR") || line.includes("CRITICAL") || line.includes("Exception") || line.includes("error")) {
      parsedLogs.push({
        id: idx, time, type: 'error',
        title: '🚨 تنبيه خطأ في النظام',
        detail: line,
        raw: line
      });
    }
  });

  // Shared action button styles
  const actionBtn = (variant: "default" | "brand" | "danger") => ({
    default: {
      background: "#fff",
      color: "var(--color-text-secondary)",
      border: "1px solid var(--color-border-subtle)",
    },
    brand: {
      background: "var(--color-brand)",
      color: "#fff",
      border: "none",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    },
    danger: {
      background: "#fef2f2",
      color: "var(--color-danger)",
      border: "1px solid #fca5a5",
    }
  }[variant]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4 pb-10" dir="rtl">
      {/* Header controls */}
      <div className="bento-card p-4 sm:p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="font-bold text-lg" style={{ color: "var(--color-text-primary)" }}>مُترجم سجلات السيرفر الذكي 📡</h2>
          <p className="text-xs mt-1" style={{ color: "var(--color-text-muted)" }}>تحويل اللوجز المعقدة لأحداث وتنبيهات مبسطة بالعربي تفهمها بسهولة</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Mode Switcher */}
          <div className="flex text-xs font-bold p-1 rounded-xl" style={{ background: "rgba(0,0,0,0.05)" }}>
            <button
              onClick={() => setViewMode('translated')}
              className="px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: viewMode === 'translated' ? '#fff' : 'transparent',
                color: viewMode === 'translated' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                boxShadow: viewMode === 'translated' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              مبسط بالعربي 💡
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className="px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: viewMode === 'raw' ? '#fff' : 'transparent',
                color: viewMode === 'raw' ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                boxShadow: viewMode === 'raw' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              تقني (Code) 💻
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer" style={{ color: "var(--color-text-secondary)" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded accent-purple-500"
            />
            تحديث تلقائي
          </label>

          <button
            onClick={copyLogs}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
            style={actionBtn("default")}
          >
            {copied ? "تم النسخ ✓" : "نسخ 📋"}
          </button>

          <button
            onClick={clearLogs}
            disabled={clearing}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
            style={actionBtn("danger")}
          >
            {clearing ? "..." : "مسح 🗑️"}
          </button>
        </div>
      </div>

      {/* Logs Content View */}
      {viewMode === 'translated' ? (
        <div className="bento-card space-y-3 h-[600px] overflow-y-auto p-4 sm:p-5">
          {parsedLogs.length === 0 ? (
            <p className="text-center py-20 font-bold" style={{ color: "var(--color-text-muted)" }}>لا توجد أحداث أو أخطاء حالياً.. السيرفر يعمل بهدوء 🟢</p>
          ) : (
            parsedLogs.map((log) => {
              const styleMap = {
                error: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626' },
                warning: { bg: '#fffbeb', border: '#fde68a', text: '#d97706' },
                user: { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb' },
                assistant: { bg: '#faf5ff', border: '#e9d5ff', text: '#9333ea' },
                success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#059669' },
                info: { bg: '#f8fafc', border: '#e2e8f0', text: 'var(--color-text-secondary)' }
              };
              const s = styleMap[log.type];

              return (
                <div key={log.id} className="p-4 rounded-xl border space-y-1.5 transition-all hover:bg-opacity-80" style={{ background: s.bg, borderColor: s.border }}>
                  <div className="flex justify-between items-center font-bold text-sm" style={{ color: s.text }}>
                    <span>{log.title}</span>
                    {log.time && <span className="text-xs opacity-75 font-mono dir-ltr">{log.time}</span>}
                  </div>
                  <p className="text-sm leading-relaxed font-medium" style={{ color: "var(--color-text-secondary)" }}>{log.detail}</p>
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      ) : (
        /* Raw Technical View */
        <div className="bento-card p-4 sm:p-5 h-[600px] overflow-y-auto font-mono text-xs leading-relaxed whitespace-pre-wrap dir-ltr text-left">
          {logs.map((line, idx) => {
            let color = "var(--color-text-secondary)";
            let bg = "transparent";
            
            if (line.includes("ERROR") || line.includes("CRITICAL") || line.includes("Exception") || line.includes("Error")) {
              color = "var(--color-danger)";
              bg = "#fef2f2";
            } else if (line.includes("WARNING")) {
              color = "#d97706";
            } else if (line.includes("INFO")) {
              color = "#059669";
            }

            return (
              <div key={idx} className="py-1 px-2 rounded mb-0.5 border-b border-gray-100 transition-colors" style={{ color, background: bg }}>
                {line}
              </div>
            );
          })}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}
