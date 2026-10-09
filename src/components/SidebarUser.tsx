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
  SUPERADMIN:                'Super Admin',
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
  background: '#FF5A00',
  boxShadow:  '0 0 10px rgba(255,90,0,0.25)',
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

  const Avatar = ({ size = 32 }: { size?: number }) => (
    <div
      className="rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{ width: size, height: size, ...avatarStyle }}
    >
      {avatar
        ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
        : <span className="font-semibold text-white" style={{ fontSize: size * 0.36 }}>{initials}</span>
      }
    </div>
  );

  const LogoutIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );

  if (collapsed) {
    return (
      <div
        className="p-2 flex flex-col items-center gap-2"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div title={`${name} — ${ROLE_LABELS[role] ?? role}`}>
          <Avatar size={34} />
        </div>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
          style={{ color: '#7f8a9c' }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#f87171'; el.style.background = 'rgba(239,68,68,0.1)'; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#475569'; el.style.background = 'transparent'; }}
        >
          <LogoutIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-2.5 px-1">
        <Avatar size={32} />
        <div className="flex-1 min-w-0">
          <p className="truncate" style={{ fontSize: '12px', fontWeight: 500, color: '#e2e8f0', lineHeight: 1.3 }}>
            {name}
          </p>
          <p className="truncate" style={{ fontSize: '10.5px', fontWeight: 300, color: '#7f8a9c', lineHeight: 1.3 }}>
            {ROLE_LABELS[role] ?? email}
          </p>
        </div>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
          style={{ color: '#7f8a9c' }}
          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#f87171'; el.style.background = 'rgba(239,68,68,0.1)'; }}
          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = '#475569'; el.style.background = 'transparent'; }}
        >
          <LogoutIcon />
        </button>
      </div>
    </div>
  );
}
