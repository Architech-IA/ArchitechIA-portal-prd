'use client';
// Popup de detalle de una tarjeta de métricas del Dashboard.
// Lee /api/dashboard/serie (datos reales agrupados por fecha de creación, hora de Colombia).
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { X, Download, ArrowUpRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type KpiClave = 'leads' | 'proposals' | 'conversion' | 'projects';
export interface KpiInfo { clave: KpiClave; label: string; color: string; link: string; valor: string; icon: string }

interface Punto { etiqueta: string; inicio: string; n: number; valor: number; ganados: number; tasa: number }
interface Detalle {
  dias: number;
  puntos: Punto[];
  resumen: { totalActual: number; periodo: number; periodoPrevio: number; valorPeriodo: number; valorPrevio: number; ganadosPeriodo: number; tasaActual: number; promedio: number; pico: { etiqueta: string; n: number } };
  porEstado: { nombre: string; cantidad: number }[];
  porGrupo: { nombre: string; cantidad: number }[];
  recientes: { id: string; titulo: string; estado: string; valor: number; fecha: string }[];
}
type Metrica = 'n' | 'valor' | 'ganados' | 'tasa';

const ESTADOS: Record<string, string> = {
  NEW: 'Nuevo', CONTACTED: 'Contactado', DIAGNOSIS: 'Diagnóstico', DEMO_VALIDATION: 'Validación demo', PROPOSAL_SENT: 'Propuesta enviada', NEGOTIATION: 'Negociación', RESULT: 'Resultado',
  DRAFT: 'Borrador', SENT: 'Enviada', UNDER_REVIEW: 'En revisión', ACCEPTED: 'Aceptada', REJECTED: 'Rechazada',
  PLANNING: 'Planeación', IN_PROGRESS: 'En curso', ON_HOLD: 'En pausa', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
};
const nombreEstado = (s: string) => ESTADOS[s] ?? s;
const MODULO: Record<KpiClave, { titulo: string; unidad: string; detalle?: string }> = {
  leads: { titulo: 'Leads', unidad: 'leads nuevos', detalle: '/leads' },
  proposals: { titulo: 'Propuestas', unidad: 'propuestas nuevas', detalle: '/proposals' },
  conversion: { titulo: 'Leads', unidad: 'leads creados', detalle: '/leads' },
  projects: { titulo: 'Proyectos', unidad: 'proyectos nuevos' },
};
const RANGOS = [{ d: 30, t: '30 días', por: 'día' }, { d: 90, t: '90 días', por: 'semana' }, { d: 365, t: '12 meses', por: 'mes' }];
const dinero = (n: number) => '$' + Math.round(n).toLocaleString('es-CO');
const glass: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 };

function Delta({ actual, previo, sufijo = '' }: { actual: number; previo: number; sufijo?: string }) {
  const dif = actual - previo;
  const pct = previo ? Math.round((dif / previo) * 100) : null;
  const Icono = dif > 0 ? TrendingUp : dif < 0 ? TrendingDown : Minus;
  const col = dif > 0 ? '#34d399' : dif < 0 ? '#f87171' : '#94a3b8';
  return (
    <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: col }}>
      <Icono size={12} />{dif > 0 ? '+' : ''}{pct !== null ? `${pct}%` : dif}{sufijo}<span style={{ color: '#7f8a9c' }}> vs. periodo anterior ({previo})</span>
    </span>
  );
}

