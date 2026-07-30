'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Loader2, Bot, User, Trash2, Mic, MicOff } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function TextChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'أهلاً بحضرتك! معاك المساعد الذكي لسيستم كاسبر 🎯 — قولي إيه اللي عايز تعمله، سجل مصروف؟ بيع؟ ميعاد؟',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
    const history = messages
      .filter((m) => m.role !== 'assistant' || messages.indexOf(m) !== 0)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });

      const data = await res.json() as { reply?: string; error?: string };

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.reply || data.error || 'حصل خطأ، حاول تاني!',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'مش قادر أتواصل مع السيرفر — تأكد إن السيرفر شغال', timestamp: new Date() },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    setMessages([
      {
        role: 'assistant',
        content: 'أهلاً بحضرتك! معاك المساعد الذكي لسيستم كاسبر 🎯 — قولي إيه اللي عايز تعمله!',
        timestamp: new Date(),
      },
    ]);
  }

  const quickActions = [
    'سجل مصروف بنزين 200 جنيه',
    'بعت منتج بـ 500 جنيه',
    'حجز ميعاد بكره الساعة 10',
    'وريني تقرير النهارده',
  ];

  return (
    <div className="flex flex-col h-[600px] bg-gradient-to-b from-slate-950 to-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-slate-950/60">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse"></span>
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">المساعد الذكي كاسبر</h3>
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
              متصل ومستعد الآن
            </p>
          </div>
        </div>
        <button
          onClick={clearChat}
          title="مسح المحادثة"
          className="p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-all"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-sm shadow-lg ${
              msg.role === 'user'
                ? 'bg-gradient-to-br from-sky-500 to-blue-600 shadow-sky-500/20'
                : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/20'
            }`}>
              {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
            </div>

            {/* Bubble */}
            <div className={`max-w-[75%] group`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-sky-500 to-blue-600 text-white rounded-tr-sm shadow-lg shadow-sky-500/10'
                  : 'bg-slate-800/80 text-slate-100 border border-slate-700/50 rounded-tl-sm'
              }`}>
                {msg.content}
              </div>
              <p className={`text-xs text-slate-600 mt-1 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                {msg.timestamp.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {/* Loading bubble */}
        {loading && (
          <div className="flex gap-3 flex-row">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-slate-800/80 border border-slate-700/50 px-4 py-3 rounded-2xl rounded-tl-sm">
              <div className="flex gap-1.5 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Actions */}
      {messages.length <= 2 && !loading && (
        <div className="px-4 pb-2">
          <p className="text-xs text-slate-500 mb-2 text-center">اختار من الاختصارات السريعة:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {quickActions.map((action) => (
              <button
                key={action}
                onClick={() => { setInput(action); inputRef.current?.focus(); }}
                className="text-xs bg-slate-800/80 border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl transition-all"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 border-t border-slate-800/80">
        <div className="flex items-end gap-2 bg-slate-800/60 border border-slate-700/80 focus-within:border-indigo-500/60 rounded-2xl px-4 py-3 transition-all">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب أمرك هنا... (Enter للإرسال)"
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 resize-none outline-none leading-relaxed max-h-24 overflow-y-auto"
            style={{ direction: 'rtl' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed flex items-center justify-center transition-all shadow-lg shadow-indigo-500/20 disabled:shadow-none"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
        <p className="text-center text-xs text-slate-600 mt-2">Shift+Enter للسطر الجديد • Enter للإرسال</p>
      </div>
    </div>
  );
}
