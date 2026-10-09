'use client';

import { useEffect, useState } from 'react';

interface KPIs {
  totalLeads: number; leadsGanados: number; leadsPerdidos: number;
  winRate: number; avgDealSize: number; totalPipeline: number;
  totalProposals: number; propAceptadas: number; acceptanceRate: number;
  totalIngresos: number;
}

interface ReportData {
  kpis: KPIs;
  revenueMensual: { mes: string; ingresos: number; deals: number }[];
  pipelineEtapas: { status: string; label: string; count: number; valor: number }[];
  revenueCategorias: { cat: string; total: number }[];
  propEstados: { status: string; count: number; valor: number }[];
  topSocios: { id: string; name: string; role: string; _count: { leads: number; proposals: number } }[];
}

const PROP_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Borrador', SENT: 'Enviado', UNDER_REVIEW: 'En Revisión',
  ACCEPTED: 'Aceptado', REJECTED: 'Rechazado',
};

const PROP_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'text-gray-400', SENT: 'text-orange-400', UNDER_REVIEW: 'text-yellow-400',
  ACCEPTED: 'text-green-400', REJECTED: 'text-red-400',
};

function Bar({ value, max, color = 'bg-orange-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-700 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
    </div>
  );
}

interface ProspectingStats {
  total: number;
  thisMonth: number;
  totalResults: number;
  costUSD: number;
  thisMonthCost: number;
  creditoRestante: number;
  leadsCreated: number;
  fromMap: number;
  topCategories: { category: string; count: number }[];
  topCities: { city: string; count: number }[];
  byUser: { name: string; count: number }[];
  recentLogs: { id: string; userName: string; city: string; category: string; results: number; fromMap: boolean; createdAt: string }[];
}

