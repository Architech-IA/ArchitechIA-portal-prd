'use client';

export default function OperationsPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">OPERATIONS</h1>
        <p className="text-gray-400 mt-1">Proyectos, backlog y operaciones del equipo técnico</p>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">En construcción</h3>
        <p className="text-gray-400 max-w-lg mx-auto">
          Esta sección estará disponible próximamente. Aquí encontrarás gestión de proyectos, backlog y sprints activos.
        </p>
      </div>
    </div>
  );
}
