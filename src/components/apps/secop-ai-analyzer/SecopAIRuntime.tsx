import { ExternalLink } from 'lucide-react';
import type { AppInstance } from '@/lib/app-types';

interface SecopAIRuntimeProps {
  app: AppInstance;
}

export default function SecopAIRuntime({ app }: SecopAIRuntimeProps) {
  const embedUrl = (app.config.embedUrl as string) || '';
  const height = (app.config.height as number) || 900;

  if (!embedUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-12 text-center">
        <h2 className="mb-2 text-xl font-bold text-white">SECOP AI Analyzer</h2>
        <p className="max-w-md text-gray-400">
          Falta configurar la URL de la app desplegada (<code className="text-indigo-400">embedUrl</code>) en{' '}
          <a href={`/apps/${app.slug}/config`} className="text-indigo-400 hover:underline">
            la configuración de esta instancia
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-950 px-4 py-2">
        <span className="text-xs text-[#7f8a9c]">
          Embebido desde <span className="text-indigo-400">{new URL(embedUrl).hostname}</span>
        </span>
        <a
          href={embedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          Abrir en pestaña nueva
          <ExternalLink size={12} />
        </a>
      </div>
      <iframe
        src={embedUrl}
        title="SECOP AI Analyzer"
        className="w-full flex-1 border-0"
        style={{ minHeight: height }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}
