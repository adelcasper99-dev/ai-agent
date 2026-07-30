'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Loader2, Bot, User, Trash2, Phone, Mic, Square, Play, Pause, Volume2, Sparkles } from 'lucide-react';
import VoiceCallModal from '@/components/VoiceCallModal';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'voice';
  content: string;
  audioUrl?: string;
  transcript?: string;
  timestamp: Date;
}

export default function TelegramSimulator() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      type: 'text',
      content: 'أهلاً يا باشا! 🤖 محاكي بوت التليجرام شغال جاهز. تقدر تتكلم معايا فويس، تكتب، أو تضغط "اتصال مباشر" للمكالمات الحية!',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Handle Recording Timer
  useEffect(() => {
    if (isRecording) {
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  // 1. Text Message Sending
  async function sendText() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      type: 'text',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json() as { reply?: string; error?: string };

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        type: 'text',
        content: data.reply || data.error || 'حصل خطأ، حاول تاني!',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'assistant', type: 'text', content: 'خطأ في الاتصال بالسيرفر', timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  // 2. Voice Note Recording & Sending
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await sendVoiceNote(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      alert('لم يتم التمكن من الوصول إلى الميكروفون!');
      console.error(e);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  async function sendVoiceNote(blob: Blob) {
    setLoading(true);
    const userMsgId = Date.now().toString();

    // Create user voice note placeholder
    const userVoiceMsg: Message = {
      id: userMsgId,
      role: 'user',
      type: 'voice',
      content: '🎙️ رسالة صوتية',
      audioUrl: URL.createObjectURL(blob),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userVoiceMsg]);

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const res = await fetch('/api/telegram/sim-voice', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json() as {
        userTranscript?: string;
        replyText?: string;
        audioUrl?: string;
        error?: string;
      };

      if (data.userTranscript) {
        // Update user message transcript
        setMessages((prev) =>
          prev.map((m) => (m.id === userMsgId ? { ...m, transcript: data.userTranscript } : m))
        );
      }

      // Add assistant voice response
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        type: 'voice',
        content: data.replyText || data.error || 'تم استلام الفويس بنجاح',
        audioUrl: data.audioUrl,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Auto play reply audio
      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audio.play().catch(() => {});
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'assistant', type: 'text', content: 'فشل معالجة الفويس نوت', timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function toggleAudioPlayback(msgId: string, url?: string) {
    if (!url) return;
    if (playingAudioId === msgId) {
      setPlayingAudioId(null);
    } else {
      setPlayingAudioId(msgId);
      const audio = new Audio(url);
      audio.onended = () => setPlayingAudioId(null);
      audio.play().catch(() => setPlayingAudioId(null));
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  }

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  return (
    <div className="flex flex-col h-[650px] max-w-2xl mx-auto bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl" dir="rtl">
      {/* Telegram Top Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse"></span>
          </div>
          <div>
            <h3 className="font-bold text-white text-base flex items-center gap-1.5">
              Casper ERP Telegram Bot
              <span className="text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded-full">
                Simulator
              </span>
            </h3>
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
              أونلاين ومتصل الآن (Text • Voice • Call)
            </p>
          </div>
        </div>

        {/* Live Call Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCallOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-105 active:scale-95"
          >
            <Phone className="w-4 h-4 animate-bounce" />
            <span>اتصال مباشر 📞</span>
          </button>
          <button
            onClick={() => setMessages([messages[0]])}
            title="مسح المحادثة"
            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-md ${
              msg.role === 'user'
                ? 'bg-gradient-to-br from-sky-500 to-blue-600'
                : 'bg-gradient-to-br from-indigo-500 to-violet-600'
            }`}>
              {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
            </div>

            {/* Bubble */}
            <div className="max-w-[80%] space-y-1">
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-tr-sm shadow-lg shadow-sky-500/10'
                  : 'bg-slate-800/90 text-slate-100 border border-slate-700/60 rounded-tl-sm shadow-lg'
              }`}>
                {/* Voice Note Layout */}
                {msg.type === 'voice' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/40">
                      <button
                        onClick={() => toggleAudioPlayback(msg.id, msg.audioUrl)}
                        className="w-8 h-8 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white flex items-center justify-center transition-all"
                      >
                        {playingAudioId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                      </button>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-medium">
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>رسالة صوتية (Voice Note)</span>
                        </div>
                        {msg.transcript && (
                          <p className="text-[11px] text-slate-400 italic mt-0.5">"{msg.transcript}"</p>
                        )}
                      </div>
                    </div>
                    {msg.content && <p className="text-sm pt-1">{msg.content}</p>}
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>

              <p className={`text-[10px] text-slate-500 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                {msg.timestamp.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading animation */}
        {loading && (
          <div className="flex gap-3 flex-row items-center">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-slate-800/90 border border-slate-700/60 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 animate-spin" />
              <span className="text-xs text-indigo-300">جاري المعالجة والرد...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Bottom Actions & Input */}
      <div className="p-3 bg-slate-950/90 border-t border-slate-800/80 backdrop-blur-md">
        {/* Recording active banner */}
        {isRecording ? (
          <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/30 px-4 py-3 rounded-2xl animate-pulse">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-rose-500 rounded-full animate-ping"></span>
              <span className="text-xs font-bold text-rose-400">جاري تسجيل الفويس نوت... ({formatTime(recordingTime)})</span>
            </div>
            <button
              onClick={stopRecording}
              className="bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
            >
              <Square className="w-3.5 h-3.5 fill-white" />
              إرسال الصوت 🚀
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2 bg-slate-900/80 border border-slate-700/70 focus-within:border-sky-500/70 rounded-2xl px-3 py-2 transition-all">
            {/* Record Mic Button */}
            <button
              onClick={startRecording}
              disabled={loading}
              title="تسجيل رسالة صوتية (Voice Note)"
              className="flex-shrink-0 p-2 text-slate-400 hover:text-sky-400 hover:bg-slate-800 rounded-xl transition-all"
            >
              <Mic className="w-5 h-5" />
            </button>

            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب رسالتك أو سجل فويس..."
              disabled={loading}
              className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 resize-none outline-none leading-relaxed max-h-20 overflow-y-auto"
              style={{ direction: 'rtl' }}
            />

            {/* Send Text Button */}
            <button
              onClick={sendText}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 p-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 text-white disabled:text-slate-600 transition-all shadow-md shadow-sky-500/20 disabled:shadow-none"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Embedded Live Call Modal */}
      <VoiceCallModal
        isOpen={isCallOpen}
        mode="customer_service"
        onClose={() => setIsCallOpen(false)}
      />
    </div>
  );
}
