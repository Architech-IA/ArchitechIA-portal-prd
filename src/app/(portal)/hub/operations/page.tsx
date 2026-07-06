'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DiskPartition {
  path: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  percent: number;
}

interface DiskChild {
  name: string;
  path: string;
  used_gb: number;
}

interface DiskCategory {
  path: string;
  label: string;
  used_gb: number;
  children?: DiskChild[];
}

interface HistSnapshot {
  ts: string;
  cpu: number; ram: number; disk: number;
  rx: number; tx: number; swap: number;
}

interface VpsMetrics {
  ts: string;
  uptime_s: number;
  cpu:          { percent: number; load_avg: number[]; count: number; per_core?: number[] };
  ram:          { total_mb: number; used_mb: number; avail_mb: number; percent: number };
  swap?:        { total_mb: number; used_mb: number; percent: number };
  disk:         { total_gb: number; used_gb: number; free_gb: number; percent: number; breakdown?: DiskPartition[]; categories?: DiskCategory[] };
  disk_io?:     { read_mbps: number; write_mbps: number };
  net:          { rx_mbps: number; tx_mbps: number };
  connections?: { total: number; established: number; listening: number };
  procs?:       { total: number; zombies: number };
  docker?:      { id: string; name: string; image: string; status: string; ports: string }[];
  services:     { name: string; active: boolean; status: string }[];
  top_procs:    { pid: number; name: string; cpu: number; mem: number }[];
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const G = {
  card:  { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' } as React.CSSProperties,
  panel: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px 16px' } as React.CSSProperties,
};
const ORANGE = '#f97316';
const MAX_HISTORY = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

function statusColor(pct: number): string {
  if (pct < 60) return '#34d399';
  if (pct < 85) return '#fbbf24';
  return '#f87171';
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function maxVal(arr: number[]): number {
  return arr.length ? Math.max(...arr) : 0;
}

function trend(current: number, previous: number): { icon: string; color: string; delta: number } {
  const delta = current - previous;
  if (Math.abs(delta) < 0.3) return { icon: '→', color: '#94a3b8', delta };
  return delta > 0 ? { icon: '↑', color: '#f87171', delta } : { icon: '↓', color: '#34d399', delta };
}

function predictDiskFull(history: number[]): { hours: number | null; growthPctPerHour: number } {
  const n = history.length;
  if (n < 5) return { hours: null, growthPctPerHour: 0 };
  const xs = history.map((_, i) => i * 0.5);
  const ys = history;
  const xMean = avg(xs);
  const yMean = avg(ys);
  const denom = avg(xs.map(x => (x - xMean) ** 2));
  if (denom === 0) return { hours: null, growthPctPerHour: 0 };
  const slope = avg(xs.map((x, i) => (x - xMean) * (ys[i] - yMean))) / denom;
  if (slope <= 0.005) return { hours: null, growthPctPerHour: slope * 2 };
  const currentPct = ys[n - 1];
  const hoursToFull = (100 - currentPct) / slope;
  return { hours: hoursToFull > 0 ? hoursToFull : null, growthPctPerHour: slope * 2 };
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ history, color, height = 36 }: { history: number[]; color: string; height?: number }) {
  const W = 120;
  if (history.length === 0) return <div style={{ height }} />;
  if (history.length === 1) {
    const y = height / 2;
    const gradId = `sg1${color.replace('#', '')}`;
    return (
      <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', height, display: 'block' }} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={`M0,${y} L${W},${y} L${W},${height} L0,${height} Z`} fill={`url(#${gradId})`} />
        <line x1="0" y1={y} x2={W} y2={y} stroke={color} strokeWidth="1.5" strokeDasharray="5 3" strokeOpacity="0.6" />
        <circle cx={W} cy={y} r="2.5" fill={color} />
      </svg>
    );
  }
  const max = Math.max(...history, 1);
  const coords = history.map((v, i) => {
    const x = (i / (history.length - 1)) * W;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pts = coords.join(' ');
  const lastCoord = coords[coords.length - 1].split(',');
  const lastX = parseFloat(lastCoord[0]);
  const lastY = parseFloat(lastCoord[1]);
  const firstCoord = coords[0].split(',');
  const areaPath = `M${firstCoord[0]},${firstCoord[1]} ` + coords.slice(1).map(p => `L${p}`).join(' ') + ` L${W},${height} L0,${height} Z`;
  const gradId = `sg${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', height, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}

// ── Dual sparkline (RX + TX) ──────────────────────────────────────────────────
function DualSparkline({ h1, h2, c1, c2, height = 80 }: {
  h1: number[]; h2: number[]; c1: string; c2: string; height?: number;
}) {
  const W = 240;
  const maxV = Math.max(...h1, ...h2, 0.001);
  const len = Math.max(h1.length, h2.length, 2);
  const pts = (hist: number[]) => hist.map((v, i) => {
    const x = (i / (len - 1)) * W;
    const y = height - (v / maxV) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const area = (hist: number[]) => {
    if (hist.length < 2) return '';
    const p = hist.map((v, i) => {
      const x = (i / (len - 1)) * W;
      const y = height - (v / maxV) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const lx = ((hist.length - 1) / (len - 1)) * W;
    return `M0,${height} L${p.join(' L')} L${lx.toFixed(1)},${height} Z`;
  };
  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', height, display: 'block' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="drx" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c1} stopOpacity="0.3" />
          <stop offset="100%" stopColor={c1} stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="dtx" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c2} stopOpacity="0.22" />
          <stop offset="100%" stopColor={c2} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {h1.length === 1 && (() => { const y = height - (h1[0] / maxV) * (height - 8) - 4; return <><path d={`M0,${y} L${W},${y} L${W},${height} L0,${height} Z`} fill="url(#drx)" /><line x1="0" y1={y} x2={W} y2={y} stroke={c1} strokeWidth="1.5" strokeDasharray="5 3" strokeOpacity="0.7" /><circle cx={W} cy={y} r="2.5" fill={c1} /></>; })()}
      {h1.length >= 2 && <><path d={area(h1)} fill="url(#drx)" /><polyline points={pts(h1)} fill="none" stroke={c1} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></>}
      {h2.length === 1 && (() => { const y = height - (h2[0] / maxV) * (height - 8) - 4; return <><path d={`M0,${y} L${W},${y} L${W},${height} L0,${height} Z`} fill="url(#dtx)" /><line x1="0" y1={y} x2={W} y2={y} stroke={c2} strokeWidth="1.5" strokeDasharray="5 3" strokeOpacity="0.6" /><circle cx={W} cy={y} r="2.5" fill={c2} /></>; })()}
      {h2.length >= 2 && <><path d={area(h2)} fill="url(#dtx)" /><polyline points={pts(h2)} fill="none" stroke={c2} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></>}
    </svg>
  );
}

// ── Time axis labels ─────────────────────────────────────────────────────────
function TimeAxis({ points, intervalSec = 30 }: { points: number; intervalSec?: number }) {
  if (points < 2) return null;
  const totalSec = (points - 1) * intervalSec;
  const fmt = (s: number) => s === 0 ? 'Ahora' : s < 60 ? `-${s}s` : `-${Math.round(s / 60)}m`;
  const labels = [0, 0.25, 0.5, 0.75, 1].map(f => fmt(Math.round((1 - f) * totalSec)));
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 2px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: '4px' }}>
      {labels.map((l, i) => (
        <span key={i} style={{ fontSize: '9px', color: '#334155', fontVariantNumeric: 'tabular-nums' }}>{l}</span>
      ))}
    </div>
  );
}

// ── Circular gauge ────────────────────────────────────────────────────────────
function CircleGauge({ pct, color, label, sub }: { pct: number; color: string; label: string; sub: string }) {
  const r = 30, cx = 40, cy = 40, stroke = 7;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ textAlign: 'center' }}>
      <svg viewBox="0 0 80 80" style={{ width: '80px', height: '80px', display: 'block', margin: '0 auto' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
          strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill={color}>{pct.toFixed(0)}%</text>
      </svg>
      <p style={{ margin: '4px 0 1px', fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>{label}</p>
      <p style={{ margin: 0, fontSize: '10px', color: '#475569' }}>{sub}</p>
    </div>
  );
}

// ── Usage bar ─────────────────────────────────────────────────────────────────
function UsageBar({ pct, color, label, val }: { pct: number; color: string; label: string; val: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>{label}</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color }}>{val}</span>
      </div>
      <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: '3px', background: color, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '3px' }}>
        <span style={{ fontSize: '10px', color: '#334155' }}>{pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ── Not configured placeholder ────────────────────────────────────────────────
function NotConfigured() {
  return (
    <div style={{ ...G.card, padding: '40px', textAlign: 'center', maxWidth: '560px', margin: '40px auto' }}>
      <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: `${ORANGE}15`, border: `1px solid ${ORANGE}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={ORANGE} strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </div>
      <h3 style={{ margin: '0 0 10px', fontSize: '17px', fontWeight: 700, color: '#e2e8f0' }}>Monitor no configurado</h3>
      <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
        Para activar el monitor de la VPS configurá las variables de entorno en Vercel y desplegá el agente en tu servidor Hostinger.
      </p>
      <div style={{ ...G.panel, textAlign: 'left', marginBottom: '12px' }}>
        <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1 — Variables en Vercel</p>
        <pre style={{ margin: 0, fontSize: '11px', color: '#34d399', background: 'rgba(52,211,153,0.05)', padding: '8px 10px', borderRadius: '6px', overflowX: 'auto' }}>
{`VPS_METRICS_URL=http://<IP_VPS>:9100
VPS_METRICS_TOKEN=<token_secreto>`}</pre>
      </div>
      <div style={{ ...G.panel, textAlign: 'left' }}>
        <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2 — Agente en la VPS</p>
        <pre style={{ margin: 0, fontSize: '11px', color: '#60a5fa', background: 'rgba(96,165,250,0.05)', padding: '8px 10px', borderRadius: '6px', overflowX: 'auto' }}>
{`pip install psutil
METRICS_TOKEN=<token> python3 metrics_agent.py`}</pre>
        <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#334155' }}>
          El archivo <code style={{ color: '#a78bfa' }}>vps-agent/metrics_agent.py</code> está en el repo.
        </p>
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────
function Skeleton() {
  const box = (h = 120) => (
    <div style={{ height: h, borderRadius: '14px', background: 'rgba(255,255,255,0.03)', animation: 'pulse 1.5s ease-in-out infinite' }} />
  );
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px', marginBottom: '12px' }}>
        {[0, 1, 2, 3, 4].map(i => <div key={i}>{box(80)}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
        {box(180)}{box(180)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        {[0, 1, 2, 3, 4].map(i => <div key={i}>{box(260)}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {box(180)}{box(180)}
      </div>
    </div>
  );
}

// ── CPU Core Heatmap ─────────────────────────────────────────────────────────
function CpuCoreHeatmap({ perCore, onOpen }: { perCore: number[]; onOpen?: () => void }) {
  const cols = perCore.length <= 4 ? 2 : 4;
  return (
    <div style={{ ...G.card, cursor: 'pointer' }} onClick={onOpen}>
      <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>CPU · Por núcleo</p>
      {perCore.length === 0 ? (
        <p style={{ margin: 0, fontSize: '12px', color: '#334155', textAlign: 'center', padding: '16px' }}>Sin datos de núcleos</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '6px' }}>
          {perCore.map((pct, i) => {
            const color = statusColor(pct);
            const bg = pct < 10 ? '18' : pct < 30 ? '28' : pct < 60 ? '42' : pct < 85 ? '68' : 'bb';
            return (
              <div key={i} title={`Core ${i}: ${pct}%`} style={{ borderRadius: '7px', background: `${color}${bg}`, border: `1px solid ${color}40`, padding: '7px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', transition: 'background 0.5s' }}>
                <span style={{ fontSize: '9px', color: '#475569', fontWeight: 600 }}>C{i}</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Disk I/O dual-line chart ──────────────────────────────────────────────────
function DiskIOChart({ readHist, writeHist, currentRead, currentWrite, onOpen }: {
  readHist: number[]; writeHist: number[]; currentRead: number; currentWrite: number; onOpen?: () => void;
}) {
  const RC = '#fb923c', WC = '#f472b6';
  return (
    <div style={{ ...G.card, cursor: 'pointer' }} onClick={onOpen}>
      <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Disco I/O</p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        {[{ color: RC, label: '↓ Lectura', val: currentRead, peak: maxVal(readHist) },
          { color: WC, label: '↑ Escritura', val: currentWrite, peak: maxVal(writeHist) }].map(s => (
          <div key={s.label} style={{ flex: 1, ...G.panel, padding: '8px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px' }}>
              <div style={{ width: '10px', height: '3px', borderRadius: '2px', background: s.color }} />
              <span style={{ fontSize: '10px', color: '#475569' }}>{s.label}</span>
            </div>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: s.color }}>{s.val} <span style={{ fontSize: '10px', fontWeight: 400 }}>MB/s</span></p>
            <p style={{ margin: '1px 0 0', fontSize: '9px', color: '#334155' }}>pico: {s.peak.toFixed(2)}</p>
          </div>
        ))}
      </div>
      <DualSparkline h1={readHist} h2={writeHist} c1={RC} c2={WC} height={72} />
    </div>
  );
}

// ── Disk Category Donut ───────────────────────────────────────────────────────
function DiskCategoryDonut({ categories, usedGb, totalGb, onOpen }: { categories: DiskCategory[]; usedGb: number; totalGb: number; onOpen?: () => void }) {
  const items = (categories ?? []).filter(c => c.used_gb > 0.01).slice(0, 7);
  const total = items.reduce((s, c) => s + c.used_gb, 0);
  const SIZE = 118, cx = 59, cy = 59, R = 42, SW = 13;
  const circ = 2 * Math.PI * R;
  const GAP = 2.5;
  let cum = 0;
  const slices = items.map((cat, i) => {
    const pct = total > 0 ? cat.used_gb / total : 0;
    const start = cum; cum += pct;
    const segLen = Math.max(0, pct * circ - GAP);
    return { ...cat, pct, start, segLen, color: CAT_COLORS[i % CAT_COLORS.length] };
  });
  const diskPct = totalGb > 0 ? (usedGb / totalGb) * 100 : 0;
  const diskColor = statusColor(diskPct);
  return (
    <div style={{ ...G.card, display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={onOpen}>
      <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>Disco · Categorías</p>
      {items.length === 0 ? (
        <p style={{ margin: 0, fontSize: '12px', color: '#334155', textAlign: 'center', padding: '16px' }}>Sin datos de categorías</p>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '14px' }}>
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ width: SIZE, height: SIZE, flexShrink: 0 }}>
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={SW} />
            {slices.map((s, i) => (
              <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={s.color} strokeWidth={SW}
                strokeDasharray={`${s.segLen.toFixed(2)} ${circ.toFixed(2)}`}
                transform={`rotate(${-90 + s.start * 360} ${cx} ${cy})`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.6s ease', filter: `drop-shadow(0 0 3px ${s.color}90)` }}
              />
            ))}
            <text x={cx} y={cy - 8} textAnchor="middle" fontSize="15" fontWeight="900" fill="#f1f5f9">{usedGb.toFixed(1)}</text>
            <text x={cx} y={cy + 5} textAnchor="middle" fontSize="8.5" fill="#475569">GB usados</text>
            <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11" fontWeight="800" fill={diskColor}>{diskPct.toFixed(1)}%</text>
          </svg>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px', minWidth: 0 }}>
            {slices.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '3px', background: s.color, flexShrink: 0, boxShadow: `0 0 6px ${s.color}90` }} />
                <span style={{ fontSize: '11px', color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: s.color, flexShrink: 0 }}>{s.used_gb.toFixed(1)} GB</span>
                <span style={{ fontSize: '9px', color: '#334155', width: '28px', textAlign: 'right', flexShrink: 0 }}>{(s.pct * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TCP Connections Chart ─────────────────────────────────────────────────────
function TcpConnChart({ history, current, listening, onOpen }: { history: number[]; current: number; listening: number; onOpen?: () => void }) {
  const color = '#34d399';
  return (
    <div style={{ ...G.card, cursor: 'pointer' }} onClick={onOpen}>
      <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Conexiones TCP</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '30px', fontWeight: 900, color, lineHeight: 1 }}>{current}</p>
          <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#475569' }}>establecidas</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ ...G.panel, padding: '5px 10px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#60a5fa' }}>{listening}</p>
            <p style={{ margin: 0, fontSize: '9px', color: '#334155' }}>listen</p>
          </div>
        </div>
      </div>
      <Sparkline history={history} color={color} height={48} />
      {history.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
          <span style={{ fontSize: '10px', color: '#334155' }}>pico <strong style={{ color: '#e2e8f0' }}>{maxVal(history)}</strong></span>
          <span style={{ fontSize: '10px', color: '#334155' }}>avg <strong style={{ color: '#e2e8f0' }}>{avg(history).toFixed(0)}</strong></span>
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
// ── Disk donut chart ──────────────────────────────────────────────────────────
function DiskDonut({ used, total, color, size = 110 }: { used: number; total: number; color: string; size?: number }) {
  const r = size * 0.38, cx = size / 2, cy = size / 2, sw = size * 0.11;
  const circ = 2 * Math.PI * r;
  const pct  = total > 0 ? used / total : 0;
  const dash  = pct * circ;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size, display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={`${dash.toFixed(2)} ${circ.toFixed(2)}`}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 0.7s ease' }}
      />
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={size * 0.16} fontWeight="800" fill={color}>{used.toFixed(1)}</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={size * 0.09} fill="#475569">de {total} GB</text>
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize={size * 0.1} fontWeight="700" fill={color}>{(pct * 100).toFixed(1)}%</text>
    </svg>
  );
}

// ── Modal base (overlay + container) ─────────────────────────────────────────
function ModalShell({ onClose, title, sub, icon, color, children }: {
  onClose: () => void; title: string; sub: string; icon: string; color: string; children: React.ReactNode;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div style={{ width: '100%', maxWidth: '520px', maxHeight: 'calc(100vh - 40px)', background: 'rgba(9,9,24,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', boxShadow: '0 32px 80px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={icon}/></svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>{title}</p>
              <p style={{ margin: 0, fontSize: '11px', color: '#475569' }}>{sub}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: '18px 22px', overflowY: 'auto', flex: 1 }}>{children}</div>
        <div style={{ padding: '12px 22px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '7px 20px', borderRadius: '9px', border: 'none', background: `linear-gradient(135deg, ${color}cc, ${color}88)`, color: '#0f172a', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ── CPU Modal ─────────────────────────────────────────────────────────────────
function CpuModal({ data, color, onClose }: { data: VpsMetrics; color: string; onClose: () => void }) {
  const loads = data.cpu.load_avg.map(l => ({ val: l, pct: Math.min(100, (l / data.cpu.count) * 100) }));
  return (
    <ModalShell onClose={onClose} title="CPU" sub={`${data.cpu.count} núcleos lógicos`} icon="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" color={color}>
      {/* Uso actual */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px' }}>
        <CircleGauge pct={data.cpu.percent} color={color} label="CPU" sub={`${data.cpu.count}c`} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Load average</p>
          {['1 min', '5 min', '15 min'].map((t, i) => {
            const sc = statusColor(loads[i].pct);
            return (
              <div key={t} style={{ marginBottom: i < 2 ? '8px' : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '11px', color: '#475569' }}>{t}</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: sc }}>{loads[i].val.toFixed(2)}</span>
                </div>
                <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ height: '100%', width: `${loads[i].pct}%`, borderRadius: '3px', background: sc, transition: 'width 0.5s' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Per-core */}
      {data.cpu.per_core && data.cpu.per_core.length > 0 && (
        <>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Por núcleo</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px', marginBottom: '20px' }}>
            {data.cpu.per_core.map((pct, i) => {
              const sc = statusColor(pct);
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ fontSize: '11px', color: '#475569' }}>Core {i}</span>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: sc }}>{pct}%</span>
                  </div>
                  <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: '3px', background: sc, transition: 'width 0.5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      {/* Top procesos */}
      {data.top_procs.length > 0 && (
        <>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top procesos por CPU</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {data.top_procs.map(p => (
              <div key={p.pid} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '10px', color: '#334155', width: '36px', flexShrink: 0 }}>#{p.pid}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: '11px', fontWeight: 800, color: statusColor(p.cpu), flexShrink: 0 }}>{p.cpu}% CPU</span>
                <span style={{ fontSize: '10px', color: '#475569', flexShrink: 0 }}>{p.mem.toFixed(1)}% MEM</span>
              </div>
            ))}
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ── RAM Modal ─────────────────────────────────────────────────────────────────
function RamModal({ data, color, onClose }: { data: VpsMetrics; color: string; onClose: () => void }) {
  const ram = data.ram;
  const usedPct  = ram.total_mb > 0 ? (ram.used_mb  / ram.total_mb) * 100 : 0;
  const availPct = ram.total_mb > 0 ? (ram.avail_mb / ram.total_mb) * 100 : 0;
  const toGB = (mb: number) => (mb / 1024).toFixed(2);
  return (
    <ModalShell onClose={onClose} title="RAM" sub={`${toGB(ram.total_mb)} GB total`} icon="M4 6h16M4 10h16M4 14h16M4 18h16" color={color}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px' }}>
        <CircleGauge pct={ram.percent} color={color} label="RAM" sub={`${toGB(ram.avail_mb)}GB libre`} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Desglose</p>
          {[
            { label: 'Total',      val: `${toGB(ram.total_mb)} GB`, pct: 100,     clr: '#94a3b8' },
            { label: 'Usado',      val: `${toGB(ram.used_mb)} GB`,  pct: usedPct,  clr: color },
            { label: 'Disponible', val: `${toGB(ram.avail_mb)} GB`, pct: availPct, clr: '#34d399' },
          ].map((r, i) => (
            <div key={r.label} style={{ marginBottom: i < 2 ? '8px' : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '11px', color: '#475569' }}>{r.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 800, color: r.clr }}>{r.val}</span>
              </div>
              <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ height: '100%', width: `${r.pct}%`, borderRadius: '3px', background: r.clr, transition: 'width 0.5s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* En MB */}
      <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>En detalle</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        {[
          { label: 'Total',      val: `${ram.total_mb} MB`, clr: '#94a3b8' },
          { label: 'Usado',      val: `${ram.used_mb} MB`,  clr: color },
          { label: 'Disponible', val: `${ram.avail_mb} MB`, clr: '#34d399' },
        ].map(r => (
          <div key={r.label} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: r.clr }}>{r.val}</p>
            <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#334155' }}>{r.label}</p>
          </div>
        ))}
      </div>
      {/* Swap */}
      {data.swap && data.swap.total_mb > 0 && (
        <>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Swap</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {[
              { label: 'Total',  val: `${data.swap.total_mb} MB`, clr: '#94a3b8' },
              { label: 'Usado',  val: `${data.swap.used_mb} MB`,  clr: statusColor(data.swap.percent) },
              { label: 'Uso %',  val: `${data.swap.percent.toFixed(1)}%`, clr: statusColor(data.swap.percent) },
            ].map(r => (
              <div key={r.label} style={{ textAlign: 'center', padding: '10px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: r.clr }}>{r.val}</p>
                <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#334155' }}>{r.label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ── Disk Modal (standalone) ───────────────────────────────────────────────────
function DiskModal({ disk, color, onClose }: { disk: VpsMetrics['disk']; color: string; onClose: () => void }) {
  const visibleCats = (disk.categories ?? []).filter(c => c.used_gb > 0.01);
  const catTotal = visibleCats.reduce((s, c) => s + c.used_gb, 0);
  const otherGb = Math.max(0, disk.used_gb - catTotal);
  const allCats: DiskCategory[] = otherGb > 0.05
    ? [...visibleCats, { path: 'other', label: 'Otro', used_gb: parseFloat(otherGb.toFixed(2)) }]
    : visibleCats;
  return (
    <ModalShell onClose={onClose} title="Espacio en Disco" sub="Desglose por categoría" icon="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8" color={color}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
        <DiskDonut used={disk.used_gb} total={disk.total_gb} color={color} size={110} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resumen global</p>
          {[
            { label: 'Total',      val: `${disk.total_gb} GB`, clr: '#94a3b8' },
            { label: 'Usado',      val: `${disk.used_gb} GB`,  clr: color },
            { label: 'Disponible', val: `${disk.free_gb} GB`,  clr: '#34d399' },
          ].map((r, i) => (
            <div key={r.label}>
              {i > 0 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '5px 0' }} />}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#475569' }}>{r.label}</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: r.clr }}>{r.val}</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop: '10px', padding: '7px 12px', borderRadius: '8px', background: `${color}12`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color }}>
              {disk.percent < 60 ? 'Espacio saludable' : disk.percent < 85 ? 'Espacio moderado' : '¡Espacio crítico!'}
            </span>
            <span style={{ fontSize: '11px', color: '#475569', marginLeft: 'auto' }}>{disk.percent.toFixed(1)}%</span>
          </div>
        </div>
      </div>
      {allCats.length > 0 && (
        <>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Qué ocupa el espacio</p>
          <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)', marginBottom: '12px', gap: '1px' }}>
            {allCats.map((cat, i) => {
              const pct = disk.used_gb > 0 ? (cat.used_gb / disk.used_gb) * 100 : 0;
              return <div key={cat.path} title={`${cat.label}: ${cat.used_gb} GB`} style={{ width: `${pct}%`, background: CAT_COLORS[i % CAT_COLORS.length], minWidth: pct > 1 ? '3px' : 0, transition: 'width 0.6s ease' }} />;
            })}
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)' }} />
          </div>
          <CatRows cats={allCats} diskUsed={disk.used_gb} colors={CAT_COLORS} />
        </>
      )}
      {allCats.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#334155', fontSize: '12px' }}>
          Reiniciá el agente en la VPS para ver el desglose por categoría.
        </div>
      )}
    </ModalShell>
  );
}

// ── Net Modal ─────────────────────────────────────────────────────────────────
function NetModal({ rxHist, txHist, data, onClose }: {
  rxHist: number[]; txHist: number[]; data: VpsMetrics; onClose: () => void;
}) {
  const RX = '#60a5fa', TX = '#a78bfa';
  const stats = [
    { label: 'RX actual',   val: `${data.net.rx_mbps.toFixed(3)} MB/s`, color: RX },
    { label: 'TX actual',   val: `${data.net.tx_mbps.toFixed(3)} MB/s`, color: TX },
    { label: 'RX pico',     val: `${maxVal(rxHist).toFixed(3)} MB/s`,   color: RX },
    { label: 'TX pico',     val: `${maxVal(txHist).toFixed(3)} MB/s`,   color: TX },
    { label: 'RX promedio', val: `${avg(rxHist).toFixed(3)} MB/s`,      color: '#94a3b8' },
    { label: 'TX promedio', val: `${avg(txHist).toFixed(3)} MB/s`,      color: '#94a3b8' },
  ];
  return (
    <ModalShell onClose={onClose} title="Red" sub={`Historial · últimas ${MAX_HISTORY} lecturas`}
      icon="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" color={RX}>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '14px', marginBottom: '8px' }}>
          {[{ color: RX, label: '↓ RX recibido' }, { color: TX, label: '↑ TX enviado' }].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '14px', height: '3px', borderRadius: '2px', background: l.color }} />
              <span style={{ fontSize: '11px', color: '#475569' }}>{l.label}</span>
            </div>
          ))}
        </div>
        <DualSparkline h1={rxHist} h2={txHist} c1={RX} c2={TX} height={100} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
        {stats.map(s => (
          <div key={s.label} style={{ ...G.panel, padding: '10px 12px' }}>
            <p style={{ margin: 0, fontSize: '10px', color: '#475569' }}>{s.label}</p>
            <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 800, color: s.color }}>{s.val}</p>
          </div>
        ))}
      </div>
      {data.connections && (
        <>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Conexiones TCP activas</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {[
              { label: 'Establecidas', val: data.connections.established, color: '#34d399' },
              { label: 'Escuchando',   val: data.connections.listening,   color: RX },
              { label: 'Total',        val: data.connections.total,        color: '#94a3b8' },
            ].map(c => (
              <div key={c.label} style={{ ...G.panel, textAlign: 'center', padding: '10px 8px' }}>
                <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: c.color }}>{c.val}</p>
                <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#475569' }}>{c.label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ── Gauge section clickeable ──────────────────────────────────────────────────
function GaugeSection({ data, cpuColor, ramColor, diskColor }: {
  data: VpsMetrics; cpuColor: string; ramColor: string; diskColor: string;
}) {
  const [modal, setModal] = useState<'cpu' | 'ram' | 'disk' | null>(null);
  const gauges = [
    { key: 'cpu'  as const, pct: data.cpu.percent,  color: cpuColor,  label: 'CPU',   sub: `${data.cpu.count}c` },
    { key: 'ram'  as const, pct: data.ram.percent,  color: ramColor,  label: 'RAM',   sub: `${(data.ram.avail_mb/1024).toFixed(1)}GB libre` },
    { key: 'disk' as const, pct: data.disk.percent, color: diskColor, label: 'Disco', sub: `${data.disk.free_gb}GB libre` },
  ];
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        {gauges.map(g => (
          <button key={g.key} onClick={() => setModal(g.key)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '10px', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}
            title={`Ver detalle de ${g.label}`}>
            <CircleGauge pct={g.pct} color={g.color} label={g.label} sub={g.sub} />
          </button>
        ))}
      </div>
      {modal === 'cpu'  && <CpuModal  data={data} color={cpuColor}  onClose={() => setModal(null)} />}
      {modal === 'ram'  && <RamModal  data={data} color={ramColor}  onClose={() => setModal(null)} />}
      {modal === 'disk' && <DiskModal disk={data.disk} color={diskColor} onClose={() => setModal(null)} />}
    </>
  );
}

// ── Category rows (expandibles) ───────────────────────────────────────────────
function CatRows({ cats, diskUsed, colors }: { cats: DiskCategory[]; diskUsed: number; colors: string[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {cats.map((cat, i) => {
        const c = colors[i % colors.length];
        const pct = diskUsed > 0 ? (cat.used_gb / diskUsed) * 100 : 0;
        const hasChildren = (cat.children?.length ?? 0) > 0;
        const isOpen = expanded === cat.path;
        return (
          <div key={cat.path}>
            {/* Fila principal */}
            <div
              onClick={() => hasChildren && setExpanded(isOpen ? null : cat.path)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: hasChildren ? 'pointer' : 'default', borderRadius: '8px', padding: '4px 2px', transition: 'background 0.15s' }}
              onMouseEnter={e => { if (hasChildren) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: c, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>{cat.label}</span>
                    <span style={{ fontSize: '10px', color: '#334155', fontFamily: 'monospace' }}>{cat.path}</span>
                    {hasChildren && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={2.5} style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                      </svg>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: c, flexShrink: 0, marginLeft: '8px' }}>{cat.used_gb} GB</span>
                </div>
                <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: '2px', background: c, transition: 'width 0.5s ease' }} />
                </div>
              </div>
              <span style={{ fontSize: '10px', color: '#475569', flexShrink: 0, width: '36px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
            </div>

            {/* Subdirectorios expandidos */}
            {isOpen && cat.children && cat.children.length > 0 && (
              <div style={{ marginLeft: '20px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '12px', borderLeft: `2px solid ${c}30` }}>
                {cat.children.map(child => {
                  const childPct = cat.used_gb > 0 ? (child.used_gb / cat.used_gb) * 100 : 0;
                  return (
                    <div key={child.path} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.name}</span>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', flexShrink: 0, marginLeft: '8px' }}>{child.used_gb} GB</span>
                        </div>
                        <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.05)' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, childPct)}%`, borderRadius: '2px', background: `${c}80` }} />
                        </div>
                      </div>
                      <span style={{ fontSize: '10px', color: '#334155', flexShrink: 0, width: '36px', textAlign: 'right' }}>{childPct.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Colors ─────────────────────────────────────────────────────────────────
const CAT_COLORS = ['#4ade80', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#22d3ee', '#fb923c', '#f472b6'];


// ── Top disk consumers ────────────────────────────────────────────────────────
function TopDiskConsumers({ disk }: { disk: VpsMetrics['disk'] }) {
  const totalUsed = disk.used_gb;
  const items = (disk.categories ?? []).flatMap((cat, i) =>
    (cat.children ?? []).map(child => ({
      ...child,
      category: cat.label,
      catColor: CAT_COLORS[i % CAT_COLORS.length],
    }))
  ).sort((a, b) => b.used_gb - a.used_gb).slice(0, 10);

  return (
    <div style={{ ...G.card, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top apps/componentes (disco)</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {items.length === 0 && (
          <p style={{ margin: 0, fontSize: '12px', color: '#334155', textAlign: 'center', padding: '16px' }}>Sin datos de desglose de disco</p>
        )}
        {items.map((item, i) => {
          const pct = totalUsed > 0 ? (item.used_gb / totalUsed) * 100 : 0;
          return (
            <div key={item.path}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#334155', width: '14px', textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                  <span style={{ fontSize: '10px', color: '#475569', flexShrink: 0 }}>{item.category}</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: item.catColor, flexShrink: 0, marginLeft: '8px' }}>{item.used_gb} GB</span>
              </div>
              <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, borderRadius: '3px', background: item.catColor, transition: 'width 0.6s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                <span style={{ fontSize: '10px', color: '#334155' }}>{pct.toFixed(1)}% del uso total</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Top RAM processes ─────────────────────────────────────────────────────────
function TopRamProcesses({ procs }: { procs: VpsMetrics['top_procs'] }) {
  const items = [...procs].sort((a, b) => b.mem - a.mem).slice(0, 5);
  return (
    <div style={{ ...G.card, alignSelf: 'start' }}>
      <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top procesos (RAM)</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.length === 0 && (
          <p style={{ margin: 0, fontSize: '12px', color: '#334155', textAlign: 'center', padding: '16px' }}>Sin datos de procesos</p>
        )}
        {items.map((proc, i) => (
          <div key={proc.pid} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: i === 0 ? 'rgba(168,85,247,0.05)' : 'rgba(255,255,255,0.02)' }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#334155', width: '14px', textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proc.name}</p>
              <p style={{ margin: 0, fontSize: '10px', color: '#334155' }}>PID {proc.pid}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: statusColor(proc.mem) }}>{proc.mem}% RAM</p>
              <p style={{ margin: 0, fontSize: '10px', color: '#475569' }}>{proc.cpu}% CPU</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Top procs CPU (top 5) ─────────────────────────────────────────────────────
function TopProcsToggle({ procs }: { procs: VpsMetrics['top_procs'] }) {
  const sorted = [...procs].sort((a, b) => b.cpu - a.cpu).slice(0, 10);
  return (
    <div style={{ ...G.card, display: 'flex', flexDirection: 'column' }}>
      <p style={{ margin: '0 0 14px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top procesos (CPU)</p>
      <div className="vps-docker-scroll" style={{ overflowY: 'auto', maxHeight: '220px', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px', flex: 1 }}>
        {sorted.length === 0 && (
          <p style={{ margin: 0, fontSize: '12px', color: '#334155', textAlign: 'center', padding: '16px' }}>Sin datos de procesos</p>
        )}
        {sorted.map((proc, i) => (
          <div key={proc.pid} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: i === 0 ? `${ORANGE}08` : 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#334155', width: '14px', textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proc.name}</p>
              <p style={{ margin: 0, fontSize: '10px', color: '#334155' }}>PID {proc.pid}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: statusColor(proc.cpu) }}>{proc.cpu}% CPU</p>
              <p style={{ margin: 0, fontSize: '10px', color: '#475569' }}>{proc.mem}% RAM</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Alerts banner ─────────────────────────────────────────────────────────────
function AlertsBanner({ data }: { data: VpsMetrics }) {
  const alerts: { msg: string; color: string }[] = [];
  if (data.cpu.percent >= 85)  alerts.push({ msg: `CPU al ${data.cpu.percent}% — carga elevada`,     color: '#f87171' });
  if (data.ram.percent >= 85)  alerts.push({ msg: `RAM al ${data.ram.percent}% — memoria crítica`,   color: '#f87171' });
  if (data.disk.percent >= 80) alerts.push({ msg: `Disco al ${data.disk.percent}% — espacio bajo`,   color: '#fbbf24' });
  if (alerts.length === 0) return null;
  return (
    <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {alerts.map((a, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', background: `${a.color}08`, border: `1px solid ${a.color}30` }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          <span style={{ fontSize: '12px', fontWeight: 700, color: a.color }}>{a.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ── Trend badge ───────────────────────────────────────────────────────────────
function TrendBadge({ current, previous }: { current: number; previous: number }) {
  const { icon, color, delta } = trend(current, previous);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 800, color, marginLeft: '5px' }}>
      {icon}
      <span style={{ fontSize: '10px', color: '#475569' }}>{Math.abs(delta).toFixed(1)}</span>
    </span>
  );
}

// ── 10 min summary ────────────────────────────────────────────────────────────
function TenMinSummary({ cpuHist, ramHist, rxHist, txHist, data }: {
  cpuHist: number[]; ramHist: number[]; rxHist: number[]; txHist: number[]; data: VpsMetrics;
}) {
  const sections = [
    { label: 'CPU %', hist: cpuHist, current: data.cpu.percent, color: statusColor(data.cpu.percent) },
    { label: 'RAM %', hist: ramHist, current: data.ram.percent, color: statusColor(data.ram.percent) },
    { label: 'RX MB/s', hist: rxHist, current: data.net.rx_mbps, color: '#60a5fa' },
    { label: 'TX MB/s', hist: txHist, current: data.net.tx_mbps, color: '#a78bfa' },
  ];
  return (
    <div style={{ ...G.card }}>
      <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Resumen últimos 10 min</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {sections.map(s => (
          <div key={s.label} style={{ ...G.panel, padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>{s.label}</span>
              <span style={{ fontSize: '13px', fontWeight: 800, color: s.color }}>{s.current.toFixed(1)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: '#64748b' }}>avg</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>{avg(s.hist).toFixed(1)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '10px', color: '#64748b' }}>max</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>{maxVal(s.hist).toFixed(1)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Disk prediction ───────────────────────────────────────────────────────────
function DiskPrediction({ diskHist, totalGb, currentPct }: { diskHist: number[]; totalGb: number; currentPct: number }) {
  const { hours, growthPctPerHour } = predictDiskFull(diskHist);
  const growthGbPerHour = (growthPctPerHour / 100) * totalGb;
  const isStable = hours === null;
  return (
    <div style={{ ...G.card }}>
      <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Predicción de disco</p>
      {diskHist.length < 5 ? (
        <p style={{ margin: 0, fontSize: '12px', color: '#334155', textAlign: 'center', padding: '20px' }}>Recolectando datos...</p>
      ) : isStable ? (
        <div style={{ textAlign: 'center', padding: '14px', borderRadius: '10px', background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.12)' }}>
          <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#34d399' }}>Estable</p>
          <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#475569' }}>Sin crecimiento significativo</p>
          <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#334155' }}>{currentPct.toFixed(1)}% usado · {growthGbPerHour.toFixed(3)} GB/h</p>
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center', padding: '14px', borderRadius: '10px', background: `${statusColor(currentPct)}10`, border: `1px solid ${statusColor(currentPct)}25`, marginBottom: '12px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>Tiempo estimado hasta llenarse</p>
            <p style={{ margin: '6px 0 0', fontSize: '26px', fontWeight: 900, color: statusColor(currentPct) }}>{hours!.toFixed(1)}h</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#475569' }}>Crecimiento</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>{growthPctPerHour.toFixed(2)}% / h</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#475569' }}>Equivalente</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>{growthGbPerHour.toFixed(2)} GB / h</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: '#475569' }}>Usado ahora</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: statusColor(currentPct) }}>{currentPct.toFixed(1)}%</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}



// ── Logs panel ────────────────────────────────────────────────────────────────
function LogsPanel() {
  const [lines, setLines] = useState<string[]>([]);
  const [open, setOpen]   = useState(false);
  const [busy, setBusy]   = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    setBusy(true);
    try {
      const res  = await fetch('/api/vps/logs', { cache: 'no-store' });
      const json = await res.json();
      if (Array.isArray(json.lines)) setLines(json.lines);
    } catch {} finally { setBusy(false); }
  }, []);

  useEffect(() => { if (open) fetchLogs(); }, [open, fetchLogs]);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(fetchLogs, 10_000);
    return () => clearInterval(id);
  }, [open, fetchLogs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  const lineColor = (l: string) =>
    l.includes('ERROR') ? '#f87171' : l.includes('WARN') ? '#fbbf24' : '#64748b';

  return (
    <div style={{ ...G.card, marginTop: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Logs del agente</p>
          {open && busy && <span style={{ fontSize: '10px', color: '#334155' }}>actualizando...</span>}
          {open && !busy && <span style={{ fontSize: '10px', color: '#334155' }}>· cada 10s</span>}
        </div>
        <button onClick={() => setOpen(o => !o)}
          style={{ padding: '4px 12px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
          {open ? 'Ocultar' : 'Ver logs'}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: '12px', background: '#060612', borderRadius: '8px', padding: '10px 14px', height: '220px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '11px', lineHeight: 1.7, border: '1px solid rgba(255,255,255,0.06)' }}>
          {lines.length === 0 && <span style={{ color: '#334155' }}>Sin logs disponibles — asegurate que el agente esté corriendo.</span>}
          {lines.map((line, i) => (
            <div key={i} style={{ color: lineColor(line), whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{line}</div>
          ))}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ data, cpuHist, ramHist, rxHist, txHist, diskHist, swapHist, diskReadHist, diskWriteHist, connHist, histSnapshots }: {
  data: VpsMetrics;
  cpuHist: number[]; ramHist: number[]; rxHist: number[]; txHist: number[]; diskHist: number[];
  swapHist: number[]; diskReadHist: number[]; diskWriteHist: number[]; connHist: number[];
  histSnapshots: HistSnapshot[];
}) {
  const [netModal,       setNetModal]       = useState(false);
  const [ramProcsModal,  setRamProcsModal]  = useState(false);
  const [loadAvgModal,   setLoadAvgModal]   = useState(false);
  const [histRange,      setHistRange]      = useState<'live' | '1d' | '7d'>('live');
  const [procsModal,     setProcsModal]     = useState(false);
  const [uptimeModal,    setUptimeModal]    = useState(false);
  const [svcsModal,      setSvcsModal]      = useState(false);
  const [cpuCoreModal,   setCpuCoreModal]   = useState(false);
  const [diskIOModal,    setDiskIOModal]    = useState(false);
  const [diskCatModal,   setDiskCatModal]   = useState(false);
  const [tcpModal,       setTcpModal]       = useState(false);
  const cpuColor  = statusColor(data.cpu.percent);
  const ramColor  = statusColor(data.ram.percent);
  const diskColor = statusColor(data.disk.percent);
  const activeServices = data.services.filter(s => s.active).length;
  const totalServices  = data.services.length;
  const allOk          = totalServices > 0 && activeServices === totalServices;

  return (
    <>
      <AlertsBanner data={data} />

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '16px' }}>
        {[
          { label: 'Uptime',    val: fmtUptime(data.uptime_s),    color: '#34d399', sub: 'sin reinicios' },
          { label: 'CPU',       val: `${data.cpu.percent}%`,       color: cpuColor,  sub: `${data.cpu.count}c · load ${data.cpu.load_avg[0]}`,  prev: cpuHist[cpuHist.length - 2] ?? data.cpu.percent },
          { label: 'RAM',       val: `${data.ram.percent}%`,       color: ramColor,  sub: `${data.ram.used_mb} / ${data.ram.total_mb} MB`,      prev: ramHist[ramHist.length - 2] ?? data.ram.percent },
          { label: 'Disco',     val: `${data.disk.percent}%`,      color: diskColor, sub: `${data.disk.used_gb} / ${data.disk.total_gb} GB`,    prev: diskHist[diskHist.length - 2] ?? data.disk.percent },
          { label: 'Servicios', val: `${activeServices}/${totalServices}`, color: allOk ? '#34d399' : '#f87171', sub: allOk ? 'Todos operativos' : `${totalServices - activeServices} caído(s)` },
        ].map(k => (
          <div key={k.label} style={{ ...G.card, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 90% 10%, ${k.color}10, transparent 60%)`, pointerEvents: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</p>
            </div>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: k.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {k.val}
              {'prev' in k && <TrendBadge current={parseFloat(k.val)} previous={k.prev as number} />}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#334155' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Gauges + Historial */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
        <div style={{ ...G.card }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Uso actual · <span style={{ color: '#334155', fontWeight: 400, textTransform: 'none' }}>click para detalle</span></p>
          <GaugeSection data={data} cpuColor={cpuColor} ramColor={ramColor} diskColor={diskColor} />
        </div>
        {(() => {
          // ── Historial: agrega snapshots según rango ────────────────────────
          const bucketed = (key: keyof HistSnapshot, hours: number, n: number): number[] => {
            const now = Date.now(), cutoff = now - hours * 3_600_000;
            const filtered = histSnapshots.filter(s => new Date(s.ts).getTime() >= cutoff);
            if (filtered.length === 0) return [];
            const bSize = (hours * 3_600_000) / n;
            const result: number[] = [];
            for (let i = 0; i < n; i++) {
              const lo = cutoff + i * bSize, hi = lo + bSize;
              const vals = filtered.filter(s => { const t = new Date(s.ts).getTime(); return t >= lo && t < hi; }).map(s => s[key] as number);
              if (vals.length > 0) result.push(vals.reduce((a, b) => a + b, 0) / vals.length);
            }
            return result;
          };
          const isLive = histRange === 'live';
          const h = histRange === '7d' ? 168 : 24;
          const n = histRange === '7d' ? 42  : 24;
          const subtitle = isLive
            ? `últimas ${MAX_HISTORY} lecturas · cada 30s`
            : histRange === '1d' ? 'últimas 24 horas · promedio por hora'
            : 'últimos 7 días · promedio cada 4h';
          const series = [
            { label: 'CPU %',   history: isLive ? cpuHist      : bucketed('cpu',  h, n), color: cpuColor,  val: `${data.cpu.percent}%`,                 net: false },
            { label: 'RAM %',   history: isLive ? ramHist      : bucketed('ram',  h, n), color: ramColor,  val: `${data.ram.percent}%`,                 net: false },
            { label: 'Swap %',  history: isLive ? swapHist     : bucketed('swap', h, n), color: '#22d3ee', val: `${data.swap?.percent ?? 0}%`,          net: false },
            { label: 'Red ↓',   history: isLive ? rxHist       : bucketed('rx',   h, n), color: '#60a5fa', val: `${data.net.rx_mbps} MB/s`,             net: true  },
            { label: 'Red ↑',   history: isLive ? txHist       : bucketed('tx',   h, n), color: '#a78bfa', val: `${data.net.tx_mbps} MB/s`,             net: true  },
            { label: 'Disco',   history: isLive ? diskReadHist : bucketed('disk', h, n), color: '#fb923c', val: `${data.disk.percent}%`,                net: false },
          ];
          const RANGES: { k: typeof histRange; label: string }[] = [
            { k: 'live', label: 'Live' },
            { k: '1d',   label: '1D'  },
            { k: '7d',   label: '7D'  },
          ];
          return (
            <div style={{ ...G.card }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Historial</p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>{subtitle}</p>
                </div>
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', padding: '3px' }}>
                  {RANGES.map(r => (
                    <button key={r.k} onClick={() => setHistRange(r.k)}
                      style={{ padding: '3px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700, transition: 'all 0.15s',
                        background: histRange === r.k ? (r.k === 'live' ? '#34d399' : ORANGE) : 'transparent',
                        color: histRange === r.k ? '#0f172a' : '#475569' }}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
                {series.map(s => (
                  <div key={s.label} onClick={s.net ? () => setNetModal(true) : undefined}
                    style={{ cursor: s.net ? 'pointer' : 'default', borderRadius: '7px', padding: '4px', background: s.net ? 'rgba(96,165,250,0.03)' : 'transparent', transition: 'background 0.15s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                        {s.label}{s.net && <span style={{ marginLeft: '4px', fontSize: '10px', color: '#334155' }}>· ver →</span>}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: s.color }}>{s.val}</span>
                    </div>
                    {!isLive && s.history.length === 0
                      ? <p style={{ margin: 0, fontSize: '10px', color: '#334155', textAlign: 'center', padding: '8px 0' }}>Recolectando...</p>
                      : <Sparkline history={s.history} color={s.color} height={38} />
                    }
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Row A: CPU · Memoria · Red (agrupado por recurso) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>

        {/* CPU & Sistema */}
        <div style={{ ...G.card, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>CPU & Sistema</p>

          {/* Load average — clickeable */}
          <div onClick={() => setLoadAvgModal(true)} style={{ cursor: 'pointer', borderRadius: '8px', padding: '6px', margin: '-6px', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)') }
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <p style={{ margin: '0 0 5px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Load average <span style={{ fontSize: '9px', color: '#334155', fontWeight: 400, textTransform: 'none' }}>· ver detalle →</span></p>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['1m', '5m', '15m'].map((t, i) => (
                <div key={t} style={{ flex: 1, ...G.panel, textAlign: 'center', padding: '8px 4px' }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: statusColor((data.cpu.load_avg[i] / data.cpu.count) * 100) }}>{data.cpu.load_avg[i]}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>{t}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Procesos — clickeable */}
          {data.procs && (
            <div onClick={() => setProcsModal(true)} style={{ cursor: 'pointer', borderRadius: '8px', padding: '6px', margin: '-6px', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <p style={{ margin: '0 0 5px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Procesos <span style={{ fontSize: '9px', color: '#334155', fontWeight: 400, textTransform: 'none' }}>· ver detalle →</span></p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ flex: 1, ...G.panel, textAlign: 'center', padding: '8px 4px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#94a3b8' }}>{data.procs.total}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>Total</p>
                </div>
                <div style={{ flex: 1, ...G.panel, textAlign: 'center', padding: '8px 4px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: data.procs.zombies > 0 ? '#f87171' : '#34d399' }}>{data.procs.zombies}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>Zombies</p>
                </div>
              </div>
            </div>
          )}

          {/* Uptime + Servicios — cada uno clickeable */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            <div onClick={() => setUptimeModal(true)} style={{ ...G.panel, textAlign: 'center', padding: '8px 4px', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = (G.panel as React.CSSProperties).background as string)}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#34d399' }}>{fmtUptime(data.uptime_s)}</p>
              <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>Uptime ↗</p>
            </div>
            <div onClick={() => setSvcsModal(true)} style={{ ...G.panel, textAlign: 'center', padding: '8px 4px', cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = (G.panel as React.CSSProperties).background as string)}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: allOk ? '#34d399' : '#f87171' }}>{activeServices}/{totalServices}</p>
              <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>Servicios ↗</p>
            </div>
          </div>
        </div>

        {/* Memoria & Swap */}
        <div style={{ ...G.card, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Memoria</p>
          <div>
            <p style={{ margin: '0 0 5px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>RAM</p>
            {[
              { label: 'Usado',      val: `${(data.ram.used_mb / 1024).toFixed(2)} GB`, pct: (data.ram.used_mb / data.ram.total_mb) * 100,  clr: ramColor },
              { label: 'Disponible', val: `${(data.ram.avail_mb / 1024).toFixed(2)} GB`, pct: (data.ram.avail_mb / data.ram.total_mb) * 100, clr: '#34d399' },
            ].map(r => (
              <div key={r.label} style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '11px', color: '#475569' }}>{r.label}</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: r.clr }}>{r.val}</span>
                </div>
                <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ height: '100%', width: `${r.pct}%`, borderRadius: '3px', background: r.clr }} />
                </div>
              </div>
            ))}
            <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#334155' }}>Total: {(data.ram.total_mb / 1024).toFixed(2)} GB</p>
          </div>
          {data.swap && data.swap.total_mb > 0 && (
            <div>
              <p style={{ margin: '0 0 5px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Swap</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ flex: 1, ...G.panel, textAlign: 'center', padding: '8px 4px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: statusColor(data.swap.percent) }}>{data.swap.percent.toFixed(1)}%</p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>Uso</p>
                </div>
                <div style={{ flex: 1, ...G.panel, textAlign: 'center', padding: '8px 4px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#22d3ee' }}>{data.swap.used_mb}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>MB usados</p>
                </div>
                <div style={{ flex: 1, ...G.panel, textAlign: 'center', padding: '8px 4px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#94a3b8' }}>{data.swap.total_mb}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>MB total</p>
                </div>
              </div>
            </div>
          )}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Top procesos por RAM</p>
              <button onClick={() => setRamProcsModal(true)}
                title="Ver top 10"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#475569', display: 'flex', alignItems: 'center', borderRadius: '4px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" /></svg>
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[...data.top_procs].sort((a, b) => b.mem - a.mem).slice(0, 3).map((proc, i) => (
                <div key={proc.pid} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', background: i === 0 ? 'rgba(168,85,247,0.05)' : 'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, color: '#334155', width: '14px', textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proc.name}</p>
                    <p style={{ margin: 0, fontSize: '10px', color: '#334155' }}>PID {proc.pid}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: statusColor(proc.mem) }}>{proc.mem}% RAM</p>
                    <p style={{ margin: 0, fontSize: '10px', color: '#475569' }}>{proc.cpu}% CPU</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Red & I/O */}
        <div style={{ ...G.card, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Red & I/O</p>
          <div>
            <p style={{ margin: '0 0 5px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Tráfico de red</p>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ flex: 1, ...G.panel, textAlign: 'center', padding: '8px 4px' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#60a5fa' }}>↓ {data.net.rx_mbps}</p>
                <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>MB/s RX</p>
              </div>
              <div style={{ flex: 1, ...G.panel, textAlign: 'center', padding: '8px 4px' }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#a78bfa' }}>↑ {data.net.tx_mbps}</p>
                <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>MB/s TX</p>
              </div>
            </div>
          </div>
          {data.connections && (
            <div>
              <p style={{ margin: '0 0 5px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Conexiones TCP</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ flex: 1, ...G.panel, textAlign: 'center', padding: '8px 4px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#34d399' }}>{data.connections.established}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>Activas</p>
                </div>
                <div style={{ flex: 1, ...G.panel, textAlign: 'center', padding: '8px 4px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#60a5fa' }}>{data.connections.listening}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>Listen</p>
                </div>
                <div style={{ flex: 1, ...G.panel, textAlign: 'center', padding: '8px 4px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#94a3b8' }}>{data.connections.total}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>Total</p>
                </div>
              </div>
            </div>
          )}
          {data.disk_io && (
            <div>
              <p style={{ margin: '0 0 5px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Disco I/O</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{ flex: 1, ...G.panel, textAlign: 'center', padding: '8px 4px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#fb923c' }}>↓ {data.disk_io.read_mbps}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>MB/s R</p>
                </div>
                <div style={{ flex: 1, ...G.panel, textAlign: 'center', padding: '8px 4px' }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#f472b6' }}>↑ {data.disk_io.write_mbps}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>MB/s W</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row D: Gráficas avanzadas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <CpuCoreHeatmap perCore={data.cpu.per_core ?? []} onOpen={() => setCpuCoreModal(true)} />
        <DiskIOChart
          readHist={diskReadHist}
          writeHist={diskWriteHist}
          currentRead={data.disk_io?.read_mbps ?? 0}
          currentWrite={data.disk_io?.write_mbps ?? 0}
          onOpen={() => setDiskIOModal(true)}
        />
        <DiskCategoryDonut categories={data.disk.categories ?? []} usedGb={data.disk.used_gb} totalGb={data.disk.total_gb} onOpen={() => setDiskCatModal(true)} />
        <TcpConnChart history={connHist} current={data.connections?.established ?? 0} listening={data.connections?.listening ?? 0} onOpen={() => setTcpModal(true)} />
      </div>

      {/* Rows B+C: Top disco (span 2 filas) · Docker · Top procesos · Servicios · Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '300px 300px', gap: '12px', marginBottom: '12px' }}>
        {/* TopDiskConsumers: ocupa fila 1 y 2 */}
        <div style={{ gridRow: '1 / 3', display: 'flex', flexDirection: 'column' }}>
          <TopDiskConsumers disk={data.disk} />
        </div>

        {/* Fila 1 col 2: Docker */}
        <div style={{ ...G.card, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Docker</p>
            {data.docker && (
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '5px', background: (data.docker.filter(c => c.status.toLowerCase().startsWith('up')).length > 0) ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)', color: (data.docker.filter(c => c.status.toLowerCase().startsWith('up')).length > 0) ? '#34d399' : '#475569' }}>
                {data.docker.filter(c => c.status.toLowerCase().startsWith('up')).length}/{data.docker.length} activos
              </span>
            )}
          </div>
          {(!data.docker || data.docker.length === 0) ? (
            <p style={{ margin: 0, fontSize: '12px', color: '#334155', textAlign: 'center', padding: '16px' }}>Sin contenedores detectados</p>
          ) : (
            <div className="vps-docker-scroll" style={{ overflowY: 'auto', maxHeight: '300px', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
              {data.docker.map(c => {
                const isUp = c.status.toLowerCase().startsWith('up');
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: isUp ? 'rgba(52,211,153,0.04)' : 'rgba(248,113,113,0.04)', border: `1px solid ${isUp ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.15)'}`, flexShrink: 0 }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isUp ? '#34d399' : '#f87171', flexShrink: 0, boxShadow: `0 0 5px ${isUp ? '#34d399' : '#f87171'}` }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: isUp ? '#e2e8f0' : '#f87171', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                      <p style={{ margin: 0, fontSize: '10px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.image}</p>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: isUp ? '#34d399' : '#f87171', flexShrink: 0 }}>{isUp ? 'up' : 'down'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fila 1 col 3: Top procesos CPU */}
        <TopProcsToggle procs={data.top_procs} />

        {/* Fila 2 col 2: Servicios */}
        <div style={{ ...G.card }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Servicios</p>
            <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: allOk ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: allOk ? '#34d399' : '#f87171' }}>
              {totalServices === 0 ? '—' : allOk ? 'Todos OK' : `${totalServices - activeServices} caído(s)`}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.services.length === 0 && (
              <p style={{ margin: 0, fontSize: '12px', color: '#334155', textAlign: 'center', padding: '16px' }}>Sin servicios configurados en el agente</p>
            )}
            {data.services.map(svc => (
              <div key={svc.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '9px', background: svc.active ? 'rgba(52,211,153,0.04)' : 'rgba(248,113,113,0.06)', border: `1px solid ${svc.active ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.2)'}` }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: svc.active ? '#34d399' : '#f87171', boxShadow: `0 0 6px ${svc.active ? '#34d399' : '#f87171'}`, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: svc.active ? '#e2e8f0' : '#f87171' }}>{svc.name}</p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#334155' }}>{svc.status}</p>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: svc.active ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: svc.active ? '#34d399' : '#f87171' }}>
                  {svc.active ? 'active' : 'down'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Fila 2 col 3: Resumen últimos 10 min */}
        <TenMinSummary cpuHist={cpuHist} ramHist={ramHist} rxHist={rxHist} txHist={txHist} data={data} />
      </div>

      <LogsPanel />

      <p style={{ margin: '10px 0 0', fontSize: '10px', color: '#1e293b', textAlign: 'right' }}>
        Datos de la VPS al {new Date(data.ts).toLocaleString('es-ES')}
      </p>

      {netModal && <NetModal rxHist={rxHist} txHist={txHist} data={data} onClose={() => setNetModal(false)} />}

      {/* CPU Core modal */}
      {cpuCoreModal && (
        <ModalShell onClose={() => setCpuCoreModal(false)} title="CPU · Por núcleo" sub={`${data.cpu.per_core?.length ?? 0} núcleos lógicos · carga global ${data.cpu.percent}%`} icon="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" color={cpuColor}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
            {(data.cpu.per_core ?? []).map((pct, i) => {
              const c = statusColor(pct);
              return (
                <div key={i} style={{ borderRadius: '10px', background: `${c}15`, border: `1px solid ${c}40`, padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>Core {i}</span>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: c, lineHeight: 1 }}>{pct}%</span>
                  <div style={{ width: '100%', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: '3px', background: c, transition: 'width 0.5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            {[
              { label: 'Promedio', val: `${avg(data.cpu.per_core ?? []).toFixed(1)}%`, color: cpuColor },
              { label: 'Máximo', val: `${maxVal(data.cpu.per_core ?? [])}%`, color: statusColor(maxVal(data.cpu.per_core ?? [])) },
              { label: 'Mínimo', val: `${Math.min(...(data.cpu.per_core ?? [0]))}%`, color: '#34d399' },
            ].map(r => (
              <div key={r.label} style={{ textAlign: 'center', padding: '14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: r.color }}>{r.val}</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#475569', textTransform: 'uppercase', fontWeight: 700 }}>{r.label}</p>
              </div>
            ))}
          </div>
        </ModalShell>
      )}

      {/* Disco I/O modal */}
      {diskIOModal && (() => {
        const RC = '#fb923c', WC = '#f472b6';
        const stats = [
          { label: 'Lectura actual', val: `${data.disk_io?.read_mbps ?? 0} MB/s`, color: RC },
          { label: 'Escritura actual', val: `${data.disk_io?.write_mbps ?? 0} MB/s`, color: WC },
          { label: 'Pico lectura', val: `${maxVal(diskReadHist).toFixed(2)} MB/s`, color: RC },
          { label: 'Pico escritura', val: `${maxVal(diskWriteHist).toFixed(2)} MB/s`, color: WC },
          { label: 'Avg lectura', val: `${avg(diskReadHist).toFixed(2)} MB/s`, color: RC },
          { label: 'Avg escritura', val: `${avg(diskWriteHist).toFixed(2)} MB/s`, color: WC },
        ];
        return (
          <ModalShell onClose={() => setDiskIOModal(false)} title="Disco I/O" sub="Velocidad de lectura y escritura en tiempo real" icon="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" color={RC}>
            <div style={{ marginBottom: '20px' }}>
              <DualSparkline h1={diskReadHist} h2={diskWriteHist} c1={RC} c2={WC} height={120} />
              <TimeAxis points={Math.max(diskReadHist.length, diskWriteHist.length)} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '3px', background: RC, borderRadius: '2px' }} />
                  <span style={{ fontSize: '11px', color: '#475569' }}>Lectura</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '12px', height: '3px', background: WC, borderRadius: '2px' }} />
                  <span style={{ fontSize: '11px', color: '#475569' }}>Escritura</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {stats.map(s => (
                <div key={s.label} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 900, color: s.color }}>{s.val}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</p>
                </div>
              ))}
            </div>
          </ModalShell>
        );
      })()}

      {/* Disco Categorías modal */}
      {diskCatModal && (() => {
        const cats = (data.disk.categories ?? []).filter(c => c.used_gb > 0.01);
        const total = cats.reduce((s, c) => s + c.used_gb, 0);
        return (
          <ModalShell onClose={() => setDiskCatModal(false)} title="Disco · Categorías" sub={`${data.disk.used_gb} GB usados de ${data.disk.total_gb} GB · ${data.disk.percent}%`} icon="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" color="#4ade80">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {cats.map((cat, i) => {
                const color = CAT_COLORS[i % CAT_COLORS.length];
                const pct = total > 0 ? (cat.used_gb / total) * 100 : 0;
                return (
                  <div key={cat.path}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: color, boxShadow: `0 0 6px ${color}80`, flexShrink: 0 }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', flex: 1 }}>{cat.label}</span>
                      <span style={{ fontSize: '11px', color: '#475569' }}>{cat.path}</span>
                      <span style={{ fontSize: '13px', fontWeight: 900, color }}>{cat.used_gb.toFixed(2)} GB</span>
                      <span style={{ fontSize: '11px', color: '#475569', width: '36px', textAlign: 'right' }}>{pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', marginBottom: cat.children?.length ? '8px' : '4px' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: '3px', background: color, boxShadow: `0 0 8px ${color}60`, transition: 'width 0.6s' }} />
                    </div>
                    {cat.children && cat.children.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px', paddingLeft: '20px' }}>
                        {cat.children.slice(0, 6).map(child => (
                          <div key={child.path} style={{ padding: '3px 8px', borderRadius: '5px', background: `${color}12`, border: `1px solid ${color}30`, fontSize: '10px', color: '#94a3b8' }}>
                            <span style={{ fontWeight: 700, color }}>{child.name}</span> · {child.used_gb} GB
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ModalShell>
        );
      })()}

      {/* TCP Connections modal */}
      {tcpModal && (
        <ModalShell onClose={() => setTcpModal(false)} title="Conexiones TCP" sub="Estado de conexiones de red en tiempo real" icon="M13 10V3L4 14h7v7l9-11h-7z" color="#34d399">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Establecidas', val: data.connections?.established ?? 0, color: '#34d399' },
              { label: 'En escucha', val: data.connections?.listening ?? 0, color: '#60a5fa' },
              { label: 'Total', val: data.connections?.total ?? 0, color: '#94a3b8' },
            ].map(r => (
              <div key={r.label} style={{ textAlign: 'center', padding: '16px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: r.color }}>{r.val}</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>{r.label}</p>
              </div>
            ))}
          </div>
          <Sparkline history={connHist} color="#34d399" height={100} />
          <TimeAxis points={connHist.length} />
          {connHist.length > 1 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '14px' }}>
              {[
                { label: 'Pico', val: maxVal(connHist) },
                { label: 'Promedio', val: avg(connHist).toFixed(1) },
                { label: 'Actual', val: connHist[connHist.length - 1] ?? 0 },
              ].map(r => (
                <div key={r.label} style={{ textAlign: 'center', padding: '10px', borderRadius: '8px', background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)' }}>
                  <p style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#34d399' }}>{r.val}</p>
                  <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#475569', textTransform: 'uppercase', fontWeight: 700 }}>{r.label}</p>
                </div>
              ))}
            </div>
          )}
        </ModalShell>
      )}

      {/* Load Average modal */}
      {loadAvgModal && (
        <ModalShell onClose={() => setLoadAvgModal(false)} title="Load Average" sub={`${data.cpu.count} núcleos lógicos`} icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" color={cpuColor}>
          <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#475569', lineHeight: 1.6 }}>
            Promedio de procesos en espera de CPU. Un valor igual a <strong style={{ color: '#e2e8f0' }}>{data.cpu.count}</strong> = 100% de carga.
            Por encima de {data.cpu.count} indica saturación.
          </p>
          {['1 minuto', '5 minutos', '15 minutos'].map((label, i) => {
            const val = data.cpu.load_avg[i];
            const pct = Math.min(100, (val / data.cpu.count) * 100);
            const sc  = statusColor(pct);
            const state = pct < 60 ? 'Normal' : pct < 85 ? 'Elevado' : 'Crítico';
            return (
              <div key={label} style={{ marginBottom: i < 2 ? '14px' : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>{label}</span>
                    <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: `${sc}18`, color: sc }}>{state}</span>
                  </div>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: sc }}>{val.toFixed(2)}</span>
                </div>
                <div style={{ height: '6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: '4px', background: sc, transition: 'width 0.5s' }} />
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#334155' }}>{pct.toFixed(1)}% de capacidad · umbral crítico: {data.cpu.count.toFixed(1)}</p>
              </div>
            );
          })}
        </ModalShell>
      )}

      {/* Procesos modal */}
      {procsModal && data.procs && (
        <ModalShell onClose={() => setProcsModal(false)} title="Procesos del sistema" sub={`${data.procs.total} procesos activos`} icon="M4 6h16M4 12h16M4 18h7" color="#94a3b8">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Total',    val: data.procs.total,   clr: '#94a3b8', desc: 'Procesos en ejecución' },
              { label: 'Zombies', val: data.procs.zombies,  clr: data.procs.zombies > 0 ? '#f87171' : '#34d399', desc: data.procs.zombies > 0 ? 'Procesos a limpiar' : 'Sin procesos zombie' },
            ].map(r => (
              <div key={r.label} style={{ textAlign: 'center', padding: '16px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: r.clr }}>{r.val}</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>{r.label}</p>
                <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#334155' }}>{r.desc}</p>
              </div>
            ))}
          </div>
          {data.procs.zombies > 0 && (
            <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
              <p style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 700, color: '#f87171' }}>¿Qué son los procesos zombie?</p>
              <p style={{ margin: 0, fontSize: '11px', color: '#475569', lineHeight: 1.6 }}>
                Procesos que terminaron pero cuyo proceso padre no recogió su estado de salida. No consumen CPU pero sí una entrada en la tabla de procesos. En general son inofensivos salvo que sean muchos.
              </p>
            </div>
          )}
          <p style={{ margin: '16px 0 8px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top por CPU ahora</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[...data.top_procs].sort((a, b) => b.cpu - a.cpu).slice(0, 5).map((p, i) => (
              <div key={p.pid} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ fontSize: '10px', color: '#334155', width: '18px', textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                <span style={{ flex: 1, fontSize: '12px', fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontSize: '10px', color: '#334155', flexShrink: 0 }}>PID {p.pid}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: statusColor(p.cpu), flexShrink: 0 }}>{p.cpu}% CPU</span>
              </div>
            ))}
          </div>
        </ModalShell>
      )}

      {/* Uptime modal */}
      {uptimeModal && (() => {
        const d = Math.floor(data.uptime_s / 86400);
        const h = Math.floor((data.uptime_s % 86400) / 3600);
        const m = Math.floor((data.uptime_s % 3600) / 60);
        const bootDate = new Date(Date.now() - data.uptime_s * 1000);
        const stability = data.uptime_s > 30 * 86400 ? 'Excelente' : data.uptime_s > 7 * 86400 ? 'Buena' : data.uptime_s > 86400 ? 'Normal' : 'Reciente';
        const stabColor = data.uptime_s > 7 * 86400 ? '#34d399' : data.uptime_s > 86400 ? '#fbbf24' : '#f87171';
        return (
          <ModalShell onClose={() => setUptimeModal(false)} title="Uptime del servidor" sub="Tiempo desde el último reinicio" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" color="#34d399">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              {[{ label: 'Días', val: d }, { label: 'Horas', val: h }, { label: 'Minutos', val: m }].map(r => (
                <div key={r.label} style={{ textAlign: 'center', padding: '16px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p style={{ margin: 0, fontSize: '32px', fontWeight: 900, color: '#34d399' }}>{r.val}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#475569', textTransform: 'uppercase', fontWeight: 700 }}>{r.label}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#475569', textTransform: 'uppercase', fontWeight: 700 }}>Inicio del servidor</p>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>{bootDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#475569' }}>{bootDate.toLocaleTimeString('es-ES')}</p>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: '10px', background: `${stabColor}0d`, border: `1px solid ${stabColor}25` }}>
                <p style={{ margin: '0 0 4px', fontSize: '10px', color: '#475569', textTransform: 'uppercase', fontWeight: 700 }}>Estabilidad</p>
                <p style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: stabColor }}>{stability}</p>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#475569' }}>{data.uptime_s.toLocaleString('es-ES')} segundos</p>
              </div>
            </div>
          </ModalShell>
        );
      })()}

      {/* Servicios modal */}
      {svcsModal && (
        <ModalShell onClose={() => setSvcsModal(false)} title="Servicios" sub={allOk ? 'Todos operativos' : `${totalServices - activeServices} servicio(s) caído(s)`} icon="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" color={allOk ? '#34d399' : '#f87171'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data.services.length === 0 && <p style={{ margin: 0, fontSize: '12px', color: '#334155', textAlign: 'center', padding: '20px' }}>Sin servicios configurados en el agente</p>}
            {data.services.map(svc => (
              <div key={svc.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '10px', background: svc.active ? 'rgba(52,211,153,0.04)' : 'rgba(248,113,113,0.06)', border: `1px solid ${svc.active ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.2)'}` }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: svc.active ? '#34d399' : '#f87171', boxShadow: `0 0 8px ${svc.active ? '#34d399' : '#f87171'}`, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: svc.active ? '#e2e8f0' : '#f87171' }}>{svc.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#475569' }}>{svc.status}</p>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 800, padding: '3px 10px', borderRadius: '6px', background: svc.active ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: svc.active ? '#34d399' : '#f87171' }}>
                  {svc.active ? 'active' : 'down'}
                </span>
              </div>
            ))}
          </div>
        </ModalShell>
      )}
      {ramProcsModal && (
        <ModalShell onClose={() => setRamProcsModal(false)} title="Top procesos por RAM" sub={`${data.ram.used_mb} MB usados · ${data.ram.total_mb} MB total`} icon="M4 6h16M4 10h16M4 14h16M4 18h16" color={ramColor}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[...data.top_procs].sort((a, b) => b.mem - a.mem).slice(0, 10).map((proc, i) => {
              const memMb = Math.round((proc.mem / 100) * data.ram.total_mb);
              const clr   = statusColor(proc.mem);
              return (
                <div key={proc.pid} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '9px', background: i === 0 ? 'rgba(168,85,247,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${i === 0 ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.04)'}` }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: i < 3 ? clr : '#334155', width: '18px', textAlign: 'right', flexShrink: 0 }}>#{i + 1}</span>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proc.name}</p>
                    <p style={{ margin: 0, fontSize: '10px', color: '#334155' }}>PID {proc.pid}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: clr }}>{proc.mem.toFixed(1)}%</p>
                      <p style={{ margin: 0, fontSize: '10px', color: '#475569' }}>{memMb} MB</p>
                    </div>
                    <div style={{ textAlign: 'right', minWidth: '52px' }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: statusColor(proc.cpu) }}>{proc.cpu.toFixed(1)}%</p>
                      <p style={{ margin: 0, fontSize: '10px', color: '#475569' }}>CPU</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ModalShell>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function OperationsPage() {
  const [data,       setData]      = useState<VpsMetrics | null>(null);
  const [error,      setError]     = useState<string | null>(null);
  const [loading,    setLoading]   = useState(true);
  const [notConf,    setNotConf]   = useState(false);
  const [lastFetch,  setLastFetch] = useState<Date | null>(null);
  const [nextIn,     setNextIn]    = useState(30);
  const [latencyMs,  setLatencyMs] = useState<number | null>(null);
  const [errorSince,     setErrorSince]     = useState<Date | null>(null);
  const [now,            setNow]           = useState(() => new Date());
  const [histSnapshots,  setHistSnapshots] = useState<HistSnapshot[]>([]);

  const cpuHist      = useRef<number[]>([]);
  const ramHist      = useRef<number[]>([]);
  const rxHist       = useRef<number[]>([]);
  const txHist       = useRef<number[]>([]);
  const diskHist     = useRef<number[]>([]);
  const swapHist     = useRef<number[]>([]);
  const diskReadHist  = useRef<number[]>([]);
  const diskWriteHist = useRef<number[]>([]);
  const connHist      = useRef<number[]>([]);

  const push = (ref: React.MutableRefObject<number[]>, val: number) => {
    ref.current = [...ref.current, val].slice(-MAX_HISTORY);
  };

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const res  = await fetch('/api/vps/stats', { cache: 'no-store' });
      setLatencyMs(Math.round(performance.now() - start));
      const json = await res.json();
      if (json.error?.includes('VPS_METRICS_URL')) { setNotConf(true); setLoading(false); return; }
      if (json.error) { setError(json.error); setErrorSince(prev => prev ?? new Date()); setLoading(false); return; }
      const m = json as VpsMetrics;
      setData(m);
      push(cpuHist,      m.cpu.percent);
      push(ramHist,      m.ram.percent);
      push(rxHist,       m.net.rx_mbps);
      push(txHist,       m.net.tx_mbps);
      push(diskHist,     m.disk.percent);
      push(swapHist,     m.swap?.percent        ?? 0);
      push(diskReadHist,  m.disk_io?.read_mbps  ?? 0);
      push(diskWriteHist, m.disk_io?.write_mbps ?? 0);
      push(connHist,     m.connections?.established ?? 0);
      setError(null);
      setErrorSince(null);
      setNotConf(false);
      setLastFetch(new Date());
      setNextIn(30);
    } catch {
      setError('No se pudo conectar con el servidor');
      setLatencyMs(null);
      setErrorSince(prev => prev ?? new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/vps/history', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.snapshots)) setHistSnapshots(d.snapshots); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => {
    const id = setInterval(fetchStats, 30_000);
    return () => clearInterval(id);
  }, [fetchStats]);
  useEffect(() => {
    const id = setInterval(() => setNextIn(n => n <= 1 ? 30 : n - 1), 1000);
    return () => clearInterval(id);
  }, [lastFetch]);
  useEffect(() => {
    if (!error) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [error]);

  const headerProps = { loading, lastFetch, nextIn, latencyMs, onRefresh: fetchStats };

  if (notConf) return (
    <div style={{ padding: '10px 32px' }}>
      <PageHeader {...headerProps} />
      <NotConfigured />
    </div>
  );

  return (
    <div style={{ padding: '10px 32px' }}>
      <PageHeader {...headerProps} />

      {error && (
        <div style={{ ...G.panel, marginBottom: '16px', borderLeft: '3px solid #f87171', background: 'rgba(248,113,113,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
            <p style={{ margin: 0, fontSize: '13px', color: '#f87171', fontWeight: 700 }}>
              VPS sin respuesta
              {errorSince && ` — hace ${Math.floor((now.getTime() - errorSince.getTime()) / 60000)}m ${Math.floor(((now.getTime() - errorSince.getTime()) % 60000) / 1000)}s`}
            </p>
            <span style={{ fontSize: '11px', color: '#475569', marginLeft: 'auto' }}>Reintentando en {nextIn}s</span>
          </div>
          {lastFetch && (
            <p style={{ margin: '6px 0 0 26px', fontSize: '11px', color: '#334155' }}>
              Último dato recibido: {lastFetch.toLocaleTimeString('es-ES')}
              {data && ` · CPU ${data.cpu.percent}% · RAM ${data.ram.percent}% · Disco ${data.disk.percent}%`}
            </p>
          )}
        </div>
      )}

      {!data && !error && loading && <Skeleton />}
      {data && (
        <Dashboard
          data={data}
          cpuHist={cpuHist.current}
          ramHist={ramHist.current}
          rxHist={rxHist.current}
          txHist={txHist.current}
          diskHist={diskHist.current}
          swapHist={swapHist.current}
          diskReadHist={diskReadHist.current}
          diskWriteHist={diskWriteHist.current}
          connHist={connHist.current}
          histSnapshots={histSnapshots}
        />
      )}
    </div>
  );
}

// ── Page header ───────────────────────────────────────────────────────────────
function PageHeader({ loading, lastFetch, nextIn, latencyMs, onRefresh }: {
  loading: boolean; lastFetch: Date | null; nextIn: number; latencyMs: number | null; onRefresh: () => void;
}) {
  const freshness = lastFetch ? Math.max(0, 30 - nextIn) : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>VPS Monitor</h1>
        <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: 'rgba(249,115,22,0.12)', color: ORANGE, border: '1px solid rgba(249,115,22,0.2)' }}>Hostinger KVM 2</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {lastFetch && (
          <span style={{ fontSize: '11px', color: '#334155' }}>
            {lastFetch.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · hace {freshness}s · {latencyMs !== null ? `${latencyMs}ms` : '—'}
          </span>
        )}
        <button onClick={onRefresh} disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', opacity: loading ? 0.5 : 1 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Actualizar
        </button>
      </div>
    </div>
  );
}
