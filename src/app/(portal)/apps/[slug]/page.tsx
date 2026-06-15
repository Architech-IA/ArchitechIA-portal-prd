'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Settings, Box, Users, Layout, Globe, BarChart3,
} from 'lucide-react';
import AppRuntimePlaceholder from '@/components/apps/shared/AppRuntimePlaceholder';
import type { AppInstance } from '@/lib/app-types';
import { APP_STATUS_LABELS } from '@/lib/app-types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  Layout,
  Globe,
  BarChart3,
};

export default function AppRuntimePage() {
  const router = useRouter();
  const params = useParams();
  const slug = String(params.slug);

  const [app, setApp] = useState<AppInstance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/apps/by-slug/${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data && !data.error) {
          setApp(data as AppInstance);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="p-6 md:p-8">
        <h1 className="text-2xl font-bold text-white">App no encontrada</h1>
      </div>
    );
  }

  const Icon = ICON_MAP[app.appType.icon] ?? Box;
  const status = APP_STATUS_LABELS[app.status];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/50 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/apps')}
            className="rounded-lg border border-gray-800 p-2 text-gray-400 hover:bg-gray-900 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${app.appType.color} text-white`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{app.name}</h1>
              <p className="text-xs text-gray-400">
                {app.appType.name} • {app.owner.name} •
                <span className={`ml-1 rounded-full border px-1.5 py-0.5 text-[10px] ${status.chip}`}>
                  {status.label}
                </span>
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => router.push(`/apps/${app.slug}/config`)}
          className="flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
        >
          <Settings className="h-4 w-4" />
          Configurar
        </button>
      </div>

      {/* Runtime area */}
      <div className="flex-1 overflow-auto p-6">
        <AppRuntimePlaceholder app={app} />
      </div>
    </div>
  );
}
