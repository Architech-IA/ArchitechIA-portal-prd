import type { AppInstance } from '@/lib/app-types';

interface AppRuntimePlaceholderProps {
  app: AppInstance;
}

export default function AppRuntimePlaceholder({ app }: AppRuntimePlaceholderProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-12 text-center">
      <div className="mb-4 text-5xl">🚀</div>
      <h2 className="mb-2 text-2xl font-bold text-white">{app.name}</h2>
      <p className="mb-6 max-w-md text-gray-400">
        Esta es una mini-app de tipo <strong className="text-orange-400">{app.appType.name}</strong>. Aquí se
        renderizará la interfaz de ejecución específica una vez que el equipo desarrolle el runtime.
      </p>
      <div className="rounded-lg border border-gray-800 bg-gray-950 p-6 text-left">
        <p className="mb-2 text-sm text-gray-500">Configuración actual:</p>
        <pre className="max-h-64 max-w-xl overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-300">
          {JSON.stringify(app.config, null, 2)}
        </pre>
      </div>
    </div>
  );
}
