// app/dashboard/data/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { Mic, Square, Upload, Sparkles, Trash2 } from "lucide-react";

type Item = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
};

export default function DataPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(true);

  // Voice Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  function load() {
    fetch("/api/knowledge")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function add() {
    if (!question.trim() || !answer.trim()) return;
    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        answer,
        keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      }),
    });
    setQuestion("");
    setAnswer("");
    setKeywords("");
    load();
  }

  async function remove(id: string) {
    await fetch("/api/knowledge", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  // 🎙️ Voice Recording & Auto-Ingest Pipeline (WebM/Opus)
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Enforce webm/opus compression
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        // Stop stream tracks
        stream.getTracks().forEach((track) => track.stop());

        // Check size limit (4MB limit guard)
        if (audioBlob.size > 4 * 1024 * 1024) {
          setIngestStatus("⚠️ التسجيل الصوتي كبير جداً (أكثر من 4 ميجابايت). سجل فترة أقصر.");
          return;
        }

        await uploadVoiceIngest(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIngestStatus("🎙️ جاري التسجيل الصوتي... اضغط إيقاف للتفريغ التلقائي.");
    } catch (err) {
      console.error(err);
      setIngestStatus("❌ فشل الوصول للميكروفون.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function uploadVoiceIngest(blob: Blob) {
    setIsIngesting(true);
    setIngestStatus("⏳ جاري تفريغ الصوت بالذكاء الاصطناعي واستخراج قاعدة المعرفة...");

    try {
      const formData = new FormData();
      formData.append("audio", blob, "voice_feed.webm");

      const res = await fetch("/api/knowledge/voice-ingest", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIngestStatus(`✨ تم بنجاح! استخراج وتغذية ${data.extractedCount} معلومة جديدة في قاعدة المعرفة.`);
        load();
      } else {
        setIngestStatus(`❌ خطأ: ${data.error || "فشلت المعالجة"}`);
      }
    } catch (err) {
      console.error(err);
      setIngestStatus("❌ حصل خطأ في الاتصال بالخادم.");
    } finally {
      setIsIngesting(false);
    }
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-10 dir-rtl">
      {/* 🎙️ Voice Knowledge Ingestion Widget */}
      <div className="bento-card p-5 sm:p-6 space-y-4" style={{ border: "1px solid rgba(128,82,255,0.25)" }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-brand/10" style={{ background: "rgba(128,82,255,0.15)", color: "var(--color-brand)" }}>
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="font-bold text-lg" style={{ color: "var(--color-text-primary)" }}>التغذية الصوتية لقاعدة المعرفة (Voice RAG)</h2>
          </div>
          <span className="text-[10px] font-bold px-3 py-1.5 rounded-full" style={{ background: "rgba(128,82,255,0.1)", color: "var(--color-brand)" }}>
            WebM/Opus AI Ingest
          </span>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
          سجل بصوتك أي معلومات عن مشاريعك، الأسعار، أو الأسئلة الشائعة للعملاء، وسيقوم الذكاء الاصطناعي بتفريغها واستخراج الأسئلة والأجوبة وتغذية الأيجنت بها تلقائياً!
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isIngesting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 font-bold px-6 py-3 rounded-xl transition-all disabled:opacity-50"
              style={{ background: "var(--color-brand)", color: "#fff", boxShadow: "var(--shadow-glow)" }}
            >
              <Mic className="w-4 h-4" />
              ابدأ التسجيل الصوتي
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="w-full sm:w-auto flex items-center justify-center gap-2 font-bold px-6 py-3 rounded-xl transition-all animate-pulse"
              style={{ background: "var(--color-danger)", color: "#fff", boxShadow: "0 0 15px rgba(229,72,77,0.3)" }}
            >
              <Square className="w-4 h-4 fill-current" />
              إيقاف ومعالجة التسجيل
            </button>
          )}

          {ingestStatus && (
            <p className="text-sm font-bold w-full sm:flex-1 px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--color-border-glass)", color: "var(--color-text-primary)" }}>
              {ingestStatus}
            </p>
          )}
        </div>
      </div>

      {/* Manual Input Section */}
      <div className="bento-card p-5 sm:p-6 space-y-4">
        <h2 className="font-bold" style={{ color: "var(--color-text-primary)" }}>إضافة معلومة كتابياً</h2>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="السؤال المتوقع من العميل"
          className="glass-input text-sm"
        />
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="الإجابة التفصيلية التي سيرد بها الأيجنت"
          rows={3}
          className="glass-input text-sm"
        />
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="كلمات مفتاحية (مفصولة بفاصلة)"
          className="glass-input text-sm"
        />
        <button
          onClick={add}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold transition-all"
          style={{ background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          إضافة لقاعدة المعرفة
        </button>
      </div>

      {/* Existing Knowledge Items List */}
      <div className="space-y-4 pt-4">
        <h3 className="font-bold text-lg" style={{ color: "var(--color-text-primary)" }}>الأسئلة والأجوبة المسجلة ({items.length})</h3>

        {loading ? (
          <div className="flex gap-4 overflow-hidden">
            {[1,2,3].map(i => (
              <div key={i} className="bento-card p-5 w-full space-y-3">
                <div className="shimmer h-5 w-1/2 rounded" />
                <div className="shimmer h-4 w-3/4 rounded" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bento-card p-10 text-center border-dashed">
            <p className="text-sm font-bold" style={{ color: "var(--color-text-muted)" }}>لا توجد أسئلة مسجلة حالياً.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map((item) => (
              <div key={item.id} className="bento-card p-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <p className="font-bold text-base" style={{ color: "var(--color-text-primary)" }}>{item.question}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>{item.answer}</p>
                  {(() => {
                    let parsedKw: string[] = [];
                    const kwData: unknown = item.keywords;
                    if (Array.isArray(kwData)) {
                      parsedKw = kwData.map(String);
                    } else if (typeof kwData === "string" && kwData.trim().length > 0) {
                      try {
                        const parsed = JSON.parse(kwData);
                        if (Array.isArray(parsed)) parsedKw = parsed.map(String);
                        else parsedKw = [String(parsed)];
                      } catch {
                        parsedKw = kwData.split(",").map((k) => k.trim()).filter(Boolean);
                      }
                    }
                    if (!parsedKw || parsedKw.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {parsedKw.map((kw, i) => (
                          <span key={i} className="text-xs font-bold px-2 py-1 rounded" style={{ background: "rgba(255,255,255,0.05)", color: "var(--color-text-muted)" }}>
                            #{kw}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <button
                  onClick={() => remove(item.id)}
                  className="self-end text-sm p-2 rounded-lg transition-all"
                  style={{ color: "var(--color-danger)", background: "rgba(229,72,77,0.1)" }}
                  title="حذف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
