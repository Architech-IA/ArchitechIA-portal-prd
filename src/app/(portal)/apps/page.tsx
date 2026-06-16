'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, LayoutGrid, List, Settings, Play,
  Users, Layout, Globe, BarChart3, Box,
} from 'lucide-react';
import type { AppInstance } from '@/lib/app-types';
import { APP_STATUS_LABELS, APP_CATEGORIES } from '@/lib/app-types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  Layout,
  Globe,
  BarChart3,
};

export default function AppsHubPage() {
  const router = useRouter();
  const [apps, setApps] = useState<AppInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/apps')
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setApps(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setApps([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filteredApps = useMemo(() => {
    return apps.filter((app) => {
      const matchesSearch =
        search.trim() === '' ||
        app.name.toLowerCase().includes(search.toLowerCase()) ||
        (app.description ?? '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === '' || app.status === statusFilter;
      const matchesCategory = categoryFilter === '' || app.appType.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [apps, search, statusFilter, categoryFilter]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    apps.forEach((app) => map.set(app.appType.category, app.appType.category));
    return Array.from(map.values());
  }, [apps]);

  const statusKeys = Object.keys(APP_STATUS_LABELS) as AppInstance['status'][];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="px-6 pb-6 pt-4 md:px-8 md:pb-8 md:pt-6">
      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o descripción..."
            className="w-full rounded-xl border border-gray-800 bg-gray-900 py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
        >
          <option value="">Todos los estados</option>
          {statusKeys.map((s) => (
            <option key={s} value={s}>{APP_STATUS_LABELS[s].label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-gray-800 bg-gray-900 px-4 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c} value={c}>{APP_CATEGORIES[c]?.label ?? c}</option>
          ))}
        </select>
        <div className="flex items-center gap-1 rounded-xl border border-gray-800 bg-gray-900 p-1">
          <button
            onClick={() => setView('grid')}
            className={`rounded-lg p-2 ${view === 'grid' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-white'}`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setView('list')}
            className={`rounded-lg p-2 ${view === 'list' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-white'}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={() => router.push('/apps/catalogo')}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-orange-600 hover:to-orange-700"
        >
          <Plus className="h-4 w-4" />
          Nueva app
        </button>
      </div>

      {/* Empty state */}
      {filteredApps.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/50 p-12 text-center">
          <div className="mb-4 flex justify-center">
            <Box className="h-12 w-12 text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold text-white">No hay mini-apps aún</h3>
          <p className="mt-1 text-sm text-gray-500">Crea tu primera app desde el catálogo de templates.</p>
          <button
            onClick={() => router.push('/apps/catalogo')}
            className="mt-4 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
          >
            Explorar catálogo
          </button>
        </div>
      )}

      {/* Grid view */}
      {view === 'grid' && filteredApps.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredApps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}

      {/* List view */}
      {view === 'list' && filteredApps.length > 0 && (
        <div className="space-y-2">
          {filteredApps.map((app) => (
            <AppListRow key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}

function AppCard({ app }: { app: AppInstance }) {
  const router = useRouter();
  const Icon = ICON_MAP[app.appType.icon] ?? Box;
  const status = APP_STATUS_LABELS[app.status];
  const category = APP_CATEGORIES[app.appType.category];

  return (
    <div className="group relative rounded-xl border border-gray-800 bg-gray-900 p-5 transition-colors hover:border-gray-700">
      <div className="mb-4 flex items-start justify-between">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${app.appType.color} text-white shadow-lg`}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-xs ${status.chip}`}>
            <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
          <div className="relative">
            <button
              onClick={() => router.push(`/apps/${app.slug}/config`)}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-800 hover:text-white"
              title="Configurar"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <h3 className="mb-1 text-lg font-semibold text-white">{app.name}</h3>
      <p className="mb-4 line-clamp-2 text-sm text-gray-500">{app.description ?? 'Sin descripción'}</p>
      <div className="mb-4 flex items-center gap-3 text-xs text-gray-500">
        <span className={category?.color ?? 'text-gray-400'}>{category?.label ?? app.appType.category}</span>
        <span>•</span>
        <span>{app.appType.name}</span>
        <span>•</span>
        <span>{app.owner.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push(`/apps/${app.slug}`)}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-orange-600 py-2 text-sm font-medium text-white hover:bg-orange-700"
        >
          <Play className="h-4 w-4" />
          Abrir
        </button>
        <button
          onClick={() => router.push(`/apps/${app.slug}/config`)}
          className="rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800 hover:text-white"
        >
          Configurar
        </button>
      </div>
    </div>
  );
}

function AppListRow({ app }: { app: AppInstance }) {
  const router = useRouter();
  const Icon = ICON_MAP[app.appType.icon] ?? Box;
  const status = APP_STATUS_LABELS[app.status];
  const category = APP_CATEGORIES[app.appType.category];

  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-4 hover:border-gray-700">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${app.appType.color} text-white`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-medium text-white">{app.name}</h3>
        <p className="truncate text-xs text-gray-500">
          {category?.label ?? app.appType.category} • {app.appType.name} • {app.owner.name}
        </p>
      </div>
      <span className={`rounded-full border px-2 py-0.5 text-xs ${status.chip}`}>
        {status.label}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => router.push(`/apps/${app.slug}`)}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
          title="Abrir"
        >
          <Play className="h-4 w-4" />
        </button>
        <button
          onClick={() => router.push(`/apps/${app.slug}/config`)}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
          title="Configurar"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
