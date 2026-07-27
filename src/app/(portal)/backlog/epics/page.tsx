'use client'

import { useState, useEffect } from 'react'
import { Plus, Layers, X, Loader2, Pencil, Trash2, ChevronDown, Rocket, Target, Map as MapIcon, Calendar } from 'lucide-react'
import Link from 'next/link'
import { usePageActions } from '@/lib/pageActionsContext'

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
  CRITICAL: 'Critica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja'
}
const EPIC_STATUSES = ['ACTIVE', 'COMPLETED', 'ARCHIVED']
const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
const COLORS = ['#7F77DD', '#1D9375', '#E2562A', '#C0655A', '#3A9E42', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE:    { label: 'Activa',     color: '#34d399' },
  COMPLETED: { label: 'Completada', color: '#7F77DD' },
  ARCHIVED:  { label: 'Archivada',  color: '#4b5563' },
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

  const sel = 'w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none'
  const selStyle = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' as const }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'rgba(10,12,28,0.98)', border: '1px solid rgba(255,255,255,0.09)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>

        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg,#1D9375,#34d39944)' }}/>

        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(29,147,117,0.12)', border: '1px solid rgba(29,147,117,0.25)' }}>
              <Layers size={14} className="text-emerald-400"/>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{initial?.id ? 'Editar Épica' : 'Nueva Épica'}</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">{initial?.id ? 'Modifica los detalles de la épica' : 'Define un nuevo milestone estratégico'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.05)' }}><X size={14}/></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Nombre *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', fontSize: '14px', fontWeight: 500 }}
              placeholder="ej: Módulo de autenticación"/>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Estado</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={sel} style={selStyle}>
                {EPIC_STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Prioridad</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={sel} style={selStyle}>
                {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Solución</label>
            <select value={form.solucionId} onChange={e => setForm(f => ({ ...f, solucionId: e.target.value }))} className={sel} style={selStyle}>
              <option value="">Sin solución</option>
              {soluciones.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5"><Calendar size={11}/> Inicio</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', colorScheme: 'dark' }}/>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5"><Calendar size={11}/> Fin</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', colorScheme: 'dark' }}/>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Descripción</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
              className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none resize-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', lineHeight: '1.6' }}
              placeholder="Objetivo estratégico de esta épica..."/>
          </div>
        </div>

        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0 24px' }}/>

        <div className="flex gap-2 px-6 py-4">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Cancelar
          </button>
          <button onClick={handle} disabled={saving || !form.name.trim()}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: saving ? '#059669' : '#1D9375' }}>
            {saving ? <Loader2 size={13} className="animate-spin"/> : <Layers size={13}/>}
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
        <Link href="/backlog/sprint" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.08)'; (e.currentTarget as HTMLElement).style.color = '#d1d5db' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          <Rocket size={10}/> Sprints
        </Link>
        <Link href="/backlog/epics" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1"
          style={{ background: 'rgba(29,147,117,0.2)', color: '#1D9375', border: '1px solid rgba(29,147,117,0.3)' }}>
          <Layers size={10}/> Epicas
        </Link>
        <Link href="/backlog/solution" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,119,221,0.08)'; (e.currentTarget as HTMLElement).style.color = '#7F77DD' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          <MapIcon size={10}/> Solution
        </Link>
      </div>
    )
    return () => setActions(null)
  }, [])

  const load = async () => {
    setLoading(true)
    const [epicsRes, solRes] = await Promise.all([fetch('/api/backlog/epics'), fetch('/api/soluciones')])
    setEpics(await epicsRes.json())
    if (solRes.ok) setSoluciones(await solRes.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async (data: typeof EMPTY_FORM & { id?: string }) => {
    const method = data.id ? 'PUT' : 'POST'
    await fetch('/api/backlog/epics', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    setShowModal(false); setEditing(null); load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminar esta epica? Los sprints asociados quedaran sin epica.')) return
    await fetch(`/api/backlog/epics?id=${id}`, { method: 'DELETE' })
    load()
  }

  const toggleExpand = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }))

  const filtered = filterStatus === 'ALL' ? epics : epics.filter(e => e.status === filterStatus)

  const getProgress = (epic: Epic) => {
    const total = epic.sprints.reduce((a, s) => a + s.items.length, 0)
    const done = epic.sprints.reduce((a, s) => a + s.items.filter(i => i.status === 'DONE').length, 0)
    return { pct: total > 0 ? Math.round((done / total) * 100) : 0, done, total }
  }

  return (
    <div className="flex flex-col h-full overflow-auto p-6" style={{ background: '#080c12' }}>

      {/* Filter tabs + action */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {([
            { key: 'ALL', label: 'Todas' },
            { key: 'ACTIVE', label: 'Activas' },
            { key: 'COMPLETED', label: 'Completadas' },
            { key: 'ARCHIVED', label: 'Archivadas' },
          ] as const).map(tab => {
            const count = tab.key === 'ALL' ? epics.length : epics.filter(e => e.status === tab.key).length
            const active = filterStatus === tab.key
            return (
              <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
                className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all"
                style={{ background: active ? 'rgba(29,147,117,0.2)' : 'transparent', color: active ? '#1D9375' : '#6b7280', border: active ? '1px solid rgba(29,147,117,0.3)' : '1px solid transparent' }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#d1d5db' } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' } }}>
                {tab.label} {count > 0 && <span style={{ opacity: 0.5 }}>{count}</span>}
              </button>
            )
          })}
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true) }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium text-white"
          style={{ background: '#1D9375' }}>
          <Plus size={13}/> Nueva Epica
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={22} className="animate-spin" style={{ color: 'rgba(255,255,255,0.15)' }}/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Layers size={40} style={{ color: 'rgba(255,255,255,0.08)', marginBottom: 16 }}/>
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>Sin epicas</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.12)' }}>Las epicas agrupan sprints bajo un objetivo comun</p>
          <button onClick={() => setShowModal(true)} className="mt-5 px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
            style={{ background: '#1D9375' }}>
            <Plus size={13}/> Crear Epica
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(epic => {
            const isExp = expanded[epic.id] !== false
            const { pct, done, total } = getProgress(epic)
            const statusCfg = STATUS_CONFIG[epic.status] || STATUS_CONFIG.ACTIVE
            const priorityColor = PRIORITY_COLORS[epic.priority]

            return (
              <div key={epic.id} className="rounded-2xl overflow-hidden transition-all duration-150"
                style={{ border: '1px solid rgba(255,255,255,0.08)', background: '#0c1118' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.border = '1px solid rgba(255,255,255,0.15)'; el.style.background = '#0e1520' }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.border = '1px solid rgba(255,255,255,0.08)'; el.style.background = '#0c1118' }}>

                {/* Epic row */}
                <div className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: epic.color }}/>

                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpand(epic.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{epic.name}</span>
                      {epic.solucion && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                          {epic.solucion.nombre}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{epic._count.sprints} sprints · {total} tareas</span>
                    </div>
                    {epic.description && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{epic.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-xs tabular-nums mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>{done}/{total}</div>
                      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: epic.color }}/>
                      </div>
                    </div>
                    <button onClick={() => { setEditing(epic); setShowModal(true) }}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'}>
                      <Pencil size={13}/>
                    </button>
                    <button onClick={() => handleDelete(epic.id)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'rgba(255,255,255,0.3)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#f87171'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'}>
                      <Trash2 size={13}/>
                    </button>
                    <ChevronDown size={14} className={`transition-transform cursor-pointer ${isExp ? 'rotate-180' : ''}`}
                      style={{ color: 'rgba(255,255,255,0.25)' }} onClick={() => toggleExpand(epic.id)}/>
                  </div>
                </div>

                {/* Sprints expandidos */}
                {isExp && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#080d14' }}>
                    {epic.sprints.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.15)' }}>
                        Sin sprints asignados a esta epica
                      </p>
                    ) : (
                      <div className="px-5 py-3 space-y-1.5">
                        {epic.sprints.map(sp => {
                          const spDone = sp.items.filter(i => i.status === 'DONE').length
                          const spPct = sp.items.length > 0 ? Math.round((spDone / sp.items.length) * 100) : 0
                          const spColor = SPRINT_STATUS_COLOR[sp.status] || '#4b5563'
                          return (
                            <div key={sp.id} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: spColor }}/>
                              <span className="text-xs flex-1 truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>{sp.name}</span>
                              <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ color: spColor, background: `${spColor}18` }}>
                                {SPRINT_STATUS_LABEL[sp.status] || sp.status}
                              </span>
                              <span className="text-xs tabular-nums" style={{ color: 'rgba(255,255,255,0.2)' }}>{sp._count.items} items</span>
                              <div className="w-16 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                <div className="h-full rounded-full" style={{ width: `${spPct}%`, background: spColor }}/>
                              </div>
                              <span className="text-xs tabular-nums w-7 text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>{spPct}%</span>
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