export default function ReportesPage() {
  const [data, setData]             = useState<ReportData | null>(null);
  const [prospecting, setProspecting] = useState<ProspectingStats | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/reportes').then(r => r.json()),
      fetch('/api/prospecting/stats').then(r => r.json()),
    ]).then(([d, p]) => {
      setData(d);
      setProspecting(p);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );

  if (!data) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-400">Error al cargar reportes.</p>
    </div>
  );

  const { kpis, revenueMensual, pipelineEtapas, revenueCategorias, propEstados, topSocios } = data;
  const maxRevenue = Math.max(...revenueMensual.map(m => m.ingresos), 1);
  const maxEtapa   = Math.max(...pipelineEtapas.map(e => e.count), 1);
  const maxCat     = Math.max(...revenueCategorias.map(c => c.total), 1);

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <p className="text-gray-400 mt-1">Métricas de ventas, pipeline y rendimiento del equipo</p>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Leads',      value: kpis.totalLeads,                       color: 'text-white' },
          { label: 'Win Rate',         value: `${kpis.winRate}%`,                    color: 'text-green-400' },
          { label: 'Ticket Promedio',  value: `$${kpis.avgDealSize.toLocaleString()}`, color: 'text-orange-400' },
          { label: 'Tasa Aceptación',  value: `${kpis.acceptanceRate}%`,             color: 'text-blue-400' },
          { label: 'Ingresos Totales', value: `$${kpis.totalIngresos.toLocaleString()}`, color: 'text-purple-400' },
        ].map(k => (
          <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue mensual + Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Revenue por mes */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Ingresos por mes (últimos 6)</h2>
          <div className="space-y-4">
            {revenueMensual.map(m => (
              <div key={m.mes}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{m.mes}</span>
                  <span className="text-white font-medium">${m.ingresos.toLocaleString()}</span>
                </div>
                <Bar value={m.ingresos} max={maxRevenue} color="bg-orange-500" />
                <p className="text-xs text-[#7f8a9c] mt-0.5">{m.deals} deals cerrados</p>
              </div>
            ))}
            {revenueMensual.length === 0 && <p className="text-[#7f8a9c] text-sm text-center py-4">Sin datos</p>}
          </div>
        </div>

        {/* Pipeline por etapa */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Pipeline por etapa</h2>
          <div className="space-y-3">
            {pipelineEtapas.map(e => (
              <div key={e.status}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{e.label}</span>
                  <span className="text-white font-medium">{e.count} lead{e.count !== 1 ? 's' : ''} · ${e.valor.toLocaleString()}</span>
                </div>
                <Bar value={e.count} max={maxEtapa} color="bg-blue-500" />
              </div>
            ))}
            {pipelineEtapas.length === 0 && <p className="text-[#7f8a9c] text-sm text-center py-4">Sin datos</p>}
          </div>
        </div>
      </div>

      {/* Revenue por categoría + Propuestas por estado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Categorías */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Ingresos por categoría</h2>
          <div className="space-y-3">
            {revenueCategorias.map(c => (
              <div key={c.cat}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{c.cat}</span>
                  <span className="text-white font-medium">${c.total.toLocaleString()}</span>
                </div>
                <Bar value={c.total} max={maxCat} color="bg-purple-500" />
              </div>
            ))}
            {revenueCategorias.length === 0 && <p className="text-[#7f8a9c] text-sm text-center py-4">Sin datos</p>}
          </div>
        </div>

        {/* Propuestas por estado */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">Propuestas por estado</h2>
          <div className="space-y-3">
            {propEstados.filter(e => e.count > 0).map(e => (
              <div key={e.status} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <span className={`text-sm font-medium ${PROP_STATUS_COLORS[e.status] ?? 'text-gray-400'}`}>
                  {PROP_STATUS_LABELS[e.status] ?? e.status}
                </span>
                <div className="text-right">
                  <span className="text-white font-bold">{e.count}</span>
                  <span className="text-gray-400 text-xs ml-2">${e.valor.toLocaleString()}</span>
                </div>
              </div>
            ))}
            {propEstados.every(e => e.count === 0) && <p className="text-[#7f8a9c] text-sm text-center py-4">Sin datos</p>}
          </div>
        </div>
      </div>

      {/* Top socios */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Rendimiento del equipo</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {topSocios.map(s => (
            <div key={s.id} className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-xs">{s.name?.split(' ').filter(w => w.length > 0).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('')}</span>
              </div>
              <div>
                <p className="text-white font-medium text-sm">{s.name}</p>
                <p className="text-gray-400 text-xs mt-0.5">{s._count.leads} leads · {s._count.proposals} propuestas</p>
              </div>
            </div>
          ))}
          {topSocios.length === 0 && <p className="text-[#7f8a9c] text-sm col-span-full text-center py-4">Sin datos</p>}
        </div>
      </div>

      {/* Resumen ejecutivo */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Resumen ejecutivo</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Leads ganados',   value: kpis.leadsGanados,    sub: `de ${kpis.totalLeads} totales`,        color: 'text-green-400' },
            { label: 'Leads perdidos',  value: kpis.leadsPerdidos,   sub: `${100 - kpis.winRate}% tasa pérdida`,  color: 'text-red-400' },
            { label: 'Pipeline total',  value: `$${kpis.totalPipeline.toLocaleString()}`, sub: 'excl. perdidos',  color: 'text-orange-400' },
            { label: 'Prop. aceptadas', value: kpis.propAceptadas,   sub: `de ${kpis.totalProposals} enviadas`,   color: 'text-blue-400' },
          ].map(k => (
            <div key={k.label} className="bg-gray-800 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-[#7f8a9c] mt-1">{k.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Lead Prospector — Google Places API */}
      {prospecting && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">Lead Prospector · Google Places API</h2>
              <p className="text-gray-400 text-sm mt-1">Uso de la API de búsqueda de negocios</p>
            </div>
            <a
              href="https://console.cloud.google.com/apis/api/places.googleapis.com/metrics"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-orange-500/50 text-gray-300 hover:text-white rounded-lg text-sm transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2c5.523 0 10 4.477 10 10S17.523 22 12 22 2 17.523 2 12 6.477 2 12 2z" opacity=".3"/>
                <path d="M12 5l-1.5 4.5H6l3.75 2.75L8.25 17 12 14.25 15.75 17l-1.5-4.75L18 9.5h-4.5L12 5z"/>
              </svg>
              Ver métricas en Google Cloud
              <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Solicitudes totales',   value: prospecting.total,                     color: 'text-white',       sub: 'llamadas a Google Places' },
              { label: 'Este mes',              value: prospecting.thisMonth,                  color: 'text-orange-400',  sub: `$${prospecting.thisMonthCost} USD gastados` },
              { label: 'Crédito restante',      value: `$${prospecting.creditoRestante}`,      color: 'text-green-400',   sub: 'de $200 gratis/mes' },
              { label: 'Leads generados',       value: prospecting.leadsCreated,               color: 'text-blue-400',    sub: 'desde Google Places' },
            ].map(k => (
              <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-[#7f8a9c] mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Top categorías */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Top categorías buscadas</h3>
              {prospecting.topCategories.length === 0 ? (
                <p className="text-xs text-[#7f8a9c] text-center py-4">Sin búsquedas aún</p>
              ) : (
                <div className="space-y-3">
                  {prospecting.topCategories.map(c => (
                    <div key={c.category}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300 truncate max-w-[160px]">{c.category}</span>
                        <span className="text-[#7f8a9c]">{c.count}</span>
                      </div>
                      <Bar value={c.count} max={prospecting.topCategories[0].count} color="bg-orange-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top ciudades */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Top ciudades buscadas</h3>
              {prospecting.topCities.length === 0 ? (
                <p className="text-xs text-[#7f8a9c] text-center py-4">Sin búsquedas aún</p>
              ) : (
                <div className="space-y-3">
                  {prospecting.topCities.map(c => (
                    <div key={c.city}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300">{c.city}</span>
                        <span className="text-[#7f8a9c]">{c.count}</span>
                      </div>
                      <Bar value={c.count} max={prospecting.topCities[0].count} color="bg-blue-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Por usuario */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Búsquedas por usuario</h3>
              {prospecting.byUser.length === 0 ? (
                <p className="text-xs text-[#7f8a9c] text-center py-4">Sin búsquedas aún</p>
              ) : (
                <div className="space-y-3">
                  {prospecting.byUser.map(u => (
                    <div key={u.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-300 truncate max-w-[140px]">{u.name}</span>
                        <span className="text-[#7f8a9c]">{u.count} búsquedas</span>
                      </div>
                      <Bar value={u.count} max={prospecting.byUser[0].count} color="bg-green-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Búsquedas recientes */}
          {prospecting.recentLogs.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Últimas búsquedas</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-[#7f8a9c] uppercase border-b border-gray-800">
                      <th className="text-left pb-2">Usuario</th>
                      <th className="text-left pb-2">Ciudad</th>
                      <th className="text-left pb-2">Categoría</th>
                      <th className="text-center pb-2">Resultados</th>
                      <th className="text-center pb-2">Mapa</th>
                      <th className="text-right pb-2">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {prospecting.recentLogs.map(l => (
                      <tr key={l.id}>
                        <td className="py-2 text-gray-300">{l.userName}</td>
                        <td className="py-2 text-gray-400">{l.city}</td>
                        <td className="py-2 text-gray-400 max-w-[200px] truncate">{l.category}</td>
                        <td className="py-2 text-center text-orange-400 font-mono">{l.results}</td>
                        <td className="py-2 text-center">{l.fromMap ? '🗺️' : '—'}</td>
                        <td className="py-2 text-right text-xs text-[#7f8a9c]">
                          {new Date(l.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
