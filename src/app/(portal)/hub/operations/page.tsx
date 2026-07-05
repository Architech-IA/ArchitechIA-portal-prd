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

interface VpsMetrics {
  ts: string;
  uptime_s: number;
  cpu: { percent: number; load_avg: number[]; count: number };
  ram: { total_mb: number; used_mb: number; avail_mb: number; percent: number };
  disk: { total_gb: number; used_gb: number; free_gb: number; percent: number; breakdown?: DiskPartition[]; categories?: DiskCategory[] };
  net: { rx_mbps: number; tx_mbps: number };
  services: { name: string; active: boolean; status: string }[];
  top_procs: { pid: number; name: string; cpu: number; mem: number }[];
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

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ history, color, height = 36 }: { history: number[]; color: string; height?: number }) {
  if (history.length < 2) return <div style={{ height }} />;
  const W = 120;
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '12px' }}>
        {[0, 1, 2, 3, 4].map(i => <div key={i}>{box(260)}</div>)}
      </div>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
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

// ── Disk Panel + Modal ────────────────────────────────────────────────────────
const CAT_COLORS = ['#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#f87171', '#22d3ee', '#fb923c', '#f472b6'];

function DiskPanel({ disk }: { disk: VpsMetrics['disk'] }) {
  const [open, setOpen] = useState(false);
  const color = statusColor(disk.percent);
  const breakdown = disk.breakdown ?? [];
  const categories = disk.categories ?? [];
  const visibleCats = categories.filter(c => c.used_gb > 0.01);
  const catTotal = visibleCats.reduce((s, c) => s + c.used_gb, 0);
  const otherGb = Math.max(0, disk.used_gb - catTotal);
  const allCats: DiskCategory[] = otherGb > 0.05
    ? [...visibleCats, { path: 'other', label: 'Otro', used_gb: parseFloat(otherGb.toFixed(2)) }]
    : visibleCats;

  const SEGMENT_COLORS = CAT_COLORS;

  return (
    <>
      {/* Card clickeable */}
      <button
        onClick={() => setOpen(true)}
        style={{ ...G.card, width: '100%', textAlign: 'left', cursor: 'pointer', display: 'block', padding: '16px 20px', position: 'relative', overflow: 'hidden', transition: 'border-color 0.15s, transform 0.15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}40`; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
      >
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 80% 20%, ${color}0e, transparent 55%)`, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"/></svg>
            <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Disco</p>
          </div>
          <span style={{ fontSize: '10px', color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Ver detalle
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </span>
        </div>

        {/* Mini donut + stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <DiskDonut used={disk.used_gb} total={disk.total_gb} color={color} size={90} />
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontSize: '10px', color: '#475569' }}>Usado</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color }}>{disk.used_gb} GB</span>
              </div>
              <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ height: '100%', width: `${disk.percent}%`, borderRadius: '3px', background: color, transition: 'width 0.6s' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1, textAlign: 'center', ...G.panel, padding: '6px 4px' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#34d399' }}>{disk.free_gb} GB</p>
                <p style={{ margin: '1px 0 0', fontSize: '9px', color: '#334155' }}>libre</p>
              </div>
              <div style={{ flex: 1, textAlign: 'center', ...G.panel, padding: '6px 4px' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#94a3b8' }}>{disk.total_gb} GB</p>
                <p style={{ margin: '1px 0 0', fontSize: '9px', color: '#334155' }}>total</p>
              </div>
            </div>
            {categories.length > 0 && (
              <p style={{ margin: '8px 0 0', fontSize: '10px', color: '#334155' }}>
                {categories.length} categorías · click para ver desglose
              </p>
            )}
          </div>
        </div>
      </button>

      {/* Modal detalle */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(6px)' }}
          onClick={() => setOpen(false)}>
          <div style={{ width: '100%', maxWidth: '540px', maxHeight: 'calc(100vh - 40px)', background: 'rgba(9,9,24,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', boxShadow: '0 32px 80px rgba(0,0,0,0.7)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"/></svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>Espacio en Disco</p>
                  <p style={{ margin: 0, fontSize: '11px', color: '#475569' }}>Desglose por categoría</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '16px 22px 20px', overflowY: 'auto', flex: 1 }}>
              {/* Hero donut + totales */}
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
                  <div style={{ marginTop: '12px', padding: '7px 12px', borderRadius: '8px', background: `${color}12`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color }}>
                      {disk.percent < 60 ? 'Espacio saludable' : disk.percent < 85 ? 'Espacio moderado' : '¡Espacio crítico!'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#475569', marginLeft: 'auto' }}>{disk.percent.toFixed(1)}% usado</span>
                  </div>
                </div>
              </div>

              {/* Barra segmentada tipo Storage (solo si hay categorías) */}
              {allCats.length > 0 && (
                <>
                  <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Qué ocupa el espacio
                  </p>

                  {/* Barra horizontal segmentada */}
                  <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)', marginBottom: '14px', gap: '1px' }}>
                    {allCats.map((cat, i) => {
                      const pct = disk.used_gb > 0 ? (cat.used_gb / disk.used_gb) * 100 : 0;
                      return (
                        <div key={cat.path} title={`${cat.label}: ${cat.used_gb} GB`}
                          style={{ width: `${pct}%`, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length], minWidth: pct > 1 ? '3px' : 0, transition: 'width 0.6s ease' }} />
                      );
                    })}
                    {/* Libre */}
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)' }} />
                  </div>

                  {/* Leyenda + filas expandibles */}
                  <CatRows cats={allCats} diskUsed={disk.used_gb} colors={SEGMENT_COLORS} />
                </>
              )}

              {allCats.length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#334155', fontSize: '12px' }}>
                  Reiniciá el agente en la VPS para ver el desglose por categoría.
                </div>
              )}
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setOpen(false)} style={{ padding: '7px 20px', borderRadius: '9px', border: 'none', background: `linear-gradient(135deg, ${color}, #059669)`, color: '#0f172a', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Top disk consumers ────────────────────────────────────────────────────────
function TopDiskConsumers({ disk }: { disk: VpsMetrics['disk'] }) {
  const totalUsed = disk.used_gb;
  const items = (disk.categories ?? []).flatMap((cat, i) =>
    (cat.children ?? []).map(child => ({
      ...child,
      category: cat.label,
      catColor: CAT_COLORS[i % CAT_COLORS.length],
    }))
  ).sort((a, b) => b.used_gb - a.used_gb).slice(0, 5);

  return (
    <div style={{ ...G.card, alignSelf: 'start' }}>
      <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top apps/componentes (disco)</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ data, cpuHist, ramHist, rxHist, txHist }: {
  data: VpsMetrics; cpuHist: number[]; ramHist: number[]; rxHist: number[]; txHist: number[];
}) {
  const cpuColor  = statusColor(data.cpu.percent);
  const ramColor  = statusColor(data.ram.percent);
  const diskColor = statusColor(data.disk.percent);
  const activeServices = data.services.filter(s => s.active).length;
  const totalServices  = data.services.length;
  const allOk          = totalServices > 0 && activeServices === totalServices;

  return (
    <>
      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '16px' }}>
        {[
          { label: 'Uptime',    val: fmtUptime(data.uptime_s),    color: '#34d399', sub: 'sin reinicios',                             icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'CPU',       val: `${data.cpu.percent}%`,       color: cpuColor,  sub: `${data.cpu.count}c · load ${data.cpu.load_avg[0]}`, icon: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18' },
          { label: 'RAM',       val: `${data.ram.percent}%`,       color: ramColor,  sub: `${data.ram.used_mb} / ${data.ram.total_mb} MB`,    icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
          { label: 'Disco',     val: `${data.disk.percent}%`,      color: diskColor, sub: `${data.disk.used_gb} / ${data.disk.total_gb} GB`,  icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8' },
          { label: 'Servicios', val: `${activeServices}/${totalServices}`, color: allOk ? '#34d399' : '#f87171', sub: allOk ? 'Todos operativos' : `${totalServices - activeServices} caído(s)`, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
        ].map(k => (
          <div key={k.label} style={{ ...G.card, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 90% 10%, ${k.color}10, transparent 60%)`, pointerEvents: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</p>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={k.color} strokeWidth={1.8} opacity={0.7}><path strokeLinecap="round" strokeLinejoin="round" d={k.icon} /></svg>
            </div>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: k.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{k.val}</p>
            <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#334155' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Gauges + Sparklines */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginBottom: '12px' }}>
        <div style={{ ...G.card }}>
          <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Uso actual · <span style={{ color: '#334155', fontWeight: 400, textTransform: 'none' }}>click para detalle</span></p>
          <GaugeSection data={data} cpuColor={cpuColor} ramColor={ramColor} diskColor={diskColor} />
        </div>

        <div style={{ ...G.card }}>
          <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Historial (últimas {MAX_HISTORY} lecturas · cada 30s)</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {[
              { label: 'CPU %',      history: cpuHist, color: cpuColor,   val: `${data.cpu.percent}%` },
              { label: 'RAM %',      history: ramHist, color: ramColor,   val: `${data.ram.percent}%` },
              { label: 'Red ↓ MB/s', history: rxHist,  color: '#60a5fa', val: `${data.net.rx_mbps} MB/s` },
              { label: 'Red ↑ MB/s', history: txHist,  color: '#a78bfa', val: `${data.net.tx_mbps} MB/s` },
            ].map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>{s.label}</span>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: s.color }}>{s.val}</span>
                </div>
                <Sparkline history={s.history} color={s.color} height={38} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resources · Services · Top procs · Top RAM · Top disk */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '12px' }}>
        {/* Resources detail */}
        <div style={{ ...G.card, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recursos</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: 'CPU',   val: `${data.cpu.percent}%`,  sub: `${data.cpu.count} núcleos`,                                                color: cpuColor },
              { label: 'RAM',   val: `${data.ram.percent}%`,  sub: `${(data.ram.used_mb / 1024).toFixed(2)} / ${(data.ram.total_mb / 1024).toFixed(2)} GB`, color: ramColor },
              { label: 'Disco', val: `${data.disk.percent}%`, sub: `${data.disk.used_gb} / ${data.disk.total_gb} GB`,                            color: diskColor },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px', borderRadius: '9px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '4px', height: '26px', borderRadius: '2px', background: r.color }} />
                  <div>
                    <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#475569' }}>{r.label}</p>
                    <p style={{ margin: '1px 0 0', fontSize: '10px', color: '#334155' }}>{r.sub}</p>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: r.color }}>{r.val}</p>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Load average</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['1m', '5m', '15m'].map((t, i) => (
                <div key={t} style={{ flex: 1, ...G.panel, textAlign: 'center', padding: '8px 4px' }}>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: statusColor((data.cpu.load_avg[i] / data.cpu.count) * 100) }}>{data.cpu.load_avg[i]}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>{t}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Red</p>
            <div style={{ display: 'flex', gap: '8px' }}>
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
        </div>

        {/* Services */}
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

        {/* Top processes */}
        <div style={{ ...G.card }}>
          <p style={{ margin: '0 0 14px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Top procesos (CPU)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {data.top_procs.length === 0 && (
              <p style={{ margin: 0, fontSize: '12px', color: '#334155', textAlign: 'center', padding: '16px' }}>Sin datos de procesos</p>
            )}
            {data.top_procs.map((proc, i) => (
              <div key={proc.pid} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: i === 0 ? 'rgba(249,115,22,0.05)' : 'rgba(255,255,255,0.02)' }}>
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

        {/* Top RAM processes */}
        <TopRamProcesses procs={data.top_procs} />

        {/* Top disk consumers */}
        <TopDiskConsumers disk={data.disk} />
      </div>

      <p style={{ margin: '10px 0 0', fontSize: '10px', color: '#1e293b', textAlign: 'right' }}>
        Datos de la VPS al {new Date(data.ts).toLocaleString('es-ES')}
      </p>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function OperationsPage() {
  const [data,      setData]     = useState<VpsMetrics | null>(null);
  const [error,     setError]    = useState<string | null>(null);
  const [loading,   setLoading]  = useState(true);
  const [notConf,   setNotConf]  = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [nextIn,    setNextIn]   = useState(30);

  const cpuHist = useRef<number[]>([]);
  const ramHist = useRef<number[]>([]);
  const rxHist  = useRef<number[]>([]);
  const txHist  = useRef<number[]>([]);

  const push = (ref: React.MutableRefObject<number[]>, val: number) => {
    ref.current = [...ref.current, val].slice(-MAX_HISTORY);
  };

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/vps/stats', { cache: 'no-store' });
      const json = await res.json();
      if (json.error?.includes('VPS_METRICS_URL')) { setNotConf(true); setLoading(false); return; }
      if (json.error) { setError(json.error); setLoading(false); return; }
      const m = json as VpsMetrics;
      setData(m);
      push(cpuHist, m.cpu.percent);
      push(ramHist, m.ram.percent);
      push(rxHist,  m.net.rx_mbps);
      push(txHist,  m.net.tx_mbps);
      setError(null);
      setNotConf(false);
      setLastFetch(new Date());
      setNextIn(30);
    } catch {
      setError('No se pudo conectar con el servidor');
    } finally {
      setLoading(false);
    }
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

  const headerProps = { loading, lastFetch, nextIn, onRefresh: fetchStats };

  if (notConf) return (
    <div style={{ padding: '24px 32px' }}>
      <PageHeader {...headerProps} />
      <NotConfigured />
    </div>
  );

  return (
    <div style={{ padding: '24px 32px' }}>
      <PageHeader {...headerProps} />

      {error && (
        <div style={{ ...G.panel, marginBottom: '16px', borderLeft: '3px solid #f87171', background: 'rgba(248,113,113,0.05)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
          <p style={{ margin: 0, fontSize: '13px', color: '#f87171', fontWeight: 600 }}>VPS inaccesible — {error}</p>
          <span style={{ fontSize: '11px', color: '#475569', marginLeft: 'auto' }}>Reintentando en {nextIn}s</span>
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
        />
      )}
    </div>
  );
}

// ── Page header ───────────────────────────────────────────────────────────────
function PageHeader({ loading, lastFetch, nextIn, onRefresh }: {
  loading: boolean; lastFetch: Date | null; nextIn: number; onRefresh: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>VPS Monitor</h1>
          <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: 'rgba(249,115,22,0.12)', color: ORANGE, border: '1px solid rgba(249,115,22,0.2)' }}>Hostinger KVM 2</span>
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>Observabilidad en tiempo real · actualización cada 30s</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {lastFetch && (
          <span style={{ fontSize: '11px', color: '#334155' }}>
            {lastFetch.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · prox. en {nextIn}s
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
