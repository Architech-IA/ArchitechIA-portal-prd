'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type AgentId = 'nexus' | 'sage';
type Tab = 'chat' | 'history' | 'config';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
  tools?: string[];
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
  shortcuts: string[];
  mcpTools: string[];
}

/* ─── OpenCode Go models ─────────────────────────────────────────── */
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

/* ─── Static agent data ──────────────────────────────────────────── */
const AGENTS: AgentConfig[] = [
  {
    id: 'nexus',
    name: 'Nexus',
    subtitle: 'Agente General',
    description: 'Asistente operativo de ArchiTechIA. Respuestas rápidas, búsqueda web y soporte del día a día.',
    model: 'Kimi K2.5',
    telegramUrl: 'https://t.me/HermesNexusBot',
    iconPath: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
    color: { accent: '#38bdf8', bg: 'rgba(14,165,233,0.07)', border: 'rgba(14,165,233,0.18)', glow: '0 0 32px rgba(14,165,233,0.10)', badge: 'rgba(14,165,233,0.15)' },
    shortcuts: ['¿Qué hay en el backlog?', 'Dame un resumen del día', '¿Cuáles son los leads activos?', 'Resumí las últimas noticias de IA'],
    mcpTools: ['get_backlog', 'get_backlog_sprints', 'create_backlog_item', 'update_backlog_item', 'get_meetings', 'create_meeting'],
  },
  {
    id: 'sage',
    name: 'Sage',
    subtitle: 'Agente Claude',
    description: 'Asistente avanzado con acceso directo al portal. Crea tareas, registra reuniones y analiza contextos complejos.',
    model: 'Claude Sonnet 4.6',
    telegramUrl: 'https://t.me/HermesSageBot',
    iconPath: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    color: { accent: '#a78bfa', bg: 'rgba(139,92,246,0.07)', border: 'rgba(139,92,246,0.18)', glow: '0 0 32px rgba(139,92,246,0.10)', badge: 'rgba(139,92,246,0.15)' },
    shortcuts: ['¿Qué hay en el backlog?', 'Crea una tarea nueva', 'Resumí las últimas reuniones', '¿Qué soluciones están activas?'],
    mcpTools: ['get_backlog', 'get_backlog_sprints', 'create_backlog_item', 'update_backlog_item', 'get_meetings', 'create_meeting'],
  },
];

/* ─── Helpers ────────────────────────────────────────────────────── */
function StatusBadge({ status, latency }: { status: AgentStatus['status']; latency?: number }) {
  if (status === 'loading') return <span className="flex items-center gap-1 text-xs text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse inline-block" />Verificando...</span>;
  const map = { online: { dot: 'bg-green-400', text: 'text-green-400', label: 'Online' }, degraded: { dot: 'bg-yellow-400 animate-pulse', text: 'text-yellow-400', label: 'Degradado' }, offline: { dot: 'bg-red-500', text: 'text-red-400', label: 'Offline' } };
  const s = map[status] ?? map.offline;
  return <span className={`flex items-center gap-1 text-xs ${s.text}`}><span className={`w-1.5 h-1.5 rounded-full inline-block ${s.dot}`} />{s.label}{latency !== undefined ? ` · ${latency}ms` : ''}</span>;
}

function TabBtn({ active, accent, onClick, children }: { active: boolean; accent: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-all"
      style={active ? { background: 'rgba(255,255,255,0.1)', color: accent } : { color: '#64748b' }}>
      {children}
    </button>
  );
}

function ToolPill({ name, done, accent, badge }: { name: string; done: boolean; accent: string; badge: string }) {
  const short = name.replace('mcp__portal_architechia__', '').replace(/_/g, ' ');
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all"
      style={{ background: badge, border: `1px solid ${accent}33` }}>
      {done ? (
        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke={accent} viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      ) : (
        <span className="w-3 h-3 rounded-full border-2 flex-shrink-0 animate-spin" style={{ borderColor: `${accent}44`, borderTopColor: accent }} />
      )}
      <span style={{ color: accent }}>{short}</span>
    </div>
  );
}

