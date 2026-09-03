'use client'
import React from 'react'

import { useState, useEffect } from 'react'
import { Plus, Layers, X, Loader2, Pencil, Trash2, ChevronDown, Rocket, Target, Map as MapIcon, Calendar, Play } from 'lucide-react'
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

function Dropdown({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: open ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9', fontSize: '13px', cursor: 'pointer', backdropFilter: 'blur(8px)', transition: 'all 0.15s' }}>
        <span>{selected?.label ?? '—'}</span>
        <ChevronDown size={13} style={{ color: '#475569', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100, borderRadius: '10px', background: 'rgba(15,18,36,0.97)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 16px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', overflow: 'auto', maxHeight: '220px' }}>
          {options.map(opt => (
            <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{ width: '100%', display: 'block', padding: '9px 14px', textAlign: 'left', fontSize: '12px', fontWeight: value === opt.value ? 600 : 400, color: value === opt.value ? '#f97316' : '#94a3b8', background: value === opt.value ? 'rgba(249,115,22,0.08)' : 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.1s' }}
              onMouseEnter={e => { if (value !== opt.value) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { if (value !== opt.value) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
              {opt.value === value && <span style={{ marginRight: '6px', color: '#f97316' }}>✓</span>}{opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function EpicModal({ initial, soluciones, onSave, onClose }: {
  initial?: Partial<typeof EMPTY_FORM & { id: string }>
  soluciones: Solucion[]
  onSave: (data: typeof EMPTY_FORM & { id?: string }) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = React.useState({ ...EMPTY_FORM, ...initial })
  const [saving, setSaving] = React.useState(false)

  const handle = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    await onSave(form as typeof EMPTY_FORM & { id?: string })
    setSaving(false)
  }

  const statusOptions = EPIC_STATUSES.map(s => ({ value: s, label: STATUS_CONFIG[s]?.label || s }))
  const priorityOptions = PRIORITIES.map(p => ({ value: p, label: PRIORITY_LABELS[p] }))
  const solucionOptions = [{ value: '', label: 'Sin solución' }, ...soluciones.map(s => ({ value: s.id, label: s.nombre }))]

  const inputStyle: React.CSSProperties = { width: '100%', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', color: '#f1f5f9', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', backdropFilter: 'blur(8px)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(16px)' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: 'rgba(12,15,30,0.85)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)', backdropFilter: 'blur(40px) saturate(180%)' }}>

        {/* Línea superior */}
        <div style={{ height: '2px', background: 'linear-gradient(90deg, #1D9375, rgba(52,211,153,0.2))' }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'linear-gradient(90deg, rgba(29,147,117,0.1) 0%, rgba(168,85,247,0.06) 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(29,147,117,0.15)', border: '1px solid rgba(29,147,117,0.3)' }}>
              <Layers size={14} style={{ color: '#34d399' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{initial?.id ? 'EDITAR ÉPICA' : 'NUEVA ÉPICA'}</h2>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>Define un nuevo milestone estratégico</p>
            </div>
          </div>
          <button onClick={onClose}
            style={{ width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)')}>
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Nombre */}
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Nombre *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="ej: Módulo de autenticación"
              style={inputStyle} />
          </div>

          {/* Estado + Prioridad */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Dropdown label="Estado" value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={statusOptions} />
            <Dropdown label="Prioridad" value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))} options={priorityOptions} />
          </div>

          {/* Solución */}
          <Dropdown label="Solución" value={form.solucionId} onChange={v => setForm(f => ({ ...f, solucionId: v }))} options={solucionOptions} />

          {/* Fechas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Inicio</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' as const }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Fin</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={{ ...inputStyle, colorScheme: 'dark' as const }} />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Descripción</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
              placeholder="Objetivo estratégico de esta épica..."
              style={{ ...inputStyle, resize: 'vertical' as const, lineHeight: '1.6' }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0 24px' }} />
        <div style={{ display: 'flex', gap: '8px', padding: '16px 24px' }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#475569', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button onClick={handle} disabled={saving || !form.name.trim()}
            style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, color: '#fff', background: saving ? '#059669' : 'linear-gradient(135deg, #1D9375, #059669)', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: (!form.name.trim() && !saving) ? 0.4 : 1 }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Layers size={13} />}
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
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }}/>
        <Link href="/backlog/control" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.08)'; (e.currentTarget as HTMLElement).style.color = '#3b82f6' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          <Play size={10}/> Sala de Control
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
