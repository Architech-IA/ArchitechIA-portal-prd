'use client';

import TopBar from "@/components/TopBar";
import SidebarUser from "@/components/SidebarUser";
import SidebarUsage from "@/components/SidebarUsage";
import GlobalSearch from "@/components/GlobalSearch";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

type NavItem = { href: string; label: string; icon: string };
type NavSection = { id: string; label: string; superAdmin?: boolean; items: NavItem[] };

// Accesos sueltos (sin header), como Home/Inbox/People de la referencia
const topLinks: NavItem[] = [
  { href: '/',           label: 'Dashboard',  icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/leads',      label: 'Leads',      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/meetings',   label: 'Calendar',   icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/calculador', label: 'Calculador', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
];

// Secciones colapsables (como Automations / Sales de la referencia)
const sections: NavSection[] = [
  {
    id: 'operacion', label: 'Operación',
    items: [
      { href: '/projects', label: 'Proyectos', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
      { href: '/backlog',  label: 'Backlog',   icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
      { href: '/hub',      label: 'HUB',       icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    ],
  },
  {
    id: 'comercial', label: 'Comercial',
    items: [
      { href: '/productos', label: 'Solutions', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
      { href: '/resources/cuentas', label: 'Cuentas', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
      { href: '/finanzas',  label: 'Finance',   icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    ],
  },
  {
    id: 'analisis', label: 'Análisis', superAdmin: true,
    items: [
      { href: '/traceability', label: 'Trazabilidad', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
      { href: '/graph',        label: 'Grafo',        icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
      { href: '/reportes',     label: 'Reportes',     icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    ],
  },
];

// Acceso suelto al final
const bottomLinks: NavItem[] = [
  { href: '/profile', label: 'Mi Perfil', icon: 'M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
];

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
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
    try {
      const savedSections = localStorage.getItem('sidebar-sections');
      setOpenSections(savedSections ? JSON.parse(savedSections) : {});
    } catch { setOpenSections({}); }
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

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = { ...prev, [id]: prev[id] === false ? true : false };
      localStorage.setItem('sidebar-sections', JSON.stringify(next));
      return next;
    });
  };

  // Las secciones arrancan abiertas salvo que el usuario las cierre
  const isSectionOpen = (id: string) => openSections[id] !== false;

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const visibleSections = sections.filter(s => isSuperAdmin || !s.superAdmin);

  const openSearch = () => window.dispatchEvent(new Event('open-global-search'));

  // Item de navegación reutilizable (modo expandido / colapsado / subitem)
  const NavLink = ({ item, isCollapsed, sub = false }: { item: NavItem; isCollapsed: boolean; sub?: boolean }) => {
    const active = isActive(item.href);
    return (
      <a
        href={item.href}
        title={isCollapsed ? item.label : undefined}
        className="flex items-center rounded-xl text-sm font-medium transition-all relative"
        style={{
          gap: isCollapsed ? '0' : '10px',
          padding: isCollapsed ? '10px 0' : '8px 12px',
          marginLeft: !isCollapsed && sub ? '8px' : '0',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          color: active ? '#FF7A2F' : '#64748b',
          background: active ? 'rgba(255,90,0,0.1)' : 'transparent',
          border: active ? '1px solid rgba(255,90,0,0.2)' : '1px solid transparent',
          textDecoration: 'none', whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.color = '#cbd5e1'; el.style.background = 'rgba(255,255,255,0.04)'; el.style.border = '1px solid rgba(255,255,255,0.06)'; } }}
        onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.color = '#64748b'; el.style.background = 'transparent'; el.style.border = '1px solid transparent'; } }}
      >
        {active && !isCollapsed && (
          <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style={{ background: '#FF5A00' }} />
        )}
        <svg style={{ color: active ? '#FF7A2F' : '#475569', flexShrink: 0 }} className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={item.icon} />
        </svg>
        {!isCollapsed && item.label}
        {!isCollapsed && active && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#FF5A00', boxShadow: '0 0 6px rgba(255,90,0,0.8)' }} />
        )}
      </a>
    );
  };

  const sidebarContent = (forceExpanded = false) => {
    const isCollapsed = !forceExpanded && collapsed && !isMobile;
    return (
      <>
        {/* Header: selector de workspace + toggle */}
        <div
          className="flex items-center justify-between px-4 py-5"
          style={{ minHeight: '72px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          {!isCollapsed ? (
            <button
              className="flex items-center gap-2.5 flex-1 min-w-0 rounded-lg py-1 px-1 -mx-1 transition-all"
              style={{ background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: '#FF5A00', boxShadow: '0 0 16px rgba(255,90,0,0.5)' }}
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
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#475569' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          ) : (
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto"
              style={{ background: '#FF5A00', boxShadow: '0 0 16px rgba(255,90,0,0.5)' }}
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

        {/* Buscador (réplica del Search de la referencia) */}
        {!isCollapsed ? (
          <div className="px-3 pt-3">
            <button
              onClick={openSearch}
              className="w-full flex items-center gap-2 rounded-xl px-3 py-2 transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,90,0,0.3)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
            >
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#475569' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <span className="text-sm flex-1 text-left" style={{ color: '#64748b' }}>Buscar…</span>
              <kbd
                className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ color: '#64748b', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                ⌘K
              </kbd>
            </button>
          </div>
        ) : (
          <div className="px-2 pt-3">
            <button
              onClick={openSearch}
              title="Buscar (⌘K)"
              className="w-full flex items-center justify-center py-2 rounded-lg transition-all"
              style={{ color: '#475569' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FF7A2F'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,90,0,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden">
          {isCollapsed && (
            <button onClick={toggleCollapse} title="Expandir sidebar"
              className="w-full flex items-center justify-center py-2 mb-2 rounded-lg transition-all"
              style={{ color: '#475569' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FF7A2F'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,90,0,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#475569'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          )}

          {/* Accesos sueltos */}
          <div className="space-y-0.5">
            {topLinks.map(item => <NavLink key={item.href} item={item} isCollapsed={isCollapsed} />)}
          </div>

          {/* Secciones colapsables */}
          {visibleSections.map(section => {
            const open = isSectionOpen(section.id);
            if (isCollapsed) {
              return (
                <div key={section.id} className="mt-2 pt-2 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {section.items.map(item => <NavLink key={item.href} item={item} isCollapsed />)}
                </div>
              );
            }
            return (
              <div key={section.id} className="mt-3">
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 transition-all group"
                  style={{ color: '#475569' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#475569'; }}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider">{section.label}</span>
                  <svg
                    className="w-3.5 h-3.5 transition-transform duration-200"
                    style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {open && (
                  <div className="relative mt-0.5 space-y-0.5">
                    {/* Rail conector de los subitems */}
                    <span className="absolute left-[14px] top-1 bottom-1 w-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                    {section.items.map(item => <NavLink key={item.href} item={item} isCollapsed={false} sub />)}
                  </div>
                )}
              </div>
            );
          })}

          {/* Accesos sueltos al final */}
          <div className="mt-3 pt-2 space-y-0.5" style={{ borderTop: isCollapsed ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            {bottomLinks.map(item => <NavLink key={item.href} item={item} isCollapsed={isCollapsed} />)}
          </div>
        </nav>

        {!isCollapsed && <SidebarUsage />}
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
