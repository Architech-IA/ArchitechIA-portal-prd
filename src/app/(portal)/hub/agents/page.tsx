'use client';

import { useState, useEffect } from 'react';

interface AgentCapability {
  label: string;
  icon: string;
}

interface Agent {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  model: string;
  color: { accent: string; bg: string; border: string; glow: string; badge: string };
  capabilities: AgentCapability[];
  telegramUrl: string;
  iconPath: string;
}

const AGENTS: Agent[] = [
  {
    id: 'nexus',
    name: 'Nexus',
    subtitle: 'Agente General',
    description: 'Asistente operativo de ArchiTechIA. Respuestas rápidas, búsqueda web, consultas de contexto organizacional y soporte del día a día.',
    model: 'GPT-4o',
    color: {
      accent: '#38bdf8',
      bg: 'rgba(14,165,233,0.07)',
      border: 'rgba(14,165,233,0.18)',
      glow: '0 0 32px rgba(14,165,233,0.12)',
      badge: 'rgba(14,165,233,0.15)',
    },
    capabilities: [
      { label: 'Búsqueda web en tiempo real', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
      { label: 'Resumen de documentos', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { label: 'Consultas rápidas de negocio', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
      { label: 'Contexto organizacional ArchiTechIA', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    ],
    telegramUrl: 'https://t.me/HermesNexusBot',
    iconPath: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
  },
  {
    id: 'sage',
    name: 'Sage',
    subtitle: 'Agente Claude',
    description: 'Asistente de IA avanzado con acceso directo al portal ArchiTechIA. Crea tareas de backlog, registra reuniones, analiza código y razona sobre contextos complejos.',
    model: 'Claude Sonnet 4.6',
    color: {
      accent: '#a78bfa',
      bg: 'rgba(139,92,246,0.07)',
      border: 'rgba(139,92,246,0.18)',
      glow: '0 0 32px rgba(139,92,246,0.12)',
      badge: 'rgba(139,92,246,0.15)',
    },
    capabilities: [
      { label: 'Crear y actualizar tareas de backlog', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
      { label: 'Registrar reuniones en el portal', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { label: 'Análisis de código y arquitectura', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
      { label: 'Razonamiento sobre contextos complejos', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
    ],
    telegramUrl: 'https://t.me/HermesSageBot',
    iconPath: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  },
];

export default function AgentsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="p-8 space-y-8">
      <div>
        <p className="text-gray-400 mt-1 text-sm">
          Asistentes IA conectados al ecosistema ArchiTechIA — disponibles vía Telegram
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {AGENTS.map((agent, idx) => (
          <div
            key={agent.id}
            className="rounded-2xl p-6 flex flex-col gap-5"
            style={{
              background: agent.color.bg,
              border: `1px solid ${agent.color.border}`,
              boxShadow: mounted ? agent.color.glow : 'none',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(16px)',
              transition: `opacity 0.4s ease ${idx * 120}ms, transform 0.4s ease ${idx * 120}ms`,
            }}
          >
            {/* Header */}
            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: agent.color.badge, border: `1px solid ${agent.color.border}` }}
              >
                <svg className="w-7 h-7" fill="none" stroke={agent.color.accent} viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={agent.iconPath} />
                </svg>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-white">{agent.name}</h2>
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ background: agent.color.badge, color: agent.color.accent }}
                  >
                    {agent.subtitle}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-green-400 ml-auto">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                    Online
                  </span>
                </div>
                <p className="text-xs font-mono mt-1" style={{ color: agent.color.accent, opacity: 0.8 }}>
                  {agent.model}
                </p>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-gray-300 leading-relaxed">{agent.description}</p>

            {/* Capabilities */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Capacidades</p>
              <ul className="space-y-2">
                {agent.capabilities.map((cap) => (
                  <li key={cap.label} className="flex items-center gap-2.5">
                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: agent.color.badge }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke={agent.color.accent} viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={cap.icon} />
                      </svg>
                    </span>
                    <span className="text-sm text-gray-300">{cap.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* CTA */}
            <a
              href={agent.telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
              style={{ background: agent.color.accent, color: '#0f172a' }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
              </svg>
              Abrir {agent.name} en Telegram
            </a>
          </div>
        ))}
      </div>

      {/* Info footer */}
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <svg className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-gray-500 leading-relaxed">
          Ambos agentes operan 24/7 en el servidor VPS. Sage tiene acceso directo a la API del portal con herramientas MCP para backlog y reuniones. Nexus opera como asistente general con búsqueda web y contexto organizacional.
        </p>
      </div>
    </div>
  );
}
