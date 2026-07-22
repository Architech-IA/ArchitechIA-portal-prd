'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Package, FolderKanban, FlaskConical, Handshake, Building2, Lightbulb, ArrowRight, Loader2, Plus, X, ExternalLink, DollarSign, Tag, Calendar, User, Search, Play, Box, Users, Layout, Globe, BarChart3, Bot, FileText, UserCircle, Headphones, Shield, Plug, Kanban } from 'lucide-react'
import { APP_CATEGORIES } from '@/lib/app-types'
import type { AppInstance } from '@/lib/app-types'

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Users, Layout, Globe, BarChart3, Bot, FileText, UserCircle, Headphones, Shield, Plug, Kanban,
}

const CAT_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  'text-orange-400':  { color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)'  },
  'text-blue-400':    { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)'  },
  'text-green-400':   { color: '#4ade80', bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.3)'  },
  'text-cyan-400':    { color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  border: 'rgba(34,211,238,0.3)'  },
  'text-purple-400':  { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.3)' },
  'text-pink-400':    { color: '#f472b6', bg: 'rgba(244,114,182,0.12)', border: 'rgba(244,114,182,0.3)' },
  'text-yellow-400':  { color: '#facc15', bg: 'rgba(250,204,21,0.12)',  border: 'rgba(250,204,21,0.3)'  },
  'text-red-400':     { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  'text-emerald-400': { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)'  },
  'text-indigo-400':  { color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.3)' },
  'text-violet-400':  { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)' },
  'text-teal-400':    { color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)',  border: 'rgba(45,212,191,0.3)'  },
  'text-fuchsia-400': { color: '#e879f9', bg: 'rgba(232,121,249,0.12)', border: 'rgba(232,121,249,0.3)' },
  'text-rose-400':    { color: '#fb7185', bg: 'rgba(251,113,133,0.12)', border: 'rgba(251,113,133,0.3)' },
  'text-amber-400':   { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.3)'  },
  'text-lime-400':    { color: '#a3e635', bg: 'rgba(163,230,53,0.12)',  border: 'rgba(163,230,53,0.3)'  },
}

function getStyle(colorClass: string) {
  return CAT_STYLE[colorClass] ?? { color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.3)' }
}

function AppCard({ app }: { app: AppInstance }) {
  const router = useRouter()
  const Icon = ICON_MAP[app.appType.icon] ?? Box
  const category = APP_CATEGORIES[app.appType.category]
  const cs = getStyle(category?.color ?? 'text-gray-400')

  const handleOpen = () => {
    const ext = app.config?.externalUrl as string | undefined
    if (ext) window.open(ext, '_blank')
    else router.push(`/apps/${app.slug}`)
  }

  return (
    <div
      className="group rounded-xl p-4 flex flex-col h-full cursor-pointer transition-all duration-150"
      style={{ background: cs.bg, border: `1px solid ${cs.border.replace('0.3', '0.2')}` }}
      onClick={handleOpen}
      onMouseEnter={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = cs.color + '55'
        ;(e.currentTarget as HTMLElement).style.background = cs.bg.replace('0.12', '0.18')
      }}
      onMouseLeave={e => {
        ;(e.currentTarget as HTMLElement).style.borderColor = cs.border.replace('0.3', '0.2')
        ;(e.currentTarget as HTMLElement).style.background = cs.bg
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: cs.color + '22', border: `1px solid ${cs.color}33` }}>
          <Icon className="h-4 w-4" style={{ color: cs.color }} />
        </div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: cs.color + '22', color: cs.color }}>
          {category?.label ?? app.appType.category}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-white mb-1 leading-snug">{app.name}</h3>
      <p className="text-xs text-gray-400 leading-relaxed mb-3 flex-1 line-clamp-2">{app.description ?? 'Sin descripcion'}</p>
      <div className="flex items-center gap-1 text-xs font-medium" style={{ color: cs.color + 'cc' }}>
        Abrir <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  )
}