/* ─── Chat panel ─────────────────────────────────────────────────── */
function ChatPanel({ agent, status, selectedModel, onNewSession }: {
  agent: AgentConfig;
  status: AgentStatus;
  selectedModel?: string;
  onNewSession: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeTools, setActiveTools] = useState<{ name: string; done: boolean }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, activeTools]);

  // Notify browser when response arrives while tab hidden
  const notifyResponse = useCallback((agentName: string, preview: string) => {
    if (document.visibilityState === 'visible') return;
    if (Notification.permission === 'granted') {
      new Notification(`${agentName} respondió`, { body: preview.slice(0, 80), icon: '/favicon.ico' });
    }
  }, []);

  const requestNotifPermission = useCallback(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleNewSession = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setActiveTools([]);
    onNewSession();
  }, [onNewSession]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    requestNotifPermission();
    setMessages(prev => [...prev, { role: 'user', content: msg, ts: Date.now() }]);
    setLoading(true);
    setActiveTools([]);

    let assistantContent = '';
    const toolsUsed: string[] = [];

    try {
      const res = await fetch(`/api/agents/${agent.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionId, model: selectedModel }),
      });

      // Grab session ID from header
      const newSessionId = res.headers.get('X-Hermes-Session-Id');
      if (newSessionId) setSessionId(newSessionId);

      if (!res.ok || !res.body) {
        const err = await res.text();
        setMessages(prev => [...prev, { role: 'assistant', content: err || 'Error', ts: Date.now() }]);
        return;
      }

      // Add empty assistant message to stream into
      setMessages(prev => [...prev, { role: 'assistant', content: '', ts: Date.now() }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            const raw = line.slice(5).trim();
            if (raw === '[DONE]') break;

            // Tool progress event
            if (currentEvent === 'hermes.tool.progress') {
              try {
                const tool = JSON.parse(raw);
                if (tool.status === 'running') {
                  setActiveTools(prev => [...prev.filter(t => t.name !== tool.tool), { name: tool.tool, done: false }]);
                } else if (tool.status === 'completed') {
                  setActiveTools(prev => prev.map(t => t.name === tool.tool ? { ...t, done: true } : t));
                  toolsUsed.push(tool.tool);
                }
              } catch { /* ignore */ }
              currentEvent = '';
              continue;
            }

            // Content chunk
            try {
              const chunk = JSON.parse(raw);
              const delta = chunk?.choices?.[0]?.delta?.content;
              if (delta) {
                assistantContent += delta;
                setMessages(prev => {
                  const next = [...prev];
                  next[next.length - 1] = { ...next[next.length - 1], content: assistantContent, tools: toolsUsed };
                  return next;
                });
              }
            } catch { /* ignore */ }
            currentEvent = '';
          }
        }
      }

      notifyResponse(agent.name, assistantContent);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error de conexión con el agente.', ts: Date.now() }]);
    } finally {
      setLoading(false);
      setActiveTools([]);
    }
  }, [input, loading, agent.id, agent.name, sessionId, selectedModel, requestNotifPermission, notifyResponse]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-[460px]">
      {/* Chat header: new session button */}
      {messages.length > 0 && (
        <div className="flex justify-end mb-2">
          <button onClick={handleNewSession}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-gray-500 hover:text-gray-300 transition-all"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Nueva sesión
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-600">
            <svg className="w-8 h-8 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={agent.iconPath} /></svg>
            <p className="text-xs">Escríbele algo a {agent.name}</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="flex flex-col gap-1">
            {/* Tool pills above assistant message */}
            {m.role === 'assistant' && m.tools && m.tools.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pl-1">
                {m.tools.map(t => (
                  <ToolPill key={t} name={t} done={true} accent={agent.color.accent} badge={agent.color.badge} />
                ))}
              </div>
            )}
            <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap"
                style={m.role === 'user'
                  ? { background: agent.color.badge, border: `1px solid ${agent.color.border}`, color: '#f1f5f9' }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#cbd5e1' }
                }>
                {m.content || (m.role === 'assistant' && loading && i === messages.length - 1 ? (
                  <span className="flex gap-1 py-0.5">
                    {[0,1,2].map(j => <span key={j} className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: `${j*150}ms` }} />)}
                  </span>
                ) : '')}
              </div>
            </div>
          </div>
        ))}

        {/* Active tool pills while streaming */}
        {loading && activeTools.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-gray-600 pl-1">Usando herramientas…</p>
            <div className="flex flex-wrap gap-1.5 pl-1">
              {activeTools.map(t => (
                <ToolPill key={t.name} name={t.name} done={t.done} accent={agent.color.accent} badge={agent.color.badge} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Shortcuts */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {agent.shortcuts.map(s => (
            <button key={s} onClick={() => send(s)}
              className="text-xs px-2.5 py-1 rounded-lg transition-all hover:opacity-80 active:scale-95"
              style={{ background: agent.color.badge, color: agent.color.accent, border: `1px solid ${agent.color.border}` }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 items-end">
        <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} rows={1}
          placeholder={status.status === 'offline' ? `${agent.name} está offline` : `Mensaje para ${agent.name}…`}
          disabled={status.status === 'offline' || loading}
          className="flex-1 resize-none rounded-xl px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 outline-none disabled:opacity-40"
          style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${input ? agent.color.border : 'rgba(255,255,255,0.08)'}`, minHeight: '42px', maxHeight: '120px' }}
        />
        <button onClick={() => send()} disabled={!input.trim() || loading || status.status === 'offline'}
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-30 active:scale-95"
          style={{ background: agent.color.accent }}>
          <svg className="w-4 h-4" fill="none" stroke="#0f172a" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m-7 7l7-7 7 7" /></svg>
        </button>
      </div>
      {sessionId && <p className="text-[10px] text-gray-700 mt-1 truncate">Session: {sessionId}</p>}
    </div>
  );
}

