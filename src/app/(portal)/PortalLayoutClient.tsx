'use client';

import TopBar from "@/components/TopBar";
import SidebarUser from "@/components/SidebarUser";
import GlobalSearch from "@/components/GlobalSearch";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

const SUPERADMIN_ONLY_PATHS = new Set(['/traceability', '/graph', '/reportes']);

const navLinks = [
  { href: '/',             label: 'Dashboard',   icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/leads',        label: 'Leads',        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/backlog',      label: 'Backlog',      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
  { href: '/meetings',     label: 'Calendar',     icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/calculador',   label: 'Calculador',   icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { href: '/projects',     label: 'Proyectos',    icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { href: '/finanzas',     label: 'Finance',      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/traceability', label: 'Trazabilidad', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/team',         label: 'HUB',          icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
  { href: '/productos',    label: 'Productos',    icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
  { href: '/cuentas',      label: 'Cuentas',      icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { href: '/graph',        label: 'Grafo',        icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
  { href: '/reportes',     label: 'Reportes',     icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { href: '/profile',      label: 'Mi Perfil',    icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
];

const SEPARATORS_BEFORE = new Set(['/backlog', '/finanzas', '/team']);

export default function PortalLayoutClient({
  children,
  isSuperAdmin: serverIsSuperAdmin,
}: {
  children: React.ReactNode;
  isSuperAdmin: boolean;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const clientRole = (session?.user as { role?: string })?.role ?? '';
  // Doble capa: server prop O verificación client-side
  const isSuperAdmin = serverIsSuperAdmin || clientRole === 'SUPERADMIN';
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const toggleCollapse = () => {
    setCollapsed(prev => {
      localStorage.setItem('sidebar-collapsed', String(!prev));
      return !prev;
    });
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const visibleLinks = navLinks.filter(
    ({ href }) => isSuperAdmin || !SUPERADMIN_ONLY_PATHS.has(href)
  );

  const sidebarContent = (forceExpanded = false) => {
    const isCollapsed = !forceExpanded && collapsed && !isMobile;
    return (
      <>
        {/* Logo + toggle */}
        <div
          className="flex items-center justify-between px-4 py-5"
          style={{ minHeight: '72px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #FF5A00 0%, #FF5A00 100%)', boxShadow: '0 0 16px rgba(255,90,0,0.5)' }}
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span
                className="text-base font-bold tracking-tight truncate"
                style={{ background: 'linear-gradient(135deg, #FF7A2F 0%, #FF7A2F 50%, #fb923c 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
              >
                ArchiTechIA
              </span>
            </div>
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto"
              style={{ background: 'linear-gradient(135deg, #FF5A00 0%, #FF5A00 100%)', boxShadow: '0 0 16px rgba(255,90,0,0.5)' }}
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          )}

          {!isCollapsed && !isMobile && (
            <button onClick={toggleCollapse} title="Colapsar sidebar"
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
              style={{ color: '#475569' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FF7A2F'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,90,0,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
          )}

          {isMobile && (
            <button onClick={() => setMobileOpen(false)}
              className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ color: '#475569' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 overflow-y-auto overflow-x-hidden">
          {isCollapsed && (
            <button onClick={toggleCollapse} title="Expandir sidebar"
              className="w-full flex items-center justify-center py-2 mb-3 rounded-lg transition-all"
              style={{ color: '#475569' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FF7A2F'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,90,0,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <div className="space-y-0.5">
            {visibleLinks.map(({ href, label, icon }) => {
              const active = isActive(href);
              return (
                <div key={href}>
                  {!isCollapsed && SEPARATORS_BEFORE.has(href) && (
                    <div className="my-2 mx-2" style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />
                  )}
                  <a
                    href={href}
                    title={isCollapsed ? label : undefined}
                    className="flex items-center rounded-xl text-sm font-medium transition-all relative"
                    style={{
                      gap: isCollapsed ? '0' : '10px',
                      padding: isCollapsed ? '10px 0' : '9px 12px',
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      color: active ? '#FF7A2F' : '#64748b',
                      background: active ? 'rgba(255,90,0,0.1)' : 'transparent',
                      border: active ? '1px solid rgba(255,90,0,0.2)' : '1px solid transparent',
                      textDecoration: 'none', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = '#cbd5e1'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.border = '1px solid rgba(255,255,255,0.06)'; } }}
                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = '#64748b'; (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.border = '1px solid transparent'; } }}
                  >
                    {active && !isCollapsed && (
                      <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style={{ background: 'linear-gradient(180deg, #FF5A00, #FF5A00)' }} />
                    )}
                    <svg style={{ color: active ? '#FF7A2F' : '#475569', flexShrink: 0 }} className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={icon} />
                    </svg>
                    {!isCollapsed && label}
                    {!isCollapsed && active && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #FF5A00, #FF5A00)', boxShadow: '0 0 6px rgba(255,90,0,0.8)' }} />
                    )}
                  </a>
                </div>
              );
            })}
          </div>
        </nav>

        <SidebarUser collapsed={isCollapsed} />
      </>
    );
  };

  return (
    <div className="flex h-screen" style={{ background: '#06060f' }}>
      {!isMobile && (
        <aside
          style={{ width: collapsed ? '64px' : '256px', minWidth: collapsed ? '64px' : '256px', background: 'linear-gradient(180deg, #08081a 0%, #0b0b1f 100%)', borderRight: '1px solid rgba(255,90,0,0.12)', transition: 'width 0.25s ease, min-width 0.25s ease', overflow: 'hidden' }}
          className="flex flex-col flex-shrink-0"
        >
          {sidebarContent()}
        </aside>
      )}

      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }} onClick={() => setMobileOpen(false)} />
      )}

      {isMobile && (
        <aside
          className="fixed top-0 left-0 h-full z-50 flex flex-col"
          style={{ width: '260px', background: 'linear-gradient(180deg, #08081a 0%, #0b0b1f 100%)', borderRight: '1px solid rgba(255,90,0,0.15)', transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s ease' }}
        >
          {sidebarContent(true)}
        </aside>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setMobileOpen(true)} isMobile={isMobile} />
        <main className="flex-1 overflow-y-auto" style={{ background: 'radial-gradient(ellipse 80% 50% at 20% -10%, rgba(255,90,0,0.05) 0%, transparent 60%), #0a0a18' }}>
          {children}
        </main>
        <GlobalSearch />
      </div>
    </div>
  );
}
