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
    if (!confirm("هل أنت تأكد من تصفير ومسح السجلات القديمة؟")) return;
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
        id: idx,
        time,
        type: 'error',
        title: '🚨 انتهى رصيد الـ API (Quota Exceeded)',
        detail: 'رصيد حساب OpenAI أو المزود الحالي قد انتهى. يرجى شحن الرصيد أو التبديل لـ Groq Pipeline من الإعدادات.',
        raw: line
      });
    } else if (line.includes("DefaultCredentialsError")) {
      parsedLogs.push({
        id: idx,
        time,
        type: 'warning',
        title: '⚠️ اعتمادات Google Cloud مفقودة',
        detail: 'محرك Google TTS يحتاج اعتمادات سحابية GCP. تم التبديل التلقائي لمحرك آخر لتفادي التعطيل.',
        raw: line
      });
    } else if (line.includes("GROQ_API_KEY is required")) {
      parsedLogs.push({
        id: idx,
        time,
        type: 'error',
        title: '🚨 مفتاح Groq مفقود',
        detail: 'يرجى كتابة مفتاح Groq API Key وحفظه من صفحة الإعدادات أولاً.',
        raw: line
      });
    } else if (line.includes("user_transcript")) {
      const match = line.match(/"user_transcript":\s*"([^"]+)"/);
      const text = match ? match[1] : line;
      parsedLogs.push({
        id: idx,
        time,
        type: 'user',
        title: '🗣️ العميل يـتحدث:',
        detail: `"${text}"`,
        raw: line
      });
    } else if (line.includes("conversation_item_added") && line.includes('"assistant"')) {
      const match = line.match(/"text":\s*"([^"]+)"/);
      const text = match ? match[1] : line;
      parsedLogs.push({
        id: idx,
        time,
        type: 'assistant',
        title: '🤖 المساعد الصوتي يـرد:',
        detail: `"${text}"`,
        raw: line
      });
    } else if (line.includes("registered worker") || line.includes("starting worker")) {
      parsedLogs.push({
        id: idx,
        time,
        type: 'success',
        title: '🟢 سيرفر الصوت متصل وجاهز',
        detail: 'المساعد جاهز لاستقبال المكالمات والربط مع LiveKit بنجاح.',
        raw: line
      });
    } else if (line.includes("received job request")) {
      parsedLogs.push({
        id: idx,
        time,
        type: 'info',
        title: '📞 مكالمة جديدة بدأت الآن',
        detail: 'جاري فتح الخط وتوصيل العميل بالمساعد الصوتي...',
        raw: line
      });
    } else if (line.includes("closing agent session")) {
      parsedLogs.push({
        id: idx,
        time,
        type: 'info',
        title: '📴 انتهت المكالمة',
        detail: 'تم إغلاق الخط وحفظ المحادثة بنجاح.',
        raw: line
      });
    } else if (line.includes("ERROR") || line.includes("CRITICAL") || line.includes("Exception")) {
      parsedLogs.push({
        id: idx,
        time,
        type: 'error',
        title: '🚨 تنبيه خطأ في النظام',
        detail: line,
        raw: line
      });
    }
  });

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex flex-wrap justify-between items-center bg-slate-100 p-4 rounded-xl border gap-3">
        <div>
          <h2 className="font-bold text-lg text-slate-800">مُترجم سجلات السيرفر الذكي 📡</h2>
          <p className="text-xs text-slate-500">تحويل اللوجز المعقدة لأحداث وتنبيهات مبسطة بالعربي تفهمها بسهولة</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="bg-slate-200 p-1 rounded-lg flex text-xs font-bold ml-2">
            <button
              onClick={() => setViewMode('translated')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'translated' ? 'bg-white text-blue-600 shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              مبسط بالعربي 💡
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1 rounded-md transition-all ${
                viewMode === 'raw' ? 'bg-white text-blue-600 shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              تقني (Code) 💻
            </button>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600"
            />
            تحديث تلقائي
          </label>

          <button
            onClick={copyLogs}
            className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-900 shadow"
          >
            {copied ? "تم النسخ ✓" : "نسخ 📋"}
          </button>

          <button
            onClick={clearLogs}
            disabled={clearing}
            className="bg-red-100 text-red-700 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-200 shadow-sm"
          >
            {clearing ? "..." : "مسح 🗑️"}
          </button>
        </div>
      </div>

      {/* Logs Content View */}
      {viewMode === 'translated' ? (
        <div className="space-y-2 h-[500px] overflow-y-auto p-3 bg-slate-50 rounded-xl border shadow-inner">
          {parsedLogs.length === 0 ? (
            <p className="text-center text-slate-400 py-20 font-bold">لا توجد أحداث أو أخطاء حالياً.. السيرفر يعمل بهدوء 🟢</p>
          ) : (
            parsedLogs.map((log) => {
              const bgMap = {
                error: 'bg-red-50 border-red-200 text-red-900',
                warning: 'bg-amber-50 border-amber-200 text-amber-900',
                user: 'bg-blue-50 border-blue-200 text-blue-900',
                assistant: 'bg-purple-50 border-purple-200 text-purple-900',
                success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
                info: 'bg-slate-100 border-slate-200 text-slate-800'
              };

              return (
                <div key={log.id} className={`p-3 rounded-xl border ${bgMap[log.type]} shadow-sm space-y-1`}>
                  <div className="flex justify-between items-center font-bold text-sm">
                    <span>{log.title}</span>
                    {log.time && <span className="text-xs opacity-75 font-mono dir-ltr">{log.time}</span>}
                  </div>
                  <p className="text-xs leading-relaxed font-medium">{log.detail}</p>
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      ) : (
        /* Raw Technical View */
        <div className="bg-slate-950 text-green-400 font-mono p-4 rounded-xl text-xs h-[500px] overflow-y-auto shadow-inner leading-relaxed whitespace-pre-wrap border border-slate-800 dir-ltr text-left">
          {logs.map((line, idx) => {
            let colorClass = "text-slate-300";
            if (line.includes("ERROR") || line.includes("CRITICAL") || line.includes("Exception") || line.includes("Error")) {
              colorClass = "text-red-400 font-bold bg-red-950/50 px-1 rounded";
            } else if (line.includes("WARNING")) {
              colorClass = "text-yellow-400 font-semibold";
            } else if (line.includes("INFO")) {
              colorClass = "text-cyan-300";
            }

            return (
              <div key={idx} className={`${colorClass} py-0.5 border-b border-slate-900/40 hover:bg-slate-900 px-2 rounded transition-colors`}>
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
