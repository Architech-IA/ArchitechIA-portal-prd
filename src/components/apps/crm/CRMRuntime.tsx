'use client';

import { useMemo, useState } from 'react';
import {
  LayoutDashboard, Users, Briefcase, CheckSquare, BarChart3,
  Search, Bell, Settings, MoreHorizontal, Phone, Mail, Calendar,
  ArrowUpRight, ArrowDownRight, Plus,
} from 'lucide-react';
import type { AppInstance } from '@/lib/app-types';
import AppBackButton from '@/components/apps/shared/AppBackButton';

interface Contact {
  id: string;
  name: string;
  role: string;
  company: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  lastActivity: string;
}

interface Deal {
  id: string;
  title: string;
  company: string;
  contact: string;
  value: number;
  stage: string;
  probability: number;
  expectedClose: string;
  owner: string;
}

interface Task {
  id: string;
  title: string;
  deal: string;
  dueDate: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

interface Activity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note';
  description: string;
  date: string;
  user: string;
}

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  contacts: Users,
  deals: Briefcase,
  tasks: CheckSquare,
  reports: BarChart3,
};

const MODULE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  contacts: 'Contactos',
  deals: 'Pipeline',
  tasks: 'Tareas',
  reports: 'Reportes',
};

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  low: 'bg-gray-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
};

const ACTIVITY_ICONS: Record<Activity['type'], React.ComponentType<{ className?: string }>> = {
  call: Phone,
  email: Mail,
  meeting: Calendar,
  note: CheckSquare,
};

