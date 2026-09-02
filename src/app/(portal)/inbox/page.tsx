'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Search,
  Inbox,
  MailOpen,
  Star,
  Paperclip,
  Filter,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  MOCK_INBOX_MESSAGES,
  type InboxMessage,
  type InboxFilters,
  applyInboxFilters,
  formatInboxDate,
  getInboxCounts,
} from '@/lib/inbox';

const PROVIDER_LABELS: Record<string, string> = {
  MICROSOFT: 'Microsoft 365',
  GOOGLE: 'Google Workspace',
};

const PROVIDER_STYLES: Record<string, string> = {
  MICROSOFT: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  GOOGLE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  padding: '8px 12px',
  color: '#e2e8f0',
  fontSize: '13px',
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  paddingRight: '28px',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
};

export default function InboxPage() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [filters, setFilters] = useState<InboxFilters>({
    query: '',
    provider: 'ALL',
    status: 'ALL',
    priority: 'ALL',
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    // MVP: cargar datos de demostración. Reemplazar por fetch('/api/inbox')
    // cuando el backend de sincronización esté disponible.
    setMessages(MOCK_INBOX_MESSAGES);
  }, []);

  const filtered = useMemo(() => applyInboxFilters(messages, filters), [messages, filters]);
  const counts = useMemo(() => getInboxCounts(messages), [messages]);
  const selected = useMemo(
    () => filtered.find((m) => m.id === selectedId) || filtered[0] || null,
    [filtered, selectedId]
  );

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setMobileDetail(true);
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isRead: true } : m))
    );
  };

  const toggleImportant = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isImportant: !m.isImportant } : m))
    );
  };

  const markUnread = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isRead: false } : m))
    );
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)] text-gray-400 text-sm">
        Cargando bandeja unificada…
      </div>
    );
  }

  const microsoftConnected = (session?.user as { microsoftConnected?: boolean })?.microsoftConnected ?? false;
  const googleConnected = (session?.user as { googleConnected?: boolean })?.googleConnected ?? false;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
            <Inbox className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Unified Inbox</h1>
            <p className="text-xs text-gray-500">Correos de Microsoft 365 y Google Workspace en un solo lugar</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <span className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-gray-400">
            {counts.unread} no leídos
          </span>
          <span className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-gray-400">
            {counts.microsoft} M365 · {counts.google} Google
          </span>
        </div>
      </div>

      {/* Connection banner */}
      {(!microsoftConnected || !googleConnected) && (
        <div className="mx-5 mt-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-2 text-xs text-blue-300">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            {!microsoftConnected && !googleConnected
              ? 'Conecta Microsoft 365 o Google Workspace en tu perfil para sincronizar correos reales.'
              : !microsoftConnected
              ? 'Microsoft 365 aún no está conectado. Se mostrarán solo los correos de Google.'
              : 'Google Workspace aún no está conectado. Se mostrarán solo los correos de Microsoft 365.'}
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="px-5 py-3 border-b border-white/5">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por remitente, asunto o contenido…"
              value={filters.query}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              className="w-full pl-9"
              style={inputStyle}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <select
                value={filters.provider}
                onChange={(e) => setFilters((f) => ({ ...f, provider: e.target.value as InboxFilters['provider'] }))}
                className="pl-8"
                style={selectStyle}
              >
                <option value="ALL">Todos los proveedores</option>
                <option value="MICROSOFT">Microsoft 365</option>
                <option value="GOOGLE">Google Workspace</option>
              </select>
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as InboxFilters['status'] }))}
              style={selectStyle}
            >
              <option value="ALL">Todos los estados</option>
              <option value="UNREAD">No leídos</option>
              <option value="READ">Leídos</option>
            </select>
            <select
              value={filters.priority}
              onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value as InboxFilters['priority'] }))}
              style={selectStyle}
            >
              <option value="ALL">Todas las prioridades</option>
              <option value="IMPORTANT">Importantes</option>
            </select>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              placeholder="Desde"
              style={inputStyle}
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              placeholder="Hasta"
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Message list */}
        <div
          className={`flex-1 min-w-0 flex flex-col border-r border-white/5 ${
            mobileDetail ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="px-4 py-2 text-xs font-medium text-gray-500 border-b border-white/5 flex items-center justify-between">
            <span>{filtered.length} mensajes</span>
            {filters.status === 'UNREAD' && counts.unread > 0 && (
              <span className="text-orange-400">{counts.unread} pendientes</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                <MailOpen className="w-10 h-10 opacity-20" />
                <p className="text-sm">No hay mensajes que coincidan con los filtros.</p>
                <button
                  onClick={() =>
                    setFilters({ query: '', provider: 'ALL', status: 'ALL', priority: 'ALL', dateFrom: '', dateTo: '' })
                  }
                  className="text-xs text-orange-400 hover:text-orange-300"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              filtered.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleSelect(m.id)}
                  className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors hover:bg-white/[0.03] ${
                    selected?.id === m.id ? 'bg-white/[0.05]' : ''
                  } ${!m.isRead ? 'bg-white/[0.015]' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                        m.provider === 'MICROSOFT' ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {m.senderName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-sm truncate ${!m.isRead ? 'font-semibold text-white' : 'text-gray-300'}`}>
                          {m.senderName}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${
                            PROVIDER_STYLES[m.provider]
                          }`}
                        >
                          {m.provider === 'MICROSOFT' ? 'M365' : 'Google'}
                        </span>
                        {m.isImportant && (
                          <Star className="w-3 h-3 text-orange-400 fill-orange-400 flex-shrink-0" />
                        )}
                        {m.hasAttachments && (
                          <Paperclip className="w-3 h-3 text-gray-500 flex-shrink-0" />
                        )}
                        <span className="ml-auto text-xs text-gray-500 flex-shrink-0">
                          {formatInboxDate(m.receivedAt)}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${!m.isRead ? 'text-white font-medium' : 'text-gray-400'}`}>
                        {m.subject}
                      </p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{m.bodyPreview}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {m.categories.map((c) => (
                          <span
                            key={c}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/5"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Detail pane */}
        <div
          className={`flex-1 min-w-0 bg-[#080810] flex flex-col ${
            mobileDetail ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {selected ? (
            <>
              <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5">
                <button
                  onClick={() => setMobileDetail(false)}
                  className="lg:hidden p-1.5 rounded-md hover:bg-white/5"
                >
                  <ArrowLeft className="w-4 h-4 text-gray-400" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white truncate">{selected.subject}</h2>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${
                        PROVIDER_STYLES[selected.provider]
                      }`}
                    >
                      {PROVIDER_LABELS[selected.provider]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {selected.senderName} · {selected.senderEmail}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => toggleImportant(selected.id, e)}
                    title={selected.isImportant ? 'Quitar importancia' : 'Marcar como importante'}
                    className="p-1.5 rounded-md hover:bg-white/5"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        selected.isImportant ? 'text-orange-400 fill-orange-400' : 'text-gray-500'
                      }`}
                    />
                  </button>
                  <button
                    onClick={(e) => markUnread(selected.id, e)}
                    title="Marcar como no leído"
                    className="p-1.5 rounded-md hover:bg-white/5"
                  >
                    <MailOpen className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="space-y-4">
                  {selected.conversation.map((msg) => (
                    <div
                      key={msg.id}
                      className="rounded-xl border border-white/5 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gray-700/50 flex items-center justify-center text-xs font-medium text-gray-300">
                            {msg.senderName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{msg.senderName}</p>
                            <p className="text-[10px] text-gray-500">{msg.senderEmail}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500">{formatInboxDate(msg.receivedAt)}</span>
                      </div>
                      <div
                        className="prose prose-invert prose-sm max-w-none text-sm text-gray-300"
                        dangerouslySetInnerHTML={{ __html: msg.bodyHtml }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-5 py-3 border-t border-white/5">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Vista de conversación sincronizada desde {PROVIDER_LABELS[selected.provider]}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
              <MailOpen className="w-12 h-12 opacity-20" />
              <p className="text-sm">Selecciona un correo para ver la conversación.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
