'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Box, Users, Layout, Globe, BarChart3 } from 'lucide-react';
import type { AppTypeDefinition } from '@/lib/app-types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  Layout,
  Globe,
  BarChart3,
};

export default function AppCatalogPage() {
  const router = useRouter();
  const [types, setTypes] = useState<AppTypeDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/app-types')
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setTypes(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setTypes([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="p-6 md:p-8">
      <button
        onClick={() => router.push('/apps')}
        className="mb-4 flex items-center gap-2 text-sm text-gray-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al Hub
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Catálogo de Mini-Apps</h1>
        <p className="mt-1 text-gray-400">Elige el tipo de app que quieres crear. Cada una es una mini-app parametrizable.</p>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {types.map((type) => (
            <AppTypeCard key={type.slug} type={type} />
          ))}
        </div>
      )}
    </div>
  );
}

function AppTypeCard({ type }: { type: AppTypeDefinition }) {
  const router = useRouter();
  const Icon = ICON_MAP[type.icon] ?? Box;

  return (
    <button
      onClick={() => router.push(`/apps/nueva/${type.slug}`)}
      className="rounded-xl border border-gray-800 bg-gray-900 p-6 text-left transition-all hover:border-orange-500/50 hover:bg-gray-800"
    >
      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${type.color} text-white shadow-lg`}>
        <Icon className="h-7 w-7" />
      </div>
      <h3 className="mb-1 text-lg font-semibold text-white">{type.name}</h3>
      <p className="text-sm text-gray-500">{type.description}</p>
      <div className="mt-4 flex items-center gap-2">
        <span className="rounded-full border border-gray-700 bg-gray-950 px-2 py-0.5 text-xs text-gray-400 capitalize">
          {type.category}
        </span>
      </div>
    </button>
  );
}
