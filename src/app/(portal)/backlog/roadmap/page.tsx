'use client'

import { useState, useEffect } from 'react'
import { usePageActions } from '@/lib/pageActionsContext'
import { Layers, ChevronRight, ExternalLink, Loader2, Rocket, Map as MapIcon } from 'lucide-react'
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
  PROJECT:     'Proyecto',
  DEMO:        'Demo',
  PARTNERSHIP: 'Partnership',
  PRODUCT:     'Producto',
  INTERN:      'Interno',
}

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: '#f87171',
  HIGH:     '#fb923c',
  MEDIUM:   '#fbbf24',
  LOW:      '#9aa6b8',
}

const SPRINT_STATUS: Record<string, { label: string; color: string }> = {
  PLANNED:     { label: 'Planificado', color: '#3d4e62' },
  IN_PROGRESS: { label: 'En progreso', color: '#3b82f6' },
  DONE:        { label: 'Completado',  color: '#34d399' },
  CANCELLED:   { label: 'Cancelado',  color: '#f87171' },
}

const EPIC_STATUS: Record<string, { label: string; dot: string }> = {
  ACTIVE:    { label: 'Activa',    dot: '#34d399' },
  COMPLETED: { label: 'Completa',  dot: '#7F77DD' },
  ARCHIVED:  { label: 'Archivada', dot: '#3d4e62' },
}

export default function SolutionPage() {
  const [soluciones, setSoluciones] = useState<Solucion[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetch('/api/backlog/roadmap')
      .then(r => r.json())
      .then(data => { setSoluciones(data); setLoading(false) })
  }, [])

  const { setActions } = usePageActions()

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
        <Link href="/backlog/roadmap" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1"
          style={{ background: 'rgba(127,119,221,0.2)', color: '#7F77DD', border: '1px solid rgba(127,119,221,0.3)' }}>
          <MapIcon size={10}/> Solution
        </Link>
      </div>
    )
    return () => setActions(null)
  }, [])

  const toggleExpand = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const totalEpics = soluciones.reduce((a, s) => a + s.epics.length, 0)
  const totalSprints = soluciones.reduce((a, s) => a + s.epics.reduce((b, e) => b + e.sprints.length, 0), 0)

  return (
    <div className="min-h-screen bg-[#080c12] text-white p-6 font-sans">


      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-white/20"/>
        </div>
      ) : soluciones.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Layers size={48} className="text-white/10 mb-4"/>
          <p className="text-white/30 text-sm font-medium">No hay solutions todavia</p>
          <p className="text-white/15 text-xs mt-1">Crea una solution desde el modulo de Solutions</p>
          <Link href="/solutions" className="mt-6 px-4 py-2 rounded-lg bg-[#7F77DD]/80 hover:bg-[#7F77DD] text-sm font-semibold text-white transition-colors flex items-center gap-2">
            <ExternalLink size={14}/> Ir a Solutions
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {soluciones.map(sol => {
            const isExp = expanded[sol.id] !== false
            const color = TIPO_COLOR[sol.tipo] || '#7F77DD'
            const doneEpics = sol.epics.filter(e => e.status === 'COMPLETED').length
            const pct = sol.epics.length > 0 ? Math.round((doneEpics / sol.epics.length) * 100) : 0

            return (
              <div key={sol.id} className="rounded-2xl border border-white/8 bg-[#0c1118] overflow-hidden">
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none" onClick={() => toggleExpand(sol.id)}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-sm font-bold text-white">{sol.nombre}</h2>
                      {sol.solucionCode && (
                        <span className="text-xs px-2 py-0.5 rounded-full border font-mono font-semibold" style={{ color, borderColor: `${color}30`, background: `${color}10` }}>
                          {sol.solucionCode}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full border font-semibold" style={{ color, borderColor: `${color}20`, background: `${color}08` }}>
                        {TIPO_LABEL[sol.tipo] || sol.tipo}
                      </span>
                      <span className="text-xs text-white/25">{sol.epics.length} epicas</span>
                    </div>
                    {sol.descripcion && <p className="text-xs text-white/35 mt-0.5 truncate">{sol.descripcion}</p>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="w-24 h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }}/>
                    </div>
                    <span className="text-xs text-white/30 w-8 text-right tabular-nums">{pct}%</span>
                  </div>
                  <ChevronRight size={15} className={`text-white/25 transition-transform ml-2 ${isExp ? 'rotate-90' : ''}`}/>
                </div>

                {isExp && (
                  <div className="border-t border-white/6 px-5 py-4">
                    {sol.epics.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-xs text-white/20">Sin epicas - <Link href="/backlog/epics" className="text-[#7F77DD] hover:underline">crear epica</Link> y asignarla a esta solution</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sol.epics.map(epic => {
                          const doneSprints = epic.sprints.filter(s => s.status === 'DONE' || s.status === 'COMPLETED').length
                          const epicPct = epic.sprints.length > 0 ? Math.round((doneSprints / epic.sprints.length) * 100) : 0
                          const statusInfo = EPIC_STATUS[epic.status] || EPIC_STATUS.ACTIVE

                          return (
                            <div key={epic.id} className="rounded-xl border border-white/6 bg-[#080d14] p-4">
                              <div className="flex items-start gap-3">
                                <div className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ background: epic.color }}/>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-sm font-semibold text-white">{epic.name}</span>
                                    <span className="flex items-center gap-1 text-xs text-white/30">
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusInfo.dot }}/>
                                      {statusInfo.label}
                                    </span>
                                    <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ color: PRIORITY_COLOR[epic.priority], background: `${PRIORITY_COLOR[epic.priority]}15` }}>
                                      {epic.priority}
                                    </span>
                                  </div>
                                  {epic.description && <p className="text-xs text-white/30 mb-2">{epic.description}</p>}
                                  {epic.sprints.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                      {epic.sprints.map(sp => {
                                        const spInfo = SPRINT_STATUS[sp.status] || SPRINT_STATUS.PLANNED
                                        return (
                                          <div key={sp.id} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-white/8 bg-white/3">
                                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: spInfo.color }}/>
                                            <span className="text-white/60 truncate max-w-[140px]">{sp.name}</span>
                                            <span className="text-white/25">{sp._count.items}</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-shrink-0 ml-2 text-right">
                                  <div className="text-xs text-white/25 tabular-nums">{epicPct}%</div>
                                  <div className="w-16 h-1 bg-white/8 rounded-full mt-1 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${epicPct}%`, background: epic.color }}/>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <Link href="/backlog/epics" className="text-xs text-white/25 hover:text-[#7F77DD] transition-colors flex items-center gap-1.5">
                        <Layers size={11}/> Gestionar epicas
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
