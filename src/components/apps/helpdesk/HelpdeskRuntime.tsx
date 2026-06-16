'use client';

import { Headphones, Search, Plus, AlertCircle, Clock } from 'lucide-react';
import type { AppInstance } from '@/lib/app-types';
import AppBackButton from '@/components/apps/shared/AppBackButton';

interface Ticket {
  id: string;
  subject: string;
  requester: string;
  category: string;
  priority: string;
  status: 'Abierto' | 'En progreso' | 'Resuelto';
  sla: string;
}

const DEFAULT_CATEGORIES = ['Técnico', 'Facturación', 'Consulta General', 'Incidente'];
const DEFAULT_PRIORITIES = ['Baja', 'Media', 'Alta', 'Crítica'];

const DUMMY_TICKETS: Ticket[] = [
  { id: 'H-1024', subject: 'No puedo acceder al portal', requester: 'Roberto Sánchez', category: 'Técnico', priority: 'Alta', status: 'Abierto', sla: '4h' },
  { id: 'H-1023', subject: 'Duda sobre factura #4521', requester: 'Laura Fernández', category: 'Facturación', priority: 'Media', status: 'En progreso', sla: '12h' },
  { id: 'H-1022', subject: 'Solicitud de nuevo usuario', requester: 'Miguel Torres', category: 'Consulta General', priority: 'Baja', status: 'Resuelto', sla: '24h' },
  { id: 'H-1021', subject: 'Caída parcial del servicio', requester: 'Patricia Ruiz', category: 'Incidente', priority: 'Crítica', status: 'En progreso', sla: '1h' },
  { id: 'H-1020', subject: 'Configuración de reportes', requester: 'Andrés Gómez', category: 'Técnico', priority: 'Media', status: 'Abierto', sla: '8h' },
];

function statusBadge(status: Ticket['status']) {
  switch (status) {
    case 'Abierto':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    case 'En progreso':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'Resuelto':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  }
}

function priorityDot(priority: string) {
  switch (priority) {
    case 'Crítica':
      return 'bg-red-500';
    case 'Alta':
      return 'bg-orange-500';
    case 'Media':
      return 'bg-yellow-500';
    default:
      return 'bg-gray-500';
  }
}

export default function HelpdeskRuntime({ app }: { app: AppInstance }) {
  const config = app.config;
  const companyName = String(config.companyName || app.name);
  const categories = Array.isArray(config.categories) ? (config.categories as string[]) : DEFAULT_CATEGORIES;
  const priorities = Array.isArray(config.priorities) ? (config.priorities as string[]) : DEFAULT_PRIORITIES;
  const slaHours = Number(config.slaHours || 24);

  const open = DUMMY_TICKETS.filter((t) => t.status === 'Abierto').length;
  const inProgress = DUMMY_TICKETS.filter((t) => t.status === 'En progreso').length;
  const resolved = DUMMY_TICKETS.filter((t) => t.status === 'Resuelto').length;

  return (
    <div className="flex h-full flex-col bg-[#0a0a18]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg">
            <Headphones className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{companyName}</h2>
            <p className="text-xs text-gray-400">Centro de soporte</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
            <Plus className="h-4 w-4" />
            Nuevo ticket
          </button>
          <AppBackButton />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Summary bar */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">Abiertos</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-white">{open}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="flex items-center gap-2 text-amber-400">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">En progreso</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-white">{inProgress}</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <Headphones className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase">Resueltos</span>
            </div>
            <p className="mt-1 text-2xl font-bold text-white">{resolved}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-gray-800 bg-gray-900 px-3 py-2">
            <Search className="h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar tickets..."
              className="flex-1 border-none bg-transparent text-sm text-white outline-none placeholder-gray-600"
            />
          </div>
          <div className="text-xs text-gray-500">SLA estándar: {slaHours}h</div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 font-medium text-gray-400">ID</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Asunto</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Solicitante</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Categoría</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Prioridad</th>
                  <th className="px-4 py-3 font-medium text-gray-400">Estado</th>
                  <th className="px-4 py-3 font-medium text-gray-400">SLA</th>
                </tr>
              </thead>
              <tbody>
                {DUMMY_TICKETS.map((ticket) => (
                  <tr key={ticket.id} className="border-b border-gray-800 last:border-0 hover:bg-white/5">
                    <td className="px-4 py-3 text-gray-500">{ticket.id}</td>
                    <td className="px-4 py-3 font-medium text-white">{ticket.subject}</td>
                    <td className="px-4 py-3 text-gray-400">{ticket.requester}</td>
                    <td className="px-4 py-3 text-gray-400">{ticket.category}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-gray-400">
                        <span className={`h-2 w-2 rounded-full ${priorityDot(ticket.priority)}`} />
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${statusBadge(ticket.status)}`}>
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{ticket.sla}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Categories & priorities reference */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Categorías</h4>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <span key={cat} className="rounded-full border border-gray-700 bg-gray-950 px-2.5 py-1 text-xs text-gray-400">
                  {cat}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
            <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">Prioridades</h4>
            <div className="flex flex-wrap gap-2">
              {priorities.map((p) => (
                <span key={p} className="rounded-full border border-gray-700 bg-gray-950 px-2.5 py-1 text-xs text-gray-400">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
