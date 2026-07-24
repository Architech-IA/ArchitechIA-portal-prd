'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ─── Types ─────────────────────────────────────────────────────────────── */
type AgentId = 'nexus' | 'sage';
type Tab = 'chat' | 'history' | 'config';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

interface AgentStatus {
  id: AgentId;
  status: 'online' | 'degraded' | 'offline' | 'loading';
  latency?: number;
}

interface AgentConfig {
  id: AgentId;
  name: string;
  subtitle: string;
  description: string;
  model: string;
  telegramUrl: string;
  iconPath: string;
  color: { accent: string; bg: string; border: string; glow: string; badge: string };
  capabilities: { label: string; icon: string }[];
}


/* ─── OpenCode Go models ────────────────────────────────────────── */
const OPENCODE_MODELS = [
  { id: 'kimi-k3',          label: 'Kimi K3',           group: 'Kimi' },
  { id: 'kimi-k2.7-code',   label: 'Kimi K2.7 Code',    group: 'Kimi' },
  { id: 'kimi-k2.6',        label: 'Kimi K2.6',         group: 'Kimi' },
  { id: 'kimi-k2.5',        label: 'Kimi K2.5',         group: 'Kimi' },
  { id: 'deepseek-v4-pro',  label: 'DeepSeek V4 Pro',   group: 'DeepSeek' },
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', group: 'DeepSeek' },
  { id: 'glm-5.2',          label: 'GLM 5.2',           group: 'GLM' },
  { id: 'glm-5.1',          label: 'GLM 5.1',           group: 'GLM' },
  { id: 'glm-5',            label: 'GLM 5',             group: 'GLM' },
  { id: 'minimax-m3',       label: 'MiniMax M3',        group: 'MiniMax' },
  { id: 'minimax-m2.7',     label: 'MiniMax M2.7',      group: 'MiniMax' },
  { id: 'minimax-m2.5',     label: 'MiniMax M2.5',      group: 'MiniMax' },
  { id: 'qwen3.7-max',      label: 'Qwen 3.7 Max',      group: 'Qwen' },
  { id: 'qwen3.7-plus',     label: 'Qwen 3.7 Plus',     group: 'Qwen' },
  { id: 'qwen3.6-plus',     label: 'Qwen 3.6 Plus',     group: 'Qwen' },
  { id: 'qwen3.5-plus',     label: 'Qwen 3.5 Plus',     group: 'Qwen' },
  { id: 'mimo-v2-pro',      label: 'MiMo V2 Pro',       group: 'MiMo' },
  { id: 'mimo-v2-omni',     label: 'MiMo V2 Omni',      group: 'MiMo' },
  { id: 'mimo-v2.5-pro',    label: 'MiMo V2.5 Pro',     group: 'MiMo' },
  { id: 'mimo-v2.5',        label: 'MiMo V2.5',         group: 'MiMo' },
  { id: 'grok-4.5',         label: 'Grok 4.5',          group: 'Grok' },
  { id: 'hy3',              label: 'Hunyuan 3',         group: 'Hunyuan' },
  { id: 'hy3-preview',      label: 'Hunyuan 3 Preview', group: 'Hunyuan' },
];
/* ─── Static agent data ──────────────────────────────────────────────────── */
const AGENTS: AgentConfig[] = [
  {
    id: 'nexus',
    name: 'Nexus',
    subtitle: 'Agente General',
    description: 'Asistente operativo de ArchiTechIA. Respuestas rápidas, búsqueda web, consultas de contexto organizacional y soporte del día a día.',
    model: 'Kimi K2.5',
    telegramUrl: 'https://t.me/HermesNexusBot',
    iconPath: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
    color: { accent: '#38bdf8', bg: 'rgba(14,165,233,0.07)', border: 'rgba(14,165,233,0.18)', glow: '0 0 32px rgba(14,165,233,0.10)', badge: 'rgba(14,165,233,0.15)' },
    capabilities: [
      { label: 'Búsqueda web en tiempo real', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
      { label: 'Resumen de documentos', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { label: 'Consultas rápidas de negocio', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
      { label: 'Contexto organizacional ArchiTechIA', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    ],
  },
  {
    id: 'sage',
    name: 'Sage',
    subtitle: 'Agente Claude',
    description: 'Asistente de IA avanzado con acceso directo al portal ArchiTechIA. Crea tareas de backlog, registra reuniones, analiza código y razona sobre contextos complejos.',
    model: 'Claude Sonnet 4.6',
    telegramUrl: 'https://t.me/HermesSageBot',
    iconPath: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    color: { accent: '#a78bfa', bg: 'rgba(139,92,246,0.07)', border: 'rgba(139,92,246,0.18)', glow: '0 0 32px rgba(139,92,246,0.10)', badge: 'rgba(139,92,246,0.15)' },
    capabilities: [
      { label: 'Crear y actualizar tareas de backlog', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
      { label: 'Registrar reuniones en el portal', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { label: 'Análisis de código y arquitectura', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
      { label: 'Razonamiento sobre contextos complejos', icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
    ],
  },
];

/* ─── Small sub-components ───────────────────────────────────────────────── */
function StatusBadge({ status, latency }: { status: AgentStatus['status']; latency?: number }) {
  if (status === 'loading') return (
    <span className="flex items-center gap-1 text-xs text-gray-500">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse inline-block" />
      Verificando...
    </span>
  );
  const map = {
    online:  { dot: 'bg-green-400',  text: 'text-green-400',  label: 'Online' },
    degraded:{ dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-400', label: 'Degradado' },
    offline: { dot: 'bg-red-500',    text: 'text-red-400',    label: 'Offline' },
  };
  const s = map[status] ?? map.offline;
  return (
    <span className={`flex items-center gap-1 text-xs ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full inline-block ${s.dot}`} />
      {s.label}{latency !== undefined ? ` · ${latency}ms` : ''}
    </span>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${active ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
    >
      {children}
    </button>
  );
}

/* ─── Chat panel ─────────────────────────────────────────────────────────── */
function ChatPanel({ agent, status, selectedModel }: { agent: AgentConfig; status: AgentStatus; selectedModel?: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg, ts: Date.now() }]);
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionId, model: selectedModel }),
      });
      const data = await res.json();
      if (data.sessionId) setSessionId(data.sessionId);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? data.error ?? 'Sin respuesta', ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión con el agente.', ts: Date.now() }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, agent.id, sessionId]);

  const onKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className="flex flex-col h-[420px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-600">
            <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={agent.iconPath} />
            </svg>
            <p className="text-xs">Escríbele algo a {agent.name}</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap"
              style={m.role === 'user'
                ? { background: agent.color.badge, border: `1px solid ${agent.color.border}`, color: '#f1f5f9' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#cbd5e1' }
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="flex gap-1">
                {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: `${i*150}ms` }} />)}
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={status.status === 'offline' ? `${agent.name} está offline` : `Mensaje para ${agent.name}...`}
          disabled={status.status === 'offline' || loading}
          className="flex-1 resize-none rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 outline-none transition-all disabled:opacity-40"
          style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${input ? agent.color.border : 'rgba(255,255,255,0.08)'}`, minHeight: '42px', maxHeight: '120px' }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading || status.status === 'offline'}
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30 active:scale-95"
          style={{ background: agent.color.accent }}
        >
          <svg className="w-4 h-4" fill="none" stroke="#0f172a" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" />
          </svg>
        </button>
      </div>
      {sessionId && <p className="text-[10px] text-gray-700 mt-1 truncate">Session: {sessionId}</p>}
    </div>
  );
}

/* ─── History panel ──────────────────────────────────────────────────────── */
function HistoryPanel({ agent }: { agent: AgentConfig }) {
  const [sessions, setSessions] = useState<{ id: string; created_at?: string; updated_at?: string; summary?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/agents/${agent.id}/history`).then(r => r.json()).then(d => {
      setSessions(Array.isArray(d?.sessions) ? d.sessions : Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [agent.id]);

  const loadMessages = async (id: string) => {
    setSelectedId(id);
    setMsgLoading(true);
    const r = await fetch(`/api/agents/${agent.id}/history?sessionId=${id}`);
    const d = await r.json();
    setMessages(Array.isArray(d?.messages) ? d.messages : Array.isArray(d) ? d : []);
    setMsgLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-600 text-sm">Cargando sesiones...</div>;

  if (sessions.length === 0) return (
    <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-600">
      <svg className="w-8 h-8 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <p className="text-xs">Sin sesiones previas</p>
    </div>
  );

  return (
    <div className="flex gap-3 h-[420px]">
      {/* Session list */}
      <div className="w-40 flex-shrink-0 overflow-y-auto space-y-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {sessions.map(s => (
          <button
            key={s.id}
            onClick={() => loadMessages(s.id)}
            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all ${selectedId === s.id ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            style={selectedId === s.id ? { background: agent.color.badge, border: `1px solid ${agent.color.border}` } : { background: 'rgba(255,255,255,0.03)' }}
          >
            <div className="font-medium truncate">{s.id.slice(0, 12)}…</div>
            {s.updated_at && <div className="opacity-60 mt-0.5">{new Date(s.updated_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</div>}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {!selectedId && <div className="flex items-center justify-center h-full text-gray-600 text-xs">Seleccioná una sesión</div>}
        {msgLoading && <div className="flex items-center justify-center h-full text-gray-600 text-xs">Cargando...</div>}
        {!msgLoading && messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[90%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap"
              style={m.role === 'user'
                ? { background: agent.color.badge, color: '#f1f5f9' }
                : { background: 'rgba(255,255,255,0.04)', color: '#94a3b8' }
              }
            >
              {typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Config panel ───────────────────────────────────────────────────────── */
function ConfigPanel({ agent, status, selectedModel, onModelChange }: { agent: AgentConfig; status: AgentStatus; selectedModel?: string; onModelChange?: (m: string) => void }) {
  const mcpTools = agent.id === 'sage'
    ? ['get_backlog', 'get_backlog_sprints', 'create_backlog_item', 'update_backlog_item', 'get_meetings', 'create_meeting']
    : ['get_backlog', 'get_backlog_sprints', 'create_backlog_item', 'update_backlog_item', 'get_meetings', 'create_meeting'];

  return (
    <div className="space-y-5 text-sm">
      {/* Model selector */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Modelo</p>
        {agent.id === 'nexus' && onModelChange ? (
          <div className="relative">
            <select
              value={selectedModel || 'kimi-k2.5'}
              onChange={e => onModelChange(e.target.value)}
              className="w-full appearance-none px-3 py-2.5 pr-8 rounded-xl text-xs font-mono outline-none cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${agent.color.border}`, color: agent.color.accent }}
            >
              {OPENCODE_MODELS.map(m => (
                <option key={m.id} value={m.id} style={{ background: '#1e293b', color: '#e2e8f0' }}>
                  {m.group} — {m.label}
                </option>
              ))}
            </select>
            <svg className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" /></svg>
            <span className="font-mono text-xs" style={{ color: agent.color.accent }}>{agent.model}</span>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Estado del proceso</p>
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <StatusBadge status={status.status} latency={status.latency} />
          <span className="text-xs text-gray-600">
            {agent.id === 'nexus' ? 'puerto 8642' : 'puerto 8643'}
          </span>
        </div>
      </div>

      {/* MCP Tools */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Herramientas MCP activas</p>
        <div className="grid grid-cols-2 gap-1.5">
          {mcpTools.map(tool => (
            <div key={tool} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: agent.color.badge }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: agent.color.accent }} />
              <span className="font-mono text-[11px]" style={{ color: agent.color.accent }}>{tool}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Telegram link */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Plataformas</p>
        <a
          href={agent.telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all hover:opacity-80"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <svg className="w-4 h-4 text-sky-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
          </svg>
          <span className="text-xs text-gray-300">Telegram — {agent.telegramUrl.replace('https://t.me/', '@')}</span>
          <svg className="w-3.5 h-3.5 text-gray-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </a>
      </div>
    </div>
  );
}

/* ─── Agent card ─────────────────────────────────────────────────────────── */
function AgentCard({ agent, status, idx }: { agent: AgentConfig; status: AgentStatus; idx: number }) {
  const [tab, setTab] = useState<Tab>('chat');
  const [mounted, setMounted] = useState(false);
  const [selectedModel, setSelectedModel] = useState('kimi-k2.5');
  useEffect(() => { setTimeout(() => setMounted(true), idx * 120); }, [idx]);

  return (
    <div
      className="rounded-2xl flex flex-col"
      style={{
        background: agent.color.bg,
        border: `1px solid ${agent.color.border}`,
        boxShadow: mounted ? agent.color.glow : 'none',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 p-5 pb-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: agent.color.badge, border: `1px solid ${agent.color.border}` }}>
          <svg className="w-6 h-6" fill="none" stroke={agent.color.accent} viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d={agent.iconPath} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-white">{agent.name}</h2>
            <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ background: agent.color.badge, color: agent.color.accent }}>{agent.subtitle}</span>
          </div>
          <StatusBadge status={status.status} latency={status.latency} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-5 pb-3">
        <TabBtn active={tab === 'chat'} onClick={() => setTab('chat')}>Chat</TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>Historial</TabBtn>
        <TabBtn active={tab === 'config'} onClick={() => setTab('config')}>Config</TabBtn>
      </div>

      <div className="border-t px-5 pt-4 pb-5 flex-1" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {tab === 'chat'    && <ChatPanel agent={agent} status={status} selectedModel={agent.id === 'nexus' ? selectedModel : undefined} />}
        {tab === 'history' && <HistoryPanel agent={agent} />}
        {tab === 'config'  && <ConfigPanel agent={agent} status={status} selectedModel={selectedModel} onModelChange={agent.id === 'nexus' ? setSelectedModel : undefined} />}
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */
export default function AgentsPage() {
  const [statuses, setStatuses] = useState<Record<AgentId, AgentStatus>>({
    nexus: { id: 'nexus', status: 'loading' },
    sage:  { id: 'sage',  status: 'loading' },
  });

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agents/status');
      const data: AgentStatus[] = await res.json();
      const map = {} as Record<AgentId, AgentStatus>;
      data.forEach(s => { map[s.id] = s; });
      setStatuses(prev => ({ ...prev, ...map }));
    } catch { /* keep loading state */ }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 30000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">Asistentes IA conectados al ecosistema ArchiTechIA</p>
        <button onClick={fetchStatus} className="p-1.5 text-gray-600 hover:text-gray-400 transition-colors" title="Refrescar estado">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {AGENTS.map((agent, idx) => (
          <AgentCard key={agent.id} agent={agent} status={statuses[agent.id]} idx={idx} />
        ))}
      </div>
    </div>
  );
}
