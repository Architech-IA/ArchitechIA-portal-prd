'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Package, FolderKanban, FlaskConical, Handshake, Building2, Lightbulb, ArrowRight } from 'lucide-react'

interface SectionStat {
  count: number | null
  loading: boolean
}

const SECTIONS = [
  {
    href: '/solutions/productos',
    label: 'Productos',
    icon: Package,
    color: '#f97316',
    bg: 'rgba(249,115,22,0.08)',
    border: 'rgba(249,115,22,0.2)',
    desc: 'Soluciones tecnológicas desarrolladas por ArchiTechIA para el mercado.',
    api: '/api/productos',
    countKey: 'length',
  },
  {
    href: '/solutions/projects',
    label: 'Projects',
    icon: FolderKanban,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.08)',
    border: 'rgba(59,130,246,0.2)',
    desc: 'Proyectos tecnológicos completos con IA y automatización para clientes.',
    api: null,
    countKey: null,
  },
  {
    href: '/solutions/pilots',
    label: 'Pilots',
    icon: FlaskConical,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.08)',
    border: 'rgba(139,92,246,0.2)',
    desc: 'Pruebas de concepto para validar tecnología antes de escalar.',
    api: '/api/soluciones?tipo=pilots',
    countKey: 'length',
  },
  {
    href: '/solutions/partnership',
    label: 'Partnership',
    icon: Handshake,
    color: '#10b981',
    bg: 'rgba(16,185,129,0.08)',
    border: 'rgba(16,185,129,0.2)',
    desc: 'Alianzas estratégicas para co-crear soluciones y productos.',
    api: '/api/soluciones?tipo=partnership',
    countKey: 'length',
  },
  {
    href: '/solutions/intern',
    label: 'Intern',
    icon: Building2,
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.08)',
    border: 'rgba(6,182,212,0.2)',
    desc: 'Soluciones internas, herramientas y plataformas de ArchiTechIA.',
    api: '/api/soluciones?tipo=intern',
    countKey: 'length',
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
    countKey: 'length',
  },
]

export default function SolutionsHome() {
  const [stats, setStats] = useState<Record<string, SectionStat>>(
    Object.fromEntries(SECTIONS.map(s => [s.href, { count: null, loading: !!s.api }]))
  )

  useEffect(() => {
    SECTIONS.forEach(s => {
      if (!s.api) return
      fetch(s.api)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          const count = Array.isArray(d) ? d.length : null
          setStats(prev => ({ ...prev, [s.href]: { count, loading: false } }))
        })
        .catch(() => setStats(prev => ({ ...prev, [s.href]: { count: null, loading: false } })))
    })
  }, [])

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Solutions</h1>
        <p className="text-sm text-gray-400">Portafolio de soluciones, proyectos y alianzas de ArchiTechIA.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.map(s => {
          const Icon = s.icon
          const stat = stats[s.href]
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group block rounded-xl p-5 transition-all duration-200"
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLElement).style.background = s.bg.replace('0.08', '0.13')
                ;(e.currentTarget as HTMLElement).style.borderColor = s.color + '55'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLElement).style.background = s.bg
                ;(e.currentTarget as HTMLElement).style.borderColor = s.border
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: s.color + '22', border: `1px solid ${s.color}33` }}
                >
                  <Icon size={18} style={{ color: s.color }} />
                </div>
                {stat && !stat.loading && stat.count !== null && (
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: s.color + '22', color: s.color }}
                  >
                    {stat.count}
                  </span>
                )}
                {stat?.loading && (
                  <span className="text-xs text-gray-600 animate-pulse">...</span>
                )}
              </div>

              <h3 className="text-sm font-semibold text-white mb-1">{s.label}</h3>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">{s.desc}</p>

              <div
                className="flex items-center gap-1 text-xs font-medium transition-colors"
                style={{ color: s.color + 'cc' }}
              >
                Ver {s.label}
                <ArrowRight size={11} className="group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
