'use client';
// Panel del Dashboard: vista rápida del servidor KVM2 y accesos rápidos del portal.
// Lee /api/vps/stats y /api/vps/docker (los mismos que usa Hub › Operations); no ejecuta nada en el servidor.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Server, Activity, Boxes, FileText, Briefcase, ClipboardList, Mail } from 'lucide-react';

interface Metricas {
  uptime_s: number;
  cpu: { percent: number };
  ram: { percent: number; used_mb: number; total_mb: number };
  swap?: { percent: number; used_mb: number };
  disk: { percent: number; used_gb: number; total_gb: number };
  connections?: { established: number };
  top_procs?: { name: string; cpu: number; mem: number }[];
}
interface Contenedor { name: string; status: string }

const ACCESOS = [
  { href: '/hub/operations', label: 'Operaciones', Icono: Activity },
  { href: '/catalogo-demos', label: 'Catálogo de demos', Icono: Boxes },
  { href: '/documentos', label: 'Documentos', Icono: FileText },
  { href: '/oficina', label: 'Oficina', Icono: Briefcase },
  { href: '/backlog', label: 'Backlog', Icono: ClipboardList },
  { href: '/inbox', label: 'Correo', Icono: Mail },
];

const caja: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 };
const color = (pct: number, aviso: number, critico: number) => (pct >= critico ? '#f87171' : pct >= aviso ? '#fbbf24' : '#34d399');

function tiempoActivo(s: number) {
  const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600);
  return d > 0 ? `${d} d ${h} h` : `${h} h ${Math.floor((s % 3600) / 60)} min`;
}

export default function PanelKvm2() {
  const [m, setM] = useState<Metricas | null>(null);
  const [cont, setCont] = useState<Contenedor[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    const cargar = () => {
      fetch('/api/vps/stats', { cache: 'no-store' }).then(r => r.json()).then(d => { if (!vivo) return; if (d.error || !d.cpu) setError(true); else { setM(d); setError(false); } }).catch(() => { if (vivo) setError(true); });
      fetch('/api/vps/docker', { cache: 'no-store' }).then(r => r.json()).then(d => { if (vivo && !d.error) setCont(d.docker ?? []); }).catch(() => {});
    };
    cargar();
    const t = setInterval(cargar, 30000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  const activos = cont ? cont.filter(c => /^up/i.test(c.status)).length : null;
  const alertas: string[] = [];
  if (m) {
    if (m.cpu.percent > 85) alertas.push(`CPU ${Math.round(m.cpu.percent)}%`);
    if (m.ram.percent > 85) alertas.push(`RAM ${Math.round(m.ram.percent)}%`);
    if (m.disk.percent > 80) alertas.push(`Disco ${Math.round(m.disk.percent)}%`);
  }
  const top = m?.top_procs?.[0];
  const filas: [string, React.ReactNode][] = m ? [
    ['Tiempo activo', tiempoActivo(m.uptime_s)],
    ['Memoria usada', `${(m.ram.used_mb / 1024).toFixed(1)} de ${(m.ram.total_mb / 1024).toFixed(1)} GB`],
    ['Swap', m.swap ? `${Math.round(m.swap.used_mb)} MB · ${Math.round(m.swap.percent)}%` : '—'],
    ['Disco', `${Math.round(m.disk.used_gb)} de ${Math.round(m.disk.total_gb)} GB`],
    ['Proceso con más CPU', top ? `${top.name} · ${Math.round(top.cpu)}%` : '—'],
    ['Alertas activas', alertas.length ? <span key="a" style={{ color: '#f87171' }}>{alertas.length} · {alertas.join(', ')}</span> : <span key="a" style={{ color: '#34d399' }}>Ninguna</span>],
  ] : [];

  const medidor = (nombre: string, pct: number, aviso: number, critico: number) => (
    <div style={{ ...caja, padding: '10px 12px', textAlign: 'center' }}>
      <span style={{ fontSize: 11, color: '#7f8a9c', letterSpacing: '.04em', textTransform: 'uppercase' }}>{nombre}</span>
      <b style={{ display: 'block', fontSize: 22, fontWeight: 600, lineHeight: 1.15, color: color(pct, aviso, critico) }}>{Math.round(pct)}%</b>
      <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', marginTop: 8, overflow: 'hidden' }}>
        <i style={{ display: 'block', height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: color(pct, aviso, critico), borderRadius: 3 }} />
      </div>
    </div>
  );

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f973161f', border: '1px solid #f9731633' }}>
          <Server size={14} style={{ color: '#f97316' }} />
        </div>
        <h3 className="text-sm font-semibold text-white leading-none">Servidor KVM2</h3>
        <span className="text-[11px] text-[#7f8a9c]" style={{ fontFamily: 'var(--font-mono, monospace)' }}>177.7.46.87</span>
        <span className="flex-1" />
        {error && !m
          ? <span className="text-[11px]" style={{ color: '#f87171' }}>Sin conexión con el servidor</span>
          : m ? <span className="text-[11px]" style={{ color: '#34d399' }}>● en línea</span>
            : <span className="text-[11px] text-[#7f8a9c]">Cargando…</span>}
      </div>

      <div className="grid gap-2.5 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))' }}>
        {medidor('CPU', m?.cpu.percent ?? 0, 70, 85)}
        {medidor('RAM', m?.ram.percent ?? 0, 70, 85)}
        {medidor('Disco', m?.disk.percent ?? 0, 70, 80)}
        <div style={{ ...caja, padding: '10px 12px', textAlign: 'center' }}>
          <span style={{ fontSize: 11, color: '#7f8a9c', letterSpacing: '.04em', textTransform: 'uppercase' }}>Contenedores</span>
          <b style={{ display: 'block', fontSize: 22, fontWeight: 600, lineHeight: 1.15, color: '#34d399' }}>{activos ?? '—'}</b>
          <div style={{ fontSize: 11, color: '#7f8a9c', marginTop: 8 }}>{cont && activos !== null ? `${cont.length - activos} detenidos` : ' '}</div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        <div>
          <p className="text-[11px] text-[#7f8a9c] mb-1.5" style={{ letterSpacing: '.04em', textTransform: 'uppercase' }}>Accesos rápidos</p>
          <div className="grid grid-cols-2 gap-1.5">
            {ACCESOS.map(({ href, label, Icono }) => (
              <Link key={href} href={href} className="flex items-center gap-2 px-2.5 py-2 text-[12px] text-gray-100 hover:bg-white/[0.09] transition-colors" style={caja}>
                <Icono size={15} style={{ color: '#ff7a2f', flexShrink: 0 }} /><span className="truncate">{label}</span>
              </Link>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] text-[#7f8a9c] mb-1.5" style={{ letterSpacing: '.04em', textTransform: 'uppercase' }}>Vistas rápidas</p>
          <div style={caja}>
            {m ? filas.map(([k, v], i) => (
              <div key={k} className="flex items-center justify-between gap-3 px-2.5 py-1.5 text-[12px]" style={i ? { borderTop: '1px solid rgba(255,255,255,0.06)' } : undefined}>
                <span className="text-[#94a3b8]">{k}</span><span className="text-gray-100 text-right truncate">{v}</span>
              </div>
            )) : <p className="px-2.5 py-3 text-[12px] text-[#7f8a9c]">{error ? 'No se pudieron leer las métricas.' : 'Cargando…'}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
