'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePageActions } from '@/lib/pageActionsContext'
import { useSession } from 'next-auth/react'
import { Plus, X, Loader2, Zap, Bug, Wrench, TrendingUp, CreditCard, ChevronDown, Rocket, Calendar, Layers, Map as MapIcon, Upload, CheckSquare, Square } from 'lucide-react'
import BacklogItemDetail from '@/components/BacklogItemDetail'

interface Solucion { id: string; nombre: string; tipo: string }
interface BacklogItem {
  id: string; title: string; description: string | null; type: string; priority: string
  status: string; points: number | null; solucionId: string | null
  solucion: { id: string; nombre: string; tipo: string } | null
  assigneeId: string | null; assigneeName: string | null; taskCode: string | null
  resultado: string | null; sprintId: string | null
  sprint: { id: string; sprintCode: string | null; name: string } | null
  createdAt: string; updatedAt: string; fechaEjecucion: string | null
}
interface Sprint {
  id: string; sprintCode: string | null; name: string; goal: string | null
  startDate: string | null; endDate: string | null; status: string
  epicId: string | null; epic: { id: string; name: string; color: string } | null
  _count: { items: number }; solucion: { id: string; solucionCode: string | null; nombre: string } | null
}
interface EpicOption { id: string; name: string; color: string; solucionId: string | null }

const STATUSES = [
  { key: 'BACKLOG',     label: 'Backlog',     color: 'bg-gray-500'  },
  { key: 'IN_PROGRESS', label: 'En Progreso', color: 'bg-blue-500'  },
  { key: 'BLOCKED',     label: 'Bloqueado',   color: 'bg-red-500'   },
  { key: 'DONE',        label: 'Done',        color: 'bg-green-500' },
]
const TYPES = [
  { key: 'DESARROLLO',    label: 'Desarrollo',    icon: Zap,         color: 'text-purple-400 bg-purple-500/10' },
  { key: 'BUG',           label: 'Bug',           icon: Bug,         color: 'text-red-400 bg-red-500/10'       },
  { key: 'TECH_DEBT',     label: 'Deuda técnica', icon: CreditCard,  color: 'text-yellow-400 bg-yellow-500/10' },
  { key: 'DOCUMENTACION', label: 'Documentación', icon: Wrench,      color: 'text-indigo-400 bg-indigo-500/10' },
  { key: 'INVESTIGACION', label: 'Investigación', icon: TrendingUp,  color: 'text-pink-400 bg-pink-500/10'     },
  { key: 'TEST_QA',       label: 'Test / QA',     icon: CheckSquare, color: 'text-cyan-400 bg-cyan-500/10'     },
]
const PRIORITIES = [
  { key: 'CRITICAL', label: 'Crítica', color: 'text-red-400',    dot: 'bg-red-500'    },
  { key: 'HIGH',     label: 'Alta',    color: 'text-orange-400', dot: 'bg-orange-500' },
  { key: 'MEDIUM',   label: 'Media',   color: 'text-yellow-400', dot: 'bg-yellow-500' },
  { key: 'LOW',      label: 'Baja',    color: 'text-gray-400',   dot: 'bg-gray-500'   },
]
const EMPTY_FORM = { title: '', description: '', type: 'DESARROLLO', priority: 'MEDIUM', status: 'BACKLOG', points: '', solucionId: '', assigneeId: '', assigneeName: '' }
const SOLUCION_TIPO_LABELS: Record<string, string> = { PROJECT: 'Proyecto', DEMO: 'Demo', PARTNERSHIP: 'Partnership', PRODUCT: 'Producto', INTERN: 'Intern' }

