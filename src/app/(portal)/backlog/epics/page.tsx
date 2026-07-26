'use client'

import { useState, useEffect } from 'react'
import { Plus, Layers, Map, X, Loader2, Pencil, Trash2, ChevronDown, Rocket, Target, Zap } from 'lucide-react'
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
const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja'
}
const EPIC_STATUSES = ['ACTIVE', 'COMPLETED', 'ARCHIVED']
const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const COLORS = ['#7F77DD', '#1D9375', '#E2562A', '#C0655A', '#3A9E42', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string }> = {
  ACTIVE:    { label: 'Activa',     dot: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  COMPLETED: { label: 'Completada', dot: '#7F77DD', bg: 'rgba(127,119,221,0.1)' },
  ARCHIVED:  { label: 'Archivada',  dot: '#4b5563', bg: 'rgba(75,85,99,0.1)' },
}

const SPRINT_STATUS_COLOR: Record<string, string> = {
  PLANNED: '#4b5563', IN_PROGRESS: '#3b82f6', DONE: '#34d399', COMPLETED: '#34d399', CANCELLED: '#f87171'
}
const SPRINT_STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Planificado', IN_PROGRESS: 'En curso', DONE: 'Completado', COMPLETED: 'Completado', CANCELLED: 'Cancelado'
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0e1420] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${form.color}20`, border: `1px solid ${form.color}40` }}>
              <Target size={13} style={{ color: form.color }}/>
            </div>
            <h2 className="text-sm font-bold text-white">{initial?.id ? 'Editar Épica' : 'Nueva Épica'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/8 transition-all"><X size={15}/></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Nombre */}
          <div>
            <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Nombre *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors"
              placeholder="ej: Módulo de autenticación"/>
          </div>

          {/* Status + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Estado</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/25 transition-colors cursor-pointer"
                style={{ colorScheme: 'dark', backgroundColor: '#0e1420' }}>
                {EPIC_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Prioridad</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/25 transition-colors cursor-pointer"
                style={{ colorScheme: 'dark', backgroundColor: '#0e1420' }}>
                {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
          </div>

          {/* Solution */}
          <div>
            <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Solution</label>
            <select value={form.solucionId} onChange={e => setForm(f => ({ ...f, solucionId: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/25 transition-colors cursor-pointer"
              style={{ colorScheme: 'dark', backgroundColor: '#0e1420' }}>
              <option value="">Sin solution</option>
              {soluciones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Inicio</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/25 transition-colors"
                style={{ colorScheme: 'dark' }}/>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Fin</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-white/25 transition-colors"
                style={{ colorScheme: 'dark' }}/>
            </div>
          </div>

          {/* Descripcion */}
          <div>
            <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5 block">Descripción</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors resize-none"
              placeholder="Objetivo de esta épica…"/>
          </div>

          {/* Color */}
          <div>
            <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2 block">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  className="w-7 h-7 rounded-full transition-all hover:scale-110"
                  style={{ background: c, outline: form.color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}/>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white/70 hover:border-white/20 transition-all">Cancelar</button>
          <button onClick={handle} disabled={saving || !form.name.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: form.color }}>
            {saving ? <Loader2 size={13} className="animate-spin"/> : null}
            {initial?.id ? 'Guardar cambios' : 'Crear Épica'}
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
    if (!confirm('Eliminar esta epica? Los sprints asociados quedaran sin epica.')) return
    await fetch(`/api/backlog/epics?id=${id}`, { method: 'DELETE' })
    load()
  }

  const toggleExpand = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const filtered = filterStatus === 'ALL' ? epics : epics.filter(e => e.status === filterStatus)

  const getEpicProgress = (epic: Epic) => {
    const total = epic.sprints.reduce((a, s) => a + s.items.length, 0)
    const done = epic.sprints.reduce((a, s) => a + s.items.filter(i => i.status === 'DONE').length, 0)
    return { pct: total > 0 ? Math.round((done / total) * 100) : 0, done, total }
  }

  const totalSprints = epics.reduce((a, e) => a + e._count.sprints, 0)
  const activeEpics = epics.filter(e => e.status === 'ACTIVE').length

  const FILTER_TABS = [
    { key: 'ALL', label: 'Todas', count: epics.length },
    { key: 'ACTIVE', label: 'Activas', count: epics.filter(e => e.status === 'ACTIVE').length },
    { key: 'COMPLETED', label: 'Completadas', count: epics.filter(e => e.status === 'COMPLETED').length },
    { key: 'ARCHIVED', label: 'Archivadas', count: epics.filter(e => e.status === 'ARCHIVED').length },
  ]

  return (
    <div className="min-h-screen bg-[#080c12] text-white font-sans">
      <div className="max-w-5xl mx-auto p-6">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-[#1D9375]/10 border border-[#1D9375]/20 flex items-center justify-center">
                <Target size={16} className="text-[#1D9375]"/>
              </div>
              <h1 className="text-lg font-bold text-white tracking-tight">Epicas</h1>
            </div>
            {/* Stats row */}
            <div className="flex items-center gap-4 ml-12">
              <span className="text-xs text-white/25 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]"/>
                {activeEpics} activas
              </span>
              <span className="text-xs text-white/25">·</span>
              <span className="text-xs text-white/25">{totalSprints} sprints totales</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/backlog" className="px-3 py-2 rounded-xl border border-white/8 text-xs text-white/40 hover:text-white/60 hover:border-white/15 transition-all flex items-center gap-1.5">
              <Rocket size={11}/> Backlog
            </Link>
            <Link href="/backlog/roadmap" className="px-3 py-2 rounded-xl border border-white/8 text-xs text-white/40 hover:text-white/60 hover:border-white/15 transition-all flex items-center gap-1.5">
              <Layers size={11}/> Solution
            </Link>
            <button onClick={() => { setEditing(null); setShowModal(true) }}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #1D9375, #16a085)' }}>
              <Plus size={13}/> Nueva Epica
            </button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-5 p-1 bg-white/3 rounded-xl border border-white/6 w-fit">
          {FILTER_TABS.map(tab => (
            <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5"
              style={{
                background: filterStatus === tab.key ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: filterStatus === tab.key ? '#fff' : 'rgba(255,255,255,0.3)',
              }}>
              {tab.label}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums"
                style={{ background: filterStatus === tab.key ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)', color: filterStatus === tab.key ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)' }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={22} className="animate-spin text-white/15"/>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/3 border border-white/6 flex items-center justify-center mb-4">
              <Target size={24} className="text-white/15"/>
            </div>
            <p className="text-sm font-semibold text-white/30 mb-1">Sin epicas</p>
            <p className="text-xs text-white/15 max-w-xs">Las epicas agrupan sprints relacionados bajo un objetivo comun</p>
            <button onClick={() => setShowModal(true)} className="mt-6 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #1D9375, #16a085)' }}>
              <Plus size={14}/> Crear primera Epica
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map(epic => {
              const isExp = expanded[epic.id] !== false
              const { pct, done, total } = getEpicProgress(epic)
              const statusCfg = STATUS_CONFIG[epic.status] || STATUS_CONFIG.ACTIVE
              const priorityColor = PRIORITY_COLORS[epic.priority]

              return (
                <div key={epic.id} className="rounded-2xl border border-white/8 bg-[#0c1118] overflow-hidden transition-all hover:border-white/12"
                  style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>

                  {/* Left accent bar + header */}
                  <div className="flex">
                    {/* Accent stripe */}
                    <div className="w-1 flex-shrink-0 rounded-l-2xl" style={{ background: epic.color }}/>

                    <div className="flex-1 px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        {/* Main info */}
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(epic.id)}>
                          {/* Top row: name + badges */}
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-sm font-bold text-white leading-tight">{epic.name}</span>
                            {/* Status badge */}
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold"
                              style={{ background: statusCfg.bg, color: statusCfg.dot, border: `1px solid ${statusCfg.dot}30` }}>
                              <span className="w-1 h-1 rounded-full" style={{ background: statusCfg.dot }}/>
                              {statusCfg.label}
                            </span>
                            {/* Priority badge */}
                            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold tabular-nums"
                              style={{ color: priorityColor, background: `${priorityColor}15` }}>
                              {PRIORITY_LABELS[epic.priority]}
                            </span>
                            {/* Solution badge */}
                            {epic.solucion && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/8 text-white/35 font-medium">
                                {epic.solucion.nombre}
                              </span>
                            )}
                          </div>
                          {/* Description */}
                          {epic.description && (
                            <p className="text-xs text-white/35 truncate mt-0.5 leading-relaxed">{epic.description}</p>
                          )}
                          {/* Meta row */}
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[11px] text-white/20">{epic._count.sprints} sprints</span>
                            <span className="text-white/10">·</span>
                            <span className="text-[11px] text-white/20 tabular-nums">{done}/{total} tareas</span>
                          </div>
                        </div>

                        {/* Progress + actions */}
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {/* Progress ring-style bar */}
                          <div className="text-right">
                            <div className="text-xs font-semibold tabular-nums mb-1" style={{ color: pct === 100 ? '#34d399' : 'rgba(255,255,255,0.4)' }}>
                              {pct}%
                            </div>
                            <div className="w-20 h-1.5 bg-white/6 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, background: pct === 100 ? '#34d399' : epic.color }}/>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1">
                            <button onClick={() => { setEditing(epic); setShowModal(true) }}
                              className="p-1.5 rounded-lg text-white/25 hover:text-white/60 hover:bg-white/8 transition-all">
                              <Pencil size={12}/>
                            </button>
                            <button onClick={() => handleDelete(epic.id)}
                              className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/8 transition-all">
                              <Trash2 size={12}/>
                            </button>
                            <button onClick={() => toggleExpand(epic.id)}
                              className="p-1.5 rounded-lg text-white/20 hover:text-white/50 hover:bg-white/6 transition-all">
                              <ChevronDown size={13} className={`transition-transform duration-200 ${isExp ? 'rotate-180' : ''}`}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sprints panel */}
                  {isExp && (
                    <div className="border-t border-white/5 bg-[#080d14]">
                      {epic.sprints.length === 0 ? (
                        <div className="px-5 py-4 text-center">
                          <p className="text-xs text-white/15">Sin sprints asignados — edita un sprint y selecciona esta epica</p>
                        </div>
                      ) : (
                        <div className="px-5 py-3 space-y-1.5">
                          {epic.sprints.map(sp => {
                            const spDone = sp.items.filter(i => i.status === 'DONE').length
                            const spPct = sp.items.length > 0 ? Math.round((spDone / sp.items.length) * 100) : 0
                            const spColor = SPRINT_STATUS_COLOR[sp.status] || '#4b5563'

                            return (
                              <div key={sp.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: spColor }}/>
                                  <span className="text-xs text-white/55 truncate">{sp.name}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0"
                                    style={{ color: spColor, background: `${spColor}15` }}>
                                    {SPRINT_STATUS_LABEL[sp.status] || sp.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className="text-[11px] text-white/20 tabular-nums">{sp._count.items} items</span>
                                  <div className="w-14 h-1 bg-white/6 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${spPct}%`, background: spColor }}/>
                                  </div>
                                  <span className="text-[11px] text-white/20 tabular-nums w-7 text-right">{spPct}%</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

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
