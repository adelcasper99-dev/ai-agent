'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Copy, Check, Volume2, Mic } from 'lucide-react';

interface VoiceNotePlayerProps {
  audioUrl?: string | null;
  text: string;
  senderName?: string;
  timestamp?: string;
  onPlayDemo?: () => void;
  isLoading?: boolean;
}

export default function VoiceNotePlayer({
  audioUrl,
  text,
  senderName = 'المساعد الصوتي',
  timestamp,
  onPlayDemo,
  isLoading = false,
}: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [copied, setCopied] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.playbackRate = playbackRate;

      audio.onloadedmetadata = () => {
        setDuration(audio.duration || 0);
      };
      audio.ontimeupdate = () => {
        setCurrentTime(audio.currentTime || 0);
      };
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      audio.onerror = () => {
        setIsPlaying(false);
      };

      // Auto-play newly generated audio stream
      audio.play().then(() => setIsPlaying(true)).catch((e) => {
        console.warn('Auto-play blocked or failed:', e);
        setIsPlaying(false);
      });

      return () => {
        audio.pause();
        audioRef.current = null;
      };
    }
  }, [audioUrl]);

  const togglePlay = () => {
    if (onPlayDemo && !audioUrl) {
      onPlayDemo();
      return;
    }

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const toggleSpeed = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `casper_voice_note_${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyText = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full bg-[#0b141a] text-slate-100 border border-[#222e35] rounded-2xl p-3 shadow-xl flex flex-col gap-2 dir-rtl">
      {/* Sender Header */}
      <div className="flex items-center justify-between border-b border-[#1f2c34] pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-emerald-600/30 border border-emerald-500/50 flex items-center justify-center text-emerald-400">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              {senderName}
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full">رسالة صوتية</span>
            </h4>
            {timestamp && <span className="text-[9px] text-slate-400">{timestamp}</span>}
          </div>
        </div>

        {/* Speed & Download Badges */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleSpeed}
            className="text-[10px] bg-[#1f2c34] hover:bg-[#2a3942] text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 transition"
            title="سرعة التشغيل"
          >
            {playbackRate}x
          </button>
          {audioUrl && (
            <button
              onClick={handleDownload}
              className="p-1 bg-[#1f2c34] hover:bg-[#2a3942] text-slate-200 hover:text-emerald-400 rounded-full border border-slate-700 transition"
              title="تحميل ملف MP3"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* WhatsApp Voice Note Waveform Bar */}
      <div className="flex items-center gap-3 bg-[#111b21] p-2.5 rounded-xl border border-[#202c33]">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          disabled={isLoading}
          className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-emerald-950/50 shrink-0 transition active:scale-95 disabled:opacity-50"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current mr-0.5" />
          )}
        </button>

        {/* Waveform Visualization Bars */}
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-1 h-6">
            {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 30, 85, 65, 40, 90, 55, 75, 35, 80, 60, 40, 90].map((h, i) => {
              const active = duration ? (currentTime / duration) * 22 > i : isPlaying;
              return (
                <div
                  key={i}
                  style={{ height: `${h}%` }}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    active ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-[#374248]'
                  } ${isPlaying ? 'animate-pulse' : ''}`}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Transcript Text & Copy Button */}
      <div className="flex items-start justify-between gap-2 bg-[#111b21]/60 p-2 rounded-xl text-xs text-slate-200">
        <p className="flex-1 leading-relaxed font-sans">{text}</p>
        <button
          onClick={copyText}
          className="text-[10px] text-amber-300 hover:text-amber-200 flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-md transition shrink-0"
          title="نسخ النص الصوتي"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'تم النسخ ✅' : 'نسخ النص 📋'}</span>
        </button>
      </div>
    </div>
  );
}
