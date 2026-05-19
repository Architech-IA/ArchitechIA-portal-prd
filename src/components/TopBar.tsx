'use client';

import { useState, useEffect, useRef } from 'react';
import { useTheme } from './ThemeProvider';
import { useRouter } from 'next/navigation';

interface Notif {
  id: string;
  tipo: 'lead' | 'propuesta' | 'proyecto' | 'finanza' | string;
  texto: string;
  sub: string;
  href: string;
  leida: boolean;
}

interface ApiNotif {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
}

function mapNotif(n: ApiNotif): Notif {
  return { id: n.id, tipo: n.type, texto: n.title, sub: n.message, href: n.link ?? '/', leida: n.read };
}

const TIPO_ICON: Record<string, string> = {
  lead:      '👤',
  propuesta: '📄',
  proyecto:  '📁',
  finanza:   '💰',
};

const SEARCH_INDEX = [
  { label: 'Dashboard',          url: '/',             tipo: 'Página'    },
  { label: 'Leads',              url: '/leads',        tipo: 'Página'    },
  { label: 'Lista de Leads',     url: '/leads/lista',  tipo: 'Página'    },
  { label: 'Pipeline',           url: '/leads/pipeline', tipo: 'Página'  },
  { label: 'Clientes',           url: '/leads/clientes', tipo: 'Página'  },
  { label: 'Prospector',         url: '/leads/prospector', tipo: 'Página' },
  { label: 'Mercado',            url: '/leads/mercado', tipo: 'Página'    },
  { label: 'Propuestas',         url: '/proposals',    tipo: 'Página'    },
  { label: 'Proyectos',          url: '/projects',     tipo: 'Página'    },
  { label: 'Trazabilidad',       url: '/traceability', tipo: 'Página'    },
  { label: 'HUB',                url: '/hub',          tipo: 'Página'    },
  { label: 'Equipo',             url: '/hub/team',     tipo: 'Página'    },
  { label: 'ADMIN',              url: '/hub/team',     tipo: 'Página'    },
  { label: 'BUSINESS',           url: '/hub/business', tipo: 'Página'    },
  { label: 'FINANCE',            url: '/hub/finance',  tipo: 'Página'    },
  { label: 'OPERATIONS',         url: '/hub/operations', tipo: 'Página'  },
  { label: 'LEGAL',              url: '/hub/legal',    tipo: 'Página'    },
  { label: 'Productos',          url: '/productos',    tipo: 'Página'    },
  { label: 'Cuentas',            url: '/resources/cuentas', tipo: 'Página'    },
  { label: 'Finance',            url: '/finanzas',     tipo: 'Página'    },
  { label: 'Calendar / Meetings', url: '/meetings',     tipo: 'Página'    },
  { label: 'Pipeline de Ventas', url: '/leads/pipeline', tipo: 'Página'    },
  { label: 'Agente de Seguridad AI', url: '/productos', tipo: 'Producto' },
  { label: 'Zoho Mail',          url: '/resources/cuentas', tipo: 'Cuenta'    },
  { label: 'GitHub',             url: '/resources/cuentas', tipo: 'Cuenta'    },
  { label: 'n8n',                url: '/resources/cuentas', tipo: 'Cuenta'    },
];