/* ─── History panel ──────────────────────────────────────────────── */
function HistoryPanel({ agent }: { agent: AgentConfig }) {
  const [sessions, setSessions] = useState<{ id: string; updated_at?: number; preview?: string; message_count?: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/agents/${agent.id}/history`).then(r => r.json()).then(d => {
      setSessions(Array.isArray(d?.sessions) ? d.sessions : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [agent.id]);

  const loadMessages = async (id: string) => {
    setSelectedId(id);
    setMsgLoading(true);
    const r = await fetch(`/api/agents/${agent.id}/history?sessionId=${id}`);
    const d = await r.json();
    setMessages(Array.isArray(d?.messages) ? d.messages : []);
    setMsgLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center h-40 text-gray-600 text-xs">Cargando sesiones...</div>;
  if (sessions.length === 0) return <div className="flex flex-col items-center justify-center h-40 gap-2 text-gray-600 text-xs">Sin sesiones previas</div>;

  return (
    <div className="flex gap-3 h-[460px]">
      <div className="w-36 flex-shrink-0 overflow-y-auto space-y-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {sessions.map(s => (
          <button key={s.id} onClick={() => loadMessages(s.id)}
            className="w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all"
            style={selectedId === s.id ? { background: agent.color.badge, border: `1px solid ${agent.color.border}`, color: '#fff' } : { background: 'rgba(255,255,255,0.03)', color: '#64748b' }}>
            <div className="font-medium truncate">{s.preview?.slice(0, 18) || s.id.slice(0, 12)}…</div>
            <div className="opacity-60 mt-0.5 flex items-center gap-1">
              {s.updated_at && new Date(s.updated_at * 1000).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
              {s.message_count && <span>· {s.message_count} msg</span>}
            </div>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto space-y-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        {!selectedId && <div className="flex items-center justify-center h-full text-gray-600 text-xs">Seleccioná una sesión</div>}
        {msgLoading && <div className="flex items-center justify-center h-full text-gray-600 text-xs">Cargando...</div>}
        {!msgLoading && messages.filter(m => m.role === 'user' || m.role === 'assistant').map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[90%] px-3 py-2 rounded-xl text-xs leading-relaxed whitespace-pre-wrap"
              style={m.role === 'user'
                ? { background: agent.color.badge, color: '#f1f5f9' }
                : { background: 'rgba(255,255,255,0.04)', color: '#94a3b8' }
              }>
              {typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Config panel ───────────────────────────────────────────────── */
function ConfigPanel({ agent, status, selectedModel, onModelChange }: {
  agent: AgentConfig; status: AgentStatus; selectedModel?: string; onModelChange?: (m: string) => void;
}) {
  return (
    <div className="space-y-5 text-sm">
      {/* Model selector */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Modelo</p>
        {agent.id === 'nexus' && onModelChange ? (
          <div className="relative">
            <select value={selectedModel || 'kimi-k2.5'} onChange={e => onModelChange(e.target.value)}
              className="w-full appearance-none px-3 py-2.5 pr-8 rounded-xl text-xs font-mono outline-none cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${agent.color.border}`, color: agent.color.accent }}>
              {OPENCODE_MODELS.map(m => (
                <option key={m.id} value={m.id} style={{ background: '#1e293b', color: '#e2e8f0' }}>{m.group} — {m.label}</option>
              ))}
            </select>
            <svg className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="font-mono text-xs" style={{ color: agent.color.accent }}>{agent.model}</span>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Estado del proceso</p>
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <StatusBadge status={status.status} latency={status.latency} />
          <span className="text-xs text-gray-600">puerto {agent.id === 'nexus' ? '8642' : '8643'}</span>
        </div>
      </div>

      {/* Notifications */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Notificaciones</p>
        <button
          onClick={() => typeof Notification !== 'undefined' && Notification.requestPermission()}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-all hover:opacity-80"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#94a3b8' }}>
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          {typeof Notification !== 'undefined' && Notification.permission === 'granted' ? '✓ Notificaciones activas' : 'Activar notificaciones push'}
        </button>
      </div>

      {/* MCP Tools */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Herramientas MCP activas</p>
        <div className="grid grid-cols-2 gap-1.5">
          {agent.mcpTools.map(tool => (
            <div key={tool} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: agent.color.badge }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: agent.color.accent }} />
              <span className="font-mono text-[11px]" style={{ color: agent.color.accent }}>{tool}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Telegram */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Plataformas</p>
        <a href={agent.telegramUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all hover:opacity-80"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <svg className="w-4 h-4 text-sky-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>
          <span className="text-xs text-gray-300">Telegram — {agent.telegramUrl.replace('https://t.me/', '@')}</span>
          <svg className="w-3.5 h-3.5 text-gray-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
        </a>
      </div>
    </div>
  );
}

/* ─── Agent card ─────────────────────────────────────────────────── */
function AgentCard({ agent, status, idx }: { agent: AgentConfig; status: AgentStatus; idx: number }) {
  const [tab, setTab] = useState<Tab>('chat');
  const [mounted, setMounted] = useState(false);
  const [selectedModel, setSelectedModel] = useState('kimi-k2.5');
  const [sessionKey, setSessionKey] = useState(0);

  useEffect(() => { setTimeout(() => setMounted(true), idx * 120); }, [idx]);

  return (
    <div className="rounded-2xl flex flex-col"
      style={{
        background: agent.color.bg,
        border: `1px solid ${agent.color.border}`,
        boxShadow: mounted ? agent.color.glow : 'none',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-5 pb-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: agent.color.badge, border: `1px solid ${agent.color.border}` }}>
          <svg className="w-6 h-6" fill="none" stroke={agent.color.accent} viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={agent.iconPath} /></svg>
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
        <TabBtn active={tab === 'chat'}    accent={agent.color.accent} onClick={() => setTab('chat')}>Chat</TabBtn>
        <TabBtn active={tab === 'history'} accent={agent.color.accent} onClick={() => setTab('history')}>Historial</TabBtn>
        <TabBtn active={tab === 'config'}  accent={agent.color.accent} onClick={() => setTab('config')}>Config</TabBtn>
      </div>

      <div className="border-t px-5 pt-4 pb-5 flex-1" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        {tab === 'chat'    && <ChatPanel key={sessionKey} agent={agent} status={status} selectedModel={agent.id === 'nexus' ? selectedModel : undefined} onNewSession={() => setSessionKey(k => k + 1)} />}
        {tab === 'history' && <HistoryPanel agent={agent} />}
        {tab === 'config'  && <ConfigPanel agent={agent} status={status} selectedModel={selectedModel} onModelChange={agent.id === 'nexus' ? setSelectedModel : undefined} />}
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────── */
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
    } catch { /* keep state */ }
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
