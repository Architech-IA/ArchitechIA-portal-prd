'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Loader2, Box, Users, Layout, Globe, BarChart3 } from 'lucide-react';
import type { AppTypeDefinition } from '@/lib/app-types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  Layout,
  Globe,
  BarChart3,
};

export default function NewAppWizardPage() {
  const router = useRouter();
  const params = useParams();
  const appTypeSlug = String(params.appTypeSlug);

  const [type, setType] = useState<AppTypeDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/app-types')
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          const found = Array.isArray(data)
            ? (data as AppTypeDefinition[]).find((t) => t.slug === appTypeSlug)
            : null;
          setType(found ?? null);
        }
      })
      .catch(() => { if (!cancelled) setType(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [appTypeSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!type) return;
    if (!name.trim()) {
      setError('El nombre de la app es obligatorio');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          appTypeId: type.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Error al crear la app');
        setSubmitting(false);
        return;
      }
      router.push(`/apps/${data.slug}/config`);
    } catch {
      setError('Error de red al crear la app');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!type) {
    return (
      <div className="p-6 md:p-8">
        <button
          onClick={() => router.push('/apps/catalogo')}
          className="mb-4 flex items-center gap-2 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo
        </button>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-12 text-center">
          <h2 className="text-xl font-semibold text-white">Tipo de app no encontrado</h2>
          <p className="mt-2 text-gray-400">El template &quot;{appTypeSlug}&quot; no existe en el catálogo.</p>
        </div>
      </div>
    );
  }

  const Icon = ICON_MAP[type.icon] ?? Box;

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-8">
      <button
        onClick={() => router.push('/apps/catalogo')}
        className="mb-4 flex items-center gap-2 text-sm text-gray-400 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al catálogo
      </button>

      <div className="mb-6 flex items-center gap-4">
        <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${type.color} text-white shadow-lg`}>
          <Icon className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Nueva {type.name}</h1>
          <p className="text-sm text-gray-400">{type.description}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-gray-800 bg-gray-900 p-6">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-gray-300">
            Nombre de la app <span className="text-red-400">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Ej: Demo CRM - Cliente X`}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-gray-300">
            Descripción
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="¿Qué problema resuelve esta app?"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-white placeholder-gray-600 focus:border-orange-500 focus:outline-none"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-900/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push('/apps/catalogo')}
            className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Crear app
          </button>
        </div>
      </form>
    </div>
  );
}
