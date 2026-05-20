'use client';

import { useSession, signOut } from 'next-auth/react';

const ROLE_LABELS: Record<string, string> = {
  ADMIN:                     'Administrador',
  GERENTE_COMERCIAL:         'Gerente Comercial',
  GERENTE_ADMINISTRATIVO:    'Gerente Administrativo',
  GERENTE_OPERACIONES:       'Gerente de Operaciones',
  ARQUITECTO_SOLUCIONES:     'Arquitecto de Soluciones',
  PARTNER:                   'Socio',
  COLLABORATOR:              'Colaborador',
};

async function logLogout(userId: string, email: string) {
  try {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, action: 'LOGOUT', success: true }),
    });
  } catch {}
}

const avatarStyle = {
  background: 'linear-gradient(135deg, #FF5A00 0%, #FF5A00 100%)',
  boxShadow:  '0 0 12px rgba(255,90,0,0.4)',
} as const;

export default function SidebarUser({ collapsed = false }: { collapsed?: boolean }) {
  const { data: session } = useSession();

  const name    = session?.user?.name  ?? 'Usuario';
  const email   = session?.user?.email ?? '';
  const role    = (session?.user as { role?: string })?.role ?? '';
  const userId  = (session?.user as { id?: string })?.id ?? '';
  const avatar  = (session?.user as { avatar?: string | null })?.avatar ?? null;
  const initials = name
    .split(' ')
    .filter(w => w.length > 0)
    .slice(0, 2)
    .map(w => w.charAt(0).toUpperCase())
    .join('');

  const handleLogout = async () => {
    await logLogout(userId, email);
    signOut({ callbackUrl: '/login' });
  };

  const Avatar = () => (
    <div
      className="flex items-center justify-center overflow-hidden"
      style={avatarStyle}
    >
      {avatar
        ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
        : <span className="font-semibold text-white text-xs">{initials}</span>
      }
    </div>
  );

  const LogoutIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );

  if (collapsed) {
    return (
      <div
        className="p-2 flex flex-col items-center gap-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          title={`${name} â€” ${ROLE_LABELS[role] ?? role}`}
          className="w-9 h-9 rounded-xl"
          style={avatarStyle}
        >
          <Avatar />
        </div>
        <button
          onClick={handleLogout}
          title="Cerrar sesiÃ³n"
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
          style={{
            color:       '#475569',
            background:  'rgba(255,255,255,0.03)',
            border:      '1px solid rgba(255,255,255,0.06)',
          }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.color       = '#f87171';
            el.style.background  = 'rgba(239,68,68,0.1)';
            el.style.borderColor = 'rgba(239,68,68,0.2)';
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.color       = '#475569';
            el.style.background  = 'rgba(255,255,255,0.03)';
            el.style.borderColor = 'rgba(255,255,255,0.06)';
          }}
        >
          <LogoutIcon />
        </button>
      </div>
    );
  }

  return (
    <div
      className="p-3"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div
        className="flex items-center gap-3 p-2.5 rounded-xl mb-2"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border:     '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden" style={avatarStyle}>
          <Avatar />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: '#e2e8f0' }}>{name}</p>
          <p className="text-xs truncate" style={{ color: '#475569' }}>{email}</p>
          {role && (
            <p className="text-xs truncate" style={{ color: '#FF7A2F' }}>
              {ROLE_LABELS[role] ?? role}
            </p>
          )}
        </div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-xl transition-all"
        style={{
          color:      '#475569',
          background: 'rgba(255,255,255,0.02)',
          border:     '1px solid rgba(255,255,255,0.05)',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.color       = '#f87171';
          el.style.background  = 'rgba(239,68,68,0.08)';
          el.style.borderColor = 'rgba(239,68,68,0.15)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.color       = '#475569';
          el.style.background  = 'rgba(255,255,255,0.02)';
          el.style.borderColor = 'rgba(255,255,255,0.05)';
        }}
      >
        <LogoutIcon />
        Cerrar sesiÃ³n
      </button>
    </div>
  );
}
