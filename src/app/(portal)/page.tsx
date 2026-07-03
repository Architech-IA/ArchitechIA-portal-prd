'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useSession } from 'next-auth/react';
import PersonalDashboard from '@/components/PersonalDashboard';
import { SkeletonKPI, SkeletonCard } from '@/components/SkeletonCard';

interface DashboardData {
  counts: { leads: number; proposals: number; projects: number; activities: number };
  leadsByStatus: { status: string; _count: number }[];
  proposalsByStatus: { status: string; _count: number }[];
  projectsByStatus: { status: string; _count: number }[];
  totalEstimatedValue: number;
  conversionRate: number;
  leadsGanados: number;
  leadsInactivos: { id: string; companyName: string; status: string; updatedAt: string }[];
  propuestasSinRespuesta: { id: string; title: string; amount: number; sentDate: string }[];
  proximosDeadlines: { id: string; name: string; endDate: string; progress: number; priority: string }[];
  registrosPendientes: { id: string; concepto: string; monto: number; moneda: string; tipo: string }[];
  topSocios: { id: string; name: string; role: string; _count: { leads: number; proposals: number; projects: number } }[];
  embudo: { status: string; count: number; valor: number }[];
  industriaLeads: { source: string; _count: number }[];
  metaMensual: number;
  ingresosMes: number;
  recentActivities: { id: string; type: string; description: string; entityType: string; createdAt: string; user: { name: string } }[];
  tendencias: { mes: string; leads: number; proyectos: number; ingresos: number }[];
  myDay: { leadsContactar: { id: string; companyName: string; contactName: string; status: string; updatedAt: string }[]; propuestasPendientes: { id: string; title: string; status: string; amount: number }[]; tareasVencidas: any[] };
  staleLeads: { id: string; companyName: string; status: string; updatedAt: string }[];
  backlogStats: { total: number; pendientes: number; enProgreso: number; completados: number; puntosTotales: number; sprintActivo: { name: string; endDate: string; items: number } | null } | null;
}

const ETAPA_LABELS: Record<string, string> = {
  NEW: 'Identificación', CONTACTED: 'Contacto', DIAGNOSIS: 'Diagnóstico', QUALIFIED: 'Calificado',
  DEMO_VALIDATION: 'Demo', PROPOSAL_SENT: 'Propuesta', NEGOTIATION: 'Negociación',
  WON: 'Ganado', LOST: 'Perdido',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'text-gray-400', MEDIUM: 'text-yellow-400',
  HIGH: 'text-orange-400', CRITICAL: 'text-red-400',
};

/* Header de sección reutilizable: chip de ícono coloreado + título.
   Reemplaza los emojis (rendering inconsistente entre OS) y el texto
   uppercase suelto que hacía ver las cards "desordenadas". */
