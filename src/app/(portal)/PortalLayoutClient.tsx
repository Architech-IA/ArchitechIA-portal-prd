'use client';

import TopBar from "@/components/TopBar";
import SidebarUser from "@/components/SidebarUser";
import SidebarUsage from "@/components/SidebarUsage";
import GlobalSearch from "@/components/GlobalSearch";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePageTitleOverride } from "@/lib/pageTitleContext";
import { PageActionsProvider, usePageActions } from "@/lib/pageActionsContext";

type NavItem = { href: string; label: string; icon: string };
type NavSection = { id: string; label: string; superAdmin?: boolean; items: NavItem[] };

// Accesos sueltos (sin header), como Home/Inbox/People de la referencia
const topLinks: NavItem[] = [
  { href: '/',           label: 'Dashboard',  icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { href: '/leads',      label: 'Leads',      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { href: '/meetings',   label: 'Calendar',   icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/calculador', label: 'Calculador', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
  { href: '/canvas', label: 'Canvas', icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z' },
];

// Secciones colapsables (como Automations / Sales de la referencia)
const sections: NavSection[] = [
  {
    id: 'operacion', label: 'Operación',
    items: [
      { href: '/workflows', label: 'Workflows', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
      { href: '/backlog',  label: 'Backlog',   icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
      { href: '/hub',      label: 'HUB',       icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    ],
  },
  {
    id: 'comercial', label: 'Comercial',
    items: [
      { href: '/solutions', label: 'Solutions', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
      { href: '/resources/cuentas', label: 'Cuentas', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
      { href: '/finanzas',  label: 'Finance',   icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { href: '/inventario', label: 'Inventario', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
      { href: '/proveedores', label: 'Proveedores', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
      { href: '/contabilidad', label: 'Contabilidad', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M9 14h.01M12 14h.01M15 14h.01M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5z' },
      { href: '/rrhh',       label: 'RRHH',        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
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

// Color distintivo por módulo — réplica del "module color coding" de mainFJ-hub
const MODULE_COLORS: Record<string, { icon: string; bg: string; border: string; glow: string }> = {
  '/':                  { icon: '#a78bfa', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', glow: '0 0 12px rgba(139,92,246,0.3)' },
  '/apps':              { icon: '#22d3ee', bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.25)',  glow: '0 0 12px rgba(6,182,212,0.3)'  },
  '/leads':             { icon: '#60a5fa', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)', glow: '0 0 12px rgba(59,130,246,0.3)' },
  '/meetings':          { icon: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', glow: '0 0 12px rgba(245,158,11,0.3)' },
  '/canvas':             { icon: '#a78bfa', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', glow: '0 0 12px rgba(139,92,246,0.3)' },
  '/calculador':        { icon: '#2dd4bf', bg: 'rgba(20,184,166,0.12)', border: 'rgba(20,184,166,0.25)', glow: '0 0 12px rgba(20,184,166,0.3)' },
  '/workflows':         { icon: '#f472b6', bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.25)', glow: '0 0 12px rgba(244,114,182,0.3)' },
  '/backlog':           { icon: '#c084fc', bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.25)', glow: '0 0 12px rgba(168,85,247,0.3)' },
  '/hub':               { icon: '#f472b6', bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.25)', glow: '0 0 12px rgba(236,72,153,0.3)' },
  '/solutions':         { icon: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', glow: '0 0 12px rgba(16,185,129,0.3)' },
  '/resources/cuentas': { icon: '#38bdf8', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.25)', glow: '0 0 12px rgba(14,165,233,0.3)' },
  '/finanzas':          { icon: '#4ade80', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.25)',  glow: '0 0 12px rgba(34,197,94,0.3)'  },
  '/traceability':      { icon: '#fb7185', bg: 'rgba(244,63,94,0.12)',  border: 'rgba(244,63,94,0.25)',  glow: '0 0 12px rgba(244,63,94,0.3)'  },
  '/graph':             { icon: '#e879f9', bg: 'rgba(217,70,239,0.12)', border: 'rgba(217,70,239,0.25)', glow: '0 0 12px rgba(217,70,239,0.3)' },
  '/reportes':          { icon: '#fda4af', bg: 'rgba(251,113,133,0.12)',border: 'rgba(251,113,133,0.25)',glow: '0 0 12px rgba(251,113,133,0.3)'},
  '/profile':           { icon: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', glow: '0 0 12px rgba(245,158,11,0.3)' },
  '/inventario':        { icon: '#38bdf8', bg: 'rgba(14,165,233,0.12)', border: 'rgba(14,165,233,0.25)', glow: '0 0 12px rgba(14,165,233,0.3)' },
  '/proveedores':       { icon: '#fb923c', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.25)', glow: '0 0 12px rgba(249,115,22,0.3)' },
  '/contabilidad':      { icon: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', glow: '0 0 12px rgba(16,185,129,0.3)' },
  '/rrhh':              { icon: '#a78bfa', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', glow: '0 0 12px rgba(139,92,246,0.3)' },
};
const DEFAULT_MODULE_COLOR = { icon: '#5a6577', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.05)', glow: '' };

export default function PortalLayoutClient({
  children,
  isSuperAdmin: serverIsSuperAdmin,
}: {
  children: React.ReactNode;
  isSuperAdmin: boolean;
}) {
  const pathname = usePathname();
  const { title: pageTitleOverride } = usePageTitleOverride();

  const { data: sessionForGreeting } = useSession();
  const _greetingFirstName = ((sessionForGreeting?.user as { name?: string })?.name ?? '').split(' ')[0] || 'ArchiTechIA';
  const _greetingHour = new Date().getHours();
  const _greeting = _greetingHour < 12 ? 'Buenos días' : _greetingHour < 18 ? 'Buenas tardes' : 'Buenas noches';

  const computedTitle = (() => {
    if (pathname === '/') return `${_greeting}, ${_greetingFirstName}`;
    if (pathname === '/apps') return 'Mini-Apps Hub';
    if (pathname === '/apps/catalogo') return 'Catálogo de Apps';
    if (pathname === '/apps/nueva/crm') return 'Nueva App: CRM';
    if (pathname === '/apps/nueva/landing') return 'Nueva App: Landing Page';
    if (pathname?.startsWith('/apps/') && pathname?.endsWith('/config')) return 'Configuración';
    if (pathname?.startsWith('/apps/')) return 'App';
    if (pathname === '/leads') return 'Leads';
    if (pathname === '/leads/lista') return 'Lista de Leads';
    if (pathname === '/leads/pipeline') return 'Pipeline';
    if (pathname === '/leads/clientes') return 'Clientes';
    if (pathname === '/leads/prospector') return 'Prospector';
    if (pathname === '/leads/mercado') return 'Mercado';
    if (pathname === '/proposals') return 'Propuestas';
    if (pathname === '/workflows') return 'Workflows';
    if (pathname === '/traceability') return 'Trazabilidad';
    if (pathname === '/hub') return 'HUB';
    if (pathname === '/hub/team') return 'Equipo';
    if (pathname === '/hub/business') return 'Business';
    if (pathname === '/hub/finance') return 'Finance';
    if (pathname === '/hub/operations') return 'Operations';
    if (pathname === '/hub/legal') return 'Legal';
    if (pathname?.startsWith('/solutions')) return 'Solutions';
    if (pathname === '/resources/cuentas') return 'Cuentas';
    if (pathname === '/finanzas') return 'Finance';
    if (pathname === '/inventario') return 'Inventario';
    if (pathname === '/proveedores') return 'Proveedores';
    if (pathname === '/contabilidad') return 'Contabilidad';
    if (pathname === '/rrhh') return 'Recursos Humanos';
    if (pathname === '/meetings') return 'Calendar';
    const clean = pathname?.replace(/^\//, '') || '';
    if (!clean) return 'ArchiTechIA';
    return clean
      .split('/')
      .pop()
      ?.replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase()) || 'ArchiTechIA';
  })();
  const pageTitle = pageTitleOverride || computedTitle;
  const session = sessionForGreeting;
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

  // Pantalla completa para demos runtime de Mini-Apps (oculta sidebar y navbar)
  const APP_STATIC_ROUTES = new Set(['/apps/catalogo', '/apps/nueva/crm', '/apps/nueva/landing']);
  const isAppRuntime = pathname && /^\/apps\/[^/]+$/.test(pathname) && !APP_STATIC_ROUTES.has(pathname);

  // Item de navegación reutilizable (modo expandido / colapsado / subitem)
  const NavLink = ({ item, isCollapsed, sub = false }: { item: NavItem; isCollapsed: boolean; sub?: boolean }) => {
    const active = isActive(item.href);
    const mc = MODULE_COLORS[item.href] ?? DEFAULT_MODULE_COLOR;
    return (
      <a
        href={item.href}
        title={isCollapsed ? item.label : undefined}
        className="flex items-center rounded-xl transition-all relative"
        style={{
          fontSize: '12px',
          fontWeight: 300,
          gap: isCollapsed ? '0' : '8px',
          padding: isCollapsed ? '6px 0' : '5px 8px',
          marginLeft: !isCollapsed && sub ? '8px' : '0',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          color: active ? '#FF7A2F' : '#e2e8f0',
          background: active ? 'linear-gradient(90deg, rgba(255,90,0,0) 0%, rgba(255,90,0,0.08) 40%, rgba(255,90,0,0.28) 100%)' : 'transparent',
          border: active ? '1px solid rgba(255,90,0,0.25)' : '1px solid transparent',
          textDecoration: 'none', whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.color = '#ffffff'; el.style.background = 'rgba(255,255,255,0.04)'; el.style.border = '1px solid rgba(255,255,255,0.06)'; } }}
        onMouseLeave={e => { if (!active) { const el = e.currentTarget as HTMLElement; el.style.color = '#e2e8f0'; el.style.background = 'transparent'; el.style.border = '1px solid transparent'; } }}
      >
        {active && !isCollapsed && (
          <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style={{ background: '#FF5A00' }} />
        )}
        <span
          className="flex items-center justify-center rounded-lg flex-shrink-0 transition-all"
          style={{
            width: '22px', height: '22px',
            background: active ? mc.bg : 'rgba(255,255,255,0.03)',
            border: `1px solid ${active ? mc.border : 'rgba(255,255,255,0.05)'}`,
            boxShadow: active ? mc.glow : 'none',
          }}
        >
          <svg style={{ color: active ? mc.icon : '#5a6577', flexShrink: 0 }} className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={item.icon} />
          </svg>
        </span>
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
          className="flex items-center justify-between px-3"
          style={{ height: '52px', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          {!isCollapsed ? (
            <button
              className="flex items-center gap-2.5 flex-1 min-w-0 rounded-lg py-1 px-1 -mx-1 transition-all"
              style={{ background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
                            <img src="/icon.png" alt="ArchiTechIA" className="w-8 h-8 rounded-lg flex-shrink-0 object-cover" style={{ boxShadow: '0 0 16px rgba(255,90,0,0.4)' }} />
              <span
                className="text-base font-bold tracking-tight truncate"
                style={{ background: 'linear-gradient(135deg, #FF7A2F 0%, #FF7A2F 50%, #fb923c 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
              >
                ArchiTechIA
              </span>
            </button>
          ) : (
                        <img src="/icon.png" alt="ArchiTechIA" className="w-9 h-9 rounded-xl mx-auto object-cover" style={{ boxShadow: '0 0 16px rgba(255,90,0,0.4)' }} />
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
        <nav className="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden">
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

  if (isAppRuntime) {
    return (
      <div className="h-screen w-screen overflow-hidden" style={{ background: '#0a0a18' }}>
        {children}
      </div>
    );
  }

  return (
    <PageActionsProvider>
    <div className="flex h-screen" style={{ background: 'transparent' }}>
      {!isMobile && (
        <aside
          style={{ width: collapsed ? '60px' : '200px', minWidth: collapsed ? '60px' : '200px', background: 'rgba(8,8,26,0.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRight: '1px solid rgba(255,255,255,0.05)', transition: 'width 0.25s ease, min-width 0.25s ease', overflow: 'hidden' }}
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
          style={{ width: '260px', background: 'rgba(8,8,26,0.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRight: '1px solid rgba(255,255,255,0.05)', transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.25s ease' }}
        >
          {sidebarContent(true)}
        </aside>
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* ── Blobs liquid glass identicos a GD-DATOSHUB (inline styles para Tailwind v4) */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute" style={{
          top: '-40px', right: '5%',
          width: '480px', height: '420px',
          background: 'rgba(99,102,241,0.22)',
          filter: 'blur(120px)',
          borderRadius: '62% 38% 45% 55% / 55% 45% 60% 40%',
        }} />
        <div className="absolute" style={{
          top: '22%', left: '28%',
          width: '380px', height: '340px',
          background: 'rgba(14,165,233,0.18)',
          filter: 'blur(110px)',
          borderRadius: '40% 60% 55% 45% / 45% 55% 40% 60%',
        }} />
        <div className="absolute" style={{
          top: '2%', left: '8%',
          width: '340px', height: '380px',
          background: 'rgba(148,163,184,0.08)',
          filter: 'blur(120px)',
          borderRadius: '55% 45% 60% 40% / 40% 60% 45% 55%',
        }} />
        <div className="absolute" style={{
          top: '48%', right: '18%',
          width: '320px', height: '300px',
          background: 'rgba(45,212,191,0.16)',
          filter: 'blur(110px)',
          borderRadius: '45% 55% 40% 60% / 60% 40% 55% 45%',
        }} />
      </div>

        <TopBar onMenuClick={() => setMobileOpen(true)} isMobile={isMobile} title={pathname === '/' ? '' : pageTitle} />
        <main className="flex-1 overflow-y-auto relative" style={{ zIndex: 1, background: 'transparent' }}>
          {children}
        </main>
        <GlobalSearch />
      </div>
    </div>
  </PageActionsProvider>
  );
}