interface SectionDef {
  href: string
  label: string
  icon: React.ElementType
  color: string
  bg: string
  border: string
  desc: string
  api: string | null
}

interface Solucion {
  id: string
  nombre: string
  tipo: string
  estado: string
  descripcion: string | null
  valorEstimado: number
  repositorio: string | null
  createdAt: string
  lead: { id: string; companyName: string; contactName: string; status: string } | null
}

interface Producto {
  id: string
  nombre: string
  version: string
  estado: string
}

const SECTIONS: SectionDef[] = [
  {
    href: '/solutions/productos',
    label: 'Productos',
    icon: Package,
    color: '#f97316',
    bg: 'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.2)',
    desc: 'Soluciones tecnologicas desarrolladas por ArchiTechIA para el mercado.',
    api: '/api/productos',
  },
  {
    href: '/solutions/projects',
    label: 'Projects',
    icon: FolderKanban,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.2)',
    desc: 'Proyectos tecnologicos completos con IA y automatizacion para clientes.',
    api: '/api/soluciones?tipo=PROJECT',
  },
  {
    href: '/solutions/pilots',
    label: 'Pilots',
    icon: FlaskConical,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.2)',
    desc: 'Pruebas de concepto para validar tecnologia antes de escalar.',
    api: '/api/soluciones?tipo=DEMO',
  },
  {
    href: '/solutions/partnership',
    label: 'Partnership',
    icon: Handshake,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.2)',
    desc: 'Alianzas estrategicas para co-crear soluciones y productos.',
    api: '/api/soluciones?tipo=PARTNERSHIP',
  },
  {
    href: '/solutions/intern',
    label: 'Intern',
    icon: Building2,
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.08)',
    border: 'rgba(6,182,212,0.2)',
    desc: 'Soluciones internas, herramientas y plataformas de ArchiTechIA.',
    api: '/api/soluciones?tipo=INTERN',
  },
  {
    href: '/solutions/iniciativas',
    label: 'Iniciativas',
    icon: Lightbulb,
    color: '#eab308',
    bg: 'rgba(234,179,8,0.08)',
    border: 'rgba(234,179,8,0.2)',
    desc: 'Ideas y proyectos emergentes propuestos por el equipo.',
    api: '/api/iniciativas',
  },
]

const TYPE_META: Record<string, { label: string; color: string; href: string }> = {
  PROJECT:     { label: 'Project',     color: '#3b82f6', href: '/solutions/projects' },
  DEMO:        { label: 'Pilot',       color: '#8b5cf6', href: '/solutions/pilots' },
  PARTNERSHIP: { label: 'Partnership', color: '#10b981', href: '/solutions/partnership' },
  INTERN:      { label: 'Intern',      color: '#06b6d4', href: '/solutions/intern' },
  PRODUCT:     { label: 'Producto',    color: '#f97316', href: '/solutions/productos' },
}

const ESTADO_COLOR: Record<string, string> = {
  ACTIVO:          '#10b981',
  'En Desarrollo': '#f97316',
  Lanzado:         '#3b82f6',
  Archivado:       '#6b7280',
  INACTIVO:        '#6b7280',
}

const EMPTY_FORM = { nombre: '', tipo: 'PROJECT', estado: 'ACTIVO', descripcion: '', valorEstimado: '' }