function Grafica({ puntos, metrica, color, formato }: { puntos: Punto[]; metrica: Metrica; color: string; formato: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, PAD = 10;
  const vals = puntos.map(p => p[metrica]);
  const max = Math.max(...vals, 1);
  const techo = metrica === 'tasa' ? Math.max(10, Math.ceil(max / 10) * 10) : max <= 4 ? 4 : Math.ceil(max * 1.1);
  const x = (i: number) => (puntos.length > 1 ? (i / (puntos.length - 1)) * W : W / 2);
  const y = (v: number) => H - PAD - (v / techo) * (H - PAD * 2);
  const linea = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const gid = `kd-${color.replace('#', '')}`;
  const ref = useRef<SVGSVGElement>(null);

  const mover = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHover(Math.round(f * (puntos.length - 1)));
  };
  const h = hover !== null ? puntos[hover] : null;
  const marcas = [0, Math.floor((puntos.length - 1) / 2), puntos.length - 1];

  return (
    <div className="relative" style={{ paddingLeft: 38 }}>
      {[0, 0.5, 1].map(f => (
        <span key={f} className="absolute text-[10px] text-[#7f8a9c] tabular-nums" style={{ left: 0, top: `calc(${(y(techo * f) / H) * 100}% - 6px)` }}>{formato(techo * f)}</span>
      ))}
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onPointerMove={mover} onPointerLeave={() => setHover(null)}
        style={{ width: '100%', height: 220, display: 'block', touchAction: 'pan-y', cursor: 'crosshair' }} role="img" aria-label="Gráfica de la métrica en el tiempo">
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.32" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[0, 0.5, 1].map(f => <line key={f} x1="0" x2={W} y1={y(techo * f)} y2={y(techo * f)} stroke="rgba(255,255,255,0.07)" strokeDasharray={f ? '3 4' : undefined} vectorEffect="non-scaling-stroke" />)}
        <path d={`${linea} L${x(vals.length - 1)} ${H} L${x(0)} ${H} Z`} fill={`url(#${gid})`} />
        <path d={linea} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1="0" y2={H} stroke="rgba(255,255,255,0.25)" vectorEffect="non-scaling-stroke" />}
      </svg>
      {h && hover !== null && (
        <>
          <span className="absolute rounded-full pointer-events-none" style={{ width: 10, height: 10, background: color, border: '2px solid #0b1020', left: `calc(38px + (100% - 38px) * ${x(hover) / W} - 5px)`, top: `calc(${(y(h[metrica]) / H) * 100}% - 5px)` }} />
          <div className="absolute pointer-events-none px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap" style={{ ...glass, background: 'rgba(15,23,42,0.96)', top: 0, left: `calc(38px + (100% - 38px) * ${x(hover) / W})`, transform: `translateX(${hover > puntos.length * 0.7 ? '-105%' : '8px'})` }}>
            <b className="block text-white">{formato(h[metrica])}</b><span className="text-[#94a3b8]">{h.etiqueta}</span>
          </div>
        </>
      )}
      <div className="flex justify-between text-[10px] text-[#7f8a9c] mt-1.5">
        {marcas.map((i, k) => <span key={k}>{puntos[i]?.etiqueta}</span>)}
      </div>
    </div>
  );
}

