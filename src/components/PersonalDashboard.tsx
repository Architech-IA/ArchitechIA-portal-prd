'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import BacklogItemDetail from '@/components/BacklogItemDetail';

interface BacklogItem {
  id: string; title: string; description: string | null; type: string;
  priority: string; status: string; points: number | null;
  assigneeId: string | null; assigneeName: string | null; createdAt: string;
  solucionId: string | null; solucion: { id: string; nombre: string; tipo: string } | null;
  resultado: string | null;
}

interface PersonalData {
  user: { id: string; email: string; name: string };
  kpis: {
    leadsActivos: number; proyectos: number; backlogPendientes: number;
    backlogInProgress: number; reunionesPróximas: number; pipelineValue: number;
  };
  myLeads: {
    id: string; companyName: string; contactName: string;
    status: string; estimatedValue: number; updatedAt: string; source: string;
  }[];
  myProjects: {
    id: string; name: string; status: string; priority: string;
    progress: number; endDate: string | null; description: string; projectRole: string;
  }[];
  myBacklog: BacklogItem[];
  upcomingMeetings: {
    id: string; title: string; type: string; date: string;
    endDate: string | null; location: string | null; link: string | null;
    attendees: string | null; status: string;
  }[];
}

const STATUS_LEAD: Record<string, string> = {
  NEW: 'Identificación', CONTACTED: 'Contacto', DIAGNOSIS: 'Diagnóstico',
  QUALIFIED: 'Calificado', DEMO_VALIDATION: 'Demo', PROPOSAL_SENT: 'Propuesta',
  NEGOTIATION: 'Negociación', WON: 'Ganado', LOST: 'Perdido',
};
const LEAD_STATUS_PILL: Record<string, string> = {
  NEW: 'bg-blue-500/15 text-blue-400',
  CONTACTED: 'bg-indigo-500/15 text-indigo-400',
  DIAGNOSIS: 'bg-violet-500/15 text-violet-400',
  QUALIFIED: 'bg-cyan-500/15 text-cyan-400',
  DEMO_VALIDATION: 'bg-yellow-500/15 text-yellow-400',
  PROPOSAL_SENT: 'bg-orange-500/15 text-orange-400',
  NEGOTIATION: 'bg-amber-500/15 text-amber-400',
  WON: 'bg-green-500/15 text-green-400',
  LOST: 'bg-red-500/15 text-red-400',
};
const PRIORITY_LEFT: Record<string, string> = {
  LOW: '#475569', MEDIUM: '#EAB308', HIGH: '#F97316', CRITICAL: '#EF4444',
};
const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica',
};
const BACKLOG_STATUS_PILL: Record<string, string> = {
  BACKLOG: 'bg-slate-700/60 text-slate-300',
  IN_PROGRESS: 'bg-orange-500/15 text-orange-300',
  REVIEW: 'bg-blue-500/15 text-blue-300',
  DONE: 'bg-green-500/15 text-green-300',
};
const BACKLOG_STATUS_LABEL: Record<string, string> = {
  BACKLOG: 'Pendiente', IN_PROGRESS: 'En progreso', REVIEW: 'En revisión', DONE: 'Listo',
};
const PROJECT_STATUS_PILL: Record<string, string> = {
  PLANNING: 'bg-blue-500/15 text-blue-400',
  IN_PROGRESS: 'bg-orange-500/15 text-orange-400',
  ON_HOLD: 'bg-yellow-500/15 text-yellow-400',
  COMPLETED: 'bg-green-500/15 text-green-400',
  CANCELLED: 'bg-red-500/15 text-red-400',
};
const PROJECT_STATUS_LABEL: Record<string, string> = {
  PLANNING: 'Planeación', IN_PROGRESS: 'En progreso',
  ON_HOLD: 'En pausa', COMPLETED: 'Completado', CANCELLED: 'Cancelado',
};
const MEETING_TYPE_LABEL: Record<string, string> = {
  INTERNAL_DAILY: 'Daily', INTERNAL_WORKSHOP: 'Workshop',
  COMERCIAL: 'Comercial', ASESORIA: 'Asesoría',
  PROVEEDORES: 'Proveedores', INTERNAL: 'Interna',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });
}
function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}
function daysUntil(iso: string | null) {
  if (!iso) return null;
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
  return diff;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.04] ${className ?? ''}`} />;
}

function EmptyState({ icon, text, sub, href, linkText }: { icon: string; text: string; sub?: string; href?: string; linkText?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,90,0,0.08)' }}>
        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm text-gray-500">{text}</p>
        {sub && <p className="text-xs text-gray-700 mt-0.5">{sub}</p>}
      </div>
      {href && linkText && (
        <a href={href} className="text-xs text-orange-500 hover:text-orange-400 transition-colors mt-1">
          {linkText} →
        </a>
      )}
    </div>
  );
}

function Sparkline({ data, color = '#7C3AED' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const W = 80, H = 28;
  const pts = data.map((v, i) =>
    `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H * 0.8) - H * 0.1}`
  );
  const lastY = H - ((data[data.length - 1] - min) / range) * (H * 0.8) - H * 0.1;
  return (
    <svg width={W} height={H} className="flex-shrink-0">
      <defs>
        <linearGradient id={`g-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M${pts.join(' L')} L${W},${H} L0,${H} Z`} fill={`url(#g-${color.replace('#', '')})`} />
      <path d={`M${pts.join(' L')}`} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={W} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}

