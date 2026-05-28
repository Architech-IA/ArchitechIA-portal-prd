'use client';

import { useEffect, useState } from 'react';

interface PersonalData {
  user: { id: string; email: string; name: string };
  kpis: {
    leadsActivos: number;
    proyectos: number;
    backlogPendientes: number;
    backlogInProgress: number;
    reunionesPróximas: number;
    pipelineValue: number;
  };
  myLeads: {
    id: string; companyName: string; contactName: string;
    status: string; estimatedValue: number; updatedAt: string; source: string;
  }[];
  myProjects: {
    id: string; name: string; status: string; priority: string;
    progress: number; endDate: string | null; description: string;
    projectRole: string;
  }[];
  myBacklog: {
    id: string; title: string; type: string; priority: string;
    status: string; points: number | null; projectId: string | null;
    project: { name: string } | null;
  }[];
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

const STATUS_COLOR: Record<string, string> = {
  NEW: 'text-blue-400', CONTACTED: 'text-indigo-400', DIAGNOSIS: 'text-violet-400',
  QUALIFIED: 'text-cyan-400', DEMO_VALIDATION: 'text-yellow-400',
  PROPOSAL_SENT: 'text-orange-400', NEGOTIATION: 'text-amber-400',
  WON: 'text-green-400', LOST: 'text-red-400',
};

const PRIORITY_DOT: Record<string, string> = {
  LOW: 'bg-gray-500', MEDIUM: 'bg-yellow-500',
  HIGH: 'bg-orange-500', CRITICAL: 'bg-red-500',
};

const PROJECT_STATUS_COLOR: Record<string, string> = {
  PLANNING: 'text-blue-400', IN_PROGRESS: 'text-orange-400',
  ON_HOLD: 'text-yellow-400', COMPLETED: 'text-green-400', CANCELLED: 'text-red-400',
};

const BACKLOG_STATUS_LABEL: Record<string, string> = {
  BACKLOG: 'Pendiente', IN_PROGRESS: 'En progreso', REVIEW: 'En revisión', DONE: 'Listo',
};

const BACKLOG_STATUS_COLOR: Record<string, string> = {
  BACKLOG: 'bg-gray-700 text-gray-300',
  IN_PROGRESS: 'bg-orange-900/40 text-orange-300',
  REVIEW: 'bg-blue-900/40 text-blue-300',
  DONE: 'bg-green-900/40 text-green-300',
};

const MEETING_TYPE_LABEL: Record<string, string> = {
  INTERNAL_DAILY: 'Daily', INTERNAL_WORKSHOP: 'Workshop',
  COMERCIAL: 'Comercial', ASESORIA: 'Asesoría',
  PROVEEDORES: 'Proveedores', INTERNAL: 'Interna',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' });
}

export default function PersonalDashboard() {
  const [data, setData] = useState<PersonalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/personal')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );

  const d = data!;
  const today = new Date();
  const todayMeetings = d.upcomingMeetings.filter(m => {
    const mDate = new Date(m.date);
    return mDate.toDateString() === today.toDateString();
  });

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Hola, <span style={{ color: '#FF7A2F' }}>{d.user.name.split(' ')[0]}</span>
        </h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {today.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Leads activos',     value: d.kpis.leadsActivos,       sub: `$${d.kpis.pipelineValue.toLocaleString()} pipeline`, icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', color: 'text-white' },
          { label: 'Proyectos',         value: d.kpis.proyectos,           sub: 'Asignados a ti',            icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z', color: 'text-white' },
          { label: 'Backlog pendiente', value: d.kpis.backlogPendientes,   sub: `${d.kpis.backlogInProgress} en progreso`, icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', color: d.kpis.backlogInProgress > 0 ? 'text-orange-400' : 'text-white' },
          { label: 'Próximas reuniones',value: d.kpis.reunionesPróximas,  sub: `${todayMeetings.length} hoy`,   icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', color: 'text-white' },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-4 border border-orange-500/20 hover:border-orange-500/40 transition-all" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400">{k.label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,90,0,0.15)' }}>
                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={k.icon} />
                </svg>
              </div>
            </div>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Backlog */}
        <div className="rounded-xl border border-gray-800 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#FF7A2F' }}>
              Mis Tareas (Backlog)
            </h2>
            <a href="/backlog" className="text-xs text-gray-500 hover:text-orange-400 transition-colors">Ver todas →</a>
          </div>
          {d.myBacklog.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-6">Sin tareas asignadas</p>
          ) : (
            <div className="space-y-2">
              {d.myBacklog.slice(0, 8).map(item => (
                <div key={item.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[item.priority] ?? 'bg-gray-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{item.title}</p>
                    {item.project && <p className="text-xs text-gray-500 truncate">{item.project.name}</p>}
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full flex-shrink-0 ${BACKLOG_STATUS_COLOR[item.status] ?? 'bg-gray-700 text-gray-400'}`}>
                    {BACKLOG_STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>
              ))}
              {d.myBacklog.length > 8 && (
                <p className="text-xs text-gray-600 text-center pt-1">+{d.myBacklog.length - 8} más</p>
              )}
            </div>
          )}
        </div>

        {/* Próximas reuniones */}
        <div className="rounded-xl border border-gray-800 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#FF7A2F' }}>
              Próximas Reuniones
            </h2>
            <a href="/meetings" className="text-xs text-gray-500 hover:text-orange-400 transition-colors">Ver calendario →</a>
          </div>
          {d.upcomingMeetings.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-6">Sin reuniones los próximos 14 días</p>
          ) : (
            <div className="space-y-2">
              {d.upcomingMeetings.map(m => {
                const isToday = new Date(m.date).toDateString() === today.toDateString();
                return (
                  <div key={m.id}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg transition-all"
                    style={{ background: isToday ? 'rgba(255,90,0,0.08)' : 'rgba(255,255,255,0.03)', border: isToday ? '1px solid rgba(255,90,0,0.2)' : '1px solid transparent' }}
                  >
                    <div className="flex-shrink-0 text-center w-10">
                      <p className="text-[10px] text-gray-500 uppercase">{formatDate(m.date).split(' ')[0]}</p>
                      <p className="text-sm font-bold text-white">{formatDate(m.date).split(' ')[1]}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-200 truncate">{m.title}</p>
                      <p className="text-xs text-gray-500">
                        {formatTime(m.date)}{m.endDate ? ` — ${formatTime(m.endDate)}` : ''} · {MEETING_TYPE_LABEL[m.type] ?? m.type}
                      </p>
                    </div>
                    {isToday && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 flex-shrink-0">Hoy</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Mis Leads */}
        <div className="rounded-xl border border-gray-800 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#FF7A2F' }}>
              Mis Leads
            </h2>
            <a href="/leads" className="text-xs text-gray-500 hover:text-orange-400 transition-colors">Ver todos →</a>
          </div>
          {d.myLeads.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-6">Sin leads asignados</p>
          ) : (
            <div className="space-y-2">
              {d.myLeads.slice(0, 8).map(l => (
                <a key={l.id} href="/leads"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:border-orange-500/20"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid transparent' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate font-medium">{l.companyName}</p>
                    <p className="text-xs text-gray-500 truncate">{l.contactName}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-medium ${STATUS_COLOR[l.status] ?? 'text-gray-400'}`}>
                      {STATUS_LEAD[l.status] ?? l.status}
                    </p>
                    {l.estimatedValue > 0 && (
                      <p className="text-xs text-gray-500">${l.estimatedValue.toLocaleString()}</p>
                    )}
                  </div>
                </a>
              ))}
              {d.myLeads.length > 8 && (
                <p className="text-xs text-gray-600 text-center pt-1">+{d.myLeads.length - 8} más</p>
              )}
            </div>
          )}
        </div>

