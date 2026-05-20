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

const TIPO_COLORS: Record<string, { bg: string; text: string }> = {
  lead:      { bg: 'rgba(255,90,0,0.15)',   text: '#FF5A00' },
  propuesta: { bg: 'rgba(255,140,0,0.15)',  text: '#FF8C00' },
  proyecto:  { bg: 'rgba(6,182,212,0.15)',  text: '#22d3ee' },
  finanza:   { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
};

function NotifIcon({ tipo }: { tipo: string }) {
  const pathMap: Record<string, string> = {
    lead:      'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    propuesta: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    proyecto:  'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    finanza:   'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  };
  const path = pathMap[tipo] ?? 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9';
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  );
}

const SEARCH_INDEX = [
  { label: 'Dashboard',            url: '/',                   tipo: 'Página'   },
  { label: 'Leads',                url: '/leads',              tipo: 'Página'   },
  { label: 'Lista de Leads',       url: '/leads/lista',        tipo: 'Página'   },
  { label: 'Pipeline',             url: '/leads/pipeline',     tipo: 'Página'   },
  { label: 'Clientes',             url: '/leads/clientes',     tipo: 'Página'   },
  { label: 'Prospector',           url: '/leads/prospector',   tipo: 'Página'   },
  { label: 'Mercado',              url: '/leads/mercado',      tipo: 'Página'   },
  { label: 'Propuestas',           url: '/proposals',          tipo: 'Página'   },
  { label: 'Proyectos',            url: '/projects',           tipo: 'Página'   },
  { label: 'Trazabilidad',         url: '/traceability',       tipo: 'Página'   },
  { label: 'HUB',                  url: '/hub',                tipo: 'Página'   },
  { label: 'Equipo',               url: '/hub/team',           tipo: 'Página'   },
  { label: 'ADMIN',                url: '/hub/team',           tipo: 'Página'   },
  { label: 'BUSINESS',             url: '/hub/business',       tipo: 'Página'   },
  { label: 'FINANCE',              url: '/hub/finance',        tipo: 'Página'   },
  { label: 'OPERATIONS',           url: '/hub/operations',     tipo: 'Página'   },
  { label: 'LEGAL',                url: '/hub/legal',          tipo: 'Página'   },
  { label: 'Productos',            url: '/productos',          tipo: 'Página'   },
  { label: 'Cuentas',              url: '/resources/cuentas',  tipo: 'Página'   },
  { label: 'Finance',              url: '/finanzas',           tipo: 'Página'   },
  { label: 'Calendar / Meetings',  url: '/meetings',           tipo: 'Página'   },
  { label: 'Pipeline de Ventas',   url: '/leads/pipeline',     tipo: 'Página'   },
  { label: 'Agente de Seguridad AI', url: '/productos',        tipo: 'Producto' },
  { label: 'Zoho Mail',            url: '/resources/cuentas',  tipo: 'Cuenta'   },
  { label: 'GitHub',               url: '/resources/cuentas',  tipo: 'Cuenta'   },
  { label: 'n8n',                  url: '/resources/cuentas',  tipo: 'Cuenta'   },
];

const TIPO_TAG_COLORS: Record<string, { bg: string; text: string }> = {
  Página:   { bg: 'rgba(255,90,0,0.12)',  text: '#FF5A00' },
  Producto: { bg: 'rgba(6,182,212,0.15)', text: '#22d3ee' },
  Cuenta:   { bg: 'rgba(255,140,0,0.15)', text: '#FF8C00' },
};

const glassBtn = {
  width: '36px',
  height: '36px',
  borderRadius: '10px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  flexShrink: 0 as const,
} as const;

const btnHoverIn  = (el: HTMLElement) => {
  el.style.background    = 'rgba(255,90,0,0.12)';
  el.style.borderColor   = 'rgba(255,90,0,0.35)';
};
const btnHoverOut = (el: HTMLElement) => {
  el.style.background    = 'rgba(255,255,255,0.04)';
  el.style.borderColor   = 'rgba(255,255,255,0.08)';
};

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

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then((d: ApiNotif[]) => setNotifs(Array.isArray(d) ? d.map(mapNotif) : []))
      .catch(() => {});
    const sse = new EventSource('/api/notifications/sse');
    sse.onmessage = (e) => {
      try { setNotifs((JSON.parse(e.data) as ApiNotif[]).map(mapNotif)); } catch {}
    };
    return () => sse.close();
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const col = new Date(now.getTime() - 5 * 60 * 60 * 1000);
      const h = String(col.getUTCHours()).padStart(2, '0');
      const m = String(col.getUTCMinutes()).padStart(2, '0');
      const s = String(col.getUTCSeconds()).padStart(2, '0');
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

  const dropdownStyle = {
    background:    'rgba(9,9,24,0.97)',
    border:        '1px solid rgba(255,255,255,0.09)',
    borderRadius:  '14px',
    boxShadow:     '0 24px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,90,0,0.08)',
    backdropFilter:'blur(24px)',
  };

  return (
    <div
      className="h-14 flex items-center px-4 gap-3 print:hidden"
      style={{
        background:          'rgba(8,8,26,0.97)',
        backdropFilter:      'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',
        borderBottom:        '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Hamburger â€” mÃ³vil */}
      {isMobile && (
        <button
          onClick={onMenuClick}
          style={glassBtn}
          onMouseEnter={e => btnHoverIn(e.currentTarget as HTMLElement)}
          onMouseLeave={e => btnHoverOut(e.currentTarget as HTMLElement)}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: '#94a3b8' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* BÃºsqueda global */}
      <div className="flex-1 relative" ref={searchRef}>
        <div className="relative max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
            style={{ color: '#475569', pointerEvents: 'none' }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Buscar pÃ¡ginas, clientes, productos..."
            value={query}
            onChange={e => { setQuery(e.target.value); setShowSearch(true); }}
            onFocus={e => {
              setShowSearch(true);
              e.currentTarget.style.borderColor = 'rgba(255,90,0,0.5)';
              e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(255,90,0,0.1)';
            }}
            style={{
              width: '100%',
              paddingLeft: '36px', paddingRight: '16px',
              paddingTop: '8px',   paddingBottom: '8px',
              background:  'rgba(255,255,255,0.04)',
              border:      '1px solid rgba(255,255,255,0.08)',
              borderRadius:'10px',
              color:       '#f1f5f9',
              fontSize:    '13px',
              outline:     'none',
              transition:  'all 0.15s ease',
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
              e.currentTarget.style.boxShadow   = 'none';
            }}
          />
        </div>

        {showSearch && resultados.length > 0 && (
          <div
            className="absolute top-full mt-1.5 w-full max-w-md overflow-hidden z-50 animate-fade-in"
            style={dropdownStyle}
          >
            {resultados.map(r => {
              const tc = TIPO_TAG_COLORS[r.tipo] ?? TIPO_TAG_COLORS['Página'];
              return (
                <button
                  key={r.url + r.label}
                  onClick={() => irA(r.url)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,90,0,0.08)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <span
                    className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium"
                    style={{ background: tc.bg, color: tc.text }}
                  >
                    {r.tipo}
                  </span>
                  <span className="text-sm" style={{ color: '#e2e8f0' }}>{r.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Toggle tema */}
      <button
        onClick={toggle}
        title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        style={glassBtn}
        onMouseEnter={e => btnHoverIn(e.currentTarget as HTMLElement)}
        onMouseLeave={e => btnHoverOut(e.currentTarget as HTMLElement)}
      >
        {theme === 'dark' ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#fbbf24' }}>
            <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.166 17.834a.75.75 0 00-1.06 1.06l1.59 1.591a.75.75 0 001.061-1.06l-1.59-1.591zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.166 6.166a.75.75 0 001.06 1.06l-1.59 1.591a.75.75 0 01-1.061-1.06l1.59-1.591z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#94a3b8' }}>
            <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
          </svg>
        )}
      </button>

      {/* Notificaciones */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          style={{ ...glassBtn, position: 'relative' }}
          onMouseEnter={e => btnHoverIn(e.currentTarget as HTMLElement)}
          onMouseLeave={e => btnHoverOut(e.currentTarget as HTMLElement)}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: '#94a3b8' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unread > 0 && (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 text-white font-bold rounded-full flex items-center justify-center"
              style={{
                background:  'linear-gradient(135deg, #6366f1, #8b5cf6)',
                boxShadow:   '0 0 8px rgba(255,90,0,0.8)',
                fontSize:    '10px',
              }}
            >
              {unread}
            </span>
          )}
        </button>

        {showNotifs && (
          <div
            className="absolute right-0 top-full mt-1.5 w-80 overflow-hidden z-50 animate-fade-in"
            style={dropdownStyle}
          >
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Notificaciones</span>
              {unread > 0 && (
                <button
                  onClick={marcarTodasLeidas}
                  className="text-xs transition-colors"
                  style={{ color: '#FF7A2F' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#FF7A2F'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#FF7A2F'}
                >
                  Marcar todas leÃ­das
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifs.length === 0 && (
                <div className="text-center py-8 px-4">
                  <svg className="w-7 h-7 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#334155' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-sm" style={{ color: '#475569' }}>Sin notificaciones pendientes</p>
                </div>
              )}
              {notifs.map(n => {
                const tc = TIPO_COLORS[n.tipo] ?? { bg: 'rgba(255,90,0,0.12)', text: '#FF7A2F' };
                return (
                  <button
                    key={n.id}
                    onClick={() => { marcarLeida(n.id); router.push(n.href); setShowNotifs(false); }}
                    className="w-full flex gap-3 px-4 py-3 text-left transition-all"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background:   !n.leida ? 'rgba(255,90,0,0.05)' : 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,90,0,0.08)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = !n.leida ? 'rgba(255,90,0,0.05)' : 'transparent'}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ background: tc.bg, color: tc.text }}
                    >
                      <NotifIcon tipo={n.tipo} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm leading-snug"
                        style={{ color: !n.leida ? '#f1f5f9' : '#94a3b8', fontWeight: !n.leida ? 500 : 400 }}
                      >
                        {n.texto}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{n.sub}</p>
                    </div>
                    {!n.leida && (
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                        style={{ background: '#FF5A00', boxShadow: '0 0 6px rgba(255,90,0,0.8)' }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Reloj */}
      <div
        className="select-none pl-3 clock-text"
        style={{ borderLeft: '1px solid rgba(255,255,255,0.06)' }}
      >
        <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: 600, color: '#64748b', letterSpacing: '0.05em' }}>
          {hora}
        </span>
      </div>
    </div>
  );
}
