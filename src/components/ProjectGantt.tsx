'use client';

interface Milestone { id: string; name: string; status: string; dueDate: string | null }
interface ProjectGanttProps {
  project: {
    name: string; startDate: string | null; endDate: string | null;
    progress: number; milestones: Milestone[];
  };
}

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export default function ProjectGantt({ project }: ProjectGanttProps) {
  const start = project.startDate ? new Date(project.startDate) : new Date();
  const end = project.endDate ? new Date(project.endDate) : new Date(start.getTime() + 30 * 86400000);
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));

  const today = new Date();
  const todayOffset = Math.max(0, Math.min(100, ((today.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100));

  const months: { label: string; start: number }[] = [];
  const current = new Date(start);
  while (current <= end) {
    months.push({ label: `${MONTHS[current.getMonth()]} ${current.getFullYear().toString().slice(2)}`, start: Math.max(0, Math.min(100, ((current.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100)) });
    current.setMonth(current.getMonth() + 1);
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">{project.name}</h3>
        <span className="text-xs text-gray-400">
          {start.toLocaleDateString('es-ES')} — {end.toLocaleDateString('es-ES')}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="w-full bg-gray-700 rounded-full h-3 relative overflow-hidden">
          <div className="bg-orange-600 h-3 rounded-full transition-all" style={{ width: `${project.progress}%` }} />
          {todayOffset > 0 && todayOffset < 100 && (
            <div className="absolute top-0 h-3 w-0.5 bg-white/50" style={{ left: `${todayOffset}%` }} />
          )}
        </div>
      </div>

      {/* Month headers */}
      <div className="relative mb-2 ml-24">
        {months.map((m, i) => (
          <span key={i} className="absolute text-[11px] text-gray-500" style={{ left: `${m.start}%` }}>
            {m.label}
          </span>
        ))}
        <div className="h-4" />
      </div>

      {/* Timeline bar */}
      <div className="flex items-center mb-4 ml-24">
        <div className="flex-1 h-8 bg-gray-800 rounded-lg relative">
          <div className="absolute inset-y-0 bg-orange-600/20 rounded-lg" style={{ left: '0%', width: `${project.progress}%` }} />
          {todayOffset > 0 && todayOffset < 100 && (
            <div className="absolute top-0 bottom-0 w-0.5 bg-white z-10" style={{ left: `${todayOffset}%` }}>
              <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[11px] text-white bg-gray-700 px-1 rounded">Hoy</span>
            </div>
          )}
        </div>
      </div>

      {/* Milestones */}
      {project.milestones.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 mb-2">Hitos</p>
          {project.milestones.map(m => {
            const pos = m.dueDate ? Math.max(0, Math.min(95, ((new Date(m.dueDate).getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100)) : 0;
            return (
              <div key={m.id} className="flex items-center gap-2 ml-24 relative">
                <div className={`absolute w-2.5 h-2.5 rounded-full ${
                  m.status === 'COMPLETED' ? 'bg-green-500' : m.status === 'IN_PROGRESS' ? 'bg-orange-500' : 'bg-gray-600'
                }`} style={{ left: `${pos}%` }} />
                <span className="text-xs text-gray-400 w-full">{m.name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
