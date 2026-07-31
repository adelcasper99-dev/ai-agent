'use client';

import { useState, useEffect, useRef } from 'react';
import { Headphones, Briefcase, PhoneOff, ShieldCheck, Sparkles, Activity, AlertCircle, User, Bot, Radio, Copy, Check } from 'lucide-react';
import { Room, RoomEvent, Track } from 'livekit-client';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  title?: string;
  isSuccessCard?: boolean;
}

interface VoiceCallModalProps {
  isOpen: boolean;
  mode: 'customer_service' | 'personal_assistant';
  onClose: () => void;
}

export default function VoiceCallModal({ isOpen, mode, onClose }: VoiceCallModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [status, setStatus] = useState<'INITIALIZING' | 'CONNECTING' | 'CONNECTED' | 'ERROR' | 'DISCONNECTED'>('INITIALIZING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [agentState, setAgentState] = useState<'LISTENING' | 'THINKING' | 'EXECUTING' | 'SPEAKING'>('LISTENING');
  const [tickerDetail, setTickerDetail] = useState<string>('جاري استماع الماكروفون...');
  
  const roomRef = useRef<Room | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const isAssistant = mode === 'personal_assistant';

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!isOpen) {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      setStatus('INITIALIZING');
      setErrorMessage(null);
      setMessages([]);
      return;
    }

    let isSubscribed = true;

    async function startCall() {
      try {
        setStatus('CONNECTING');
        setErrorMessage(null);

        // Fetch LiveKit AccessToken
        const res = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'فشل الحصول على توكن المحادثة الصوتية.');
        }

        if (!isSubscribed) return;

        setRoomName(data.roomName);

        // Connect to LiveKit Room
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });

        roomRef.current = room;

        room.on(RoomEvent.Connected, () => {
          if (isSubscribed) {
            setStatus('CONNECTED');
            setAgentState('SPEAKING');
            setTickerDetail('يتحدث المساعد الصوتي...');
            room.startAudio().catch((e) => console.warn("LiveKit startAudio warning:", e));
          }
        });

        room.on(RoomEvent.DataReceived, (payload) => {
          try {
            const text = new TextDecoder().decode(payload);
            const data = JSON.parse(text);
            if (data.type === 'error') {
              setStatus('ERROR');
              setErrorMessage(data.message);
            }
          } catch (e) {}
        });

        room.on(RoomEvent.Disconnected, () => {
          if (isSubscribed) {
            setStatus('DISCONNECTED');
            setTimeout(() => {
              if (isSubscribed) onClose();
            }, 1200);
          }
        });

        room.on(RoomEvent.TrackSubscribed, (track: Track) => {
          if (track.kind === Track.Kind.Audio) {
            const audioElement = track.attach();
            audioElement.id = 'livekit-agent-audio';
            audioElement.autoplay = true;
            document.body.appendChild(audioElement);
            audioElement.play().catch((err) => {
              console.warn("Browser audio autoplay blocked, attempting unlock:", err);
              const unlock = () => {
                audioElement.play();
                document.removeEventListener("click", unlock);
              };
              document.addEventListener("click", unlock);
            });
          }
        });

        // Listen for Real-Time Live Transcripts & Event Tickers via LiveKit Data Channel
        // ✅ Full 4-arg signature per livekit-client SDK: (payload, participant, kind, topic)
        room.on(RoomEvent.DataReceived, (payload: Uint8Array, _participant: unknown, _kind: unknown, topic: string | undefined) => {
          // Filter: only process packets tagged for the voice agent
          if (topic && topic !== 'casper-voice-events') return;
          try {
            const decoder = new TextDecoder();
            const jsonStr = decoder.decode(payload);
            const packet = JSON.parse(jsonStr);

            if (packet.type === 'ACTION_SUCCESS') {
              const newMsg: ChatMessage = {
                id: Math.random().toString(36).substring(2, 9),
                role: 'assistant',
                title: packet.title || '✅ تم الحفظ بالسيستم',
                text: packet.text,
                timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                isSuccessCard: true,
              };
              setMessages(prev => [...prev, newMsg]);
              setAgentState('EXECUTING');
              setTickerDetail('✅ ' + (packet.title || 'تم التسجيل بالتقارير بنجاح'));
            } else if (packet.type === 'TRANSCRIPT') {
              const newMsg: ChatMessage = {
                id: Math.random().toString(36).substring(2, 9),
                role: packet.role === 'assistant' ? 'assistant' : 'user',
                text: packet.text,
                timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
              };
              setMessages(prev => [...prev, newMsg]);
            } else if (packet.type === 'EVENT_TICKER') {
              const stateMap: Record<string, 'LISTENING' | 'THINKING' | 'EXECUTING' | 'SPEAKING'> = {
                LISTENING: 'LISTENING', THINKING: 'THINKING', EXECUTING: 'EXECUTING', SPEAKING: 'SPEAKING',
              };
              const mappedState = stateMap[packet.state as string];
              if (mappedState) setAgentState(mappedState);
              if (packet.detail) setTickerDetail(packet.detail);
            }
          } catch (e) {
            console.warn('[LiveKit Data Parsing Warning]:', e);
          }
        });

        await room.connect(data.wsUrl, data.token);

        // Enable local microphone with WebRTC Noise Suppression & Echo Cancellation
        try {
          await room.localParticipant.setMicrophoneEnabled(true, {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          });
        } catch (micErr: unknown) {
          const name = micErr instanceof Error ? micErr.name : '';
          if (name === 'NotAllowedError') {
            throw new Error('يرجى السماح بالوصول للميكروفون في إعدادات المتصفح ثم أعد المحاولة.');
          }
          throw micErr;
        }

      } catch (err: any) {
        console.error('[Voice Modal Connect Error]:', err);
        if (isSubscribed) {
          setStatus('ERROR');
          let errorText = err.message || 'تعذر الاتصال بخادم الصوت الحي.';
          if (errorText.includes('invalid API key')) {
            errorText = 'مفتاح LiveKit غير صحيح. راجع صفحة الإعدادات وتأكد من المفاتيح.';
          } else if (errorText.includes('quota')) {
            errorText = 'لقد استنفذت رصيد الذكاء الاصطناعي (Quota Exceeded).';
          }
          setErrorMessage(errorText);
        }
      }
    }

    startCall();

    const handleUnload = () => {
      if (roomRef.current) {
        try {
          roomRef.current.disconnect();
        } catch (e) {
          console.warn('[Ungraceful Disconnect Best-Effort Warning]:', e);
        }
        roomRef.current = null;
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
      isSubscribed = false;
      if (roomRef.current) {
        try {
          roomRef.current.disconnect();
        } catch (e) {}
        roomRef.current = null;
      }
    };
  }, [isOpen, mode, onClose]);

  if (!isOpen) return null;

  const handleHangUp = () => {
    if (roomRef.current) {
      try {
        roomRef.current.disconnect();
      } catch (e) {
        console.warn('[Graceful HangUp Disconnect Warning]:', e);
      }
      roomRef.current = null;
    }
    setStatus('DISCONNECTED');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 dir-rtl">
      <div className={`w-full max-w-xl rounded-3xl p-6 md:p-8 shadow-2xl border flex flex-col items-center text-center space-y-5 transition-all ${
        isAssistant
          ? 'bg-gradient-to-b from-[#180a2c] via-[#120822] to-[#0a0414] border-purple-500/50 shadow-purple-950/60'
          : 'bg-gradient-to-b from-[#09182b] via-[#071324] to-[#040a14] border-blue-500/50 shadow-blue-950/60'
      }`}>
        
        {/* Header Icon */}
        <div className="relative">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border shadow-xl ${
            isAssistant
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-purple-950/80'
              : 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-blue-950/80'
          }`}>
            {isAssistant ? <Briefcase className="w-8 h-8" /> : <Headphones className="w-8 h-8" />}
          </div>
          {status === 'CONNECTED' && (
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
            </span>
          )}
        </div>

        {/* Title & Badge */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h3 className="text-lg font-black text-white">
              {isAssistant ? 'المساعد الشخصي الذكي لـ Casper ERP' : 'محاكاة دعم كاسبر الحي'}
            </h3>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xs text-slate-400">
            {isAssistant
              ? 'تسجيل مصاريف ومبيعات ومراجعة الحسابات صوتاً للمدير'
              : 'الرد على استفسارات عملاء المحل والصيانة بالعامية المصرية'}
          </p>
        </div>

        {/* Live Agent Event Ticker & Audio Visualizer */}
        <div className="w-full bg-[#050b16]/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col items-center justify-center space-y-3">
          {status === 'CONNECTING' && (
            <div className="flex items-center gap-2 text-sky-400 text-xs font-bold animate-pulse">
              <Activity className="w-4 h-4 animate-spin" />
              جاري تجهيز التوكن والاتصال بسيرفر الذكاء الاصطناعي...
            </div>
          )}

          {status === 'CONNECTED' && (
            <div className="space-y-3 w-full">
              {/* Dynamic State Ticker Badge */}
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>مكالمة نشطة الآن</span>
                </div>
                <div className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-sky-300 flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-sky-400 animate-pulse" />
                  {tickerDetail}
                </div>
              </div>

              {/* Animated Audio Waveform */}
              <div className="flex items-center justify-center gap-1.5 h-6">
                <span className="w-1.5 h-4 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-6 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-8 bg-cyan-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-5 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.2s]"></span>
                <span className="w-1.5 h-3 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.4s]"></span>
              </div>
            </div>
          )}

          {status === 'ERROR' && (
            <div className="flex items-center gap-2 text-rose-400 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {errorMessage || 'خطأ في الاتصال'}
            </div>
          )}

          {status === 'DISCONNECTED' && (
            <div className="text-slate-400 text-xs font-bold">
              تم إغلاق الجلسة الصوتية وتحديث السجل.
            </div>
          )}
        </div>

        {/* Real-Time Live Transcript Chat Box */}
        <div className="w-full bg-[#030712]/80 border border-slate-800 rounded-2xl p-3 flex flex-col h-44 space-y-2 text-right">
          <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            التفريغ النصي اللحظي للحوار (Live Speech Transcript)
          </div>

          <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                تحدث في المايك للبدء في رؤية النص المكتوب حياً...
              </div>
            ) : (
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2 text-xs ${
                    msg.role === 'user' ? 'flex-row-reverse text-right' : 'flex-row text-right'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.isSuccessCard
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : msg.role === 'user' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                  }`}>
                    {msg.isSuccessCard ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> : msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                  <div className={`p-2.5 rounded-2xl max-w-[85%] leading-relaxed ${
                    msg.isSuccessCard
                      ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-100 rounded-tl-none shadow-lg shadow-emerald-950/40 font-bold'
                      : msg.role === 'user'
                      ? 'bg-blue-600/20 border border-blue-500/30 text-blue-100 rounded-tr-none'
                      : 'bg-purple-950/40 border border-purple-500/30 text-purple-100 rounded-tl-none font-mono'
                  }`}>
                    {msg.title && <h5 className="text-xs font-black text-emerald-300 mb-1 flex items-center gap-1">{msg.title}</h5>}
                    <p className="text-sm font-semibold mb-1">{msg.text}</p>
                    <div className="flex items-center justify-between gap-2 mt-1.5 border-t border-slate-700/40 pt-1">
                      <span className="text-[9px] opacity-60 block dir-ltr text-left">{msg.timestamp}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(msg.text);
                          setCopiedId(msg.id);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="text-[10px] text-amber-300 hover:text-amber-200 flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-md transition font-sans"
                        title="نسخ النص الصوتي للتحليل"
                      >
                        {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedId === msg.id ? 'تم النسخ ✅' : 'نسخ النص 📋'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Noise Suppression & Security Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="text-[10px] text-emerald-300 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            عزل الضوضاء والصدى نشط (WebRTC Noise Suppression)
          </div>

          {isAssistant && (
            <div className="text-[10px] text-purple-300 font-bold bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
              <Briefcase className="w-3.5 h-3.5 text-purple-400" />
              RBAC Secured • حصرية للمدير
            </div>
          )}
        </div>

        {/* Hang Up Action Button */}
        <button
          onClick={handleHangUp}
          className="w-full py-3.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-rose-950/60 group"
        >
          <PhoneOff className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span>إنهاء المحادثة (Hang Up)</span>
        </button>
      </div>
    </div>
  );
}
