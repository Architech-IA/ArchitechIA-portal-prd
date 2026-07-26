'use client'

import { useState, useEffect } from 'react'
import { Plus, Layers, Map, X, Loader2, Pencil, Trash2, ChevronRight, Rocket } from 'lucide-react'
import Link from 'next/link'

interface Sprint {
  id: string
  name: string
  status: string
  startDate: string | null
  endDate: string | null
  _count: { items: number }
  items: { status: string }[]
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
  solucion: { id: string; nombre: string } | null
  sprints: Sprint[]
  _count: { sprints: number }
}

interface Solucion { id: string; nombre: string }

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#f87171', HIGH: '#fb923c', MEDIUM: '#fbbf24', LOW: '#9aa6b8'
}
const EPIC_STATUSES = ['ACTIVE', 'COMPLETED', 'ARCHIVED']
const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const COLORS = ['#7F77DD', '#1D9375', '#E2562A', '#C0655A', '#3A9E42', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']

const SPRINT_STATUS_COLOR: Record<string, string> = {
  PLANNED: '#3d4e62', IN_PROGRESS: '#3b82f6', DONE: '#34d399', COMPLETED: '#34d399', CANCELLED: '#f87171'
}

const EMPTY_FORM = { name: '', description: '', status: 'ACTIVE', priority: 'MEDIUM', color: '#7F77DD', startDate: '', endDate: '', solucionId: '' }

function EpicModal({ initial, soluciones, onSave, onClose }: {
  initial?: Partial<typeof EMPTY_FORM & { id: string }>
  soluciones: Solucion[]
  onSave: (data: typeof EMPTY_FORM & { id?: string }) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial })
  const [saving, setSaving] = useState(false)

  const handle = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await onSave(form as typeof EMPTY_FORM & { id?: string })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0e1420] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-white">{initial?.id ? 'Editar Épica' : 'Nueva Épica'}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 transition-colors"><X size={18}/></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Nombre *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30"
              placeholder="ej: Council con capacidades de voz"/>
          </div>
          <div>
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Descripción</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/30 resize-none"
              placeholder="Objetivo de la épica…"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Estado</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30">
                {EPIC_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Prioridad</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30">
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Fecha inicio</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"/>
            </div>
            <div>
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Fecha fin</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Solution</label>
            <select value={form.solucionId} onChange={e => setForm(f => ({ ...f, solucionId: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/30">
              <option value="">Sin solution</option>
              {soluciones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
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
            {saving && <Loader2 size={14} className="animate-spin"/>}
            {initial?.id ? 'Guardar' : 'Crear Épica'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EpicsPage() {
  const [epics, setEpics] = useState<Epic[]>([])
  const [soluciones, setSoluciones] = useState<Solucion[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Epic | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [filterStatus, setFilterStatus] = useState('ALL')

  const load = async () => {
    setLoading(true)
    const [epicsRes, solRes] = await Promise.all([
      fetch('/api/backlog/epics'),
      fetch('/api/soluciones'),
    ])
    setEpics(await epicsRes.json())
    if (solRes.ok) setSoluciones(await solRes.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async (data: typeof EMPTY_FORM & { id?: string }) => {
    const method = data.id ? 'PUT' : 'POST'
    await fetch('/api/backlog/epics', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    setShowModal(false)
    setEditing(null)
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta épica? Los sprints asociados quedarán sin épica.')) return
    await fetch(`/api/backlog/epics?id=${id}`, { method: 'DELETE' })
    load()
  }

  const toggleExpand = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const filtered = filterStatus === 'ALL' ? epics : epics.filter(e => e.status === filterStatus)

  const getEpicProgress = (epic: Epic) => {
    if (epic.sprints.length === 0) return 0
    const total = epic.sprints.reduce((a, s) => a + s.items.length, 0)
    const done = epic.sprints.reduce((a, s) => a + s.items.filter(i => i.status === 'DONE').length, 0)
    return total > 0 ? Math.round((done / total) * 100) : 0
  }

  return (
    <div className="min-h-screen bg-[#080c12] text-white p-6 font-sans">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#1D9375]/10 border border-[#1D9375]/20 flex items-center justify-center flex-shrink-0">
            <Layers size={18} className="text-[#1D9375]"/>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Épicas</h1>
            <p className="text-xs text-white/30 mt-0.5">{epics.length} épicas · {epics.reduce((a, e) => a + e._count.sprints, 0)} sprints</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/backlog" className="px-3 py-2 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white/70 transition-colors flex items-center gap-1.5">
            <Rocket size={12}/> Backlog
          </Link>
          <Link href="/backlog/roadmap" className="px-3 py-2 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white/70 transition-colors flex items-center gap-1.5">
            <Map size={12}/> Solution
          </Link>
          <button onClick={() => setShowModal(true)}
            className="px-3 py-2 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 bg-[#1D9375]/80 hover:bg-[#1D9375] transition-colors">
            <Plus size={13}/> Nueva Épica
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {['ALL', ...EPIC_STATUSES].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filterStatus === s ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/60'}`}>
            {s === 'ALL' ? 'Todas' : s === 'ACTIVE' ? 'Activas' : s === 'COMPLETED' ? 'Completadas' : 'Archivadas'}
            <span className="ml-1.5 text-white/30">{s === 'ALL' ? epics.length : epics.filter(e => e.status === s).length}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={24} className="animate-spin text-white/20"/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Layers size={48} className="text-white/10 mb-4"/>
          <p className="text-white/30 text-sm font-medium">No hay épicas</p>
          <p className="text-white/15 text-xs mt-1">Las épicas agrupan sprints relacionados bajo un objetivo común</p>
          <button onClick={() => setShowModal(true)} className="mt-6 px-4 py-2 rounded-lg bg-[#1D9375]/80 hover:bg-[#1D9375] text-sm font-semibold text-white transition-colors flex items-center gap-2">
            <Plus size={14}/> Crear primera Épica
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(epic => {
            const isExp = expanded[epic.id] !== false
            const pct = getEpicProgress(epic)
            const totalItems = epic.sprints.reduce((a, s) => a + s.items.length, 0)
            const doneItems = epic.sprints.reduce((a, s) => a + s.items.filter(i => i.status === 'DONE').length, 0)

            return (
              <div key={epic.id} className="rounded-2xl border border-white/8 bg-[#0c1118] overflow-hidden">
                {/* Epic header */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: epic.color }}/>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(epic.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{epic.name}</span>
                      {epic.solucion && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-white/40">
                          {epic.solucion.nombre}
                        </span>
                      )}
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ color: PRIORITY_COLORS[epic.priority], background: `${PRIORITY_COLORS[epic.priority]}15` }}>
                        {epic.priority}
                      </span>
                      <span className="text-xs text-white/25">{epic._count.sprints} sprints · {totalItems} tareas</span>
                    </div>
                    {epic.description && <p className="text-xs text-white/30 mt-0.5 truncate">{epic.description}</p>}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-xs text-white/25 tabular-nums">{doneItems}/{totalItems}</div>
                      <div className="w-20 h-1.5 bg-white/8 rounded-full mt-1 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: epic.color }}/>
                      </div>
                    </div>
                    <button onClick={() => { setEditing(epic); setShowModal(true) }}
                      className="p-1.5 rounded-lg hover:bg-white/8 text-white/30 hover:text-white/60 transition-colors">
                      <Pencil size={13}/>
                    </button>
                    <button onClick={() => handleDelete(epic.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-white/30 hover:text-red-400 transition-colors">
                      <Trash2 size={13}/>
                    </button>
                    <ChevronRight size={15} className={`text-white/25 transition-transform cursor-pointer ${isExp ? 'rotate-90' : ''}`} onClick={() => toggleExpand(epic.id)}/>
                  </div>
                </div>

                {/* Sprints */}
                {isExp && epic.sprints.length > 0 && (
                  <div className="border-t border-white/6 px-5 py-3">
                    <div className="space-y-2">
                      {epic.sprints.map(sp => {
                        const spDone = sp.items.filter(i => i.status === 'DONE').length
                        const spPct = sp.items.length > 0 ? Math.round((spDone / sp.items.length) * 100) : 0
                        const spColor = SPRINT_STATUS_COLOR[sp.status] || '#3d4e62'

                        return (
                          <div key={sp.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/3 border border-white/5">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: spColor }}/>
                            <span className="text-xs text-white/60 flex-1 truncate">{sp.name}</span>
                            <span className="text-xs text-white/25 tabular-nums">{sp._count.items} items</span>
                            <div className="w-16 h-1 bg-white/8 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${spPct}%`, background: spColor }}/>
                            </div>
                            <span className="text-xs text-white/20 tabular-nums w-8 text-right">{spPct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {isExp && epic.sprints.length === 0 && (
                  <div className="border-t border-white/6 px-5 py-3">
                    <p className="text-xs text-white/20 text-center py-2">Sin sprints asignados a esta épica todavía</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <EpicModal
          initial={editing ? {
            id: editing.id, name: editing.name, description: editing.description || '',
            status: editing.status, priority: editing.priority, color: editing.color,
            startDate: editing.startDate ? editing.startDate.slice(0, 10) : '',
            endDate: editing.endDate ? editing.endDate.slice(0, 10) : '',
            solucionId: editing.solucion?.id || '',
          } : undefined}
          soluciones={soluciones}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
