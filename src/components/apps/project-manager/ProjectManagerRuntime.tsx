'use client';

import { Kanban, Plus, Calendar, Clock, UserCircle } from 'lucide-react';
import type { AppInstance } from '@/lib/app-types';
import AppBackButton from '@/components/apps/shared/AppBackButton';

interface Task {
  id: string;
  title: string;
  assignee: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
}

const DEFAULT_STAGES = ['Backlog', 'Por hacer', 'En progreso', 'Revisión', 'Hecho'];
const DEFAULT_ROLES = ['Product Owner', 'Tech Lead', 'Developer', 'QA', 'Designer'];

const DUMMY_TASKS: Record<string, Task[]> = {
  Backlog: [
    { id: 'TK-201', title: 'Investigar proveedor de IA', assignee: 'PO', dueDate: '2025-07-01', priority: 'low' },
  ],
  'Por hacer': [
    { id: 'TK-195', title: 'Definir arquitectura de datos', assignee: 'TL', dueDate: '2025-06-20', priority: 'high' },
  ],
  'En progreso': [
    { id: 'TK-188', title: 'Diseñar prototipo de UI', assignee: 'Designer', dueDate: '2025-06-18', priority: 'medium' },
    { id: 'TK-182', title: 'Configurar CI/CD', assignee: 'Dev', dueDate: '2025-06-19', priority: 'high' },
  ],
  Revisión: [
    { id: 'TK-175', title: 'Revisar integración OAuth', assignee: 'QA', dueDate: '2025-06-16', priority: 'medium' },
  ],
  Hecho: [
    { id: 'TK-160', title: 'Kickoff del proyecto', assignee: 'PO', dueDate: '2025-06-10', priority: 'low' },
  ],
};

const PRIORITY_STYLES: Record<Task['priority'], string> = {
  low: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  high: 'bg-red-500/10 text-red-400 border-red-500/30',
};

export default function ProjectManagerRuntime({ app }: { app: AppInstance }) {
  const config = app.config;
  const companyName = String(config.companyName || app.name);
  const stages = Array.isArray(config.stages) ? (config.stages as string[]) : DEFAULT_STAGES;
  const teamRoles = Array.isArray(config.teamRoles) ? (config.teamRoles as string[]) : DEFAULT_ROLES;
  const showTimeline = config.showTimeline !== false;

  return (
    <div className="flex h-full flex-col bg-[#0a0a18]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-900/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg">
            <Kanban className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{companyName}</h2>
            <p className="text-xs text-gray-400">Gestión de proyectos</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-xs text-gray-500 md:flex">
            <UserCircle className="h-3.5 w-3.5" />
            {teamRoles.join(', ')}
          </div>
          <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            <Plus className="h-4 w-4" />
            Tarea
          </button>
          <AppBackButton />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {/* Kanban board */}
        <div className="mb-8 flex gap-4 overflow-x-auto pb-2">
          {stages.map((stage) => {
            const tasks = DUMMY_TASKS[stage] ?? [];
            return (
              <div key={stage} className="w-72 flex-shrink-0 rounded-xl border border-gray-800 bg-gray-900/60 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{stage}</h3>
                  <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                    {tasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-lg border border-gray-800 bg-gray-950 p-3 transition-colors hover:border-gray-700"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-white">{task.title}</p>
                        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${PRIORITY_STYLES[task.priority]}`}>
                          {task.priority}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <UserCircle className="h-3 w-3" />
                          {task.assignee}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {task.dueDate}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline placeholder */}
        {showTimeline && (
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-400" />
              <h3 className="text-sm font-semibold text-white">Timeline del proyecto</h3>
            </div>
            <div className="relative">
              <div className="absolute left-0 right-0 top-3 h-0.5 bg-gray-800" />
              <div className="relative flex justify-between">
                {[
                  { label: 'Inicio', date: 'Jun 1' },
                  { label: 'Planificación', date: 'Jun 15' },
                  { label: 'Desarrollo', date: 'Jul 20' },
                  { label: 'Pruebas', date: 'Ago 10' },
                  { label: 'Lanzamiento', date: 'Ago 25' },
                ].map((milestone, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 border-indigo-500 bg-gray-900">
                      <div className="h-2 w-2 rounded-full bg-indigo-500" />
                    </div>
                    <p className="mt-2 text-xs font-medium text-white">{milestone.label}</p>
                    <p className="text-[10px] text-gray-500">{milestone.date}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