export default function PersonalDashboard() {
  const [data, setData] = useState<PersonalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<BacklogItem | null>(null);

  useEffect(() => {
    fetch('/api/dashboard/personal')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleStatusChange = async (item: BacklogItem, newStatus: string) => {
    await fetch(`/api/backlog/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, status: newStatus, solucionId: item.solucionId }),
    });
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        myBacklog: prev.myBacklog
          .map(i => i.id === item.id ? { ...i, status: newStatus } : i)
          .filter(i => i.status !== 'DONE'),
      };
    });
    setSelectedItem(prev => prev?.id === item.id ? { ...prev, status: newStatus } : prev);
  };

  const handleDelete = async (item: BacklogItem) => {
    await fetch(`/api/backlog/${item.id}`, { method: 'DELETE' });
    setData(prev => prev ? { ...prev, myBacklog: prev.myBacklog.filter(i => i.id !== item.id) } : prev);
    setSelectedItem(null);
  };

  // ── Skeleton loading ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-14 h-14 rounded-2xl flex-shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="w-52 h-6" />
          <Skeleton className="w-36 h-4" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );

  const d = data!;
  const today = new Date();
  const todayMeetings = d.upcomingMeetings.filter(
    m => new Date(m.date).toDateString() === today.toDateString()
  );
  const inProgressTasks = d.myBacklog.filter(i => i.status === 'IN_PROGRESS');

  const kpis = [
    {
      label: 'Leads activos',
      value: d.kpis.leadsActivos,
      sub: d.kpis.pipelineValue > 0 ? `$${d.kpis.pipelineValue.toLocaleString()} pipeline` : 'Sin pipeline activo',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      color: '#3B82F6',
      link: '/leads',
      spark: [3, 5, 4, 6, 5, 7, d.kpis.leadsActivos || 6],
    },
    {
      label: 'Proyectos',
      value: d.kpis.proyectos,
      sub: 'Asignados a ti',
      icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
      color: '#8B5CF6',
      link: '/projects',
      spark: [2, 3, 2, 4, 3, 4, d.kpis.proyectos || 3],
    },
    {
      label: 'Tareas pendientes',
      value: d.kpis.backlogPendientes,
      sub: `${d.kpis.backlogInProgress} en progreso`,
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
      color: '#F97316',
      link: '/backlog',
      spark: [8, 12, 9, 14, 11, 13, d.kpis.backlogPendientes || 10],
    },
    {
      label: 'Próximas reuniones',
      value: d.kpis.reunionesPróximas,
      sub: `${todayMeetings.length} hoy`,
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      color: '#22C55E',
      link: '/meetings',
      spark: [1, 2, 1, 3, 2, 3, d.kpis.reunionesPróximas || 2],
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl">

      {/* Popup detalle tarea */}
      {selectedItem && (
        <BacklogItemDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onStatusChange={(item, newStatus) => handleStatusChange(item as unknown as BacklogItem, newStatus)}
          currentUserName={d.user.name}
          onEdit={() => { setSelectedItem(null); window.location.href = '/backlog'; }}
          onDelete={() => handleDelete(selectedItem)}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-white font-bold text-lg select-none"
          style={{ background: 'linear-gradient(135deg, #FF5A00 0%, #FF7A2F 100%)', boxShadow: '0 0 24px rgba(255,90,0,0.3)' }}
        >
          {getInitials(d.user.name)}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white leading-tight">
            Hola, <span style={{ color: '#FF7A2F' }}>{d.user.name.split(' ')[0]}</span>
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <a
            key={k.label}
            href={k.link}
            className="group relative rounded-2xl p-4 border border-white/[0.06] overflow-hidden transition-all duration-200"
            style={{ background: 'var(--bg-card)' }}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none"
              style={{ background: `radial-gradient(circle at top left, ${k.color}18 0%, transparent 60%)` }}
            />
            <div className="relative">
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border"
                  style={{ background: `${k.color}18`, borderColor: `${k.color}33` }}
                >
                  <svg className="w-[14px] h-[14px]" style={{ color: k.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={k.icon} />
                  </svg>
                </div>
                <Sparkline data={k.spark} color={k.color} />
              </div>
              <p className="text-xl md:text-2xl font-bold text-white tracking-tight tabular-nums">{k.value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{k.label}</p>
              <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-700 group-hover:text-slate-500 transition-colors">
                <span className="truncate">{k.sub}</span>
                <ArrowUpRight size={9} className="flex-shrink-0" />
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* ── Tareas + Reuniones ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Mis Tareas */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#FF7A2F' }}>Mis Tareas</h2>
              {d.myBacklog.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-medium">
                  {d.myBacklog.length}
                </span>
              )}
            </div>
            <a href="/backlog" className="text-xs text-gray-600 hover:text-orange-400 transition-colors">Ver todas →</a>
          </div>

          {d.myBacklog.length === 0 ? (
            <EmptyState
              icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              text="Sin tareas asignadas"
              sub="Cuando te asignen tareas aparecerán aquí"
            />
          ) : (
            <div className="space-y-1.5">
              {d.myBacklog.slice(0, 8).map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="w-full flex items-center gap-3 pl-0 pr-3 py-2.5 rounded-lg text-left transition-all duration-150 group cursor-pointer overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid transparent' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                    (e.currentTarget as HTMLElement).style.border = '1px solid rgba(255,255,255,0.08)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)';
                    (e.currentTarget as HTMLElement).style.border = '1px solid transparent';
                  }}
                >
                  {/* Priority bar */}
                  <span
                    className="w-1 self-stretch rounded-r flex-shrink-0"
                    style={{ background: PRIORITY_LEFT[item.priority] ?? '#475569', minHeight: '32px' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate group-hover:text-white transition-colors leading-snug">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-gray-600 truncate mt-0.5">
                      {item.solucion?.nombre ?? 'Sin solución'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {item.points != null && item.points > 0 && (
                      <span className="text-[10px] text-gray-600 font-medium">{item.points}pt</span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${BACKLOG_STATUS_PILL[item.status] ?? 'bg-gray-700/60 text-gray-400'}`}>
                      {BACKLOG_STATUS_LABEL[item.status] ?? item.status}
                    </span>
                  </div>
                </button>
              ))}
              {d.myBacklog.length > 8 && (
                <a href="/backlog" className="block text-center text-xs text-gray-600 hover:text-orange-400 pt-2 transition-colors">
                  +{d.myBacklog.length - 8} tareas más →
                </a>
              )}
            </div>
          )}
        </div>

        {/* Próximas Reuniones */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#FF7A2F' }}>Próximas Reuniones</h2>
              {todayMeetings.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium">
                  {todayMeetings.length} hoy
                </span>
              )}
            </div>
            <a href="/meetings" className="text-xs text-gray-600 hover:text-orange-400 transition-colors">Ver calendario →</a>
          </div>

          {d.upcomingMeetings.length === 0 ? (
            <EmptyState
              icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              text="Sin reuniones los próximos 14 días"
              sub="Tienes la agenda libre"
            />
          ) : (
            <div className="space-y-2">
              {d.upcomingMeetings.map(m => {
                const mDate = new Date(m.date);
                const isToday = mDate.toDateString() === today.toDateString();
                const isTomorrow = mDate.toDateString() === new Date(today.getTime() + 86400000).toDateString();
                const dayNum = mDate.toLocaleDateString('es-ES', { day: '2-digit' });
                const monthAbbr = mDate.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '').toUpperCase();
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                    style={{
                      background: isToday ? 'rgba(255,90,0,0.07)' : 'rgba(255,255,255,0.025)',
                      border: isToday ? '1px solid rgba(255,90,0,0.2)' : '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    {/* Date badge */}
                    <div
                      className="flex-shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center"
                      style={{ background: isToday ? 'rgba(255,90,0,0.2)' : 'rgba(255,255,255,0.05)' }}
                    >
                      <span className="text-[9px] font-semibold leading-none" style={{ color: isToday ? '#FF7A2F' : '#64748b' }}>
                        {monthAbbr}
                      </span>
                      <span className="text-sm font-bold leading-tight text-white">{dayNum}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate leading-snug">{m.title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {formatTime(m.date)}{m.endDate ? ` — ${formatTime(m.endDate)}` : ''} · {MEETING_TYPE_LABEL[m.type] ?? m.type}
                      </p>
                    </div>
                    {isToday && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-semibold flex-shrink-0">HOY</span>
                    )}
                    {isTomorrow && !isToday && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-semibold flex-shrink-0">MAÑANA</span>
                    )}
                    {m.link && (
                      <a
                        href={m.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                        title="Unirse"
                      >
                        <svg className="w-3.5 h-3.5 text-gray-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Leads + Proyectos ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Mis Leads */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#FF7A2F' }}>Mis Leads</h2>
              {d.myLeads.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-medium">
                  {d.myLeads.length}
                </span>
              )}
            </div>
            <a href="/leads" className="text-xs text-gray-600 hover:text-orange-400 transition-colors">Ver todos →</a>
          </div>

          {d.myLeads.length === 0 ? (
            <EmptyState
              icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              text="Sin leads asignados"
              sub="Los leads que gestiones aparecerán aquí"
              href="/leads"
              linkText="Ir a Leads"
            />
          ) : (
            <div className="space-y-1.5">
              {d.myLeads.slice(0, 8).map(l => {
                const daysSince = Math.floor((Date.now() - new Date(l.updatedAt).getTime()) / 86400000);
                const isStale = daysSince >= 7;
                return (
                  <a
                    key={l.id}
                    href="/leads"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid transparent' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                      (e.currentTarget as HTMLElement).style.border = '1px solid rgba(255,255,255,0.08)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)';
                      (e.currentTarget as HTMLElement).style.border = '1px solid transparent';
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-200 truncate font-medium">{l.companyName}</p>
                        {isStale && (
                          <span title={`Sin actividad ${daysSince} días`} className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-600 truncate mt-0.5">{l.contactName}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {l.estimatedValue > 0 && (
                        <span className="text-xs text-gray-400 font-medium">${l.estimatedValue.toLocaleString()}</span>
                      )}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${LEAD_STATUS_PILL[l.status] ?? 'bg-gray-700/60 text-gray-400'}`}>
                        {STATUS_LEAD[l.status] ?? l.status}
                      </span>
                    </div>
                  </a>
                );
              })}
              {d.myLeads.length > 8 && (
                <a href="/leads" className="block text-center text-xs text-gray-600 hover:text-orange-400 pt-2 transition-colors">
                  +{d.myLeads.length - 8} más →
                </a>
              )}
            </div>
          )}
        </div>

        {/* Mis Proyectos */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#FF7A2F' }}>Mis Proyectos</h2>
              {d.myProjects.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 font-medium">
                  {d.myProjects.length}
                </span>
              )}
            </div>
            <a href="/projects" className="text-xs text-gray-600 hover:text-orange-400 transition-colors">Ver todos →</a>
          </div>

          {d.myProjects.length === 0 ? (
            <EmptyState
              icon="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              text="Sin proyectos asignados"
              sub="Los proyectos en los que participes aparecerán aquí"
              href="/projects"
              linkText="Ver Proyectos"
            />
          ) : (
            <div className="space-y-2.5">
              {d.myProjects.map(p => {
                const days = daysUntil(p.endDate);
                const isOverdue = days !== null && days < 0;
                const isUrgent = days !== null && days >= 0 && days <= 7;
                return (
                  <a
                    key={p.id}
                    href="/projects"
                    className="block px-3 py-3 rounded-lg transition-all duration-150"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid transparent' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                      (e.currentTarget as HTMLElement).style.border = '1px solid rgba(255,255,255,0.08)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)';
                      (e.currentTarget as HTMLElement).style.border = '1px solid transparent';
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <p className="text-sm text-gray-200 font-medium leading-snug flex-1 min-w-0 truncate">{p.name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${PROJECT_STATUS_PILL[p.status] ?? 'bg-gray-700/60 text-gray-400'}`}>
                        {PROJECT_STATUS_LABEL[p.status] ?? p.status}
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${p.progress}%`,
                            background: p.progress >= 80
                              ? 'linear-gradient(90deg, #22C55E, #4ADE80)'
                              : 'linear-gradient(90deg, #FF5A00, #FF7A2F)',
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 font-medium tabular-nums w-8 text-right flex-shrink-0">
                        {p.progress}%
                      </span>
                    </div>

                    {p.endDate && (
                      <p className={`text-[11px] ${isOverdue ? 'text-red-400' : isUrgent ? 'text-yellow-400' : 'text-gray-600'}`}>
                        {isOverdue
                          ? `⚠ Vencido hace ${Math.abs(days!)} días`
                          : isUrgent
                          ? `⏱ Vence en ${days} día${days === 1 ? '' : 's'}`
                          : `Fecha límite: ${new Date(p.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`
                        }
                      </p>
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