function createDummyData() {
  const contacts: Contact[] = [
    { id: 'c1', name: 'Roberto Sánchez', role: 'CEO', company: 'TechCorp', email: 'roberto@techcorp.com', phone: '+57 312 345 6789', status: 'active', lastActivity: '2025-06-10' },
    { id: 'c2', name: 'Laura Fernández', role: 'CTO', company: 'InnovateLab', email: 'laura@innovatelab.com', phone: '+57 310 456 7890', status: 'active', lastActivity: '2025-06-12' },
    { id: 'c3', name: 'Miguel Torres', role: 'Director de Ops', company: 'DataFlow', email: 'miguel@dataflow.com', phone: '+57 315 567 8901', status: 'active', lastActivity: '2025-06-08' },
    { id: 'c4', name: 'Patricia Ruiz', role: 'Gerente Comercial', company: 'CloudSync', email: 'patricia@cloudsync.com', phone: '+57 318 678 9012', status: 'inactive', lastActivity: '2025-05-28' },
    { id: 'c5', name: 'Andrés Gómez', role: 'Founder', company: 'StartUpX', email: 'andres@startupx.com', phone: '+57 320 789 0123', status: 'active', lastActivity: '2025-06-14' },
    { id: 'c6', name: 'Carolina Mendoza', role: 'COO', company: 'Ortega & Asoc.', email: 'carolina@ortega.com', phone: '+57 311 890 1234', status: 'active', lastActivity: '2025-06-13' },
  ];

  const deals: Deal[] = [
    { id: 'd1', title: 'Automatización de reporting', company: 'DataFlow', contact: 'Miguel Torres', value: 35000, stage: 'Negociación', probability: 75, expectedClose: '2025-07-15', owner: 'Santiago Ortega' },
    { id: 'd2', title: 'Chatbot de atención al cliente', company: 'InnovateLab', contact: 'Laura Fernández', value: 25000, stage: 'Propuesta', probability: 50, expectedClose: '2025-07-22', owner: 'Daniel Martínez' },
    { id: 'd3', title: 'Workflow automation', company: 'TechCorp', contact: 'Roberto Sánchez', value: 15000, stage: 'Contactado', probability: 30, expectedClose: '2025-08-05', owner: 'Freddy Orozco' },
    { id: 'd4', title: 'Agente de seguridad IA', company: 'CloudSync', contact: 'Patricia Ruiz', value: 42000, stage: 'Nuevo', probability: 10, expectedClose: '2025-08-30', owner: 'Santiago Ortega' },
    { id: 'd5', title: 'Migración de datos a IA', company: 'StartUpX', contact: 'Andrés Gómez', value: 18000, stage: 'Propuesta', probability: 45, expectedClose: '2025-07-30', owner: 'Daniel Martínez' },
    { id: 'd6', title: 'Sistema de citas inteligente', company: 'Ortega & Asoc.', contact: 'Carolina Mendoza', value: 12000, stage: 'Cerrado', probability: 100, expectedClose: '2025-06-01', owner: 'Freddy Orozco' },
    { id: 'd7', title: 'Dashboard predictivo', company: 'DataFlow', contact: 'Miguel Torres', value: 28000, stage: 'Negociación', probability: 80, expectedClose: '2025-07-10', owner: 'Santiago Ortega' },
  ];

  const tasks: Task[] = [
    { id: 't1', title: 'Enviar propuesta a InnovateLab', deal: 'Chatbot de atención al cliente', dueDate: '2025-06-16', completed: false, priority: 'high' },
    { id: 't2', title: 'Llamada de seguimiento con TechCorp', deal: 'Workflow automation', dueDate: '2025-06-17', completed: false, priority: 'medium' },
    { id: 't3', title: 'Preparar demo para DataFlow', deal: 'Automatización de reporting', dueDate: '2025-06-18', completed: true, priority: 'high' },
    { id: 't4', title: 'Revisar contrato de Ortega & Asoc.', deal: 'Sistema de citas inteligente', dueDate: '2025-06-15', completed: true, priority: 'low' },
    { id: 't5', title: 'Investigar integración con CloudSync', deal: 'Agente de seguridad IA', dueDate: '2025-06-20', completed: false, priority: 'medium' },
  ];

  const activities: Activity[] = [
    { id: 'a1', type: 'call', description: 'Llamada de discovery con TechCorp', date: '2025-06-14', user: 'Freddy Orozco' },
    { id: 'a2', type: 'email', description: 'Propuesta enviada a InnovateLab', date: '2025-06-13', user: 'Daniel Martínez' },
    { id: 'a3', type: 'meeting', description: 'Demo con DataFlow', date: '2025-06-12', user: 'Santiago Ortega' },
    { id: 'a4', type: 'note', description: 'CloudSync interesado en piloto', date: '2025-06-10', user: 'Santiago Ortega' },
    { id: 'a5', type: 'call', description: 'Seguimiento con Ortega & Asoc.', date: '2025-06-09', user: 'Freddy Orozco' },
  ];

  return { contacts, deals, tasks, activities };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

export default function CRMRuntime({ app }: { app: AppInstance }) {
  const config = app.config;
  const companyName = String(config.companyName || app.name);
  const theme = String(config.theme || 'dark');
  const modules = Array.isArray(config.modules) ? (config.modules as string[]) : ['contacts', 'deals'];
  const pipelineStages = Array.isArray(config.pipelineStages)
    ? (config.pipelineStages as string[])
    : ['Nuevo', 'Contactado', 'Propuesta', 'Negociación', 'Cerrado'];

  const [activeModule, setActiveModule] = useState(() => modules[0] || 'deals');
  const [search, setSearch] = useState('');
  const data = useMemo(() => createDummyData(), []);

  const isDark = theme === 'dark';
  const bgMain = isDark ? 'bg-[#0a0a18]' : 'bg-gray-50';
  const bgCard = isDark ? 'bg-gray-900' : 'bg-white';
  const textMain = isDark ? 'text-white' : 'text-gray-900';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-800' : 'border-gray-200';
  const sidebarBg = isDark ? 'bg-[#08081a]' : 'bg-white';

  return (
    <div className={`flex h-full flex-col ${bgMain} ${textMain}`}>
      <CRMHeader companyName={companyName} isDark={isDark} search={search} onSearch={setSearch} />
      <div className="flex flex-1 overflow-hidden">
        <CRMSidebar
          modules={modules}
          activeModule={activeModule}
          onModuleChange={setActiveModule}
          isDark={isDark}
          sidebarBg={sidebarBg}
          borderColor={borderColor}
          textMuted={textMuted}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {activeModule === 'dashboard' && <CRMDashboard data={data} pipelineStages={pipelineStages} bgCard={bgCard} borderColor={borderColor} textMuted={textMuted} isDark={isDark} />}
          {activeModule === 'contacts' && <CRMContacts contacts={data.contacts} search={search} bgCard={bgCard} borderColor={borderColor} textMuted={textMuted} />}
          {activeModule === 'deals' && <CRMPipeline deals={data.deals} stages={pipelineStages} bgCard={bgCard} borderColor={borderColor} textMuted={textMuted} isDark={isDark} />}
          {activeModule === 'tasks' && <CRMTasks tasks={data.tasks} bgCard={bgCard} borderColor={borderColor} textMuted={textMuted} />}
          {activeModule === 'reports' && <CRMReports data={data} bgCard={bgCard} borderColor={borderColor} textMuted={textMuted} />}
        </main>
      </div>
    </div>
  );
}

function CRMHeader({
  companyName,
  isDark,
  search,
  onSearch,
}: {
  companyName: string;
  isDark: boolean;
  search: string;
  onSearch: (value: string) => void;
}) {
  const bg = isDark ? 'bg-[#08081a]/90' : 'bg-white/90';
  const border = isDark ? 'border-gray-800' : 'border-gray-200';

  return (
    <header className={`flex items-center justify-between border-b ${border} ${bg} px-4 py-3 backdrop-blur md:px-6`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
          <Briefcase className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold">{companyName}</h1>
          <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>CRM por ArchiTechIA</p>
        </div>
      </div>
      <div className="hidden items-center gap-3 md:flex">
        <div className={`flex items-center gap-2 rounded-lg border ${border} px-3 py-2 ${isDark ? 'bg-gray-900' : 'bg-gray-100'}`}>
          <Search className="h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar..."
            className={`border-none bg-transparent text-sm outline-none ${isDark ? 'text-white placeholder-gray-600' : 'text-gray-900 placeholder-gray-500'}`}
          />
        </div>
        <button className={`rounded-lg p-2 ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
          <Bell className="h-5 w-5 text-gray-500" />
        </button>
        <button className={`rounded-lg p-2 ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}>
          <Settings className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-xs font-bold text-white">
          AD
        </div>
        <AppBackButton />
      </div>
    </header>
  );
}

function CRMSidebar({
  modules,
  activeModule,
  onModuleChange,
  isDark,
  sidebarBg,
  borderColor,
  textMuted,
}: {
  modules: string[];
  activeModule: string;
  onModuleChange: (module: string) => void;
  isDark: boolean;
  sidebarBg: string;
  borderColor: string;
  textMuted: string;
}) {
  return (
    <aside className={`hidden w-56 flex-shrink-0 flex-col border-r ${borderColor} ${sidebarBg} md:flex`}>
      <nav className="flex-1 p-3">
        <div className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Módulos</div>
        <div className="space-y-1">
          {modules.map((module) => {
            const Icon = MODULE_ICONS[module] ?? LayoutDashboard;
            const active = activeModule === module;
            return (
              <button
                key={module}
                onClick={() => onModuleChange(module)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? 'bg-orange-500/10 text-orange-400'
                    : `${textMuted} hover:bg-gray-800/50 hover:text-white`
                }`}
              >
                <Icon className="h-4 w-4" />
                {MODULE_LABELS[module] ?? module}
              </button>
            );
          })}
        </div>
      </nav>
      <div className={`border-t ${borderColor} p-4`}>
        <div className={`rounded-lg ${isDark ? 'bg-gray-900' : 'bg-gray-100'} p-3`}>
          <p className={`text-xs ${textMuted}`}>Plan activo</p>
          <p className="text-sm font-semibold">CRM Pro</p>
        </div>
      </div>
    </aside>
  );
}

function CRMDashboard({
  data,
  pipelineStages,
  bgCard,
  borderColor,
  textMuted,
  isDark,
}: {
  data: ReturnType<typeof createDummyData>;
  pipelineStages: string[];
  bgCard: string;
  borderColor: string;
  textMuted: string;
  isDark: boolean;
}) {
  const totalValue = data.deals.reduce((sum, d) => sum + d.value, 0);
  const weightedValue = data.deals.reduce((sum, d) => sum + d.value * (d.probability / 100), 0);
  const wonValue = data.deals.filter((d) => d.stage === 'Cerrado').reduce((sum, d) => sum + d.value, 0);
  const activeDeals = data.deals.filter((d) => d.stage !== 'Cerrado').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Valor del pipeline" value={formatCurrency(totalValue)} trend="+12%" positive bgCard={bgCard} borderColor={borderColor} textMuted={textMuted} />
        <KpiCard label="Valor ponderado" value={formatCurrency(weightedValue)} trend="+8%" positive bgCard={bgCard} borderColor={borderColor} textMuted={textMuted} />
        <KpiCard label="Ganado" value={formatCurrency(wonValue)} trend="+24%" positive bgCard={bgCard} borderColor={borderColor} textMuted={textMuted} />
        <KpiCard label="Deals activos" value={String(activeDeals)} trend="-2" positive={false} bgCard={bgCard} borderColor={borderColor} textMuted={textMuted} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className={`lg:col-span-2 rounded-xl border ${borderColor} ${bgCard} p-5`}>
          <h3 className="mb-4 text-base font-semibold">Pipeline resumido</h3>
          <CRMPipeline deals={data.deals} stages={pipelineStages} bgCard={bgCard} borderColor={borderColor} textMuted={textMuted} isDark={isDark} />
        </div>
        <div className={`rounded-xl border ${borderColor} ${bgCard} p-5`}>
          <h3 className="mb-4 text-base font-semibold">Actividad reciente</h3>
          <div className="space-y-3">
            {data.activities.slice(0, 5).map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.type];
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm">{activity.description}</p>
                    <p className={`text-xs ${textMuted}`}>{activity.user} • {activity.date}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, trend, positive, bgCard, borderColor, textMuted,
}: {
  label: string;
  value: string;
  trend: string;
  positive: boolean;
  bgCard: string;
  borderColor: string;
  textMuted: string;
}) {
  const TrendIcon = positive ? ArrowUpRight : ArrowDownRight;
  const trendColor = positive ? 'text-green-400' : 'text-red-400';

  return (
    <div className={`rounded-xl border ${borderColor} ${bgCard} p-5`}>
      <p className={`text-sm ${textMuted}`}>{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      <div className={`mt-2 flex items-center gap-1 text-xs ${trendColor}`}>
        <TrendIcon className="h-3.5 w-3.5" />
        {trend}
      </div>
    </div>
  );
}

function CRMContacts({
  contacts,
  search,
  bgCard,
  borderColor,
  textMuted,
}: {
  contacts: Contact[];
  search: string;
  bgCard: string;
  borderColor: string;
  textMuted: string;
}) {
  const filtered = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className={`rounded-xl border ${borderColor} ${bgCard} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-inherit p-4">
        <h3 className="text-base font-semibold">Contactos</h3>
        <button className="flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700">
          <Plus className="h-3.5 w-3.5" />
          Nuevo
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className={`border-b ${borderColor}`}>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((contact) => (
              <tr key={contact.id} className={`border-b ${borderColor} last:border-0 hover:bg-black/5`}>
                <td className="px-4 py-3">
                  <div className="font-medium">{contact.name}</div>
                  <div className={`text-xs ${textMuted}`}>{contact.role}</div>
                </td>
                <td className="px-4 py-3">{contact.company}</td>
                <td className="px-4 py-3">{contact.email}</td>
                <td className="px-4 py-3">{contact.phone}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${contact.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                    {contact.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CRMPipeline({
  deals,
  stages,
  bgCard,
  borderColor,
  textMuted,
  isDark,
}: {
  deals: Deal[];
  stages: string[];
  bgCard: string;
  borderColor: string;
  textMuted: string;
  isDark: boolean;
}) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {stages.map((stage) => {
        const stageDeals = deals.filter((d) => d.stage === stage);
        const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0);
        return (
          <div key={stage} className={`w-72 flex-shrink-0 rounded-xl border ${borderColor} ${bgCard} p-3`}>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold">{stage}</h4>
              <span className={`rounded-full px-2 py-0.5 text-xs ${isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                {stageDeals.length}
              </span>
            </div>
            <p className={`mb-3 text-xs ${textMuted}`}>{formatCurrency(stageValue)}</p>
            <div className="space-y-2">
              {stageDeals.map((deal) => (
                <div key={deal.id} className={`rounded-lg border ${borderColor} p-3 hover:border-orange-500/30 transition-colors`}>
                  <div className="mb-1 flex items-start justify-between">
                    <p className="text-sm font-medium">{deal.title}</p>
                    <button className="text-gray-500 hover:text-white">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className={`text-xs ${textMuted}`}>{deal.company}</p>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-orange-400">{formatCurrency(deal.value)}</span>
                    <span className={textMuted}>{deal.probability}%</span>
                  </div>
                  <div className="mt-2 h-1 w-full rounded-full bg-gray-800">
                    <div className="h-1 rounded-full bg-gradient-to-r from-orange-500 to-orange-600" style={{ width: `${deal.probability}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CRMTasks({
  tasks,
  bgCard,
  borderColor,
  textMuted,
}: {
  tasks: Task[];
  bgCard: string;
  borderColor: string;
  textMuted: string;
}) {
  return (
    <div className={`rounded-xl border ${borderColor} ${bgCard} p-5`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold">Tareas</h3>
        <button className="flex items-center gap-1 rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700">
          <Plus className="h-3.5 w-3.5" />
          Nueva tarea
        </button>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.id} className={`flex items-center gap-3 rounded-lg border ${borderColor} p-3`}>
            <div className={`h-2 w-2 rounded-full ${PRIORITY_COLORS[task.priority]}`} />
            <div className="flex-1">
              <p className={`text-sm ${task.completed ? 'line-through opacity-60' : ''}`}>{task.title}</p>
              <p className={`text-xs ${textMuted}`}>{task.deal} • Vence {task.dueDate}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CRMReports({
  data,
  bgCard,
  borderColor,
  textMuted,
}: {
  data: ReturnType<typeof createDummyData>;
  bgCard: string;
  borderColor: string;
  textMuted: string;
}) {
  const totalValue = data.deals.reduce((sum, d) => sum + d.value, 0);
  const avgDeal = totalValue / data.deals.length;
  const won = data.deals.filter((d) => d.stage === 'Cerrado').length;
  const conversionRate = Math.round((won / data.deals.length) * 100);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={`rounded-xl border ${borderColor} ${bgCard} p-5`}>
          <p className={`text-sm ${textMuted}`}>Deal promedio</p>
          <p className="mt-1 text-2xl font-bold">{formatCurrency(avgDeal)}</p>
        </div>
        <div className={`rounded-xl border ${borderColor} ${bgCard} p-5`}>
          <p className={`text-sm ${textMuted}`}>Tasa de conversión</p>
          <p className="mt-1 text-2xl font-bold">{conversionRate}%</p>
        </div>
        <div className={`rounded-xl border ${borderColor} ${bgCard} p-5`}>
          <p className={`text-sm ${textMuted}`}>Contactos activos</p>
          <p className="mt-1 text-2xl font-bold">{data.contacts.filter((c) => c.status === 'active').length}</p>
        </div>
      </div>
      <div className={`rounded-xl border ${borderColor} ${bgCard} p-5`}>
        <h3 className="mb-4 text-base font-semibold">Deals por etapa</h3>
        <div className="space-y-3">
          {['Nuevo', 'Contactado', 'Propuesta', 'Negociación', 'Cerrado'].map((stage) => {
            const count = data.deals.filter((d) => d.stage === stage).length;
            const pct = data.deals.length > 0 ? (count / data.deals.length) * 100 : 0;
            return (
              <div key={stage}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{stage}</span>
                  <span className={textMuted}>{count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-800">
                  <div className="h-2 rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
