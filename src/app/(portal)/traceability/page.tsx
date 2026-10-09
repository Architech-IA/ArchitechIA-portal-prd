'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useAsyncAction } from '@/hooks/useAsyncAction';

interface Activity {
  id: string;
  type: string;
  description: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

interface SessionLog {
  id: string;
  userId: string | null;
  email: string | null;
  action: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  details: string | null;
  createdAt: string;
}

type Tab = 'activities' | 'sessions';

const TABS: { key: Tab; label: string }[] = [
  { key: 'activities', label: 'Actividades' },
  { key: 'sessions', label: 'Sesiones' },
];

// SVG icons per activity type (no emojis)
function ActivityIcon({ type }: { type: string }) {
  const paths: Record<string, string> = {
    CREATED:             'M12 4v16m8-8H4',
    UPDATED:             'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    STATUS_CHANGED:      'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    NOTE_ADDED:          'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    PROPOSAL_SENT:       'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
    MILESTONE_COMPLETED: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  };
  const d = paths[type] ?? 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z';
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d={d} />
    </svg>
  );
}

function getActivityColor(type: string): { bg: string; icon: string; border: string } {
  const map: Record<string, { bg: string; icon: string; border: string }> = {
    CREATED:             { bg: 'rgba(16,185,129,0.12)',  icon: '#34d399', border: '#34d399' },
    UPDATED:             { bg: 'rgba(59,130,246,0.12)',  icon: '#60a5fa', border: '#60a5fa' },
    STATUS_CHANGED:      { bg: 'rgba(245,158,11,0.12)',  icon: '#fbbf24', border: '#fbbf24' },
    NOTE_ADDED:          { bg: 'rgba(139,92,246,0.12)',  icon: '#a78bfa', border: '#a78bfa' },
    PROPOSAL_SENT:       { bg: 'rgba(255,90,0,0.12)',    icon: '#fb923c', border: '#fb923c' },
    MILESTONE_COMPLETED: { bg: 'rgba(16,185,129,0.18)',  icon: '#10b981', border: '#10b981' },
  };
  return map[type] ?? { bg: 'rgba(255,255,255,0.05)', icon: '#94a3b8', border: '#334155' };
}

