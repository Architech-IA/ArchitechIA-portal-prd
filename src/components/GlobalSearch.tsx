'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResults {
  leads:     { id: string; companyName: string; contactName: string; status: string; estimatedValue: number }[];
  proposals: { id: string; title: string; status: string; amount: number }[];
  projects:  { id: string; name: string; status: string; progress: number }[];
  clientes:  { id: string; nombre: string; industria: string; estado: string }[];
  backlog:   { id: string; title: string; status: string; type: string }[];
  meetings:  { id: string; title: string; date: string; type: string }[];
}

const STATUS_ES: Record<string, string> = {
  NEW: 'Identificación', CONTACTED: 'Contacto', QUALIFIED: 'Diagnóstico', WON: 'Resultado', LOST: 'Resultado',
  DRAFT: 'Borrador', SENT: 'Enviado', ACCEPTED: 'Aceptado', REJECTED: 'Rechazado',
  PLANNING: 'Planificación', IN_PROGRESS: 'En Progreso', COMPLETED: 'Completado',
};

export default function GlobalSearch() {
  const router   = useRouter();
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => { setOpen(false); setQuery(''); setResults(null); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
      if (e.key === 'Escape') close();
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-global-search', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-global-search', onOpen);
    };
  }, [close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults(null); return; }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(d => { setResults(d); setLoading(false); });
    }, 300);
  }, [query]);

  const navigate = (href: string) => { router.push(href); close(); };

  const total = results
    ? results.leads.length + results.proposals.length + results.projects.length + results.clientes.length
    : 0;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" onClick={close}>
      <div
        className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar leads, propuestas, proyectos, clientes..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
          />
          {loading && <div className="w-4 h-4 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin flex-shrink-0" />}
          <kbd className="hidden sm:inline-flex px-2 py-0.5 text-xs text-gray-500 border border-gray-700 rounded">Esc</kbd>
        </div>

        {/* Resultados */}
        <div className="max-h-96 overflow-y-auto">
          {query.length < 2 && (
            <p className="text-center text-gray-500 text-sm py-8">Escribe al menos 2 caracteres para buscar</p>
          )}
          {query.length >= 2 && !loading && total === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">Sin resultados para &ldquo;{query}&rdquo;</p>
          )}
          {results && total > 0 && (
            <div className="p-2">
              {results.leads.length > 0 && (
                <Section label="Leads">
                  {results.leads.map(l => (
                    <Result key={l.id} onClick={() => navigate('/leads')}
                      title={l.companyName} sub={`${l.contactName} · ${STATUS_ES[l.status] || l.status}`}
                      badge={`$${l.estimatedValue.toLocaleString()}`} color="orange" />
                  ))}
                </Section>
              )}
              {results.proposals.length > 0 && (
                <Section label="Propuestas">
                  {results.proposals.map(p => (
                    <Result key={p.id} onClick={() => navigate('/proposals')}
                      title={p.title} sub={STATUS_ES[p.status] || p.status}
                      badge={`$${p.amount.toLocaleString()}`} color="blue" />
                  ))}
                </Section>
              )}
              {results.projects.length > 0 && (
                <Section label="Proyectos">
                  {results.projects.map(p => (
                    <Result key={p.id} onClick={() => navigate('/projects')}
                      title={p.name} sub={STATUS_ES[p.status] || p.status}
                      badge={`${p.progress}%`} color="green" />
                  ))}
                </Section>
              )}
              {results.clientes.length > 0 && (
                <Section label="Clientes">
                  {results.clientes.map(c => (
                    <Result key={c.id} onClick={() => navigate('/clientes')}
                      title={c.nombre} sub={c.industria}
                      badge={c.estado} color="purple" />
                  ))}
                </Section>
              )}
              {results.backlog && results.backlog.length > 0 && (
                <Section label="Backlog">
                  {results.backlog.map(b => (
                    <Result key={b.id} onClick={() => navigate('/backlog')}
                      title={b.title} sub={b.type}
                      badge={b.status} color="blue" />
                  ))}
                </Section>
              )}
              {results.meetings && results.meetings.length > 0 && (
                <Section label="Meetings">
                  {results.meetings.map(m => (
                    <Result key={m.id} onClick={() => navigate('/meetings')}
                      title={m.title}
                      sub={new Date(m.date).toLocaleDateString('es-ES')}
                      badge={m.type} color="green" />
                  ))}
                </Section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-800 flex items-center gap-4 text-xs text-gray-600">
          <span><kbd className="px-1.5 py-0.5 border border-gray-700 rounded text-gray-500">↑↓</kbd> navegar</span>
          <span><kbd className="px-1.5 py-0.5 border border-gray-700 rounded text-gray-500">↵</kbd> abrir</span>
          <span><kbd className="px-1.5 py-0.5 border border-gray-700 rounded text-gray-500">Esc</kbd> cerrar</span>
          <span className="ml-auto">Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      {children}
    </div>
  );
}

function Result({ title, sub, badge, color, onClick }: {
  title: string; sub: string; badge: string;
  color: 'orange' | 'blue' | 'green' | 'purple';
  onClick: () => void;
}) {
  const colorMap = {
    orange: 'bg-orange-900/30 text-orange-400',
    blue:   'bg-blue-900/30 text-blue-400',
    green:  'bg-green-900/30 text-green-400',
    purple: 'bg-purple-900/30 text-purple-400',
  };
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium truncate">{title}</p>
        <p className="text-xs text-gray-500 truncate">{sub}</p>
      </div>
      <span className={`px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${colorMap[color]}`}>{badge}</span>
    </button>
  );
}