function SectionHeader({ icon, color, title, badge }: { icon: string; color: string; title: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}1f`, border: `1px solid ${color}33` }}>
          <svg className="w-3.5 h-3.5" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-white leading-none">{title}</h3>
      </div>
      {badge}
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

export default function Home() {
  const { data: session, status: sessionStatus } = useSession();
  const userRole = (session?.user as { role?: string })?.role ?? '';
  const isSuperAdmin = userRole === 'SUPERADMIN';

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartTab, setChartTab] = useState<'ingresos' | 'leads' | 'proyectos'>('ingresos');
  const [showSettings, setShowSettings] = useState(false);

  const defaultWidgets = { kpis: true, jornada: true, meta: true, embudo: true, alertas: true, fuentes: true, actividad: true };
  const [widgets, setWidgets] = useState(defaultWidgets);

  useEffect(() => {
    const saved = localStorage.getItem('dashboardWidgets');
    if (saved) setWidgets(JSON.parse(saved));
  }, []);

  const toggleWidget = (key: string) => {
    setWidgets(prev => {
      const next = { ...prev, [key]: !prev[key as keyof typeof prev] };
      localStorage.setItem('dashboardWidgets', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    if (!isSuperAdmin && sessionStatus === 'authenticated') return;
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isSuperAdmin, sessionStatus]);

  if (sessionStatus === 'loading') return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );

  if (!isSuperAdmin) return <PersonalDashboard />;

  if (loading) return (
    <div className="page-wrap space-y-5 animate-pulse">
      <div className="skeleton skeleton-title w-40" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <SkeletonKPI key={i} />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SkeletonCard rows={5} />
        <SkeletonCard rows={5} />
      </div>
      <SkeletonCard rows={3} />
    </div>
  );

  const tendencias = data?.tendencias ?? [];
  const maxVal = tendencias.length > 0 ? Math.max(...tendencias.map(t =>
    chartTab === 'ingresos' ? t.ingresos : chartTab === 'leads' ? t.leads : t.proyectos
  )) : 1;

  const metaPct = data ? Math.min(Math.round((data.ingresosMes / data.metaMensual) * 100), 100) : 0;
  const maxEmbudo = data?.embudo[0]?.count || 1;
  const alertas = (data?.leadsInactivos.length ?? 0) + (data?.propuestasSinRespuesta.length ?? 0) + (data?.proximosDeadlines.length ?? 0) + (data?.registrosPendientes.length ?? 0);

  return (
    <div className="page-wrap space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight gradient-text">Dashboard</h1>
          <p className="page-subtitle">Resumen general de ArchiTechIA</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {alertas > 0 && (
            <div className="badge badge-danger gap-1.5 px-3 py-1.5 flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {alertas} alerta{alertas > 1 ? 's' : ''}
            </div>
          )}
          <button onClick={() => setShowSettings(!showSettings)}
            className={`btn ${showSettings ? 'btn-primary' : 'btn-ghost'}`}
            title="Personalizar dashboard">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </div>

      {/* Panel de personalización de widgets */}
      {showSettings && (
        <div className="bg-gray-900 border border-orange-500/30 rounded-xl p-5">
          <SectionHeader color="#FF5A00" title="Personalizar Dashboard"
            icon="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            badge={
              <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            }
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {([
              { key: 'kpis',      label: 'KPIs Principales' },
              { key: 'jornada',   label: 'Mi Jornada' },
              { key: 'meta',      label: 'Meta Mensual' },
              { key: 'embudo',    label: 'Embudo de Ventas' },
              { key: 'alertas',   label: 'Alertas Inteligentes' },
              { key: 'fuentes',   label: 'Fuentes de Leads' },
              { key: 'actividad', label: 'Actividad Reciente' },
            ] as { key: keyof typeof widgets; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => toggleWidget(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                  widgets[key]
                    ? 'bg-orange-500/10 border-orange-500/40 text-orange-300'
                    : 'bg-gray-800 border-gray-700 text-gray-500'
                }`}
              >
                <span className={`w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center ${widgets[key] ? 'bg-orange-500 border-orange-500' : 'border-gray-600'}`}>
                  {widgets[key] && <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10.28 2.28L4 8.56 1.72 6.28a1 1 0 00-1.42 1.42l3 3a1 1 0 001.42 0l7-7a1 1 0 00-1.42-1.42z"/></svg>}
                </span>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* KPIs principales */}
      {widgets.kpis && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads',     value: data?.counts.leads ?? 0,        sub: `$${(data?.totalEstimatedValue ?? 0).toLocaleString()} en pipeline`, color: '#3B82F6', link: '/leads',     icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', spark: [3,5,4,6,5,7, data?.counts.leads ?? 6] },
          { label: 'Propuestas',      value: data?.counts.proposals ?? 0,    sub: 'En seguimiento activo',                                              color: '#8B5CF6', link: '/proposals', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',  spark: [2,3,2,4,3,4, data?.counts.proposals ?? 3] },
          { label: 'Tasa Conversión', value: `${data?.conversionRate ?? 0}%`, sub: `${data?.leadsGanados ?? 0} leads ganados`,                         color: '#22C55E', link: '/leads',     icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',                                                                                                        spark: [1,3,2,4,3,5, data?.conversionRate ?? 4] },
          { label: 'Proyectos',       value: data?.counts.projects ?? 0,     sub: 'En desarrollo y completados',                                        color: '#FF5A00', link: '/projects',  icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',                                                          spark: [4,6,5,7,6,8, data?.counts.projects ?? 6] },
        ].map((k) => (
          <a key={k.label} href={k.link}
            className="group relative rounded-2xl p-4 border border-white/[0.06] overflow-hidden transition-all duration-200"
            style={{ background: 'var(--bg-card)' }}
          >
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none"
              style={{ background: `radial-gradient(circle at top left, ${k.color}18 0%, transparent 60%)` }}
            />
            <div className="relative">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border"
                  style={{ background: `${k.color}18`, borderColor: `${k.color}33` }}>
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
      </div>}

      {/* Backlog + Sprint */}
      {widgets.jornada && data?.backlogStats && (
        <div className="card p-5 mb-6">
          <SectionHeader color="#FF5A00" title="Backlog"
            icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          <div className="grid grid-cols-4 gap-4 mb-4">
            {[
              { label: 'Total', value: data.backlogStats.total, color: 'text-white' },
              { label: 'Pendientes', value: data.backlogStats.pendientes, color: 'text-gray-400' },
              { label: 'En Progreso', value: data.backlogStats.enProgreso, color: 'text-orange-400' },
              { label: 'Completados', value: data.backlogStats.completados, color: 'text-green-400' },
            ].map(k => (
              <div key={k.label} className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">{data.backlogStats.puntosTotales} puntos totales</span>
            {data.backlogStats.sprintActivo ? (
              <span className="text-orange-400">
                Sprint activo: {data.backlogStats.sprintActivo.name} · {data.backlogStats.sprintActivo.items} ítems · 
                hasta {new Date(data.backlogStats.sprintActivo.endDate).toLocaleDateString('es-ES')}
              </span>
            ) : (
              <span className="text-gray-500">Sin sprint activo</span>
            )}
          </div>
        </div>
      )}

      {/* Mi Jornada */}
      {widgets.jornada && data?.myDay && (data.myDay.leadsContactar.length > 0 || data.myDay.propuestasPendientes.length > 0 || (data.staleLeads?.length ?? 0) > 0) && (
        <div className="card p-5 mb-6">
          <SectionHeader color="#3B82F6" title="Lo que debo hacer hoy"
            icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.myDay.leadsContactar.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Leads por contactar</p>
                {data.myDay.leadsContactar.map(l => (
                  <a key={l.id} href={`/leads`} className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg mb-1 hover:bg-gray-700 transition-colors text-xs">
                    <span className="text-white truncate">{l.companyName}</span>
                    <span className="text-gray-500 ml-2">{Math.floor((Date.now() - new Date(l.updatedAt).getTime()) / 86400000)}d</span>
                  </a>
                ))}
              </div>
            )}
            {data.myDay.propuestasPendientes.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Propuestas en seguimiento</p>
                {data.myDay.propuestasPendientes.map(p => (
                  <a key={p.id} href={`/proposals/${p.id}`} className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg mb-1 hover:bg-gray-700 transition-colors text-xs">
                    <span className="text-white truncate">{p.title}</span>
                    <span className={`ml-2 ${p.status === 'DRAFT' ? 'text-gray-400' : p.status === 'SENT' ? 'text-orange-400' : 'text-yellow-400'}`}>
                      ${p.amount.toLocaleString()}
                    </span>
                  </a>
                ))}
              </div>
            )}
            {(data.staleLeads?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                  Leads estancados (+7 días)
                </p>
                {data.staleLeads!.slice(0, 5).map(l => (
                  <a key={l.id} href={`/leads`} className="flex items-center justify-between px-3 py-2 bg-red-900/10 border border-red-900/20 rounded-lg mb-1 hover:bg-red-900/20 transition-colors text-xs">
                    <span className="text-white truncate">{l.companyName}</span>
                    <span className="text-red-400 ml-2">{Math.floor((Date.now() - new Date(l.updatedAt).getTime()) / 86400000)}d</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}


      {/* Meta Mensual */}
      {widgets.meta && data && (
        <div className="card p-5">
          <SectionHeader
            color="#22C55E"
            title="Meta Mensual"
            icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            badge={
              <span className={`badge ${metaPct >= 100 ? 'badge-success' : metaPct >= 60 ? 'badge-warning' : 'badge-danger'}`}>
                {metaPct}%
              </span>
            }
          />
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-2xl font-bold text-white tabular-nums">${data.ingresosMes.toLocaleString()}</p>
              <p className="text-xs text-gray-600 mt-0.5">de ${data.metaMensual.toLocaleString()} meta</p>
            </div>
            <p className="text-xs text-gray-600 mb-1">
              {new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${metaPct}%`,
                background: metaPct >= 100
                  ? 'linear-gradient(90deg,#10b981,#34d399)'
                  : metaPct >= 60
                  ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                  : 'linear-gradient(90deg,#ef4444,#f87171)',
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-gray-700">$0</span>
            <span className="text-[10px] text-gray-700">${Math.round(data.metaMensual / 2).toLocaleString()}</span>
            <span className="text-[10px] text-gray-700">${data.metaMensual.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Embudo de ventas + Tendencias */}
      {widgets.embudo && <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Embudo de ventas */}
        <div className="card p-6">
          <SectionHeader color="#A855F7" title="Embudo de Ventas"
            icon="M3 4h18l-7 9v6l-4 2v-8L3 4z" />
          <div className="space-y-3">
            {data?.embudo.map((etapa, i) => {
              const pct = maxEmbudo > 0 ? Math.round((etapa.count / maxEmbudo) * 100) : 0;
              const funnelWidth = Math.max(pct, 4); // minimum 4% for visibility
              const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-orange-500', 'bg-red-500', 'bg-green-500'];
              return (
                <div key={etapa.status} className="relative">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${colors[i]}`} />
                      <span className="text-gray-300 font-medium">{ETAPA_LABELS[etapa.status] ?? etapa.status}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">${etapa.valor.toLocaleString()}</span>
                      <span className="text-white font-bold min-w-[1.5rem] text-right">{etapa.count}</span>
                    </div>
                  </div>
                  {/* Funnel bar centered */}
                  <div className="relative h-3 bg-gray-800/50 rounded-full overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full ${colors[i]} transition-all duration-700 ease-out`}
                      style={{ width: `${funnelWidth}%` }}
                    />
                  </div>
                  {/* Conversion rate vs previous stage */}
                  {i > 0 && data.embudo[i - 1].count > 0 && (
                    <div className="flex justify-end mt-0.5">
                      <span className="text-[10px] text-gray-600">
                        {Math.round((etapa.count / data.embudo[i - 1].count) * 100)}% conversión
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Tendencias mensuales */}
        <div className="card p-6">
          <SectionHeader color="#06B6D4" title="Tendencias"
            icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            badge={
              <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                {(['ingresos', 'leads', 'proyectos'] as const).map((t) => (
                  <button key={t} onClick={() => setChartTab(t)}
                    className={`px-2 py-1 text-xs rounded-md capitalize transition-colors ${chartTab === t ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                    {t}
                  </button>
                ))}
              </div>
            }
          />
          <div className="flex items-end gap-2 h-32">
            {tendencias.map((t) => {
              const val = chartTab === 'ingresos' ? t.ingresos : chartTab === 'leads' ? t.leads : t.proyectos;
              const h = Math.round((val / maxVal) * 112);
              return (
                <div key={t.mes} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="relative w-full">
                    <div className="w-full rounded-t bg-gradient-to-t from-orange-600 to-orange-400 group-hover:from-orange-500 group-hover:to-orange-300 transition-all"
                      style={{ height: `${h}px` }} />
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 border border-gray-700 text-xs text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                      {chartTab === 'ingresos' ? `$${(val as number).toLocaleString()}` : val}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">{t.mes}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-800 flex justify-between">
            {tendencias.map((t) => {
              const val = chartTab === 'ingresos' ? t.ingresos : chartTab === 'leads' ? t.leads : t.proyectos;
              return (
                <p key={t.mes} className="text-xs font-semibold text-orange-400 text-center flex-1">
                  {chartTab === 'ingresos' ? `$${((val as number) / 1000).toFixed(0)}k` : val}
                </p>
              );
            })}
          </div>
        </div>
      </div>}

      {/* Alertas inteligentes */}
      {widgets.alertas && alertas > 0 && (
        <div className="card p-6">
          <SectionHeader color="#F59E0B" title="Alertas Inteligentes"
            icon="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Leads inactivos */}
            {(data?.leadsInactivos.length ?? 0) > 0 && (
              <div className="bg-yellow-900/10 border border-yellow-800/50 rounded-lg p-4">
                <p className="text-xs font-semibold text-yellow-400 mb-2 flex items-center gap-1.5">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Leads sin actividad +7 días
                </p>
                <div className="space-y-1">
                  {data?.leadsInactivos.map(l => (
                    <p key={l.id} className="text-xs text-gray-300 truncate">• {l.companyName}</p>
                  ))}
                </div>
              </div>
            )}
            {/* Propuestas sin respuesta */}
            {(data?.propuestasSinRespuesta.length ?? 0) > 0 && (
              <div className="bg-red-900/10 border border-red-800/50 rounded-lg p-4">
                <p className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1.5">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Propuestas sin respuesta +5 días
                </p>
                <div className="space-y-1">
                  {data?.propuestasSinRespuesta.map(p => (
                    <p key={p.id} className="text-xs text-gray-300 truncate">• {p.title}</p>
                  ))}
                </div>
              </div>
            )}
            {/* Próximos deadlines */}
            {(data?.proximosDeadlines.length ?? 0) > 0 && (
              <div className="bg-orange-900/10 border border-orange-800/50 rounded-lg p-4">
                <p className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1.5">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Deadlines próximos 7 días
                </p>
                <div className="space-y-1">
                  {data?.proximosDeadlines.map(p => (
                    <div key={p.id} className="flex items-center justify-between">
                      <p className="text-xs text-gray-300 truncate flex-1">{p.name}</p>
                      <span className={`text-xs ml-2 flex-shrink-0 ${PRIORITY_COLORS[p.priority]}`}>
                        {new Date(p.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Registros financieros pendientes */}
            {(data?.registrosPendientes.length ?? 0) > 0 && (
              <div className="bg-purple-900/10 border border-purple-800/50 rounded-lg p-4">
                <p className="text-xs font-semibold text-purple-400 mb-2 flex items-center gap-1.5">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Pagos pendientes en Finanzas
                </p>
                <div className="space-y-1">
                  {data?.registrosPendientes.map(r => (
                    <div key={r.id} className="flex items-center justify-between">
                      <p className="text-xs text-gray-300 truncate flex-1">{r.concepto}</p>
                      <span className="text-xs ml-2 flex-shrink-0 text-purple-400">
                        {r.moneda === 'EUR' ? '€' : '$'}{r.monto.toLocaleString()} {r.moneda}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Distribución por fuente + Estados */}
      {widgets.fuentes && <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Fuentes de leads */}
        <div className="card p-6">
          <SectionHeader color="#22D3EE" title="Fuentes de Leads"
            icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          <div className="space-y-3">
            {(() => {
              const total = data?.industriaLeads.reduce((a, b) => a + b._count, 0) ?? 1;
              return data?.industriaLeads.map((item) => {
                const pct = total > 0 ? Math.round((item._count / total) * 100) : 0;
                return (
                  <div key={item.source}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-300">{item.source}</span>
                      <span className="text-orange-400">{item._count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div className="bg-orange-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Leads por estado */}
        <div className="card p-6">
          <SectionHeader color="#3B82F6" title="Leads por Estado"
            icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          <div className="space-y-3">
            {(() => {
              const maxCount = Math.max(...(data?.leadsByStatus.map(s => s._count) ?? [1]));
              return data?.leadsByStatus.map(item => {
                const pct = maxCount > 0 ? Math.round((item._count / maxCount) * 100) : 0;
                return (
                  <div key={item.status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-400">{translateStatus(item.status)}</span>
                      <span className="font-semibold text-orange-400">{item._count}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1">
                      <div className="bg-orange-500 h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Propuestas por estado */}
        <div className="card p-6">
          <SectionHeader color="#8B5CF6" title="Propuestas por Estado"
            icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          <div className="space-y-3">
            {(() => {
              const maxCount = Math.max(...(data?.proposalsByStatus.map(s => s._count) ?? [1]));
              return data?.proposalsByStatus.map(item => {
                const pct = maxCount > 0 ? Math.round((item._count / maxCount) * 100) : 0;
                return (
                  <div key={item.status}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-400">{translateStatus(item.status)}</span>
                      <span className="font-semibold text-orange-400">{item._count}</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1">
                      <div className="bg-orange-500 h-1 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>}

      {/* Actividad Reciente */}
      {widgets.actividad && (data?.recentActivities?.length ?? 0) > 0 && (
        <div className="card p-5">
          <SectionHeader
            color="#94A3B8"
            title="Actividad Reciente"
            icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            badge={
              <a href="/traceability" className="text-xs transition-colors" style={{ color: '#FF7A2F' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FF5A00'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#FF7A2F'}
              >
                Ver todo →
              </a>
            }
          />
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            {data?.recentActivities.slice(0, 8).map(a => (
              <div
                key={a.id}
                className="flex items-center gap-3 py-2"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: getActivityDot(a.type) }}
                />
                <p className="text-xs text-gray-300 flex-1 truncate">{a.description}</p>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[10px] text-gray-600">{a.user.name}</span>
                  <span className="text-[10px] text-gray-700 font-mono">
                    {new Date(a.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function getActivityDot(type: string): string {
  const map: Record<string, string> = {
    CREATED: '#34d399', UPDATED: '#60a5fa', STATUS_CHANGED: '#fbbf24',
    NOTE_ADDED: '#a78bfa', PROPOSAL_SENT: '#fb923c', MILESTONE_COMPLETED: '#10b981',
  };
  return map[type] ?? '#475569';
}

function translateStatus(status: string): string {
  const t: Record<string, string> = {
    NEW: 'Identificación', CONTACTED: 'Contacto', QUALIFIED: 'Diagnóstico',
    PROPOSAL_SENT: 'Propuesta', NEGOTIATION: 'Negociación',
    WON: 'Resultado', LOST: 'Resultado', DRAFT: 'Borrador', SENT: 'Enviado',
    UNDER_REVIEW: 'En Revisión', ACCEPTED: 'Aceptado', REJECTED: 'Rechazado',
    PLANNING: 'Planificación', IN_PROGRESS: 'En Progreso', ON_HOLD: 'En Pausa',
    COMPLETED: 'Completado', CANCELLED: 'Cancelado',
  };
  return t[status] || status;
}

