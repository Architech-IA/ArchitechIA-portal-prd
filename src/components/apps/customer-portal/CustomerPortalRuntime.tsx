'use client';

import { useState } from 'react';
import {
  UserCircle, FolderKanban, Receipt, TicketCheck, FileText, User,
  Bell, Search,
} from 'lucide-react';
import type { AppInstance } from '@/lib/app-types';
import AppBackButton from '@/components/apps/shared/AppBackButton';

type ModuleKey = 'projects' | 'invoices' | 'tickets' | 'documents' | 'profile';

const MODULE_ICONS: Record<ModuleKey, React.ComponentType<{ className?: string }>> = {
  projects: FolderKanban,
  invoices: Receipt,
  tickets: TicketCheck,
  documents: FileText,
  profile: User,
};

const MODULE_LABELS: Record<ModuleKey, string> = {
  projects: 'Proyectos',
  invoices: 'Facturas',
  tickets: 'Tickets',
  documents: 'Documentos',
  profile: 'Perfil',
};

const DUMMY_PROJECTS = [
  { id: 'P-101', name: 'Migración a la nube', status: 'En progreso', progress: 65, dueDate: '2025-08-15' },
  { id: 'P-102', name: 'Implementación CRM', status: 'Planificación', progress: 20, dueDate: '2025-09-01' },
  { id: 'P-103', name: 'Chatbot de soporte', status: 'En revisión', progress: 90, dueDate: '2025-07-20' },
];

const DUMMY_INVOICES = [
  { id: 'F-4521', concept: 'Servicios Junio 2026', amount: 4500000, status: 'Pagada', date: '2026-06-01' },
  { id: 'F-4489', concept: 'Licencias Q2', amount: 1200000, status: 'Pendiente', date: '2026-05-15' },
];

const DUMMY_TICKETS = [
  { id: 'T-778', subject: 'Error al cargar reporte', status: 'Abierto', priority: 'Alta' },
  { id: 'T-765', subject: 'Solicitud de acceso', status: 'Resuelto', priority: 'Media' },
];

const DUMMY_DOCUMENTS = [
  { id: 'D-12', name: 'Contrato de servicios 2026.pdf', size: '2.4 MB', date: '2026-01-10' },
  { id: 'D-13', name: 'Anexo técnico v2.pdf', size: '1.1 MB', date: '2026-03-22' },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

export default function CustomerPortalRuntime({ app }: { app: AppInstance }) {
  const config = app.config;
  const companyName = String(config.companyName || app.name);
  const modules = (Array.isArray(config.modules) ? (config.modules as ModuleKey[]) : ['projects', 'invoices', 'tickets']) as ModuleKey[];
  const welcomeMessage = String(config.welcomeMessage || 'Bienvenido a tu portal de cliente');
  const primaryColor = String(config.primaryColor || '#0EA5E9');

  const [activeModule, setActiveModule] = useState<ModuleKey>(modules[0] || 'projects');
  const [search, setSearch] = useState('');

  const ActiveIcon = MODULE_ICONS[activeModule];

  return (
    <div className="flex h-full flex-col bg-[#0a0a18]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-lg"
            style={{ backgroundColor: primaryColor }}
          >
            <UserCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{companyName}</h2>
            <p className="text-xs text-gray-400">Portal de cliente</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 md:flex">
            <Search className="h-4 w-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="border-none bg-transparent text-sm text-white outline-none placeholder-gray-600"
            />
          </div>
          <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-800 hover:text-white">
            <Bell className="h-5 w-5" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-xs font-bold text-white">
            CL
          </div>
          <AppBackButton />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-gray-800 bg-gray-900/40 md:flex">
          <nav className="flex-1 p-3">
            <div className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Módulos</div>
            <div className="space-y-1">
              {modules.map((module) => {
                const Icon = MODULE_ICONS[module];
                const active = activeModule === module;
                return (
                  <button
                    key={module}
                    onClick={() => setActiveModule(module)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      active ? 'bg-sky-500/10 text-sky-400' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {MODULE_LABELS[module]}
                  </button>
                );
              })}
            </div>
          </nav>
        </aside>

        {/* Main area */}
        <main className="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white">{welcomeMessage}</h3>
            <p className="text-sm text-gray-500">{MODULE_LABELS[activeModule]}</p>
          </div>

          {activeModule === 'projects' && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {DUMMY_PROJECTS.map((project) => (
                <div key={project.id} className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500">{project.id}</span>
                    <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-400">
                      {project.status}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white">{project.name}</h4>
                  <p className="mt-1 text-xs text-gray-500">Entrega: {project.dueDate}</p>
                  <div className="mt-3 h-2 w-full rounded-full bg-gray-800">
                    <div className="h-2 rounded-full bg-sky-500" style={{ width: `${project.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeModule === 'invoices' && (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <div className="space-y-3">
                {DUMMY_INVOICES.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 p-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{invoice.concept}</p>
                      <p className="text-xs text-gray-500">{invoice.id} • {invoice.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">{formatCurrency(invoice.amount)}</p>
                      <p className={`text-xs ${invoice.status === 'Pagada' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {invoice.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeModule === 'tickets' && (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
              <div className="space-y-3">
                {DUMMY_TICKETS.map((ticket) => (
                  <div key={ticket.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950 p-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{ticket.subject}</p>
                      <p className="text-xs text-gray-500">{ticket.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{ticket.priority}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${ticket.status === 'Resuelto' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
                        {ticket.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeModule === 'documents' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {DUMMY_DOCUMENTS.map((doc) => (
                <div key={doc.id} className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10 text-sky-400">
                    <FileText className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">{doc.name}</h4>
                  <p className="mt-1 text-xs text-gray-500">{doc.size} • {doc.date}</p>
                </div>
              ))}
            </div>
          )}

          {activeModule === 'profile' && (
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-xl font-bold text-white">
                  CL
                </div>
                <div>
                  <h4 className="text-base font-semibold text-white">Cliente Demo</h4>
                  <p className="text-sm text-gray-500">cliente@{companyName.toLowerCase().replace(/\s+/g, '')}.com</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
                  <p className="text-xs text-gray-500">Plan contratado</p>
                  <p className="text-sm font-semibold text-white">Enterprise</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
                  <p className="text-xs text-gray-500">Desde</p>
                  <p className="text-sm font-semibold text-white">Enero 2026</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
