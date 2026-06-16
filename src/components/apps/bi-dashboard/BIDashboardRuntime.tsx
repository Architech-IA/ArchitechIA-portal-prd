'use client';

import { BarChart3, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import type { AppInstance } from '@/lib/app-types';
import AppBackButton from '@/components/apps/shared/AppBackButton';

interface KpiCard {
  label: string;
  value: string;
  change?: string;
}

interface ChartConfig {
  title: string;
  type: 'line' | 'bar' | 'pie';
  dataSource?: string;
}

const DEFAULT_KPIS: KpiCard[] = [
  { label: 'Leads', value: '1,248', change: '+12%' },
  { label: 'Conversiones', value: '8.4%', change: '+2.1%' },
  { label: 'Ingresos', value: '$42.5M', change: '+5.3%' },
  { label: 'Tickets', value: '87', change: '-4%' },
];

const DEFAULT_CHARTS: ChartConfig[] = [
  { title: 'Ventas mensuales', type: 'line', dataSource: 'Ventas' },
  { title: 'Leads por canal', type: 'bar', dataSource: 'Leads' },
  { title: 'Satisfacción', type: 'pie', dataSource: 'Encuestas' },
];

function isPositiveChange(change?: string) {
  if (!change) return true;
  return !change.startsWith('-');
}

export default function BIDashboardRuntime({ app }: { app: AppInstance }) {
  const config = app.config;
  const companyName = String(config.companyName || app.name);
  const kpiCards = Array.isArray(config.kpiCards) ? (config.kpiCards as KpiCard[]) : DEFAULT_KPIS;
  const charts = Array.isArray(config.charts) ? (config.charts as ChartConfig[]) : DEFAULT_CHARTS;
  const refreshInterval = Number(config.refreshInterval || 60);

  return (
    <div className="flex h-full flex-col bg-[#0a0a18]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{companyName}</h2>
            <p className="text-xs text-gray-400">Dashboard BI • Datos en tiempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiza cada {refreshInterval}s
          </div>
          <AppBackButton />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* KPI cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpiCards.map((kpi, i) => {
            const positive = isPositiveChange(kpi.change);
            const TrendIcon = positive ? TrendingUp : TrendingDown;
            return (
              <div
                key={i}
                className="rounded-xl border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-gray-700"
              >
                <p className="text-sm text-gray-400">{kpi.label}</p>
                <p className="mt-1 text-2xl font-bold text-white">{kpi.value}</p>
                {kpi.change && (
                  <div className={`mt-2 flex items-center gap-1 text-xs ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                    <TrendIcon className="h-3.5 w-3.5" />
                    {kpi.change}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {charts.map((chart, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-gray-700"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">{chart.title}</h3>
                  <p className="text-xs text-gray-500">{chart.dataSource || 'Datos internos'}</p>
                </div>
                <span className="rounded-full border border-gray-700 bg-gray-950 px-2 py-0.5 text-[10px] uppercase text-gray-400">
                  {chart.type}
                </span>
              </div>
              <div className="flex h-48 items-center justify-center">
                {chart.type === 'line' && <LineChartPlaceholder />}
                {chart.type === 'bar' && <BarChartPlaceholder />}
                {chart.type === 'pie' && <PieChartPlaceholder />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LineChartPlaceholder() {
  return (
    <svg viewBox="0 0 300 120" className="h-full w-full">
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 90 C40 80, 60 40, 100 55 S180 90, 220 30 S280 50, 300 20"
        fill="none"
        stroke="#10b981"
        strokeWidth="3"
      />
      <path
        d="M0 90 C40 80, 60 40, 100 55 S180 90, 220 30 S280 50, 300 20 V120 H0 Z"
        fill="url(#lineFill)"
        stroke="none"
      />
      {[20, 55, 90].map((y, i) => (
        <line key={i} x1="0" y1={y} x2="300" y2={y} stroke="#374151" strokeWidth="1" strokeDasharray="4" />
      ))}
    </svg>
  );
}

function BarChartPlaceholder() {
  const heights = [45, 70, 55, 90, 65, 80, 50];
  return (
    <svg viewBox="0 0 300 120" className="h-full w-full">
      {heights.map((h, i) => (
        <rect
          key={i}
          x={20 + i * 38}
          y={120 - h}
          width="26"
          height={h}
          rx="3"
          fill="#14b8a6"
          opacity={0.8 + (i % 3) * 0.1}
        />
      ))}
      <line x1="0" y1="120" x2="300" y2="120" stroke="#4b5563" strokeWidth="2" />
    </svg>
  );
}

function PieChartPlaceholder() {
  return (
    <svg viewBox="0 0 120 120" className="h-36 w-36">
      <circle cx="60" cy="60" r="50" fill="#10b981" />
      <path d="M60 60 L60 10 A50 50 0 0 1 110 60 Z" fill="#14b8a6" />
      <path d="M60 60 L110 60 A50 50 0 0 1 60 110 Z" fill="#0d9488" />
      <path d="M60 60 L60 110 A50 50 0 0 1 10 60 Z" fill="#34d399" />
      <circle cx="60" cy="60" r="22" fill="#111827" />
      <text x="60" y="64" textAnchor="middle" fill="#e5e7eb" fontSize="12" fontWeight="bold">
        100%
      </text>
    </svg>
  );
}
