'use client';

import { Shield, Server, Monitor, Network, AppWindow, Database, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { AppInstance } from '@/lib/app-types';
import AppBackButton from '@/components/apps/shared/AppBackButton';

interface Threat {
  id: string;
  name: string;
  level: string;
  time: string;
  status: 'blocked' | 'investigating' | 'resolved';
}

const DEFAULT_ASSETS = ['Servidores', 'Endpoints', 'Red', 'Aplicaciones', 'Bases de datos'];
const DEFAULT_LEVELS = ['Crítica', 'Alta', 'Media', 'Baja'];

const ASSET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Servidores: Server,
  Endpoints: Monitor,
  Red: Network,
  Aplicaciones: AppWindow,
  'Bases de datos': Database,
};

const DUMMY_THREATS: Threat[] = [
  { id: 'T-91', name: 'Intento de fuerza bruta en VPN', level: 'Alta', time: '10 min', status: 'blocked' },
  { id: 'T-90', name: 'Phishing detectado en correo', level: 'Media', time: '35 min', status: 'investigating' },
  { id: 'T-89', name: 'Tráfico anómalo saliente', level: 'Crítica', time: '1 h', status: 'investigating' },
  { id: 'T-88', name: 'Actualización de firma antivirus', level: 'Baja', time: '3 h', status: 'resolved' },
];

const COMPLIANCE_ITEMS = [
  { label: 'Autenticación multifactor', passed: true },
  { label: 'Encriptación en tránsito', passed: true },
  { label: 'Backups diarios verificados', passed: true },
  { label: 'Política de contraseñas', passed: false },
  { label: 'Revisión de accesos trimestral', passed: true },
];

function threatStatusBadge(status: Threat['status']) {
  switch (status) {
    case 'blocked':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'investigating':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'resolved':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  }
}

function threatStatusLabel(status: Threat['status']) {
  switch (status) {
    case 'blocked':
      return 'Bloqueado';
    case 'investigating':
      return 'Investigando';
    case 'resolved':
      return 'Resuelto';
  }
}

function levelColor(level: string) {
  switch (level) {
    case 'Crítica':
      return 'text-red-400';
    case 'Alta':
      return 'text-orange-400';
    case 'Media':
      return 'text-yellow-400';
    default:
      return 'text-gray-400';
  }
}

export default function SecurityDashboardRuntime({ app }: { app: AppInstance }) {
  const config = app.config;
  const companyName = String(config.companyName || app.name);
  const assets = Array.isArray(config.assets) ? (config.assets as string[]) : DEFAULT_ASSETS;
  const threatLevels = Array.isArray(config.threatLevels) ? (config.threatLevels as string[]) : DEFAULT_LEVELS;
  const showCompliance = config.showCompliance !== false;

  const score = 87;

  return (
    <div className="flex h-full flex-col bg-[#0a0a18]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{companyName}</h2>
            <p className="text-xs text-gray-400">Panel de seguridad</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
            Último escaneo: hace 5 min
          </div>
          <AppBackButton />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Score gauge */}
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6 lg:col-span-1">
            <h3 className="mb-4 text-sm font-semibold text-white">Puntuación de seguridad</h3>
            <div className="flex flex-col items-center">
              <div className="relative h-40 w-40">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="#1f2937" strokeWidth="12" />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="12"
                    strokeDasharray={`${(score / 100) * 327} 327`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-white">{score}</span>
                  <span className="text-xs text-gray-500">/ 100</span>
                </div>
              </div>
              <p className="mt-3 text-sm text-emerald-400">Postura segura</p>
            </div>
          </div>

          {/* Asset status cards */}
          <div className="lg:col-span-2">
            <h3 className="mb-4 text-sm font-semibold text-white">Estado de activos</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => {
                const Icon = ASSET_ICONS[asset] ?? Server;
                const healthy = Math.random() > 0.2;
                return (
                  <div
                    key={asset}
                    className="rounded-xl border border-gray-800 bg-gray-900 p-4 transition-colors hover:border-gray-700"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={`text-xs ${healthy ? 'text-emerald-400' : 'text-red-400'}`}>
                        {healthy ? 'Saludable' : 'Alerta'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white">{asset}</p>
                    <p className="text-xs text-gray-500">{healthy ? 'Monitoreo activo' : 'Requiere atención'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Threats */}
        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Amenazas recientes</h3>
            <div className="flex gap-2">
              {threatLevels.map((level) => (
                <span key={level} className={`text-xs ${levelColor(level)}`}>
                  {level}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {DUMMY_THREATS.map((threat) => (
              <div
                key={threat.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-800 bg-gray-950 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${threat.level === 'Crítica' ? 'bg-red-500/10 text-red-400' : threat.level === 'Alta' ? 'bg-orange-500/10 text-orange-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{threat.name}</p>
                    <p className="text-xs text-gray-500">{threat.id} • hace {threat.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs ${levelColor(threat.level)}`}>{threat.level}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${threatStatusBadge(threat.status)}`}>
                    {threatStatusLabel(threat.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compliance checklist */}
        {showCompliance && (
          <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900 p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">Cumplimiento</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {COMPLIANCE_ITEMS.map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-lg border border-gray-800 bg-gray-950 p-3">
                  {item.passed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                  <span className={`text-xs ${item.passed ? 'text-gray-300' : 'text-gray-500'}`}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
