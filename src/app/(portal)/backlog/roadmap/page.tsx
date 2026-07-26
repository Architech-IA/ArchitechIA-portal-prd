'use client'

import { useState, useEffect } from 'react'
import { Plus, Map, Layers, ChevronRight, Calendar, X, Loader2, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface Sprint {
  id: string
  name: string
  status: string
  startDate: string | null
  endDate: string | null
  _count: { items: number }
}

interface Epic {
  id: string
  name: string
  description: string | null
  status: string
  priority: string
  color: string
  startDate: string | null
  endDate: string | null
  roadmapId: string | null
  sprints: Sprint[]
  _count: { sprints: number }
}

interface Roadmap {
  id: string
  name: string
  description: string | null
  quarter: string | null
  year: number | null
  status: string
  color: string
  epics: Epic[]
}

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: '#f87171',
  HIGH: '#fb923c',
  MEDIUM: '#fbbf24',
  LOW: '#9aa6b8',
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

const EMPTY_ROADMAP = { name: '', description: '', quarter: '', year: new Date().getFullYear(), color: '#7F77DD' }

function RoadmapModal({ initial, onSave, onClose }: {
  initial?: Partial<typeof EMPTY_ROADMAP & { id: string }>
  onSave: (data: typeof EMPTY_ROADMAP & { id?: string }) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({ ...EMPTY_ROADMAP, ...initial })
  const [saving, setSaving] = useState(false)

  const handle = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await onSave(form as typeof EMPTY_ROADMAP & { id?: string })
    setSaving(false)
  }

  const COLORS = ['#7F77DD', '#1D9375', '#E2562A', '#C0655A', '#3A9E42', '#3b82f6', '#f59e0b', '#8b5cf6']

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0e1420] border border-white/10 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-white">{initial?.id ? 'Editar Solution' : 'Nueva Solution'}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors"><X size={18}/></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Nombre *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
              placeholder="ej: Solution Q3 2026"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Quarter</label>
              <input value={form.quarter} onChange={e => setForm(f => ({ ...f, quarter: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
                placeholder="Q3 2026"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Año</label>
              <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: Number(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Descripción</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 resize-none"
              placeholder="Objetivo de la solution…"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{ background: c, outline: form.color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}/>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-white/10 text-sm text-white/50 hover:text-white/70 transition-colors">Cancelar</button>
          <button onClick={handle} disabled={saving || !form.name.trim()}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: form.color }}>
            {saving ? <Loader2 size={14} className="animate-spin"/> : null}
            {initial?.id ? 'Guardar' : 'Crear Solution'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RoadmapPage() {
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Roadmap | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/backlog/roadmap')
    setRoadmaps(await r.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async (data: typeof EMPTY_ROADMAP & { id?: string }) => {
    const method = data.id ? 'PUT' : 'POST'
    await fetch('/api/backlog/roadmap', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    setShowModal(false)
    setEditing(null)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta solution? Las épicas quedarán sin solution.')) return
    await fetch(`/api/backlog/roadmap?id=${id}`, { method: 'DELETE' })
    load()
  }

  const toggleExpand = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const totalEpics = roadmaps.reduce((a, r) => a + r.epics.length, 0)
  const totalSprints = roadmaps.reduce((a, r) => a + r.epics.reduce((b, e) => b + e.sprints.length, 0), 0)

  return (
    <div className="min-h-screen bg-[#080c12] text-white p-6 font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#7F77DD]/10 border border-[#7F77DD]/20 flex items-center justify-center flex-shrink-0">
            <Map size={18} className="text-[#7F77DD]"/>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Solution</h1>
            <p className="text-xs text-white/30 mt-0.5">{roadmaps.length} solutions · {totalEpics} épicas · {totalSprints} sprints</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/backlog" className="px-3 py-2 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white/70 transition-colors flex items-center gap-1.5">
            <Layers size={12}/> Backlog
          </Link>
          <Link href="/backlog/epics" className="px-3 py-2 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white/70 transition-colors flex items-center gap-1.5">
            <Layers size={12}/> Épicas
          </Link>
          <button onClick={() => setShowModal(true)}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 bg-[#7F77DD]/80 hover:bg-[#7F77DD] transition-colors">
            <Plus size={13}/> Nueva Solution
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-white/20"/>
        </div>
      ) : roadmaps.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Map size={48} className="text-white/10 mb-4"/>
          <p className="text-white/30 text-sm font-medium">No hay solutions todavía</p>
          <p className="text-white/15 text-xs mt-1">Creá la primera solution para organizar las épicas por quarter</p>
          <button onClick={() => setShowModal(true)} className="mt-6 px-4 py-2 rounded-lg bg-[#7F77DD]/80 hover:bg-[#7F77DD] text-sm font-semibold text-white transition-colors flex items-center gap-2">
            <Plus size={14}/> Crear primera Solution
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {roadmaps.map(rm => {
            const isExp = expanded[rm.id] !== false
            const doneEpics = rm.epics.filter(e => e.status === 'COMPLETED').length
            const pct = rm.epics.length > 0 ? Math.round((doneEpics / rm.epics.length) * 100) : 0

            return (
              <div key={rm.id} className="rounded-2xl border border-white/8 bg-[#0c1118] overflow-hidden">
                {/* Roadmap header */}
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none" onClick={() => toggleExpand(rm.id)}>
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: rm.color }}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-sm font-bold text-white">{rm.name}</h2>
                      {rm.quarter && (
                        <span className="text-xs px-2 py-0.5 rounded-full border font-semibold" style={{ color: rm.color, borderColor: `${rm.color}30`, background: `${rm.color}10` }}>
                          {rm.quarter}
                        </span>
                      )}
                      <span className="text-xs text-white/25">{rm.epics.length} épicas</span>
                    </div>
                    {rm.description && <p className="text-xs text-white/35 mt-0.5 truncate">{rm.description}</p>}
                  </div>
                  {/* Progress bar */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="w-24 h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: rm.color }}/>
                    </div>
                    <span className="text-xs text-white/30 w-8 text-right tabular-nums">{pct}%</span>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <button onClick={e => { e.stopPropagation(); setEditing(rm); setShowModal(true) }}
                      className="p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-white/60 transition-colors">
                      <Pencil size={13}/>
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(rm.id) }}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors">
                      <Trash2 size={13}/>
                    </button>
                    <ChevronRight size={15} className={`text-white/25 transition-transform ${isExp ? 'rotate-90' : ''}`}/>
                  </div>
                </div>

                {/* Epics */}
                {isExp && (
                  <div className="border-t border-white/6 px-5 py-4">
                    {rm.epics.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-xs text-white/20">Sin épicas — <Link href="/backlog/epics" className="text-[#7F77DD] hover:underline">crear épica</Link> y asignarla a este roadmap</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {rm.epics.map(epic => {
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

                                  {/* Sprints */}
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
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                  <div className="text-right">
                                    <div className="text-xs text-white/25 tabular-nums">{epicPct}%</div>
                                    <div className="w-16 h-1 bg-white/8 rounded-full mt-1 overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width: `${epicPct}%`, background: epic.color }}/>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <Link href="/backlog/epics" className="text-xs text-white/25 hover:text-[#7F77DD] transition-colors flex items-center gap-1">
                        <Plus size={11}/> Gestionar épicas
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <RoadmapModal
          initial={editing ? { id: editing.id, name: editing.name, description: editing.description || '', quarter: editing.quarter || '', year: editing.year || new Date().getFullYear(), color: editing.color } : undefined}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