        {/* Mis Proyectos */}
        <div className="rounded-xl border border-gray-800 p-5" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#FF7A2F' }}>
              Mis Proyectos
            </h2>
            <a href="/projects" className="text-xs text-gray-500 hover:text-orange-400 transition-colors">Ver todos →</a>
          </div>
          {d.myProjects.length === 0 ? (
            <p className="text-sm text-gray-600 text-center py-6">Sin proyectos asignados</p>
          ) : (
            <div className="space-y-3">
              {d.myProjects.map(p => (
                <a key={p.id} href="/projects"
                  className="block px-3 py-3 rounded-lg transition-all hover:border-orange-500/20"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid transparent' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-200 font-medium truncate flex-1">{p.name}</p>
                    <span className={`text-xs ml-3 flex-shrink-0 ${PROJECT_STATUS_COLOR[p.status] ?? 'text-gray-400'}`}>
                      {p.status === 'PLANNING' ? 'Planeación' : p.status === 'IN_PROGRESS' ? 'En progreso' : p.status === 'COMPLETED' ? 'Completado' : p.status === 'ON_HOLD' ? 'En pausa' : p.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${p.progress}%`, background: 'linear-gradient(90deg, #FF5A00, #FF7A2F)' }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">{p.progress}%</span>
                  </div>
                  {p.endDate && (
                    <p className="text-xs text-gray-600 mt-1">
                      Fecha límite: {new Date(p.endDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
