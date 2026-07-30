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
    <div className="space-y-6 max-w-4xl dir-rtl">
      {/* 🎙️ Voice Knowledge Ingestion Widget */}
      <div className="border border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-lg text-slate-800">التغذية الصوتية لقاعدة المعرفة (Voice RAG)</h2>
          </div>
          <span className="text-xs bg-indigo-100 text-indigo-700 font-medium px-2.5 py-1 rounded-full">
            WebM/Opus AI Ingest
          </span>
        </div>

        <p className="text-sm text-slate-600">
          سجل بصوتك أي معلومات عن مشاريعك، الأسعار، أو الأسئلة الشائعة للعملاء، وسيقوم الذكاء الاصطناعي بتفريغها واستخراج الأسئلة والأجوبة وتغذية الأيجنت بها تلقائياً!
        </p>

        <div className="flex items-center gap-3 pt-2">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isIngesting}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2.5 rounded-lg shadow transition disabled:opacity-50"
            >
              <Mic className="w-4 h-4" />
              ابدأ التسجيل الصوتي
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2.5 rounded-lg shadow transition animate-pulse"
            >
              <Square className="w-4 h-4 fill-current" />
              إيقاف ومعالجة التسجيل
            </button>
          )}

          {ingestStatus && (
            <p className="text-sm font-medium text-slate-700 bg-white/80 border px-3 py-2 rounded-lg flex-1">
              {ingestStatus}
            </p>
          )}
        </div>
      </div>

      {/* Manual Input Section */}
      <div className="border rounded-xl p-5 space-y-4 bg-white shadow-sm">
        <h2 className="font-semibold text-slate-800">إضافة معلومة كتابياً</h2>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="السؤال المتوقع من العميل"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="الإجابة التفصيلية التي سيرد بها الأيجنت"
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="كلمات مفتاحية (مفصولة بفاصلة)"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <button
          onClick={add}
          className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-4 py-2 rounded-lg text-sm transition"
        >
          إضافة لقاعدة المعرفة
        </button>
      </div>

      {/* Existing Knowledge Items List */}
      <div className="space-y-3">
        <h3 className="font-semibold text-slate-800 text-base">الأسئلة والأجوبة المسجلة ({items.length})</h3>

        {loading ? (
          <p className="text-sm text-slate-500">جاري التحميل...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-slate-500">لا توجد أسئلة مسجلة حالياً.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="border rounded-xl p-4 bg-white flex justify-between gap-4 shadow-sm">
                <div className="space-y-1">
                  <p className="font-semibold text-slate-800">{item.question}</p>
                  <p className="text-sm text-slate-600">{item.answer}</p>
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
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {parsedKw.map((kw, i) => (
                          <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            #{kw}
                          </span>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <button
                  onClick={() => remove(item.id)}
                  className="text-red-500 hover:text-red-700 text-sm p-1 hover:bg-red-50 rounded transition"
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
