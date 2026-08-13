// components/ui/glass-card.tsx
"use client";

import React from "react";

export interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  accentColor?: string;
  negative?: boolean;
}

export function KPICard({ title, value, icon, trend, accentColor = "#06b6d4", negative }: KPICardProps) {
  return (
    <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-5 relative overflow-hidden backdrop-blur-xl group hover:border-white/10 transition-all duration-300 shadow-2xl">
      <div 
        className="absolute top-0 right-0 w-24 h-24 rounded-full blur-[60px] -mr-10 -mt-10 opacity-30 group-hover:opacity-50 transition-opacity"
        style={{ background: accentColor }}
      />
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className="p-2 rounded-xl" style={{ background: `${accentColor}20` }}>
          {icon}
        </div>
        {trend && (
          <span 
            className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
              negative 
                ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      <div className="relative z-10">
        <p className="text-3xl font-extrabold text-white tracking-tight tabular-nums">
          {value}
        </p>
        <p className="text-zinc-400 text-sm font-bold mt-1">{title}</p>
      </div>
    </div>
  );
}

export interface GlassPanelProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accentColor?: "cyan" | "emerald" | "rose" | "amber" | "blue" | "purple";
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const colorMap = {
  cyan: "bg-cyan-500/5 group-hover:bg-cyan-500/10 text-cyan-400",
  emerald: "bg-emerald-500/5 group-hover:bg-emerald-500/10 text-emerald-400",
  rose: "bg-rose-500/5 group-hover:bg-rose-500/10 text-rose-400",
  amber: "bg-amber-500/5 group-hover:bg-amber-500/10 text-amber-400",
  blue: "bg-blue-500/5 group-hover:bg-blue-500/10 text-blue-400",
  purple: "bg-purple-500/5 group-hover:bg-purple-500/10 text-purple-400",
};

export function GlassPanel({ title, subtitle, icon, accentColor = "cyan", extra, children, className = "" }: GlassPanelProps) {
  const accentClass = colorMap[accentColor] || colorMap.cyan;

  return (
    <div className={`bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden relative group shadow-2xl ${className}`}>
      <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full -mr-16 -mt-16 transition-colors ${accentClass.split(' ')[0]} ${accentClass.split(' ')[1]}`} />
      {(title || extra) && (
        <div className="p-6 border-b border-white/10 flex items-center justify-between relative z-10">
          <div>
            {title && (
              <h3 className="text-sm font-black text-zinc-200 uppercase tracking-widest flex items-center gap-2">
                {icon}
                {title}
              </h3>
            )}
            {subtitle && <p className="text-xs text-zinc-400 font-medium mt-1">{subtitle}</p>}
          </div>
          {extra && <div className="shrink-0">{extra}</div>}
        </div>
      )}
      <div className="p-6 relative z-10">{children}</div>
    </div>
  );
}

export function GlassHeader({ title, subtitle, icon, actions }: { title: string; subtitle?: string; icon?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-zinc-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-md shadow-2xl mb-8">
      <div className="flex items-center gap-3">
        {icon && <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">{icon}</div>}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            {title}
          </h1>
          {subtitle && <p className="text-zinc-400 text-sm mt-1 font-medium">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}
