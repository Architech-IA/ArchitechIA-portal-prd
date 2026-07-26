'use client'

import { useState, useEffect } from 'react'
import { usePageActions } from '@/lib/pageActionsContext'
import { Layers, ExternalLink, Loader2, Rocket, Map as MapIcon, FolderKanban, FlaskConical, Handshake, Building2, Package, ChevronDown } from 'lucide-react'
import Link from 'next/link'

interface Sprint {
  id: string
  name: string
  status: string
  _count: { items: number }
}

interface Epic {
  id: string
  name: string
  description: string | null
  status: string
  priority: string
  color: string
  sprints: Sprint[]
  _count: { sprints: number }
}

interface Solucion {
  id: string
  solucionCode: string | null
  nombre: string
  descripcion: string | null
  tipo: string
  estado: string
  epics: Epic[]
}

const TIPO_COLOR: Record<string, string> = {
  PROJECT:     '#3b82f6',
  DEMO:        '#f59e0b',
  PARTNERSHIP: '#1D9375',
  PRODUCT:     '#7F77DD',
  INTERN:      '#9aa6b8',
}

const TIPO_LABEL: Record<string, string> = {
  PROJECT:     'Project',
  DEMO:        'Pilot',
  PARTNERSHIP: 'Partnership',
  PRODUCT:     'Product',
  INTERN:      'Intern',
}

const TIPO_ICON: Record<string, React.ElementType> = {
  PROJECT: FolderKanban, DEMO: FlaskConical, PARTNERSHIP: Handshake, PRODUCT: Package, INTERN: Building2
}

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: '#f87171', HIGH: '#fb923c', MEDIUM: '#fbbf24', LOW: '#9aa6b8',
}
const PRIORITY_LABEL: Record<string, string> = {
  CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja',
}

const SPRINT_STATUS: Record<string, { label: string; color: string }> = {
  PLANNED:     { label: 'Planificado', color: '#4b5563' },
  IN_PROGRESS: { label: 'En progreso', color: '#3b82f6' },
  DONE:        { label: 'Completado',  color: '#34d399' },
  COMPLETED:   { label: 'Completado',  color: '#34d399' },
  CANCELLED:   { label: 'Cancelado',   color: '#f87171' },
}

const EPIC_STATUS: Record<string, { label: string; color: string }> = {
  ACTIVE:    { label: 'Activa',    color: '#34d399' },
  COMPLETED: { label: 'Completa',  color: '#7F77DD' },
  ARCHIVED:  { label: 'Archivada', color: '#4b5563' },
}