function PriorityDot({ priority }: { priority: string }) {
  const p = PRIORITIES.find(x => x.key === priority) ?? PRIORITIES[2]
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot}`} title={p.label} />
}

function CustomSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState({ top: 0, left: 0, width: 0 })
  const ref = React.useRef<HTMLDivElement>(null)
  const btnRef = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const handleOpen = () => {
    if (btnRef.current) { const r = btnRef.current.getBoundingClientRect(); setPos({ top: r.bottom + 4, left: r.left, width: r.width }) }
    setOpen(v => !v)
  }
  const selected = options.find(o => o.value === value)
  return (
    <div ref={ref} className="relative w-full">
      <button ref={btnRef} type="button" onClick={handleOpen} className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-white focus:outline-none transition-all" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
        <span className={`flex-1 min-w-0 truncate text-left text-sm ${selected ? 'text-white' : 'text-gray-500'}`}>{selected ? selected.label : (placeholder ?? 'Seleccionar...')}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 flex-shrink-0 ml-2 transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && typeof window !== 'undefined' && (
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, background: 'rgba(12,14,28,0.98)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(16px)', maxHeight: '200px', overflowY: 'auto', zIndex: 9999, borderRadius: '10px', boxShadow: '0 12px 40px rgba(0,0,0,0.7)' }}>
          {options.map((opt, i) => (
            <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]" style={{ borderBottom: i < options.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: opt.value === value ? 'rgba(249,115,22,0.08)' : 'transparent' }}>
              <span className="text-[13px]" style={{ color: opt.value === value ? '#f97316' : '#d1d5db' }}>{opt.label}</span>
              {opt.value === value && <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="ml-auto flex-shrink-0"><path d="M1 4L3.5 6.5L9 1" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SprintPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [items, setItems] = useState<BacklogItem[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [soluciones, setSoluciones] = useState<Solucion[]>([])
  const [epics, setEpics] = useState<EpicOption[]>([])
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showCollapsed, setShowCollapsed] = useState(true)
  const [showAddItems, setShowAddItems] = useState(false)
  const [viewItem, setViewItem] = useState<BacklogItem | null>(null)
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null)
  const [sprintEditForm, setSprintEditForm] = useState({ name: '', goal: '', startDate: '', endDate: '', epicId: '', solucionId: '' })
  const [savingSprintEdit, setSavingSprintEdit] = useState(false)
  const [showSprintModal, setShowSprintModal] = useState(false)
  const [sprintForm, setSprintForm] = useState({ name: '', goal: '', startDate: '', endDate: '', solucionId: '', epicId: '', items: [] as string[] })
  const [savingSprint, setSavingSprint] = useState(false)
  const [sprintQuickAdd, setSprintQuickAdd] = useState({ title: '', type: 'DESARROLLO', priority: 'MEDIUM' })
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<BacklogItem | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [pendingSprintId, setPendingSprintId] = useState<string | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)
  const { setActions } = usePageActions()
  const userName = (session?.user as any)?.name ?? ''

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none transition-all'

  useEffect(() => {
    setActions(
      <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/backlog" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.08)'; (e.currentTarget as HTMLElement).style.color = '#d1d5db' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          Backlog
        </Link>
        <Link href="/backlog/sprint" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1"
          style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
          <Rocket size={10}/> Sprint
        </Link>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }}/>
        <Link href="/backlog/epics" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(29,147,117,0.08)'; (e.currentTarget as HTMLElement).style.color = '#1D9375' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          <Layers size={10}/> Épicas
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

  const safeFetch = async (url: string) => { try { const r = await fetch(url); if (!r.ok) return []; return await r.json() } catch { return [] } }

  useEffect(() => {
    Promise.all([
      safeFetch('/api/backlog'),
      safeFetch('/api/backlog/sprints'),
      safeFetch('/api/soluciones'),
      safeFetch('/api/backlog/epics'),
      safeFetch('/api/users'),
    ]).then(([i, sp, s, ep, u]) => {
      setItems(Array.isArray(i) ? i : [])
      setSprints(Array.isArray(sp) ? sp : [])
      setSoluciones(Array.isArray(s) ? s.map((x: any) => ({ id: x.id, nombre: x.nombre, tipo: x.tipo })) : [])
      setEpics(Array.isArray(ep) ? ep.map((e: { id: string; name: string; color: string; solucion?: { id: string } | null }) => ({ id: e.id, name: e.name, color: e.color, solucionId: e.solucion?.id ?? null })) : [])
      setUsers(Array.isArray(u) ? u.filter((x: any) => x.role !== 'SUPERADMIN') : [])
      setLoading(false)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    if (!form.solucionId.trim()) { alert('Debes seleccionar una solución asociada'); return }
    setSaving(true)
    const body = { ...form, points: form.points ? Number(form.points) : null, solucionId: form.solucionId || null }
    const postBody = pendingSprintId ? { ...body, sprintId: pendingSprintId } : body
    const res = await fetch('/api/backlog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(postBody) })
    if (res.ok) { const created = await res.json(); setItems(prev => [...prev, created]) }
    setSaving(false); setShowModal(false); setPendingSprintId(null)
  }

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : null

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-emerald-500" size={28}/></div>

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#080c12' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div/>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSprintModal(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium text-emerald-400 hover:text-emerald-300"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Rocket size={13}/> Nuevo Sprint
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {sprints.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <Rocket size={28} className="text-emerald-400"/>
            </div>
            <p className="text-gray-400 text-sm">No hay sprints. Crea uno con el botón <span className="text-emerald-400 font-medium">Nuevo Sprint</span>.</p>
            <button onClick={() => setShowSprintModal(true)} className="px-4 py-2 rounded-lg text-sm font-semibold text-emerald-400 transition-all" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <Rocket size={13} className="inline mr-1.5"/>Nuevo Sprint
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {sprints.map(activeSprint => {
              const sprintItems = items.filter(i => i.sprintId === activeSprint.id)
              const doneCount = sprintItems.filter(i => i.status === 'DONE').length
              const progress = sprintItems.length > 0 ? Math.round((doneCount / sprintItems.length) * 100) : 0

              const updateSprintStatus = async (newStatus: string) => {
                if (newStatus === 'ACTIVE') {
                  const existingActive = sprints.find(s => s.status === 'ACTIVE')
                  if (existingActive && existingActive.id !== activeSprint.id) {
                    if (!confirm('Ya hay un sprint activo. ¿Cerrarlo y activar este?')) return
                    await fetch('/api/backlog/sprints', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: existingActive.id, status: 'CLOSED' }) })
                  }
                }
                if (newStatus === 'CLOSED') {
                  const unfinished = sprintItems.filter(i => i.status !== 'DONE')
                  for (const item of unfinished) {
                    await fetch(`/api/backlog/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...item, sprintId: null, status: 'BACKLOG', solucionId: item.solucionId }) })
                  }
                  setItems(prev => prev.map(i => { const u = unfinished.find(x => x.id === i.id); return u ? { ...i, sprintId: null, status: 'BACKLOG' } : i }))
                }
                const res = await fetch('/api/backlog/sprints', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: activeSprint.id, status: newStatus }) })
                if (res.ok) { const updated = await res.json(); setSprints(prev => prev.map(s => s.id === updated.id ? updated : s)) }
              }

              return (
                <div key={activeSprint.id} className="flex flex-col gap-4">
                  <div className="rounded-2xl flex-shrink-0 overflow-hidden" style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    {/* Sprint header */}
                    <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(16,185,129,0.1)', background: 'rgba(16,185,129,0.04)' }}>
                      <div className="flex items-center gap-3">
                        {activeSprint.solucion?.solucionCode && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded mr-1" style={{ background: 'rgba(234,88,12,0.15)', color: '#fb923c', border: '1px solid rgba(234,88,12,0.2)' }}>{activeSprint.solucion.solucionCode}</span>}
                        <span className="text-[13px] font-mono font-bold tracking-wider" style={{ color: '#10b981' }}>{activeSprint.sprintCode ?? 'SP-???'}</span>
                        {activeSprint.epic && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold border" style={{ color: activeSprint.epic.color, background: `${activeSprint.epic.color}15`, borderColor: `${activeSprint.epic.color}30` }}>
                            {activeSprint.epic.name}
                          </span>
                        )}
                        <span className="w-px h-3" style={{ background: 'rgba(255,255,255,0.12)' }}/>
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: activeSprint.status === 'ACTIVE' ? 'rgba(16,185,129,0.2)' : activeSprint.status === 'PLANNED' ? 'rgba(251,191,36,0.2)' : 'rgba(107,114,128,0.2)', color: activeSprint.status === 'ACTIVE' ? '#10b981' : activeSprint.status === 'PLANNED' ? '#fbbf24' : '#9ca3af' }}>
                          {activeSprint.status === 'ACTIVE' ? 'Activo' : activeSprint.status === 'PLANNED' ? 'Planificado' : 'Cerrado'}
                        </span>
                        {fmtDate(activeSprint.startDate) && <span className="text-[11px] text-gray-600">{fmtDate(activeSprint.startDate)} → {fmtDate(activeSprint.endDate) ?? '?'}</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {activeSprint.status === 'PLANNED' && (
                          <button onClick={() => updateSprintStatus('ACTIVE')} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all" style={{ background: 'rgba(16,185,129,0.3)', border: '1px solid rgba(16,185,129,0.5)' }}>▶ Activar</button>
                        )}
                        {activeSprint.status === 'ACTIVE' && (
                          <button onClick={() => { if (confirm('¿Cerrar sprint? Los items sin terminar volverán al Backlog.')) updateSprintStatus('CLOSED') }} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all" style={{ background: 'rgba(107,114,128,0.15)', border: '1px solid rgba(107,114,128,0.35)', color: '#9ca3af' }}>✓ Cerrar Sprint</button>
                        )}
                        <button onClick={() => { setSprintEditForm({ name: activeSprint.name, goal: activeSprint.goal ?? '', startDate: activeSprint.startDate ? activeSprint.startDate.slice(0,10) : '', endDate: activeSprint.endDate ? activeSprint.endDate.slice(0,10) : '', epicId: activeSprint.epicId ?? '', solucionId: activeSprint.solucion?.id ?? '' }); setEditingSprint(activeSprint) }} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#6b7280' }}>✎ Editar</button>
                        <button onClick={() => setShowSprintModal(true)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-400 transition-all" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>+ Nuevo Sprint</button>
                      </div>
                    </div>
                    {/* Sprint body */}
                    <div className="px-5 py-4">
                      <h2 className="text-base font-bold text-white leading-snug mb-1">{activeSprint.name}</h2>
                      {activeSprint.goal && <p className="text-[12px] text-gray-500 leading-relaxed mb-3" style={{ whiteSpace: 'pre-line', maxHeight: '60px', overflow: 'hidden' }}>{activeSprint.goal}</p>}
                      {/* Progress */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: progress === 100 ? '#10b981' : 'linear-gradient(90deg,#10b981,#34d399)' }}/>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-400 flex-shrink-0">{doneCount}/{sprintItems.length} · {progress}%</span>
                      </div>
                      {/* Activities */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <button onClick={() => setShowCollapsed(v => !v)} className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-300 uppercase tracking-wider hover:text-white transition-colors">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                            Actividades ({sprintItems.length})
                          </button>
                          <button onClick={() => setShowAddItems(v => !v)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all" style={{ background: showAddItems ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)', border: showAddItems ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.1)', color: showAddItems ? '#f97316' : '#9ca3af' }}>
                            <Plus size={10}/> Gestionar
                          </button>
                        </div>
                        {/* Gestionar panel */}
                        {showAddItems && (() => {
                          const availableItems = items.filter(i => !i.sprintId && i.status !== 'DONE')
                          const addToSprint = async (item: BacklogItem) => {
                            const res = await fetch(`/api/backlog/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...item, sprintId: activeSprint.id, solucionId: item.solucionId }) })
                            if (res.ok) { const updated = await res.json(); setItems(prev => prev.map(i => i.id === updated.id ? updated : i)) }
                          }
                          const removeFromSprint = async (item: BacklogItem) => {
                            const res = await fetch(`/api/backlog/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...item, sprintId: null, solucionId: item.solucionId }) })
                            if (res.ok) { const updated = await res.json(); setItems(prev => prev.map(i => i.id === updated.id ? updated : i)) }
                          }
                          return (
                            <div className="mb-3 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.02)' }}>
                              <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <input value={sprintQuickAdd.title} onChange={e => setSprintQuickAdd(f => ({ ...f, title: e.target.value }))}
                                  onKeyDown={e => { if (e.key !== 'Enter' || !sprintQuickAdd.title.trim()) return; setPendingSprintId(activeSprint.id); setForm({ ...EMPTY_FORM, title: sprintQuickAdd.title, type: sprintQuickAdd.type, priority: sprintQuickAdd.priority, assigneeName: userName }); setEditItem(null); setSprintQuickAdd(f => ({ ...f, title: '' })); setShowModal(true) }}
                                  placeholder="Nueva actividad..." className="flex-1 text-[12px] text-white placeholder-gray-600 focus:outline-none bg-transparent min-w-0"/>
                                <select value={sprintQuickAdd.type} onChange={e => setSprintQuickAdd(f => ({ ...f, type: e.target.value }))} className="text-[10px] rounded px-1.5 py-1 text-gray-400 focus:outline-none flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                  {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                                </select>
                                <button onClick={() => { if (!sprintQuickAdd.title.trim()) return; setPendingSprintId(activeSprint.id); setForm({ ...EMPTY_FORM, title: sprintQuickAdd.title, type: sprintQuickAdd.type, priority: sprintQuickAdd.priority, assigneeName: userName }); setEditItem(null); setSprintQuickAdd(f => ({ ...f, title: '' })); setShowModal(true) }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white flex-shrink-0" style={{ background: 'rgba(249,115,22,0.3)', border: '1px solid rgba(249,115,22,0.5)' }}>
                                  <Plus size={10}/> Agregar
                                </button>
                              </div>
                              {availableItems.length > 0 && (
                                <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                                  <div className="px-3 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}><p className="text-[10px] text-gray-600 uppercase tracking-wide font-semibold">Agregar del backlog</p></div>
                                  {availableItems.map(item => (
                                    <button key={item.id} onClick={() => addToSprint(item)} className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                      <Plus size={9} className="text-emerald-400 flex-shrink-0"/>
                                      <span className="text-[11px] text-gray-400 truncate flex-1">{item.title}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {sprintItems.length > 0 && (
                                <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                                  <div className="px-3 py-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><p className="text-[10px] text-gray-600 uppercase tracking-wide font-semibold">Quitar del sprint</p></div>
                                  {sprintItems.map(item => (
                                    <button key={item.id} onClick={() => removeFromSprint(item)} className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                      <X size={9} className="text-red-400 flex-shrink-0"/>
                                      <span className="text-[11px] text-gray-400 truncate flex-1">{item.title}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })()}
                        <div className="flex items-center flex-shrink-0 mb-2">
                          <span className="text-[11px] text-gray-600">{sprintItems.length} item{sprintItems.length !== 1 ? 's' : ''} en este sprint</span>
                        </div>
                        {!showCollapsed && (sprintItems.length === 0 ? (
                          <p className="text-[11px] text-gray-700 py-1">Sin actividades — abrí Gestionar para agregar.</p>
                        ) : (
                          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                            {sprintItems.map((item, idx) => {
                              const statusMeta = STATUSES.find(s => s.key === item.status)
                              const typeMeta = TYPES.find(t => t.key === item.type)
                              const TypeIcon = typeMeta?.icon
                              return (
                                <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-white/[0.03]" style={{ borderBottom: idx < sprintItems.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }} onClick={() => setViewItem(item)}>
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusMeta?.color ?? 'bg-gray-500'}`}/>
                                  {item.taskCode && <span className="text-[9px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>{item.taskCode}</span>}
                                  <span className="text-[12px] text-gray-200 flex-1 truncate">{item.title}</span>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {TypeIcon && <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${typeMeta?.color}`}><TypeIcon size={9}/></span>}
                                    <PriorityDot priority={item.priority}/>
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: item.status === 'DONE' ? 'rgba(16,185,129,0.15)' : item.status === 'IN_PROGRESS' ? 'rgba(59,130,246,0.15)' : item.status === 'BLOCKED' ? 'rgba(239,68,68,0.15)' : 'rgba(107,114,128,0.15)', color: item.status === 'DONE' ? '#10b981' : item.status === 'IN_PROGRESS' ? '#60a5fa' : item.status === 'BLOCKED' ? '#f87171' : '#9ca3af' }}>
                                      {statusMeta?.label ?? item.status}
                                    </span>
                                    {item.assigneeName && <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-black flex-shrink-0" style={{ background: 'linear-gradient(135deg,#f97316,#fb923c)' }} title={item.assigneeName}>{item.assigneeName.split(' ').map((w: string) => w[0]).slice(0,2).join('')}</div>}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* New item modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }} onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="w-full max-w-lg shadow-2xl rounded-2xl overflow-hidden" style={{ background: 'rgba(10,12,28,0.98)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #f97316, #fb923c44)' }}/>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h2 className="text-base font-semibold text-white">Nueva tarea</h2>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.05)' }}><X size={14}/></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Título *</label>
                <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="¿Qué hay que hacer?" className={inputCls} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', fontSize: '15px', fontWeight: 500, padding: '10px 14px' }}/>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Tipo</label><CustomSelect value={form.type} onChange={v => setForm({...form, type: v})} options={TYPES.map(t => ({ value: t.key, label: t.label }))}/></div>
                <div><label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Prioridad</label><CustomSelect value={form.priority} onChange={v => setForm({...form, priority: v})} options={PRIORITIES.map(p => ({ value: p.key, label: p.label }))}/></div>
                <div><label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Estado</label><CustomSelect value={form.status} onChange={v => setForm({...form, status: v})} options={STATUSES.map(s => ({ value: s.key, label: s.label }))}/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Solución *</label><CustomSelect value={form.solucionId} onChange={v => setForm({...form, solucionId: v})} placeholder="Seleccionar…" options={soluciones.map(s => ({ value: s.id, label: `${SOLUCION_TIPO_LABELS[s.tipo] ?? s.tipo}: ${s.nombre}` }))}/></div>
                <div><label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Responsable</label><CustomSelect value={form.assigneeId} onChange={v => { const u = users.find(x => x.id === v); setForm({ ...form, assigneeId: v, assigneeName: u?.name ?? '' }) }} placeholder="Sin asignar" options={[{ value: '', label: 'Sin asignar' }, ...users.map(u => ({ value: u.id, label: u.name }))]}/></div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm text-gray-400" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancelar</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-50" style={{ background: saving ? '#c2410c' : '#ea580c' }}>
                  {saving && <Loader2 size={13} className="animate-spin"/>}Crear tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item detail */}
      {viewItem && (
        <BacklogItemDetail item={viewItem} onClose={() => setViewItem(null)} currentUserName={userName}
          onEdit={() => setViewItem(null)} onDelete={() => setViewItem(null)}
          onStatusChange={async (item, newStatus) => {
            const res = await fetch(`/api/backlog/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...item, status: newStatus, solucionId: item.solucionId, assigneeName: item.assigneeName }) })
            if (res.ok) { const updated = await res.json(); setItems(prev => prev.map(i => i.id === updated.id ? updated : i)); setViewItem(updated) }
          }}/>
      )}

      {/* Edit sprint modal */}
      {editingSprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }} onClick={() => setEditingSprint(null)}>
          <div className="w-full rounded-2xl overflow-visible" style={{ maxWidth: '520px', background: 'rgba(10,12,26,0.98)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
            <div className="h-0.5 w-full rounded-t-2xl" style={{ background: 'linear-gradient(90deg,#10b981,#34d39944)' }}/>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}><Rocket size={14} className="text-emerald-400"/></div>
                <div><h2 className="text-sm font-semibold text-white">Editar Sprint</h2><p className="text-[11px] text-gray-500 mt-0.5">Modifica los detalles del sprint</p></div>
              </div>
              <button onClick={() => setEditingSprint(null)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.05)' }}><X size={14}/></button>
            </div>
            <div className="px-6 py-5 flex flex-col gap-4 overflow-visible">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Solución</label>
                  <CustomSelect value={sprintEditForm.solucionId} onChange={v => setSprintEditForm(f => ({ ...f, solucionId: v, epicId: '' }))} placeholder="Sin solución" options={[{ value: '', label: 'Sin solución' }, ...soluciones.map(s => ({ value: s.id, label: s.nombre }))]}/>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Épica</label>
                  <CustomSelect
                    value={sprintEditForm.epicId}
                    onChange={v => setSprintEditForm(f => ({ ...f, epicId: v }))}
                    placeholder={sprintEditForm.solucionId ? 'Sin épica' : 'Selecciona solución primero'}
                    options={[
                      { value: '', label: 'Sin épica' },
                      ...epics
                        .filter(e => !sprintEditForm.solucionId || e.solucionId === sprintEditForm.solucionId)
                        .map(e => ({ value: e.id, label: e.name }))
                    ]}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Nombre del sprint</label>
                <input autoFocus value={sprintEditForm.name} onChange={e => setSprintEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Sprint 1" className="w-full rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', padding: '10px 14px' }}/>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Objetivo</label>
                <textarea value={sprintEditForm.goal} onChange={e => setSprintEditForm(f => ({ ...f, goal: e.target.value }))} rows={2} className="w-full rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none resize-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', padding: '10px 14px' }}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5"><Calendar size={11}/> Inicio</label><input type="date" value={sprintEditForm.startDate} onChange={e => setSprintEditForm(f => ({ ...f, startDate: e.target.value }))} className="w-full rounded-lg text-sm text-white focus:outline-none" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', padding: '8px 12px', colorScheme: 'dark' }}/></div>
                <div><label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5"><Calendar size={11}/> Fin</label><input type="date" value={sprintEditForm.endDate} onChange={e => setSprintEditForm(f => ({ ...f, endDate: e.target.value }))} className="w-full rounded-lg text-sm text-white focus:outline-none" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', padding: '8px 12px', colorScheme: 'dark' }}/></div>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }}/>
              <div className="flex justify-end gap-2 pb-1">
                <button type="button" onClick={() => setEditingSprint(null)} className="px-4 py-2 rounded-lg text-sm text-gray-400" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancelar</button>
                <button type="button" disabled={!sprintEditForm.name.trim() || savingSprintEdit} onClick={async () => {
                  if (!sprintEditForm.name.trim()) return
                  setSavingSprintEdit(true)
                  try {
                    const res = await fetch('/api/backlog/sprints/edit', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingSprint.id, name: sprintEditForm.name, goal: sprintEditForm.goal, startDate: sprintEditForm.startDate, endDate: sprintEditForm.endDate, epicId: sprintEditForm.epicId || null, solucionId: sprintEditForm.solucionId || null }) })
                    if (res.ok) { const updated = await res.json(); setSprints(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s)) }
                  } finally { setSavingSprintEdit(false); setEditingSprint(null) }
                }} className="px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-50" style={{ background: savingSprintEdit ? '#059669' : '#10b981' }}>
                  {savingSprintEdit ? <Loader2 size={13} className="animate-spin"/> : <Rocket size={13}/>}{savingSprintEdit ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New sprint modal */}
      {showSprintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)' }} onClick={e => { if (e.target === e.currentTarget) setShowSprintModal(false) }}>
          <div className="w-full shadow-2xl rounded-2xl overflow-hidden flex flex-col" style={{ maxWidth: '560px', background: 'rgba(10,12,28,0.98)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #10b981, #34d39944)' }}/>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}><Rocket size={15} className="text-emerald-400"/></div>
                <div><h2 className="text-sm font-semibold text-white">Nuevo Sprint</h2><p className="text-[11px] text-gray-500 mt-0.5">Agrupa items del backlog en un ciclo</p></div>
              </div>
              <button onClick={() => setShowSprintModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.05)' }}><X size={14}/></button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Solución asociada</label>
                <CustomSelect value={sprintForm.solucionId} onChange={v => setSprintForm({ ...sprintForm, solucionId: v, epicId: '' })} placeholder="Seleccionar solución…" options={soluciones.map(s => ({ value: s.id, label: s.nombre }))}/>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Épica</label>
                <CustomSelect
                  value={sprintForm.epicId}
                  onChange={v => setSprintForm({ ...sprintForm, epicId: v })}
                  placeholder={sprintForm.solucionId ? 'Sin épica' : 'Selecciona solución primero'}
                  options={[
                    { value: '', label: 'Sin épica' },
                    ...epics
                      .filter(e => !sprintForm.solucionId || e.solucionId === sprintForm.solucionId)
                      .map(e => ({ value: e.id, label: e.name }))
                  ]}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Nombre del sprint *</label>
                <input value={sprintForm.name} onChange={e => setSprintForm({ ...sprintForm, name: e.target.value })} placeholder="Ej: Sprint 1 - MVP Backlog" className="w-full rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', padding: '10px 14px' }}/>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Objetivo del sprint</label>
                <textarea rows={3} value={sprintForm.goal} onChange={e => setSprintForm({ ...sprintForm, goal: e.target.value })} placeholder="¿Qué se espera lograr al finalizar este sprint?" className="w-full rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none resize-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 14px', lineHeight: '1.6' }}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5"><Calendar size={11}/> Inicio</label><input type="date" value={sprintForm.startDate} onChange={e => setSprintForm({ ...sprintForm, startDate: e.target.value })} className="w-full rounded-lg text-sm text-white focus:outline-none" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', padding: '8px 12px', colorScheme: 'dark' }}/></div>
                <div><label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5"><Calendar size={11}/> Fin</label><input type="date" value={sprintForm.endDate} onChange={e => setSprintForm({ ...sprintForm, endDate: e.target.value })} className="w-full rounded-lg text-sm text-white focus:outline-none" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', padding: '8px 12px', colorScheme: 'dark' }}/></div>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }}/>
              <div className="flex justify-end gap-2 pt-1 pb-1">
                <button type="button" onClick={() => { setShowSprintModal(false); setSprintForm({ name: '', goal: '', startDate: '', endDate: '', solucionId: '', epicId: '', items: [] }) }} className="px-4 py-2 rounded-lg text-sm text-gray-400" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancelar</button>
                <button type="button" disabled={!sprintForm.name.trim() || savingSprint} onClick={async () => {
                  if (!sprintForm.name.trim()) return
                  setSavingSprint(true)
                  try {
                    const res = await fetch('/api/backlog/sprints', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: sprintForm.name, goal: sprintForm.goal, startDate: sprintForm.startDate, endDate: sprintForm.endDate, solucionId: sprintForm.solucionId || null, epicId: sprintForm.epicId || null }) })
                    if (res.ok) { const newSprint: Sprint = await res.json(); setSprints(prev => [newSprint, ...prev]) }
                  } finally { setSavingSprint(false); setShowSprintModal(false); setSprintForm({ name: '', goal: '', startDate: '', endDate: '', solucionId: '', epicId: '', items: [] }) }
                }} className="px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-50" style={{ background: savingSprint ? '#059669' : '#10b981' }}>
                  {savingSprint ? <Loader2 size={13} className="animate-spin"/> : <Rocket size={13}/>}{savingSprint ? 'Creando...' : 'Crear Sprint'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <input ref={importFileRef} type="file" accept=".txt,.md,.xml,.html" className="hidden"/>
    </div>
  )
}
