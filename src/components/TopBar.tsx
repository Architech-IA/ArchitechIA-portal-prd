'use client';
import { usePageActions } from '@/lib/pageActionsContext';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';

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

const glassBtn: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  flexShrink: 0,
  position: 'relative',
};

export default function TopBar({
  onMenuClick,
  isMobile,
  title,
}: {
  onMenuClick?: () => void;
  isMobile?: boolean;
  title?: string;
}) {
  const router = useRouter();
  const { actions: pageActions } = usePageActions();
  const pathname = usePathname();
  const { data: session } = useSession();

  // Si estamos en una subruta de /hub o /solutions, el título lleva al home de la sección.
  const HUB_SUBPAGE_RE = /^\/hub\/.+/;
  const SOLUTIONS_RE = /^\/solutions(\/.*)?$/;
  const titleHref = title && HUB_SUBPAGE_RE.test(pathname) ? '/hub'
    : title && SOLUTIONS_RE.test(pathname) ? '/solutions'
    : null;
  const userName = (session?.user as { name?: string })?.name ?? '';
  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase() || 'A';

  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

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

  const unread = notifs.filter(n => !n.leida).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const marcarTodasLeidas = () => {
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
    notifs.filter(n => !n.leida).forEach(n =>
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: n.id, read: true }),
      }).catch(() => {})
    );
  };

  const marcarLeida = (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n));
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, read: true }),
    }).catch(() => {});
  };

  return (
    <div
      className="flex items-center px-4 md:px-5 gap-2 print:hidden"
      style={{
        height: '52px',
        fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
        background: 'rgba(8,8,26,0.97)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {title && (
          titleHref ? (
            <button
              onClick={() => router.push(titleHref)}
              className="text-xs font-medium truncate flex items-center gap-1.5 group"
              style={{ color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#cbd5e1'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#64748b'}
              title={HUB_SUBPAGE_RE.test(pathname) ? "Volver al Hub" : "Ir a Solutions"}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ flexShrink: 0, opacity: 0.6 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
              {title}
            </button>
          ) : (
            <span className="text-xs font-medium truncate block" style={{ color: '#cbd5e1' }}>
              {title}
            </span>
          )
        )}
        {/* Page-injected actions slot — next to title */}
        {pageActions && (
          <>
            <div className="w-px h-4 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />
            <div className="flex items-center flex-shrink-0">{pageActions}</div>
          </>
        )}
      </div>

      {/* Busqueda global */}
      <button
        onClick={() => window.dispatchEvent(new Event('open-global-search'))}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors border"
        style={{ color: '#64748b', background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.06)' }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.color = '#94a3b8';
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.color = '#64748b';
          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
        }}
      >
        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <span>Buscar</span>
        <kbd
          className="text-[9px] px-1.5 py-0.5 rounded font-mono"
          style={{ color: '#64748b', background: 'rgba(255,255,255,0.08)' }}
        >
          K
        </kbd>
      </button>

      {/* Notificaciones */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          style={glassBtn}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)';
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: '#64748b' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 text-white font-bold rounded-full flex items-center justify-center px-1"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', fontSize: '9px' }}
            >
              {unread}
            </span>
          )}
        </button>

        {showNotifs && (
          <div
            className="absolute right-0 top-full mt-1.5 w-80 overflow-hidden z-50 animate-fade-in"
            style={{
              background: 'rgba(9,9,24,0.97)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '14px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
              backdropFilter: 'blur(24px)',
            }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Notificaciones</span>
              {unread > 0 && (
                <button onClick={marcarTodasLeidas} className="text-xs" style={{ color: '#FF7A2F' }}>
                  Marcar todas leidas
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
                      background: !n.leida ? 'rgba(255,90,0,0.05)' : 'transparent',
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

      {/* Avatar con iniciales */}
      <a
        href="/profile"
        title={userName || 'Mi Perfil'}
        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 select-none transition-colors"
        style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.3)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(124,58,237,0.2)'}
      >
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#A78BFA', letterSpacing: '0.03em' }}>
          {initials}
        </span>
      </a>
    </div>
  );
}