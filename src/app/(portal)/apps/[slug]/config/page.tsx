'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft, Save, Play, Loader2, Box, Users, Layout, Globe, BarChart3,
} from 'lucide-react';
import AppConfigForm from '@/components/apps/shared/AppConfigForm';
import type { AppInstance, AppTypeDefinition } from '@/lib/app-types';
import { APP_STATUS_LABELS } from '@/lib/app-types';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Users,
  Layout,
  Globe,
  BarChart3,
};

interface RelationOption {
  id: string;
  label: string;
}

export default function AppConfigPage() {
  const router = useRouter();
  const params = useParams();
  const slug = String(params.slug);

  const [app, setApp] = useState<AppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<AppInstance['status']>('DRAFT');
  const [leadId, setLeadId] = useState('');
  const [proposalId, setProposalId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [clienteId, setClienteId] = useState('');

  const [leads, setLeads] = useState<RelationOption[]>([]);
  const [proposals, setProposals] = useState<RelationOption[]>([]);
  const [projects, setProjects] = useState<RelationOption[]>([]);
  const [clientes, setClientes] = useState<RelationOption[]>([]);

  // Load app
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/apps/by-slug/${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data && !data.error) {
          setApp(data as AppInstance);
          setConfig((data as AppInstance).config);
          setStatus((data as AppInstance).status);
          setLeadId((data as AppInstance).leadId ?? '');
          setProposalId((data as AppInstance).proposalId ?? '');
          setProjectId((data as AppInstance).projectId ?? '');
          setClienteId((data as AppInstance).clienteId ?? '');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  // Load relation options
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/leads').then((r) => r.json()).catch(() => []),
      fetch('/api/proposals').then((r) => r.json()).catch(() => []),
      fetch('/api/projects').then((r) => r.json()).catch(() => []),
      fetch('/api/clientes').then((r) => r.json()).catch(() => []),
    ]).then(([leadsData, proposalsData, projectsData, clientesData]) => {
      if (cancelled) return;
      setLeads((Array.isArray(leadsData) ? leadsData : []).map((l) => ({ id: l.id, label: l.companyName ?? l.name ?? l.id })));
      setProposals((Array.isArray(proposalsData) ? proposalsData : []).map((p) => ({ id: p.id, label: p.title ?? p.id })));
      setProjects((Array.isArray(projectsData) ? projectsData : []).map((p) => ({ id: p.id, label: p.name ?? p.id })));
      setClientes((Array.isArray(clientesData) ? clientesData : []).map((c) => ({ id: c.id, label: c.nombre ?? c.id })));
    });
    return () => { cancelled = true; };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`/api/apps/${app.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          config,
          leadId: leadId || null,
          proposalId: proposalId || null,
          projectId: projectId || null,
          clienteId: clienteId || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setApp(data as AppInstance);
        setMessage('Cambios guardados correctamente');
      } else {
        setMessage(data.error ?? 'Error al guardar');
      }
    } catch {
      setMessage('Error de red al guardar');
    } finally {
      setSaving(false);
    }
  };

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
  const type = app.appType as unknown as AppTypeDefinition;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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
              <h1 className="text-2xl font-bold text-white">{app.name}</h1>
              <p className="text-sm text-gray-400">{app.appType.name} • Configuración</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/apps/${app.slug}`)}
            className="flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <Play className="h-4 w-4" />
            Abrir app
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main config */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Configuración de {type.name}</h2>
            <AppConfigForm schema={type.schema} config={config} onChange={setConfig} />
          </div>

          {message && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${message.includes('Error') ? 'border-red-900/50 bg-red-900/20 text-red-400' : 'border-green-900/50 bg-green-900/20 text-green-400'}`}>
              {message}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push('/apps')}
              className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              Guardar cambios
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Estado</h3>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AppInstance['status'])}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
            >
              {Object.entries(APP_STATUS_LABELS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Relaciones</h3>
            <div className="space-y-4">
              <RelationSelect
                label="Lead"
                value={leadId}
                onChange={setLeadId}
                options={leads}
              />
              <RelationSelect
                label="Propuesta"
                value={proposalId}
                onChange={setProposalId}
                options={proposals}
              />
              <RelationSelect
                label="Proyecto"
                value={projectId}
                onChange={setProjectId}
                options={projects}
              />
              <RelationSelect
                label="Cliente"
                value={clienteId}
                onChange={setClienteId}
                options={clientes}
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function RelationSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: RelationOption[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none"
      >
        <option value="">Sin relación</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