export default function TopBar({ onMenuClick, isMobile }: { onMenuClick?: () => void; isMobile?: boolean }) {
  const { theme, toggle } = useTheme();
  const router = useRouter();

  const [query, setQuery]           = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [notifs, setNotifs]         = useState<Notif[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [hora, setHora]             = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef  = useRef<HTMLDivElement>(null);

  // Cargar notificaciones reales
  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then((d: ApiNotif[]) => setNotifs(Array.isArray(d) ? d.map(mapNotif) : []))
      .catch(() => {});

    // SSE: notificaciones en tiempo real
    const sse = new EventSource('/api/notifications/sse');
    sse.onmessage = (e) => {
      try { setNotifs((JSON.parse(e.data) as ApiNotif[]).map(mapNotif)); } catch {}
    };
    return () => sse.close();
  }, []);

  // Reloj UTC-5 (Colombia / Lima / Bogotá)
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const utcMinus5 = new Date(now.getTime() - 5 * 60 * 60 * 1000);
      const h = String(utcMinus5.getUTCHours()).padStart(2, '0');
      const m = String(utcMinus5.getUTCMinutes()).padStart(2, '0');
      const s = String(utcMinus5.getUTCSeconds()).padStart(2, '0');
      setHora(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const unread = notifs.filter(n => !n.leida).length;

  const resultados = query.length >= 2
    ? SEARCH_INDEX.filter(s => s.label.toLowerCase().includes(query.toLowerCase()))
    : [];

  // Cerrar dropdowns al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
      if (notifRef.current  && !notifRef.current.contains(e.target as Node))  setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const marcarTodasLeidas = () => {
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
    notifs.filter(n => !n.leida).forEach(n =>
      fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id, read: true }) }).catch(() => {})
    );
  };

  const marcarLeida = (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, read: true }) }).catch(() => {});
  };

  const irA = (url: string) => {
    router.push(url);
    setQuery('');
    setShowSearch(false);
  };

  return (
    <div
      className="h-14 flex items-center px-4 gap-3 print:hidden border-b border-gray-800"
      style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #0f0f0f 100%)' }}
    >
      {/* Hamburger — solo móvil */}
      {isMobile && (
        <button
          onClick={onMenuClick}
          className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center flex-shrink-0 hover:border-orange-500/50 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Búsqueda global */}
      <div className="flex-1 relative" ref={searchRef}>
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar páginas, clientes, productos..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            className="w-full pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
          />
        </div>

        {/* Resultados */}
        {showSearch && resultados.length > 0 && (
          <div className="absolute top-full mt-1 w-full max-w-md bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50">
            {resultados.map((r) => (
              <button
                key={r.url + r.label}
                onClick={() => irA(r.url)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700 transition-colors text-left"
              >
                <span className="text-xs px-2 py-0.5 bg-orange-900/30 text-orange-400 rounded-full flex-shrink-0">{r.tipo}</span>
                <span className="text-sm text-white">{r.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Toggle tema */}
      <button
        onClick={toggle}
        className="w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center hover:border-orange-500/50 transition-colors"
        title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      >
        {theme === 'dark' ? (
          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.166 17.834a.75.75 0 00-1.06 1.06l1.59 1.591a.75.75 0 001.061-1.06l-1.59-1.591zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.166 6.166a.75.75 0 001.06 1.06l-1.59 1.591a.75.75 0 01-1.061-1.06l1.59-1.591z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Notificaciones */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          className="relative w-9 h-9 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center hover:border-orange-500/50 transition-colors"
        >
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
              {unread}
            </span>
          )}
        </button>

        {/* Panel notificaciones */}
        {showNotifs && (
          <div className="absolute right-0 top-full mt-1 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden z-50 mr-24">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <span className="text-sm font-semibold text-white">Notificaciones</span>
              {unread > 0 && (
                <button onClick={marcarTodasLeidas} className="text-xs text-orange-400 hover:text-orange-300">
                  Marcar todas como leídas
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifs.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-6">Sin notificaciones pendientes</p>
              )}
              {notifs.map((n) => (
                <button
                  key={n.id}
                  onClick={() => { marcarLeida(n.id); router.push(n.href); setShowNotifs(false); }}
                  className={`w-full flex gap-3 px-4 py-3 border-b border-gray-700/50 text-left hover:bg-gray-700/40 transition-colors ${!n.leida ? 'bg-orange-900/10' : ''}`}
                >
                  <span className="text-lg flex-shrink-0 mt-0.5">{TIPO_ICON[n.tipo] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.leida ? 'text-white font-medium' : 'text-gray-400'}`}>{n.texto}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.sub}</p>
                  </div>
                  {!n.leida && <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1.5" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reloj */}
      <div className="select-none pl-3 border-l border-gray-700 flex items-center">
        <span style={{ fontFamily: 'monospace', fontSize: '15px', fontWeight: 600, color: '#e5e7eb', letterSpacing: '0.05em' }}>
          {hora}
        </span>
      </div>
    </div>
  );
}