export default function SolutionPage() {
  const [soluciones, setSoluciones] = useState<Solucion[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const { setActions } = usePageActions()

  useEffect(() => {
    fetch('/api/backlog/solution')
      .then(r => r.json())
      .then(data => { setSoluciones(data); setLoading(false) })
  }, [])

  useEffect(() => {
    setActions(
      <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/backlog" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.08)'; (e.currentTarget as HTMLElement).style.color = '#d1d5db' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          Backlog
        </Link>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }}/>
        <Link href="/backlog" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.08)'; (e.currentTarget as HTMLElement).style.color = '#93c5fd' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          <Rocket size={10}/> Sprints
        </Link>
        <Link href="/backlog/epics" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(29,147,117,0.08)'; (e.currentTarget as HTMLElement).style.color = '#1D9375' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          <Layers size={10}/> Epicas
        </Link>
        <Link href="/backlog/solution" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1"
          style={{ background: 'rgba(127,119,221,0.2)', color: '#7F77DD', border: '1px solid rgba(127,119,221,0.3)' }}>
          <MapIcon size={10}/> Solution
        </Link>
      </div>
    )
    return () => setActions(null)
  }, [])

  const toggleExpand = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  return (
    <div className="flex flex-col h-full overflow-auto p-6" style={{ background: '#080c12' }}>
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 size={22} className="animate-spin" style={{ color: 'rgba(255,255,255,0.15)' }}/>
        </div>
      ) : soluciones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <MapIcon size={40} style={{ color: 'rgba(255,255,255,0.08)', marginBottom: 16 }}/>
          <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>Sin solutions</p>
          <p className="text-xs mt-1 mb-5" style={{ color: 'rgba(255,255,255,0.12)' }}>Crea una solution desde el módulo de Solutions</p>
          <Link href="/solutions" className="px-4 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-2"
            style={{ background: '#7F77DD' }}>
            <ExternalLink size={12}/> Ir a Solutions
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {soluciones.map(sol => {
            const isExp = expanded[sol.id] === true
            const color = TIPO_COLOR[sol.tipo] || '#7F77DD'
            const Icon = TIPO_ICON[sol.tipo] || Package
            const doneEpics = sol.epics.filter(e => e.status === 'COMPLETED').length
            const pct = sol.epics.length > 0 ? Math.round((doneEpics / sol.epics.length) * 100) : 0

            return (
              <div key={sol.id}
                className="rounded-2xl overflow-hidden transition-all duration-200"
                style={{
                  border: isExp ? `1px solid ${color}30` : '1px solid rgba(255,255,255,0.07)',
                  background: '#0c1118',
                  boxShadow: isExp ? `0 0 0 1px ${color}15, 0 4px 24px rgba(0,0,0,0.3)` : '0 1px 3px rgba(0,0,0,0.2)',
                }}>

                {/* Solution row */}
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 text-left transition-colors duration-150"
                  style={{ cursor: 'pointer', background: 'transparent' }}
                  onClick={() => toggleExpand(sol.id)}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>

                  {/* Icon */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                    style={{ background: `${color}18`, border: `1px solid ${color}35` }}>
                    <Icon size={15} style={{ color }}/>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[13px] font-semibold text-white leading-snug">{sol.nombre}</span>
                      {sol.solucionCode && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md"
                          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          {sol.solucionCode}
                        </span>
                      )}
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ color, background: `${color}15`, border: `1px solid ${color}25` }}>
                        {TIPO_LABEL[sol.tipo] || sol.tipo}
                      </span>
                      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        {sol.epics.length} {sol.epics.length === 1 ? 'épica' : 'épicas'}
                      </span>
                    </div>
                    {sol.descripcion && (
                      <p className="text-xs leading-relaxed truncate" style={{ color: 'rgba(255,255,255,0.28)' }}>
                        {sol.descripcion}
                      </p>
                    )}
                  </div>

                  {/* Right: progress + chevron */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-[11px] tabular-nums font-medium" style={{ color: pct > 0 ? color : 'rgba(255,255,255,0.2)' }}>
                        {pct}%
                      </span>
                      <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}aa, ${color})` }}/>
                      </div>
                    </div>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <ChevronDown size={13} className={`transition-transform duration-200 ${isExp ? 'rotate-180' : ''}`}
                        style={{ color: 'rgba(255,255,255,0.3)' }}/>
                    </div>
                  </div>
                </button>

                {/* Expanded: epics */}
                {isExp && (
                  <div style={{ borderTop: `1px solid ${color}18`, background: 'rgba(0,0,0,0.15)' }}>
                    {sol.epics.length === 0 ? (
                      <div className="flex flex-col items-center py-10 gap-2">
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
                          Sin épicas — <Link href="/backlog/epics" className="underline underline-offset-2 transition-colors" style={{ color: '#7F77DD' }}>crear épica</Link> y asignarla a esta solution
                        </p>
                      </div>
                    ) : (
                      <div className="px-5 py-4 space-y-2">
                        {sol.epics.map(epic => {
                          const doneSprints = epic.sprints.filter(s => s.status === 'DONE' || s.status === 'COMPLETED').length
                          const epicPct = epic.sprints.length > 0 ? Math.round((doneSprints / epic.sprints.length) * 100) : 0
                          const statusInfo = EPIC_STATUS[epic.status] || EPIC_STATUS.ACTIVE

                          return (
                            <div key={epic.id} className="rounded-xl p-3.5"
                              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <div className="flex items-start gap-3">
                                {/* Epic color bar */}
                                <div className="w-[3px] self-stretch rounded-full flex-shrink-0"
                                  style={{ background: epic.color, minHeight: 20 }}/>

                                <div className="flex-1 min-w-0">
                                  {/* Epic header */}
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-[13px] font-semibold text-white">{epic.name}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                      style={{ color: statusInfo.color, background: `${statusInfo.color}15`, border: `1px solid ${statusInfo.color}25` }}>
                                      {statusInfo.label}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                                      style={{ color: PRIORITY_COLOR[epic.priority], background: `${PRIORITY_COLOR[epic.priority]}15` }}>
                                      {PRIORITY_LABEL[epic.priority]}
                                    </span>
                                  </div>

                                  {epic.description && (
                                    <p className="text-xs mb-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.28)' }}>
                                      {epic.description}
                                    </p>
                                  )}

                                  {/* Sprint pills */}
                                  {epic.sprints.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                      {epic.sprints.map(sp => {
                                        const spInfo = SPRINT_STATUS[sp.status] || SPRINT_STATUS.PLANNED
                                        return (
                                          <span key={sp.id} className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg"
                                            style={{ background: `${spInfo.color}12`, border: `1px solid ${spInfo.color}25`, color: 'rgba(255,255,255,0.5)' }}>
                                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: spInfo.color }}/>
                                            <span className="truncate max-w-[130px]">{sp.name}</span>
                                            <span style={{ color: 'rgba(255,255,255,0.25)' }}>{sp._count.items}</span>
                                          </span>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>

                                {/* Epic progress */}
                                <div className="flex-shrink-0 text-right min-w-[52px]">
                                  <span className="text-[11px] font-medium tabular-nums" style={{ color: epicPct > 0 ? epic.color : 'rgba(255,255,255,0.2)' }}>
                                    {epicPct}%
                                  </span>
                                  <div className="w-12 h-1 rounded-full mt-1 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                                    <div className="h-full rounded-full" style={{ width: `${epicPct}%`, background: epic.color }}/>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <div className="px-5 pb-3 pt-1">
                      <Link href="/backlog/epics"
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium transition-colors"
                        style={{ color: 'rgba(255,255,255,0.2)' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#7F77DD'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.2)'}>
                        <Layers size={11}/> Gestionar épicas
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
