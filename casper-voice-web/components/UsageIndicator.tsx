'use client';

import React, { useState, useEffect } from 'react';
import { ExternalLink, RefreshCw, Activity, CheckCircle2 } from 'lucide-react';

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

// Resolves fill color from percentage against the brand token palette
function getProgressStyle(pct: number = 0): string {
  if (pct > 80) return 'var(--color-danger)';
  if (pct > 50) return 'var(--color-warning)';
  return 'var(--color-success-text)';
}

export function UsageIndicator() {
  const [data, setData]           = useState<UsageData | null>(null);
  const [loading, setLoading]     = useState(true);
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
    const id = setInterval(fetchUsage, 15000);
    return () => clearInterval(id);
  }, []);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="bento-card p-6">
        <div className="flex items-center gap-3 mb-6 pb-4" style={{ borderBottom: '1px solid var(--color-border-glass)' }}>
          <div className="shimmer w-32 h-5 rounded-lg" />
          <div className="shimmer w-24 h-4 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="nested-card p-5 space-y-4">
              <div className="shimmer h-4 w-20 rounded-full" />
              <div className="shimmer h-5 w-full rounded-lg" />
              <div className="shimmer h-1.5 w-full rounded-full" />
              <div className="shimmer h-4 w-24 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { gemini, groq, livekit } = data.providers;

  // ── Provider card config ───────────────────────────────────────────────────
  const providers = [
    {
      data: livekit,
      accentColor: 'var(--color-success-text)',        // deep-verdant
      badgeStyle: {
        background: 'rgba(21,132,110,0.16)',
        color: '#1fc9a4',
        border: '1px solid rgba(21,132,110,0.28)',
      },
      stat: livekit.bandwidthUsed ?? '—',
      statLabel: 'الباندويث المستهلك',
      sub: `الحد الشهري: ${livekit.bandwidthLimit ?? '—'}`,
    },
    {
      data: groq,
      accentColor: 'var(--color-warning)',              // saffron-spark
      badgeStyle: {
        background: 'rgba(255,184,41,0.14)',
        color: 'var(--color-warning)',
        border: '1px solid rgba(255,184,41,0.28)',
      },
      stat: (groq.usedRequests ?? 0).toLocaleString('ar-EG'),
      statLabel: 'الطلبات المستخدمة',
      sub: `${(groq.remainingRequests ?? 0).toLocaleString('ar-EG')} طلب متبقي`,
    },
    {
      data: gemini,
      accentColor: 'var(--color-brand)',                // electric-iris
      badgeStyle: {
        background: 'rgba(128,82,255,0.16)',
        color: '#b19aff',
        border: '1px solid rgba(128,82,255,0.28)',
      },
      stat: (gemini.usedTokens ?? 0).toLocaleString('ar-EG') + ' توكنز',
      statLabel: 'التوكنز المستهلكة',
      sub: `${(gemini.remainingTokens ?? 0).toLocaleString('ar-EG')} توكنز متبقي`,
    },
  ];

  return (
    <div className="bento-card p-6 space-y-5">

      {/* ── Header ── */}
      <div
        className="flex items-center justify-between pb-4"
        style={{ borderBottom: '1px solid var(--color-border-glass)' }}
      >
        <div className="flex items-center gap-3">
          {/* Left-side: title + connected pill */}
          <div>
            <h3
              className="text-base font-bold flex items-center gap-2 flex-wrap"
              style={{ color: 'var(--color-text-primary)' }}
            >
              الاستخدام الحالي
              <span
                className="text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1"
                style={{
                  background: 'rgba(21,132,110,0.14)',
                  color: '#1fc9a4',
                  border: '1px solid rgba(21,132,110,0.28)',
                }}
              >
                <CheckCircle2 size={10} />
                متصل بـ AI Studio
              </span>
              {/* Live pulse */}
              <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#1fc9a4' }}>
                <span className="pulse-dot" style={{ background: '#1fc9a4' }} />
                مباشر
              </span>
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              تحديث لحظي — ({data.dateStr})
            </p>
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={fetchUsage}
          disabled={refreshing}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-all"
          style={{
            color: 'var(--color-text-muted)',
            border: '1px solid var(--color-border-glass)',
            background: 'transparent',
          }}
          title="تحديث"
        >
          <RefreshCw
            size={14}
            className={refreshing ? 'animate-spin' : ''}
            style={{ color: refreshing ? 'var(--color-brand)' : 'var(--color-text-muted)' }}
          />
        </button>
      </div>

      {/* ── Provider Cards Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providers.map((p) => (
          <div key={p.data.name} className="nested-card p-4 space-y-3">

            {/* Badge + external link */}
            <div className="flex items-center justify-between">
              <span
                className="text-xs font-bold px-2.5 py-1 rounded-full"
                style={p.badgeStyle}
              >
                {p.data.badge}
              </span>
              <a
                href={p.data.dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
                title="فتح لوحة التحكم"
              >
                <ExternalLink size={13} />
              </a>
            </div>

            {/* Provider name */}
            <h4
              className="text-sm font-bold leading-snug"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {p.data.name}
            </h4>

            {/* Stat row above bar */}
            <div className="flex justify-between items-center text-xs">
              <span style={{ color: 'var(--color-text-muted)' }}>{p.statLabel}</span>
              <span
                className="font-bold tabular-nums"
                style={{ color: p.accentColor }}
              >
                {p.stat}
              </span>
            </div>

            {/* Progress bar */}
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{
                  width: `${Math.max(3, p.data.percentage ?? 1)}%`,
                  background: getProgressStyle(p.data.percentage),
                }}
              />
            </div>

            {/* Sub-stat below bar */}
            <p className="text-xs tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
              {p.sub}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
