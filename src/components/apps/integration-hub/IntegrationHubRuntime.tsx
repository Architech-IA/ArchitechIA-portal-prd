'use client';

import { Plug, CheckCircle2, AlertCircle, PauseCircle, Clock } from 'lucide-react';
import type { AppInstance } from '@/lib/app-types';
import AppBackButton from '@/components/apps/shared/AppBackButton';

interface Integration {
  name: string;
  source: string;
  target: string;
  status: 'active' | 'paused' | 'error';
}

const DEFAULT_INTEGRATIONS: Integration[] = [
  { name: 'CRM → ERP', source: 'CRM', target: 'ERP', status: 'active' },
  { name: 'E-commerce → Warehouse', source: 'E-commerce', target: 'Warehouse', status: 'active' },
  { name: 'Forms → Email', source: 'Forms', target: 'Email', status: 'paused' },
];

const SYNC_LABELS: Record<string, string> = {
  realtime: 'Tiempo real',
  hourly: 'Cada hora',
  daily: 'Diaria',
};

function statusBadge(status: Integration['status']) {
  switch (status) {
    case 'active':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'paused':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'error':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
  }
}

function statusIcon(status: Integration['status']) {
  switch (status) {
    case 'active':
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case 'paused':
      return <PauseCircle className="h-4 w-4 text-amber-400" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-400" />;
  }
}

function statusLabel(status: Integration['status']) {
  switch (status) {
    case 'active':
      return 'Activa';
    case 'paused':
      return 'Pausada';
    case 'error':
      return 'Error';
  }
}

export default function IntegrationHubRuntime({ app }: { app: AppInstance }) {
  const config = app.config;
  const companyName = String(config.companyName || app.name);
  const integrations = Array.isArray(config.integrations)
    ? (config.integrations as Integration[])
    : DEFAULT_INTEGRATIONS;
  const syncFrequency = String(config.syncFrequency || 'hourly');

  const systems = Array.from(
    new Set(integrations.flatMap((i) => [i.source, i.target]))
  );

  return (
    <div className="flex h-full flex-col bg-[#0a0a18]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-amber-600 text-white shadow-lg">
            <Plug className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{companyName}</h2>
            <p className="text-xs text-gray-400">Integration Hub</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
            <Clock className="h-3.5 w-3.5" />
            Sincronización {SYNC_LABELS[syncFrequency] ?? syncFrequency}
          </div>
          <AppBackButton />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Systems hub */}
        <div className="mb-8 rounded-xl border border-gray-800 bg-gray-900 p-6">
          <h3 className="mb-4 text-sm font-semibold text-white">Sistemas conectados</h3>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {systems.map((system) => (
              <div key={system} className="flex flex-col items-center gap-2">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-sm font-bold text-white shadow-md">
                  {system.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs text-gray-400">{system}</span>
              </div>
            ))}
          </div>
          <svg className="pointer-events-none absolute left-0 top-0 h-full w-full opacity-0" />
        </div>

        {/* Integration cards */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {integrations.map((integration, i) => (
            <div
              key={i}
              className="relative rounded-xl border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-gray-700"
            >
              {/* Connector line decoration */}
              <div className="absolute left-0 right-0 top-8 hidden h-0.5 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 lg:block" />

              <div className="relative mb-4 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-xs font-bold text-white">
                  {integration.source.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex h-8 flex-1 items-center justify-center">
                  <div className="h-0.5 w-full max-w-[80px] bg-gradient-to-r from-gray-600 to-amber-500/50" />
                  <Plug className="mx-1 h-4 w-4 text-amber-500" />
                  <div className="h-0.5 w-full max-w-[80px] bg-gradient-to-r from-amber-500/50 to-gray-600" />
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-xs font-bold text-white">
                  {integration.target.slice(0, 2).toUpperCase()}
                </div>
              </div>

              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">{integration.name}</h4>
                <span className={`rounded-full border px-2 py-0.5 text-xs ${statusBadge(integration.status)}`}>
                  {statusLabel(integration.status)}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{integration.source}</span>
                <span>{integration.target}</span>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950 p-3">
                {statusIcon(integration.status)}
                <span className="text-xs text-gray-400">
                  {integration.status === 'active'
                    ? 'Sincronización activa'
                    : integration.status === 'paused'
                      ? 'Pausada temporalmente'
                      : 'Error detectado'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Sync log placeholder */}
        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900 p-5">
          <h3 className="mb-3 text-sm font-semibold text-white">Últimas sincronizaciones</h3>
          <div className="space-y-2">
            {[
              { time: '14:02', event: 'CRM → ERP completada', status: 'ok' },
              { time: '13:45', event: 'E-commerce → Warehouse en progreso', status: 'ok' },
              { time: '13:10', event: 'Forms → Email pausada manualmente', status: 'warn' },
            ].map((log, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-950 p-3">
                <span className="text-xs text-gray-500">{log.time}</span>
                <span className="text-xs text-gray-300">{log.event}</span>
                <span
                  className={`ml-auto h-2 w-2 rounded-full ${log.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