export default function SolutionsHome() {
  const [counts, setCounts] = useState<Record<string, number | null>>({})
  const [allItems, setAllItems] = useState<Array<(Solucion | Producto) & { tipo: string }>>([])
  const [loadingList, setLoadingList] = useState(true)
  const [apps, setApps] = useState<AppInstance[]>([])
  const [loadingApps, setLoadingApps] = useState(true)
  const [appSearch, setAppSearch] = useState('')
  const [appCategory, setAppCategory] = useState('')
  const [iniciativas, setIniciativas] = useState<Array<{ id: string; nombre: string; estado: string; categoria: string; prioridad: string }>>([])
  const [loadingIniciativas, setLoadingIniciativas] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<Solucion | null>(null)

  const fetchAll = () => {
    SECTIONS.forEach(s => {
      if (!s.api) return
      fetch(s.api)
        .then(r => r.ok ? r.json() : [])
        .then(d => setCounts(prev => ({ ...prev, [s.href]: Array.isArray(d) ? d.length : null })))
        .catch(() => {})
    })

    Promise.all([
      fetch('/api/soluciones').then(r => r.ok ? r.json() : []).catch(() => []),
      fetch('/api/productos').then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([sols, prods]) => {
      const solItems = Array.isArray(sols) ? (sols as Solucion[]) : []
      const prodItems = Array.isArray(prods)
        ? (prods as Producto[]).map(p => ({ ...p, tipo: 'PRODUCT' }))
        : []
      setAllItems([...prodItems, ...solItems])
      setLoadingList(false)
    })

    fetch('/api/iniciativas')
      .then(r => r.ok ? r.json() : [])
      .then(d => { setIniciativas(Array.isArray(d) ? d : []); setLoadingIniciativas(false) })
      .catch(() => setLoadingIniciativas(false))
  }

  useEffect(() => {
    fetchAll()
    fetch('/api/apps')
      .then(r => r.ok ? r.json() : [])
      .then(d => { setApps(Array.isArray(d) ? d : []); setLoadingApps(false) })
      .catch(() => setLoadingApps(false))
  }, [])

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/soluciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          tipo: form.tipo,
          estado: form.estado,
          descripcion: form.descripcion.trim() || null,
          valorEstimado: parseFloat(form.valorEstimado) || 0,
        }),
      })
      if (!res.ok) throw new Error('Error al crear')
      setShowModal(false)
      setForm(EMPTY_FORM)
      setLoadingList(true)
      fetchAll()
    } catch {
      setError('No se pudo crear la solución')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#e5e7eb',
    fontSize: '13px',
    outline: 'none',
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 10px center',
    paddingRight: '32px',
    cursor: 'pointer',
    colorScheme: 'dark',
  }

  return (
    <div className="pt-3 pb-6 px-6 md:px-8 flex gap-6 items-start">
      {/* Left: section cards */}
      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {SECTIONS.map(s => {
            const Icon = s.icon
            const count = counts[s.href]
            return (
              <Link
                key={s.href}
                href={s.href}
                className="group block rounded-xl p-4 transition-all duration-150"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = s.color + '55'
                  ;(e.currentTarget as HTMLElement).style.background = s.bg.replace('0.08', '0.13')
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLElement).style.borderColor = s.border
                  ;(e.currentTarget as HTMLElement).style.background = s.bg
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: s.color + '22', border: `1px solid ${s.color}33` }}
                  >
                    <Icon size={16} style={{ color: s.color }} />
                  </div>
                  {count != null && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: s.color + '22', color: s.color }}>
                      {count}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{s.label}</h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-3">{s.desc}</p>
                <div className="flex items-center gap-1 text-xs font-medium" style={{ color: s.color + 'cc' }}>
                  Ver {s.label}
                  <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            )
          })}
        </div>

        {/* Apps catalog */}
        <div className="mt-6">
          {/* Title + search + category pills — all in one row */}
          <div className="flex items-center gap-3 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            <h2 className="text-sm font-semibold text-white flex-shrink-0">Mini Apps</h2>
            <div className="relative flex-shrink-0 w-36">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                className="w-full bg-white/5 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 outline-none focus:border-white/20"
                placeholder="Buscar..."
                value={appSearch}
                onChange={e => setAppSearch(e.target.value)}
              />
            </div>
            <button
              onClick={() => setAppCategory('')}
              className="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
              style={appCategory === '' ? { background: '#f97316', color: '#fff' } : { background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}
            >
              Todas
            </button>
            {Object.entries(APP_CATEGORIES).map(([key, cat]) => {
              const cs = getStyle(cat.color)
              const active = appCategory === key
              return (
                <button
                  key={key}
                  onClick={() => setAppCategory(active ? '' : key)}
                  className="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors"
                  style={active
                    ? { background: cs.color, color: '#fff' }
                    : { background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}
                >
                  {cat.label}
                </button>
              )
            })}
            <Link href="/apps" className="flex-shrink-0 ml-auto text-[11px] text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1">
              Ver todas <ArrowRight size={10} />
            </Link>
          </div>

          {loadingApps ? (
            <div className="flex justify-center py-12">
              <Loader2 size={20} className="animate-spin text-gray-600" />
            </div>
          ) : (() => {
            const filtered = apps.filter(a => {
              const matchCat = !appCategory || a.appType.category === appCategory
              const matchSearch = !appSearch || a.name.toLowerCase().includes(appSearch.toLowerCase()) || (a.description ?? '').toLowerCase().includes(appSearch.toLowerCase())
              return matchCat && matchSearch
            })
            return filtered.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-10">Sin apps para mostrar</p>
            ) : (
              <div
                className="flex gap-3 overflow-x-auto pb-2"
                style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
              >
                {filtered.map(app => (
                  <div key={app.id} className="flex-shrink-0 w-52">
                    <AppCard app={app} />
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Right: all solutions widget */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3">
        {/* Action buttons — outside widgets */}
        <button
          onClick={() => { setForm(EMPTY_FORM); setError(''); setShowModal(true) }}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors"
          style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)', color: '#f97316' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.2)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.12)'}
        >
          <Plus size={13} />
          Nueva solución
        </button>
        <Link
          href="/solutions/iniciativas"
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-colors"
          style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', color: '#eab308' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(234,179,8,0.18)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(234,179,8,0.1)'}
        >
          <Plus size={13} />
          Nueva iniciativa
        </Link>

        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
        >
        {/* Widget header */}
        <div className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(249,115,22,0.1)' }}>
          <span className="text-xs font-semibold text-white">Todas las soluciones</span>
          {allItems.length > 0 && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
              {allItems.length}
            </span>
          )}
        </div>

        {/* List */}
        {loadingList ? (
          <div className="flex justify-center py-8">
            <Loader2 size={16} className="animate-spin text-gray-500" />
          </div>
        ) : allItems.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-8">Sin soluciones registradas</p>
        ) : (
          <div className="overflow-y-auto" style={{ maxHeight: '212px' }}>
            {allItems.map((item, i) => {
              const meta = TYPE_META[item.tipo] || { label: item.tipo, color: '#6b7280', href: '/solutions' }
              const estado = (item as Solucion).estado || ''
              const estadoColor = ESTADO_COLOR[estado] || '#6b7280'
              return (
                <button
                  key={item.id + i}
                  onClick={() => setDetail(item as Solucion)}
                  className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: meta.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-200 truncate">{item.nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-medium" style={{ color: meta.color }}>{meta.label}</span>
                      {estado && (
                        <span className="text-[10px]" style={{ color: estadoColor }}>{estado}</span>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
        </div>

        {/* Iniciativas widget */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
        >
          <div className="px-4 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(234,179,8,0.1)' }}>
            <span className="text-xs font-semibold text-white">Iniciativas</span>
            {iniciativas.length > 0 && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
                {iniciativas.length}
              </span>
            )}
          </div>

          {loadingIniciativas ? (
            <div className="flex justify-center py-6">
              <Loader2 size={16} className="animate-spin text-gray-500" />
            </div>
          ) : iniciativas.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-6">Sin iniciativas registradas</p>
          ) : (
            <div className="overflow-y-auto" style={{ maxHeight: '212px' }}>
              {iniciativas.map(item => {
                const prioColor: Record<string, string> = { ALTA: '#ef4444', MEDIA: '#f97316', BAJA: '#6b7280' }
                const dotColor = prioColor[item.prioridad] || '#eab308'
                return (
                  <Link
                    key={item.id}
                    href="/solutions/iniciativas"
                    className="flex items-start gap-3 px-4 py-2.5 transition-colors"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: dotColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-200 truncate">{item.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.categoria && (
                          <span className="text-[10px] text-gray-500">{item.categoria}</span>
                        )}
                        {item.prioridad && (
                          <span className="text-[10px] font-medium" style={{ color: dotColor }}>{item.prioridad}</span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail popup */}
      {detail && (() => {
        const meta = TYPE_META[detail.tipo] || { label: detail.tipo, color: '#6b7280', href: '/solutions' }
        const estadoColor = ESTADO_COLOR[detail.estado] || '#6b7280'
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) setDetail(null) }}
          >
            <div
              className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {/* Header strip */}
              <div className="px-5 py-4 flex items-start justify-between"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: meta.color + '11' }}>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: meta.color }}>{meta.label}</p>
                  <h2 className="text-sm font-semibold text-white leading-snug">{detail.nombre}</h2>
                </div>
                <button onClick={() => setDetail(null)} className="text-gray-500 hover:text-gray-300 ml-3 flex-shrink-0 mt-0.5">
                  <X size={15} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Estado + valor */}
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background: estadoColor + '22', color: estadoColor, border: `1px solid ${estadoColor}44` }}>
                    {detail.estado}
                  </span>
                  {detail.valorEstimado > 0 && (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <DollarSign size={11} />
                      {detail.valorEstimado.toLocaleString()} USD
                    </span>
                  )}
                </div>

                {/* Descripcion */}
                {detail.descripcion && (
                  <p className="text-xs text-gray-300 leading-relaxed">{detail.descripcion}</p>
                )}

                {/* Meta rows */}
                <div className="space-y-2">
                  {detail.lead && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <User size={12} className="flex-shrink-0 text-gray-600" />
                      <span>{detail.lead.companyName}</span>
                      {detail.lead.contactName && <span className="text-gray-600">· {detail.lead.contactName}</span>}
                    </div>
                  )}
                  {detail.repositorio && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Tag size={12} className="flex-shrink-0 text-gray-600" />
                      <a href={detail.repositorio} target="_blank" rel="noopener noreferrer"
                        className="truncate hover:text-white transition-colors" style={{ color: meta.color }}>
                        {detail.repositorio}
                      </a>
                    </div>
                  )}
                  {detail.createdAt && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar size={12} className="flex-shrink-0 text-gray-600" />
                      {new Date(detail.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setDetail(null)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-400"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    Cerrar
                  </button>
                  <Link
                    href={meta.href}
                    onClick={() => setDetail(null)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white"
                    style={{ background: meta.color }}
                  >
                    <ExternalLink size={11} />
                    Ver {meta.label}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-white">Nueva solución</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nombre *</label>
                <input
                  style={inputStyle}
                  placeholder="Ej: Agente de cotizaciones"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                  <select
                    style={selectStyle}
                    value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  >
                    <option value="PROJECT">Project</option>
                    <option value="DEMO">Pilot</option>
                    <option value="PARTNERSHIP">Partnership</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Estado</label>
                  <select
                    style={inputStyle}
                    value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                  >
                    <option value="ACTIVO">Activo</option>
                    <option value="INACTIVO">Inactivo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Descripcion</label>
                <textarea
                  style={{ ...inputStyle, resize: 'none' }}
                  rows={3}
                  placeholder="Breve descripcion de la solución..."
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Valor estimado (USD)</label>
                <input
                  style={inputStyle}
                  type="number"
                  placeholder="0"
                  value={form.valorEstimado}
                  onChange={e => setForm(f => ({ ...f, valorEstimado: e.target.value }))}
                />
              </div>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-400 transition-colors"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold text-white transition-opacity disabled:opacity-50"
                  style={{ background: '#f97316' }}
                >
                  {saving ? 'Guardando...' : 'Crear solución'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
