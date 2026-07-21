'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, FolderKanban, FlaskConical, Handshake, Building2, Lightbulb, ArrowRight, Loader2 } from 'lucide-react'

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

export default function SolutionsHome() {
  const [counts, setCounts] = useState<Record<string, number | null>>({})
  const [allItems, setAllItems] = useState<Array<(Solucion | Producto) & { tipo: string }>>([])
  const [loadingList, setLoadingList] = useState(true)

  useEffect(() => {
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
  }, [])

  return (
    <div className="p-6 md:p-8 flex gap-6 items-start">
      {/* Left: section cards */}
      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white mb-1">Solutions</h1>
          <p className="text-sm text-gray-400">Portafolio de soluciones, proyectos y alianzas de ArchiTechIA.</p>
        </div>

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
      </div>

      {/* Right: all solutions widget */}
      <div
        className="w-72 flex-shrink-0 rounded-xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
      >
        <div className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="text-xs font-semibold text-white">Todas las soluciones</span>
          {allItems.length > 0 && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af' }}>
              {allItems.length}
            </span>
          )}
        </div>

        {loadingList ? (
          <div className="flex justify-center py-8">
            <Loader2 size={16} className="animate-spin text-gray-500" />
          </div>
        ) : allItems.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-8">Sin soluciones registradas</p>
        ) : (
          <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
            {allItems.map((item, i) => {
              const meta = TYPE_META[item.tipo] || { label: item.tipo, color: '#6b7280', href: '/solutions' }
              const estado = (item as Solucion).estado || ''
              const estadoColor = ESTADO_COLOR[estado] || '#6b7280'
              return (
                <Link
                  key={item.id + i}
                  href={meta.href}
                  className="flex items-start gap-3 px-4 py-2.5 transition-colors"
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
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
