'use client';

import { useState, useEffect } from 'react';

interface HubCard {
  title: string;
  description: string;
  href: string;
  icon: string;
}

interface ServiceStatus {
  name: string;
  status: 'ok' | 'degraded' | 'down';
  latency: number;
}

const HUB_CARDS: HubCard[] = [
  {
    title: 'BUSINESS',
    description: 'Estrategia comercial, leads, propuestas y gestión de clientes.',
    href: '/hub/business',
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  },
  {
    title: 'FINANCE',
    description: 'Finanzas, presupuestos, pagos y control de registros contables.',
    href: '/hub/finance',
    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'OPERATIONS',
    description: 'Proyectos, backlog y operaciones del equipo técnico.',
    href: '/hub/operations',
    icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  },
  {
    title: 'ADMIN',
    description: 'Gestión del equipo, usuarios, roles y configuración organizacional.',
    href: '/hub/team',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    title: 'LEGAL',
    description: 'Contratos, documentos legales, compliance y políticas corporativas.',
    href: '/hub/legal',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
];

function StatusDot({ status }: { status: ServiceStatus['status'] }) {
  const cls = status === 'ok' ? 'bg-green-400' : status === 'degraded' ? 'bg-yellow-400' : 'bg-red-400';
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cls} ${status !== 'ok' ? 'animate-pulse' : ''}`} />;
}

export default function HubPage() {
  const [mounted, setMounted]   = useState(false);
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const fetchStatus = () => {
    setLoadingStatus(true);
    fetch('/api/status')
      .then(r => r.json())
      .then(d => { setServices(d); setLastCheck(new Date()); })
      .catch(() => {})
      .finally(() => setLoadingStatus(false));
  };

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 60000);
    return () => clearInterval(id);
  }, []);

  const allOk = services.length > 0 && services.every(s => s.status === 'ok');
  const hasIssues = services.some(s => s.status !== 'ok');

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">HUB</h1>
        <p className="text-gray-400 mt-1">Centro de operaciones y gestión organizacional de ArchiTechIA</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {HUB_CARDS.map((card, idx) => (
          <a
            key={card.href}
            href={card.href}
            className="group block bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-orange-500/50 transition-all"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(12px)',
              transition: `all 0.35s ease ${idx * 80}ms`,
            }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white group-hover:text-orange-400 transition-colors">{card.title}</h3>
                <p className="text-sm text-gray-400 mt-1 leading-relaxed">{card.description}</p>
              </div>
              <svg className="w-5 h-5 text-gray-600 group-hover:text-orange-400 transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        ))}
      </div>

      {/* Widget de estado del sistema */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${loadingStatus ? 'bg-gray-600' : allOk ? 'bg-green-400' : hasIssues ? 'bg-yellow-400 animate-pulse' : 'bg-gray-600'}`} />
            <h3 className="text-sm font-semibold text-white">Estado del Sistema</h3>
            {!loadingStatus && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${allOk ? 'bg-green-900/30 text-green-400' : hasIssues ? 'bg-yellow-900/30 text-yellow-400' : 'bg-gray-800 text-gray-500'}`}>
                {allOk ? 'Todos operativos' : hasIssues ? 'Incidencia detectada' : 'Verificando...'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {lastCheck && (
              <span className="text-xs text-gray-600">
                Actualizado {lastCheck.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={fetchStatus}
              disabled={loadingStatus}
              className="p-1.5 text-gray-500 hover:text-white transition-colors disabled:opacity-40"
              title="Refrescar"
            >
              <svg className={`w-4 h-4 ${loadingStatus ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {loadingStatus && services.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-gray-800 rounded-lg p-3 animate-pulse">
                <div className="h-3 bg-gray-700 rounded w-16 mb-2" />
                <div className="h-2 bg-gray-700 rounded w-10" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {services.map(s => (
              <div key={s.name} className={`rounded-lg p-3 border transition-colors ${
                s.status === 'ok'       ? 'bg-green-900/10 border-green-800/30' :
                s.status === 'degraded' ? 'bg-yellow-900/10 border-yellow-800/30' :
                                          'bg-red-900/10 border-red-800/30'
              }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <StatusDot status={s.status} />
                  <span className="text-sm font-medium text-white">{s.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${
                    s.status === 'ok' ? 'text-green-400' : s.status === 'degraded' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {s.status === 'ok' ? 'Operativo' : s.status === 'degraded' ? 'Degradado' : 'Sin servicio'}
                  </span>
                  <span className="text-xs text-gray-600">{s.latency}ms</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