export default function TraceabilityPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>('activities');

  // ── Activities state ──
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [filter, setFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');

  // ── Sessions state ──
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsFetched, setSessionsFetched] = useState(false);
  const [sessionActionFilter, setSessionActionFilter] = useState('');
  const [sessionSearch, setSessionSearch] = useState('');

  useEffect(() => {
    fetch('/api/activities')
      .then(res => res.json())
      .then(data => { setActivities(data); setLoadingActivities(false); });
  }, []);

  useEffect(() => {
    if (tab === 'sessions' && !sessionsFetched) {
      setLoadingSessions(true);
      fetch('/api/sessions?limit=200')
        .then(res => res.json())
        .then(data => { setSessions(data); setLoadingSessions(false); setSessionsFetched(true); });
    }
  }, [tab, sessionsFetched]);

  useEffect(() => {
    if (!session?.user?.email || !sessionsFetched) return;
    const currentEmail = session.user.email;
    const currentId = (session.user as { id?: string }).id || '';
    const key = `session-backfill-${currentEmail}`;
    if (localStorage.getItem(key)) return;
    const hasRecentLogin = sessions.some(s => s.email === currentEmail && s.action === 'LOGIN' && s.success);
    if (!hasRecentLogin && sessionsFetched) {
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentId, email: currentEmail, action: 'LOGIN', success: true }),
      }).then(() => { localStorage.setItem(key, '1'); setSessionsFetched(false); }).catch(() => {});
    }
  }, [session, sessionsFetched, sessions]);

  const filteredActivities = activities.filter(a => {
    const matchesSearch = a.description.toLowerCase().includes(filter.toLowerCase()) ||
      a.user.name.toLowerCase().includes(filter.toLowerCase());
    const matchesType = !entityTypeFilter || a.entityType === entityTypeFilter;
    return matchesSearch && matchesType;
  });

  const filteredSessions = sessions.filter(s => {
    const matchesAction = !sessionActionFilter || s.action === sessionActionFilter;
    const matchesSearch = !sessionSearch ||
      (s.email && s.email.toLowerCase().includes(sessionSearch.toLowerCase())) ||
      (s.ip && s.ip.includes(sessionSearch)) ||
      (s.action && s.action.toLowerCase().includes(sessionSearch.toLowerCase()));
    return matchesAction && matchesSearch;
  });

  const getEntityTypeLabel = (entityType: string) => {
    const labels: Record<string, string> = { lead: 'Lead', proposal: 'Propuesta', project: 'Proyecto' };
    return labels[entityType] || entityType;
  };

  const getActionBadge = (action: string) => {
    const map: Record<string, string> = {
      LOGIN: 'bg-emerald-900/50 text-emerald-300 border border-emerald-800/50',
      LOGOUT: 'bg-gray-700/50 text-gray-400 border border-gray-700',
      FAILED_LOGIN: 'bg-red-900/50 text-red-300 border border-red-800/50',
    };
    return map[action] || 'bg-gray-700/50 text-gray-400 border border-gray-700';
  };

  const getActionLabel = (action: string) => {
    const map: Record<string, string> = { LOGIN: 'Inicio de sesión', LOGOUT: 'Cierre de sesión', FAILED_LOGIN: 'Intento fallido' };
    return map[action] || action;
  };

  const exportFn = useCallback(() => new Promise<void>(resolve => {
    setTimeout(() => { window.print(); resolve(); }, 80);
  }), []);
  const { run: handleExportPDF, loading: exporting, success: exported } = useAsyncAction(exportFn);

  const parseBrowser = (ua: string | null) => {
    if (!ua) return '—';
    if (ua.includes('Firefox/')) return 'Firefox';
    if (ua.includes('Chrome/') && !ua.includes('Edg/') && !ua.includes('OPR/')) return 'Chrome';
    if (ua.includes('Edg/')) return 'Edge';
    if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari';
    if (ua.includes('OPR/') || ua.includes('Opera/')) return 'Opera';
    return 'Navegador';
  };

  const parseOS = (ua: string | null) => {
    if (!ua) return '—';
    if (ua.includes('Windows NT')) return 'Windows';
    if (ua.includes('Mac OS X')) return 'macOS';
    if (ua.includes('Linux') && !ua.includes('Android')) return 'Linux';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
    return '—';
  };

  if (tab === 'activities' && loadingActivities) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="p-5">
      <style>{`
        @media print {
          aside, nav, button, input, select, .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
          .print-card { background: white !important; border: 1px solid #ddd !important; }
        }
      `}</style>

      {/* ── Tabs + Exportar ── */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-0.5 bg-gray-900/80 rounded-lg p-0.5 border border-white/[0.06] w-fit">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                tab === key
                  ? 'bg-orange-600 text-white shadow'
                  : 'text-[#7f8a9c] hover:text-gray-300 hover:bg-white/[0.04]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#7f8a9c]">
            {tab === 'activities' ? `${filteredActivities.length} registros` : `${filteredSessions.length} sesiones`}
          </span>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className={`no-print flex items-center gap-1.5 px-3 py-1.5 border rounded-lg transition-all text-xs ${
              exported
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : exporting
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-400 cursor-not-allowed'
                : 'bg-white/[0.05] border-white/[0.08] text-gray-400 hover:text-white hover:border-orange-500/40 hover:bg-orange-500/10'
            }`}
          >
            {exporting ? (
              <>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin" />
                Exportando...
              </>
            ) : exported ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Listo
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Exportar PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* ═══════════ TAB: ACTIVITIES ═══════════ */}
      {tab === 'activities' && (
        <>
          {/* Filtros */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7f8a9c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar actividades..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-white/[0.07] rounded-lg bg-white/[0.03] text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500/40 focus:bg-white/[0.05] transition-all"
              />
            </div>
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="px-3 py-1.5 border border-white/[0.07] rounded-lg bg-white/[0.03] text-xs text-gray-400 focus:outline-none focus:border-orange-500/40 transition-all"
            >
              <option value="">Todos los tipos</option>
              <option value="lead">Leads</option>
              <option value="proposal">Propuestas</option>
              <option value="project">Proyectos</option>
            </select>
          </div>

          {/* Timeline */}
          <div
            className="rounded-xl border overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
          >
            <div className="p-4">
              <div className="space-y-2">
                {filteredActivities.map((activity, index) => {
                  const colors = getActivityColor(activity.type);
                  return (
                    <div key={activity.id} className="flex gap-3">
                      {/* Timeline rail */}
                      <div className="flex flex-col items-center flex-shrink-0" style={{ width: '28px' }}>
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: colors.bg, color: colors.icon, border: `1px solid ${colors.icon}22` }}
                        >
                          <ActivityIcon type={activity.type} />
                        </div>
                        {index < filteredActivities.length - 1 && (
                          <div className="w-px flex-1 mt-1.5" style={{ background: 'rgba(255,255,255,0.06)', minHeight: '12px' }} />
                        )}
                      </div>

                      {/* Card */}
                      <div
                        className="flex-1 mb-2 rounded-lg overflow-hidden"
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderLeft: `2px solid ${colors.border}55`,
                        }}
                      >
                        <div className="px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-200">{activity.user.name}</span>
                              <span className={`px-1.5 py-px text-[11px] rounded ${getEntityTypeBadgeColor(activity.entityType)}`}>
                                {getEntityTypeLabel(activity.entityType)}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#7f8a9c] font-mono">
                              {new Date(activity.createdAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 leading-relaxed">{activity.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredActivities.length === 0 && (
                  <div className="text-center py-12">
                    <svg className="w-8 h-8 text-[#7f8a9c] mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-[#7f8a9c]">No se encontraron actividades</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ═══════════ TAB: SESSIONS ═══════════ */}
      {tab === 'sessions' && (
        <>
          {loadingSessions ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
          ) : (
            <>
              {/* Filtros sesiones */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7f8a9c]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar por email, IP o acción..."
                    value={sessionSearch}
                    onChange={(e) => setSessionSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-white/[0.07] rounded-lg bg-white/[0.03] text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-orange-500/40 focus:bg-white/[0.05] transition-all"
                  />
                </div>
                <select
                  value={sessionActionFilter}
                  onChange={(e) => setSessionActionFilter(e.target.value)}
                  className="px-3 py-1.5 border border-white/[0.07] rounded-lg bg-white/[0.03] text-xs text-gray-400 focus:outline-none focus:border-orange-500/40 transition-all"
                >
                  <option value="">Todas las acciones</option>
                  <option value="LOGIN">Inicios de sesión</option>
                  <option value="LOGOUT">Cierres de sesión</option>
                  <option value="FAILED_LOGIN">Intentos fallidos</option>
                </select>
              </div>

              <div
                className="rounded-xl border overflow-x-auto"
                style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Fecha / Hora', 'Email', 'Acción', 'IP', 'Navegador', 'SO', 'Estado'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[#7f8a9c]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map((s, i) => (
                      <tr
                        key={s.id}
                        className="transition-colors"
                        style={{
                          borderBottom: i < filteredSessions.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap font-mono text-[11px]">
                          {new Date(s.createdAt).toLocaleString('es-ES')}
                        </td>
                        <td className="px-4 py-2.5 text-gray-300 max-w-[180px] truncate" title={s.email || '—'}>
                          {s.email || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 text-[11px] font-medium rounded ${getActionBadge(s.action)}`}>
                            {getActionLabel(s.action)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[#7f8a9c] font-mono text-[11px]">{s.ip || '—'}</td>
                        <td className="px-4 py-2.5 text-[#7f8a9c]">{parseBrowser(s.userAgent)}</td>
                        <td className="px-4 py-2.5 text-[#7f8a9c]">{parseOS(s.userAgent)}</td>
                        <td className="px-4 py-2.5">
                          {s.success ? (
                            <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                              Éxito
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-400 text-[11px]" title={s.details || ''}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                              Fallo
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredSessions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-xs text-[#7f8a9c]">
                          No se encontraron registros de sesiones
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-[#7f8a9c] mt-2 text-right">
                {filteredSessions.length} de {sessions.length} registros
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

function getEntityTypeBadgeColor(entityType: string): string {
  const colors: Record<string, string> = {
    lead:     'bg-orange-900/50 text-orange-400 border border-orange-800/40',
    proposal: 'bg-purple-900/50 text-purple-400 border border-purple-800/40',
    project:  'bg-emerald-900/50 text-emerald-400 border border-emerald-800/40',
  };
  return colors[entityType] || 'bg-gray-800 text-gray-400 border border-gray-700';
}
