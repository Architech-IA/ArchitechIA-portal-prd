'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Play, Box,
  Users, Layout, Globe, BarChart3,
  Bot, FileText, UserCircle, Headphones, Shield, Plug, Kanban,
} from 'lucide-react';
import type { AppInstance } from '@/lib/app-types';
import { APP_CATEGORIES } from '@/lib/app-types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Users, Layout, Globe, BarChart3, Bot, FileText, UserCircle, Headphones, Shield, Plug, Kanban,
};

const CAT_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  'text-orange-400':  { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)'  },
  'text-blue-400':    { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)'  },
  'text-green-400':   { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)'  },
  'text-cyan-400':    { color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  border: 'rgba(34,211,238,0.3)'  },
  'text-purple-400':  { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.3)' },
  'text-pink-400':    { color: '#f472b6', bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.3)' },
  'text-yellow-400':  { color: '#facc15', bg: 'rgba(250,204,21,0.12)',  border: 'rgba(250,204,21,0.3)'  },
  'text-red-400':     { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  'text-emerald-400': { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)'  },
  'text-indigo-400':  { color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.3)' },
  'text-violet-400':  { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  'text-teal-400':    { color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)',  border: 'rgba(45,212,191,0.3)'  },
  'text-fuchsia-400': { color: '#e879f9', bg: 'rgba(232,121,249,0.12)', border: 'rgba(232,121,249,0.3)' },
  'text-rose-400':    { color: '#fb7185', bg: 'rgba(251,113,133,0.12)', border: 'rgba(251,113,133,0.3)' },
  'text-amber-400':   { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)'  },
  'text-lime-400':    { color: '#a3e635', bg: 'rgba(163,230,53,0.12)',  border: 'rgba(163,230,53,0.3)'  },
};

function getStyle(colorClass: string) {
  return CAT_STYLE[colorClass] ?? { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)' };
}

export default function AppsHubPage() {
  const [apps, setApps] = useState<AppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/apps')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setApps(Array.isArray(d) ? d : []); })
      .catch(() => { if (!cancelled) setApps([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    return apps
      .filter((a) => { const k = a.appType.category; if (seen.has(k)) return false; seen.add(k); return true; })
      .map((a) => a.appType.category);
  }, [apps]);

  const filtered = useMemo(() => apps.filter((a) => {
    const q = search.trim().toLowerCase();
    return (!q || a.name.toLowerCase().includes(q) || (a.description ?? '').toLowerCase().includes(q))
        && (!categoryFilter || a.appType.category === categoryFilter);
  }), [apps, search, categoryFilter]);

  return (
    <div className="px-6 pb-8 pt-6 md:px-8">

      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Catalogo de Apps
        </h1>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="input-dark rounded-xl py-2 pl-9 pr-4 text-sm"
            style={{ width: '220px' }}
          />
        </div>
      </div>

      {/* Pills de categoria */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1 scrollbar-hide">
        {(['', ...categories] as string[]).map((cat) => {
          const meta = cat ? APP_CATEGORIES[cat] : null;
          const label = cat ? (meta?.label ?? cat) : 'Todas';
          const active = categoryFilter === cat;
          return (
            <button
              key={cat || '__all__'}
              onClick={() => setCategoryFilter(cat)}
              className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all flex-shrink-0"
              style={active
                ? { background: '#ffffff', color: '#0a0a16', border: '1px solid transparent' }
                : { background: 'transparent', color: '#64748b', border: '1px solid rgba(255,255,255,0.1)' }
              }
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = '#e2e8f0'; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.color = '#64748b'; }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <Box className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">No se encontraron apps</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}

function AppCard({ app }: { app: AppInstance }) {
  const router = useRouter();
  const Icon = ICON_MAP[app.appType.icon] ?? Box;
  const category = APP_CATEGORIES[app.appType.category];
  const cs = getStyle(category?.color ?? 'text-gray-400');

  return (
    <div
      className="relative rounded-2xl p-4 border flex flex-col transition-all duration-200"
      style={{
        background: '#0d0d1a',
        borderColor: 'rgba(255,255,255,0.06)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = cs.border;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px ${cs.border}`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
        (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.4)';
      }}
    >
      {/* Icono + badge */}
      <div className="flex items-start justify-between mb-3">
        <div
          className={`h-10 w-10 flex items-center justify-center rounded-xl bg-gradient-to-br ${app.appType.color} text-white shadow-md flex-shrink-0`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2"
          style={{ color: cs.color, background: cs.bg, border: `1px solid ${cs.border}` }}
        >
          {category?.label ?? app.appType.category}
        </span>
      </div>

      {/* Titulo */}
      <h3 className="text-sm font-bold mb-1.5 leading-snug" style={{ color: cs.color }}>
        {app.name}
      </h3>

      {/* Descripcion */}
      <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed flex-1 mb-4">
        {app.description ?? 'Sin descripcion'}
      </p>

      {/* Abrir */}
      <button
        onClick={() => router.push(`/apps/${app.slug}`)}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold text-white transition-colors"
        style={{ background: '#ea580c' }}
        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = '#c2410c'}
        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = '#ea580c'}
      >
        <Play className="h-3 w-3" />
        Abrir
      </button>
    </div>
  );
}
