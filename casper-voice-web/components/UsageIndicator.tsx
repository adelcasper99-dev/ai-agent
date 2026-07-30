'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, ExternalLink, RefreshCw, Zap, Activity, CheckCircle2 } from 'lucide-react';

interface ProviderUsage {
  name: string;
  usedTokens?: number;
  limitTokens?: number;
  remainingTokens?: number;
  usedRequests?: number;
  limitRequests?: number;
  remainingRequests?: number;
  percentage?: number;
  bandwidthUsed?: string;
  bandwidthLimit?: string;
  dashboardUrl: string;
  badge: string;
}

interface UsageData {
  dateStr: string;
  providers: {
    gemini: ProviderUsage;
    groq: ProviderUsage;
    livekit: ProviderUsage;
  };
}

export function UsageIndicator() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsage = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/usage');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Failed to fetch usage data', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsage();
    const interval = setInterval(fetchUsage, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center animate-pulse">
        <div className="h-6 bg-slate-800 rounded w-1/3 mx-auto mb-4"></div>
        <div className="h-20 bg-slate-800/50 rounded-xl"></div>
      </div>
    );
  }

  if (!data) return null;

  const gemini = data.providers.gemini;
  const groq = data.providers.groq;
  const livekit = data.providers.livekit;

  const getProgressColor = (pct: number = 0) => {
    if (pct > 80) return 'bg-rose-500';
    if (pct > 50) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              مؤشر استهلاك التوكنز والحدود اليومية
              <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> متصل بـ AI Studio
              </span>
            </h3>
            <p className="text-xs text-slate-400">تحديث لحظي لحساب التوكنز والحدود المتبقية لليوم ({data.dateStr})</p>
          </div>
        </div>

        <button
          onClick={fetchUsage}
          disabled={refreshing}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
          title="تحديث البيانات"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
        </button>
      </div>

      {/* Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gemini Card */}
        <div className="bg-slate-800/40 border border-slate-800/90 hover:border-indigo-500/30 rounded-2xl p-5 transition-all space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg">
                {gemini.badge}
              </span>
              <h4 className="text-sm font-bold text-white pt-1">{gemini.name}</h4>
            </div>
            <a
              href={gemini.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-indigo-400 p-1 transition-colors"
              title="فتح لوحة Google AI Studio"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-mono">
              <span>المستهلك: {gemini.usedTokens?.toLocaleString()} توكنز</span>
              <span className="font-bold text-emerald-400">{gemini.percentage}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(gemini.percentage)}`}
                style={{ width: `${Math.max(3, gemini.percentage || 0)}%` }}
              ></div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center text-xs">
            <span className="text-slate-400">المتبقي اليوم:</span>
            <span className="font-bold text-white font-mono">{gemini.remainingTokens?.toLocaleString()} توكنز</span>
          </div>
        </div>

        {/* Groq Card */}
        <div className="bg-slate-800/40 border border-slate-800/90 hover:border-amber-500/30 rounded-2xl p-5 transition-all space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg">
                {groq.badge}
              </span>
              <h4 className="text-sm font-bold text-white pt-1">{groq.name}</h4>
            </div>
            <a
              href={groq.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-amber-400 p-1 transition-colors"
              title="فتح لوحة Groq Console"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-mono">
              <span>المستهلك: {groq.usedRequests?.toLocaleString()} طلبات</span>
              <span className="font-bold text-amber-400">{groq.percentage}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${getProgressColor(groq.percentage)}`}
                style={{ width: `${Math.max(3, groq.percentage || 0)}%` }}
              ></div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center text-xs">
            <span className="text-slate-400">المتبقي اليوم:</span>
            <span className="font-bold text-white font-mono">{groq.remainingRequests?.toLocaleString()} طلبات</span>
          </div>
        </div>

        {/* LiveKit Card */}
        <div className="bg-slate-800/40 border border-slate-800/90 hover:border-cyan-500/30 rounded-2xl p-5 transition-all space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-lg">
                {livekit.badge}
              </span>
              <h4 className="text-sm font-bold text-white pt-1">{livekit.name}</h4>
            </div>
            <a
              href={livekit.dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-cyan-400 p-1 transition-colors"
              title="فتح لوحة LiveKit Cloud"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1.5 font-mono">
              <span>الباندويث المستهلك:</span>
              <span className="font-bold text-cyan-400">{livekit.bandwidthUsed}</span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div className="h-full bg-cyan-500 rounded-full w-[1.5%]"></div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex justify-between items-center text-xs">
            <span className="text-slate-400">الحد الشهري المجاني:</span>
            <span className="font-bold text-white font-mono">{livekit.bandwidthLimit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