export default function KpiDetalle({ kpi, onClose }: { kpi: KpiInfo; onClose: () => void }) {
  const [dias, setDias] = useState(90);
  const [metrica, setMetrica] = useState<Metrica>(kpi.clave === 'conversion' ? 'tasa' : 'n');
  const [d, setD] = useState<Detalle | null>(null);
  const [error, setError] = useState(false);
  const cerrar = useRef<HTMLButtonElement>(null);
  const alCerrar = useRef(onClose);
  alCerrar.current = onClose;
  const mod = MODULO[kpi.clave];
  const rango = RANGOS.find(r => r.d === dias)!;

  const cargar = useCallback(() => {
    setError(false);
    fetch(`/api/dashboard/serie?kpi=${kpi.clave}&dias=${dias}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setD).catch(() => setError(true));
  }, [kpi.clave, dias]);
  useEffect(() => { setD(null); cargar(); }, [cargar]);

  // Esc cierra, el foco entra al botón de cerrar y vuelve al elemento que abrió el popup.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') alCerrar.current(); };
    document.addEventListener('keydown', esc);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    cerrar.current?.focus();
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = overflow; previo?.focus?.(); };
  }, []);

  const opciones: { k: Metrica; t: string }[] =
    kpi.clave === 'conversion' ? [{ k: 'tasa', t: 'Tasa acumulada' }, { k: 'ganados', t: 'Ganados' }, { k: 'n', t: 'Creados' }]
      : kpi.clave === 'projects' ? [{ k: 'n', t: 'Cantidad' }, { k: 'ganados', t: 'Completados' }]
        : [{ k: 'n', t: 'Cantidad' }, { k: 'valor', t: 'Valor' }, { k: 'ganados', t: kpi.clave === 'leads' ? 'Ganados' : 'Aceptadas' }];
  const formato = (v: number) => (metrica === 'valor' ? (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}k` : `$${Math.round(v)}`) : metrica === 'tasa' ? `${v.toFixed(0)}%` : String(Math.round(v * 10) / 10));

  const csv = () => {
    if (!d) return;
    const filas = [['periodo', 'inicio', 'nuevos', 'valor', 'ganados', 'tasa_acumulada_%'], ...d.puntos.map(p => [p.etiqueta, p.inicio.slice(0, 10), p.n, p.valor, p.ganados, p.tasa])];
    const blob = new Blob(['﻿' + filas.map(f => f.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${kpi.clave}-${dias}d-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  const r = d?.resumen;
  const maxEstado = Math.max(1, ...(d?.porEstado.map(e => e.cantidad) ?? [1]));
  const itemHref = (id: string) => (mod.detalle ? `${mod.detalle}/${id}` : kpi.link);

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-6" style={{ background: 'rgba(3,6,15,0.72)', backdropFilter: 'blur(6px)' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`Detalle de ${kpi.label}`} className="w-full sm:max-w-[860px] max-h-[94vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5"
        style={{ background: 'linear-gradient(160deg,#141a2e,#0d1224)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: `0 30px 80px -20px ${kpi.color}40` }}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${kpi.color}1f`, border: `1px solid ${kpi.color}40` }}>
            <svg className="w-[18px] h-[18px]" style={{ color: kpi.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={kpi.icon} /></svg>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-[#7f8a9c] uppercase" style={{ letterSpacing: '.05em' }}>{kpi.label}</p>
            <p className="text-3xl font-bold text-white tabular-nums leading-tight">{kpi.valor}</p>
            {r && (kpi.clave === 'conversion'
              ? <span className="text-[11px] text-[#94a3b8]">{r.ganadosPeriodo} ganados en el periodo · {r.tasaActual}% sobre {r.totalActual} leads</span>
              : <Delta actual={r.periodo} previo={r.periodoPrevio} />)}
          </div>
          <span className="flex-1" />
          <button ref={cerrar} onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94a3b8] hover:text-white hover:bg-white/10 transition-colors"><X size={16} /></button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="inline-flex p-0.5 rounded-lg" style={glass} role="tablist" aria-label="Periodo">
            {RANGOS.map(o => <button key={o.d} role="tab" aria-selected={dias === o.d} onClick={() => setDias(o.d)} className="px-3 py-1 text-[12px] rounded-md transition-colors" style={dias === o.d ? { background: `${kpi.color}2e`, color: '#fff' } : { color: '#94a3b8' }}>{o.t}</button>)}
          </div>
          <span className="flex-1" />
          <div className="inline-flex p-0.5 rounded-lg" style={glass} role="tablist" aria-label="Métrica">
            {opciones.map(o => <button key={o.k} role="tab" aria-selected={metrica === o.k} onClick={() => setMetrica(o.k)} className="px-3 py-1 text-[12px] rounded-md transition-colors" style={metrica === o.k ? { background: 'rgba(255,255,255,0.12)', color: '#fff' } : { color: '#94a3b8' }}>{o.t}</button>)}
          </div>
        </div>

        <div className="p-3 mb-3" style={glass}>
          {d ? <Grafica puntos={d.puntos} metrica={metrica} color={kpi.color} formato={formato} />
            : error ? <div className="h-[250px] flex flex-col items-center justify-center gap-2 text-[13px] text-[#94a3b8]">No se pudo cargar el detalle.<button onClick={cargar} className="px-3 py-1 rounded-lg text-white" style={{ background: `${kpi.color}b0` }}>Reintentar</button></div>
              : <div className="h-[250px] rounded-lg animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />}
        </div>

        {r && d && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
              {[
                { t: `En ${rango.t}`, v: String(r.periodo), s: mod.unidad },
                { t: `Promedio por ${rango.por}`, v: String(r.promedio), s: 'nuevos' },
                { t: 'Pico', v: String(r.pico.n), s: r.pico.etiqueta },
                kpi.clave === 'leads' || kpi.clave === 'proposals'
                  ? { t: 'Valor del periodo', v: dinero(r.valorPeriodo), s: r.valorPrevio ? `antes ${dinero(r.valorPrevio)}` : 'sin periodo previo' }
                  : { t: kpi.clave === 'projects' ? 'Completados' : 'Ganados', v: String(r.ganadosPeriodo), s: 'en el periodo' },
              ].map(c => (
                <div key={c.t} className="px-3 py-2.5 transition-colors hover:bg-white/[0.07]" style={glass}>
                  <p className="text-[10px] text-[#7f8a9c] uppercase" style={{ letterSpacing: '.05em' }}>{c.t}</p>
                  <p className="text-lg font-semibold text-white tabular-nums truncate">{c.v}</p>
                  <p className="text-[11px] text-[#7f8a9c] truncate">{c.s}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
              <div className="p-3" style={glass}>
                <p className="text-[11px] text-[#7f8a9c] uppercase mb-2" style={{ letterSpacing: '.05em' }}>Por estado (creados en el periodo)</p>
                {d.porEstado.length ? d.porEstado.map(e => (
                  <div key={e.nombre} className="mb-1.5">
                    <div className="flex justify-between text-[12px] text-gray-200"><span>{nombreEstado(e.nombre)}</span><b className="tabular-nums">{e.cantidad}</b></div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}><div className="h-full rounded-full" style={{ width: `${(e.cantidad / maxEstado) * 100}%`, background: kpi.color }} /></div>
                  </div>
                )) : <p className="text-[12px] text-[#7f8a9c]">Sin registros en este periodo.</p>}
                {d.porGrupo.length > 0 && (
                  <>
                    <p className="text-[11px] text-[#7f8a9c] uppercase mt-3 mb-1.5" style={{ letterSpacing: '.05em' }}>Por fuente</p>
                    <div className="flex flex-wrap gap-1.5">{d.porGrupo.map(g => <span key={g.nombre} className="px-2 py-0.5 rounded-md text-[11px] text-gray-200" style={glass}>{g.nombre} · {g.cantidad}</span>)}</div>
                  </>
                )}
              </div>
              <div className="p-3" style={glass}>
                <p className="text-[11px] text-[#7f8a9c] uppercase mb-2" style={{ letterSpacing: '.05em' }}>Más recientes</p>
                {d.recientes.length ? d.recientes.map(x => (
                  <Link key={x.id} href={itemHref(x.id)} onClick={onClose} className="flex items-center gap-2 px-2 py-1.5 -mx-2 rounded-lg text-[12px] hover:bg-white/[0.07] transition-colors">
                    <span className="truncate flex-1 text-gray-100">{x.titulo}</span>
                    <span className="text-[#7f8a9c] flex-shrink-0">{nombreEstado(x.estado)}</span>
                    <span className="text-[#7f8a9c] flex-shrink-0 tabular-nums">{new Date(x.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', timeZone: 'America/Bogota' })}</span>
                  </Link>
                )) : <p className="text-[12px] text-[#7f8a9c]">Sin registros en este periodo.</p>}
              </div>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={csv} disabled={!d} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-gray-100 hover:bg-white/10 transition-colors disabled:opacity-40" style={glass}><Download size={13} />Descargar CSV</button>
          <span className="flex-1" />
          <Link href={kpi.link} onClick={onClose} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-white" style={{ background: `${kpi.color}c0` }}>Abrir {mod.titulo.toLowerCase()}<ArrowUpRight size={13} /></Link>
        </div>
      </div>
    </div>
  );
}
