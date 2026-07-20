'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, LayoutGrid, List, X, Loader2, Zap, Bug, Wrench, TrendingUp, CreditCard, ChevronDown, Pencil, Trash2, Filter, Eye, Upload, CheckSquare, Square, Rocket, Calendar } from 'lucide-react'
import BacklogItemDetail from '@/components/BacklogItemDetail'

interface Solucion {
  id: string
  nombre: string
  tipo: string
}

interface BacklogItem {
  id: string
  title: string
  description: string | null
  type: string
  priority: string
  status: string
  points: number | null
  solucionId: string | null
  solucion: { id: string; nombre: string; tipo: string } | null
  assigneeId: string | null
  assigneeName: string | null
  taskCode: string | null
  sprintId: string | null
  sprint: { id: string; sprintCode: string | null; name: string } | null
  createdAt: string
}

interface Sprint {
  id: string
  sprintCode: string | null
  name: string
  goal: string | null
  startDate: string | null
  endDate: string | null
  status: string
  _count: { items: number }
}

const STATUSES = [
  { key: 'BACKLOG',     label: 'Backlog',      color: 'bg-gray-500',   border: 'border-gray-500/30', bg: 'bg-gray-500/5'   },
  { key: 'IN_PROGRESS', label: 'En Progreso',  color: 'bg-blue-500',   border: 'border-blue-500/30', bg: 'bg-blue-500/5'   },
  { key: 'BLOCKED',     label: 'Bloqueado',    color: 'bg-red-500',    border: 'border-red-500/30',  bg: 'bg-red-500/5'    },
  { key: 'DONE',        label: 'Done',         color: 'bg-green-500',  border: 'border-green-500/30', bg: 'bg-green-500/5'  },
]

const TYPES = [
  { key: 'FEATURE',     label: 'Feature',        icon: Zap,       color: 'text-purple-400 bg-purple-500/10' },
  { key: 'BUG',         label: 'Bug',            icon: Bug,       color: 'text-red-400 bg-red-500/10'      },
  { key: 'TASK',        label: 'Tarea',          icon: Wrench,    color: 'text-blue-400 bg-blue-500/10'    },
  { key: 'IMPROVEMENT', label: 'Mejora',         icon: TrendingUp,color: 'text-green-400 bg-green-500/10'  },
  { key: 'TECH_DEBT',   label: 'Deuda técnica',  icon: CreditCard,color: 'text-yellow-400 bg-yellow-500/10'},
  { key: 'DESARROLLO',     label: 'Desarrollo',     icon: Zap,       color: 'text-cyan-400 bg-cyan-500/10'     },
  { key: 'COTIZACION',    label: 'Cotización',     icon: CreditCard,color: 'text-orange-400 bg-orange-500/10'  },
  { key: 'DOCUMENTACION', label: 'Documentación',  icon: Wrench,    color: 'text-indigo-400 bg-indigo-500/10'  },
  { key: 'INVESTIGACION', label: 'Investigación',  icon: TrendingUp,color: 'text-pink-400 bg-pink-500/10'      },
]

const PRIORITIES = [
  { key: 'CRITICAL', label: 'Crítica', color: 'text-red-400',    dot: 'bg-red-500'    },
  { key: 'HIGH',     label: 'Alta',   color: 'text-orange-400', dot: 'bg-orange-500' },
  { key: 'MEDIUM',   label: 'Media',  color: 'text-yellow-400', dot: 'bg-yellow-500' },
  { key: 'LOW',      label: 'Baja',   color: 'text-gray-400',   dot: 'bg-gray-500'   },
]

const EMPTY_FORM = {
  title: '', description: '', type: 'TASK', priority: 'MEDIUM',
  status: 'BACKLOG', points: '', solucionId: '', assigneeId: '', assigneeName: '',
}

interface ImportTask {
  id: string
  title: string
  description: string
  selected: boolean
  points?: string
  type?: string
  priority?: string
}

type ParsedTask = { title: string; description: string; points?: string; type?: string; priority?: string }

function parseFileToTasks(content: string, fileName: string): ParsedTask[] {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? 'txt'

  if (ext === 'html' || ext === 'htm') {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    const results: { title: string; description: string }[] = []
    const rows = doc.querySelectorAll('tr')
    if (rows.length > 1) {
      rows.forEach((row, i) => {
        if (i === 0) return
        const cells = row.querySelectorAll('td')
        const title = cells[0]?.textContent?.trim() ?? ''
        const desc = cells[1]?.textContent?.trim() ?? ''
        if (title.length > 2) results.push({ title, description: desc })
      })
      if (results.length) return results
    }
    const lis = doc.querySelectorAll('li')
    if (lis.length > 0) {
      lis.forEach(li => {
        const text = li.textContent?.trim() ?? ''
        if (text.length > 2 && text.length < 300) results.push({ title: text, description: '' })
      })
      if (results.length) return results
    }
    const headings = doc.querySelectorAll('h2, h3, h4')
    headings.forEach(h => {
      const title = h.textContent?.trim() ?? ''
      const next = h.nextElementSibling
      const desc = next && ['P', 'DIV'].includes(next.tagName) ? next.textContent?.trim() ?? '' : ''
      if (title) results.push({ title, description: desc })
    })
    return results
  }

  if (ext === 'xml') {
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/xml')
    const results: ParsedTask[] = []
    for (const tag of ['task', 'item', 'actividad', 'tarea', 'activity', 'issue', 'story']) {
      const els = doc.getElementsByTagName(tag)
      if (els.length > 0) {
        Array.from(els).forEach(el => {
          const titleEl = el.querySelector('title,titulo,name,nombre,summary')
          const descEl = el.querySelector('description,descripcion,desc,body,detail')
          const title = titleEl?.textContent?.trim() || el.getAttribute('title') || el.getAttribute('name') || ''
          const description = descEl?.textContent?.trim() ?? ''
          const points = el.querySelector('points,puntos,storypoints,pts')?.textContent?.trim()
          const type = el.querySelector('type,tipo')?.textContent?.trim()
          const priority = el.querySelector('priority,prioridad')?.textContent?.trim()
          if (title.trim().length > 2) results.push({ title: title.trim(), description, points, type, priority })
        })
        if (results.length) return results
      }
    }
    doc.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0) {
        const text = el.textContent?.trim() ?? ''
        if (text.length > 3 && text.length < 200) results.push({ title: text, description: '' })
      }
    })
    return results
  }

  // txt / md / markdown
  const lines = content.split('\n')
  const results: { title: string; description: string }[] = []
  const hasHeaders = lines.some(l => /^#{1,3}\s/.test(l.trim()))

  if (hasHeaders) {
    let current: { title: string; description: string } | null = null
    for (const line of lines) {
      const trimmed = line.trim()
      const m = trimmed.match(/^#{1,3}\s+(.+)/)
      if (m) {
        if (current) results.push(current)
        current = { title: m[1].trim(), description: '' }
      } else if (current && trimmed && !trimmed.startsWith('#')) {
        current.description += (current.description ? ' ' : '') + trimmed
      }
    }
    if (current) results.push(current)
    return results
  }

  for (const line of lines) {
    let title = line.trim()
    if (!title) continue
    title = title.replace(/^[-*+]\s+(\[[ x]\]\s+)?/, '').replace(/^\d+[.)]\s+/, '').replace(/^#{1,6}\s+/, '').trim()
    if (title.length > 2) results.push({ title, description: '' })
  }
  return results
}

function TypeBadge({ type }: { type: string }) {
  const t = TYPES.find(x => x.key === type) ?? TYPES[2]
  const Icon = t.icon
  return (
    <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${t.color}`}>
      <Icon size={9} /> {t.label}
    </span>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  const p = PRIORITIES.find(x => x.key === priority) ?? PRIORITIES[2]
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot}`} title={p.label} />
}

function PointsBadge({ points }: { points: number | null }) {
  if (!points) return null
  return <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded font-mono">{points}pt</span>
}

const SOLUCION_TIPO_LABELS: Record<string, string> = {
  PROJECT: 'Proyecto', DEMO: 'Demo', PARTNERSHIP: 'Partnership', PRODUCT: 'Producto', INTERN: 'Intern',
}

function SolutionBadge({ solucion }: { solucion: { id: string; nombre: string; tipo: string } | null }) {
  if (!solucion) return null
  return (
    <span className="text-[10px] text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded truncate max-w-[120px]" title={`${SOLUCION_TIPO_LABELS[solucion.tipo] ?? solucion.tipo}: ${solucion.nombre}`}>
      {solucion.nombre}
    </span>
  )
}


function FilterSelect({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        dropRef.current && !dropRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(o => !o)
  }

  const current = options.find(o => o.value === value)

  return (
    <div className="flex-shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors text-left whitespace-nowrap"
        style={{
          background: open ? 'rgba(249,115,22,0.12)' : 'rgba(255,255,255,0.05)',
          border: open ? '1px solid rgba(249,115,22,0.45)' : '1px solid rgba(255,255,255,0.09)',
          color: current ? '#f97316' : '#9ca3af',
          minWidth: '130px',
        }}
      >
        <span className="flex-1 truncate">{current ? current.label : placeholder}</span>
        <svg
          className="w-3 h-3 flex-shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s', color: '#6b7280' }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && typeof window !== 'undefined' && (
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: Math.max(pos.width, 200),
            maxHeight: '260px',
            overflowY: 'auto',
            zIndex: 9999,
            background: 'rgba(10,10,26,0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
            backdropFilter: 'blur(16px)',
            padding: '4px 0',
          }}
        >
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false) }}
            className="w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2"
            style={{ color: value === '' ? '#f97316' : '#9ca3af', background: value === '' ? 'rgba(249,115,22,0.1)' : 'transparent' }}
            onMouseEnter={e => { if (value !== '') (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
            onMouseLeave={e => { if (value !== '') (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <span>{placeholder}</span>
            {value === '' && <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
          </button>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2"
              style={{ color: value === opt.value ? '#f97316' : '#d1d5db', background: value === opt.value ? 'rgba(249,115,22,0.1)' : 'transparent' }}
              onMouseEnter={e => { if (value !== opt.value) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { if (value !== opt.value) (e.currentTarget as HTMLElement).style.background = value === opt.value ? 'rgba(249,115,22,0.1)' : 'transparent' }}
            >
              <span className="truncate">{opt.label}</span>
              {value === opt.value && <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


// Custom dark-themed select to avoid OS native dropdown styling
function CustomSelect({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const selected = options.find(o => o.value === value)
  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-white focus:outline-none transition-all"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}
      >
        <span className={selected ? 'text-white' : 'text-gray-500'}>{selected ? selected.label : (placeholder ?? 'Seleccionar...')}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 flex-shrink-0 ml-2 transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {open && (
        <div
          className="absolute left-0 right-0 z-[200] rounded-xl overflow-hidden shadow-2xl"
          style={{ top: 'calc(100% + 4px)', background: 'rgba(12,14,28,0.98)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(16px)', maxHeight: '200px', overflowY: 'auto' }}
        >
          {options.map((opt, i) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
              style={{ borderBottom: i < options.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: opt.value === value ? 'rgba(249,115,22,0.08)' : 'transparent' }}
            >
              <span className="text-[13px]" style={{ color: opt.value === value ? '#f97316' : '#d1d5db' }}>{opt.label}</span>
              {opt.value === value && <svg width="10" height="8" viewBox="0 0 10 8" fill="none" className="ml-auto flex-shrink-0"><path d="M1 4L3.5 6.5L9 1" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function BacklogPage() {
  const { data: session } = useSession()
  const [items, setItems]   = useState<BacklogItem[]>([])
  const [soluciones, setSoluciones] = useState<Solucion[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView]         = useState<'kanban' | 'lista'>('kanban')
  const [kanbanExpanded, setKanbanExpanded] = useState(false)
  const [viewItem, setViewItem] = useState<BacklogItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem]   = useState<BacklogItem | null>(null)
  const [form, setForm]     = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState<BacklogItem | null>(null)
  const [filterType, setFilterType]     = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterSolution, setFilterSolution] = useState('')
  const [filterAssignee, setFilterAssignee] = useState('')
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([])

  const importFileRef = useRef<HTMLInputElement>(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importTasks, setImportTasks] = useState<ImportTask[]>([])
  const [importDefaults, setImportDefaults] = useState({ type: 'TASK', priority: 'MEDIUM', status: 'BACKLOG', points: '', solucionId: '', assigneeId: '', assigneeName: '' })
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [showSprintModal, setShowSprintModal] = useState(false)
  const [sprintForm, setSprintForm] = useState({ name: '', goal: '', startDate: '', endDate: '', items: [] as string[] })
  const [savingSprint, setSavingSprint] = useState(false)
  const [showItemsPicker, setShowItemsPicker] = useState(false)
  const [mainView, setMainView] = useState<'backlog' | 'sprint'>('backlog')
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null)
  const [sprintEditForm, setSprintEditForm] = useState({ name: '', goal: '', startDate: '', endDate: '' })
  const [savingSprintEdit, setSavingSprintEdit] = useState(false)
  const [showAddItems, setShowAddItems] = useState(false)
  const [pendingSprintId, setPendingSprintId] = useState<string | null>(null)
  const [sprintQuickAdd, setSprintQuickAdd] = useState({ title: '', type: 'TASK', priority: 'MEDIUM' })

  const userName = (session?.user as any)?.name ?? ''

  const safeFetch = async (url: string) => {
    try {
      const r = await fetch(url)
      if (!r.ok) return []
      return await r.json()
    } catch {
      return []
    }
  }

  const load = async () => {
    try {
      const [i, s, u, sp] = await Promise.all([
        safeFetch('/api/backlog'),
        safeFetch('/api/soluciones'),
        safeFetch('/api/users'),
        safeFetch('/api/backlog/sprints'),
      ])
      setItems(Array.isArray(i) ? i : [])
      setSoluciones(Array.isArray(s) ? s.map((x: any) => ({ id: x.id, nombre: x.nombre, tipo: x.tipo })) : [])
      setUsers(Array.isArray(u) ? u.filter((x: any) => x.role !== 'SUPERADMIN') : [])
      setSprints(Array.isArray(sp) ? sp : [])
    } catch {
      // silencia cualquier error residual; la página igual muestra el kanban vacío
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openNew = (status = 'BACKLOG') => {
    setEditItem(null)
    setForm({ ...EMPTY_FORM, status, assigneeName: userName })
    setShowModal(true)
  }

  const openEdit = (item: BacklogItem) => {
    setEditItem(item)
    setForm({
      title: item.title, description: item.description ?? '', type: item.type,
      priority: item.priority, status: item.status, points: item.points ? String(item.points) : '',
      solucionId: item.solucionId ?? '', assigneeId: item.assigneeId ?? '', assigneeName: item.assigneeName ?? '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    if (!form.solucionId.trim()) {
      alert('Debes seleccionar una solución asociada')
      return
    }
    setSaving(true)
    const body = { ...form, points: form.points ? Number(form.points) : null, solucionId: form.solucionId || null }
    if (editItem) {
      const res = await fetch(`/api/backlog/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) { const updated = await res.json(); setItems(prev => prev.map(i => i.id === updated.id ? updated : i)) }
    } else {
      const postBody = pendingSprintId ? { ...body, sprintId: pendingSprintId } : body
      const res = await fetch('/api/backlog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(postBody) })
      if (res.ok) { const created = await res.json(); setItems(prev => [...prev, created]) }
    }
    setSaving(false)
    setShowModal(false)
    setPendingSprintId(null)
  }

  const deleteItem = async () => {
    if (!confirmDel) return
    await fetch(`/api/backlog/${confirmDel.id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== confirmDel.id))
    setConfirmDel(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const content = ev.target?.result as string
      const parsed = parseFileToTasks(content, file.name)
      if (parsed.length === 0) { alert('No se detectaron tareas en el archivo.'); return }
      setImportTasks(parsed.map((t, i) => ({ ...t, id: `imp-${i}`, selected: true })))
      setImportDefaults({ type: 'TASK', priority: 'MEDIUM', status: 'BACKLOG', points: '', solucionId: '', assigneeId: '', assigneeName: userName })
      setImportError('')
      setShowImportModal(true)
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  const handleImportSubmit = async () => {
    const selected = importTasks.filter(t => t.selected && t.title.trim())
    if (selected.length === 0) { setImportError('Selecciona al menos una tarea.'); return }
    if (!importDefaults.solucionId) { setImportError('Selecciona una solución asociada.'); return }
    setImporting(true)
    setImportError('')
    try {
      const created: BacklogItem[] = []
      for (const t of selected) {
        const res = await fetch('/api/backlog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: t.title.trim(),
            description: t.description.trim() || null,
            type: t.type ?? importDefaults.type,
            priority: t.priority ?? importDefaults.priority,
            status: importDefaults.status,
            points: (() => { const p = t.points ?? importDefaults.points; return p ? Number(p) : null })(),
            solucionId: importDefaults.solucionId,
            assigneeId: importDefaults.assigneeId || null,
            assigneeName: importDefaults.assigneeName || null,
          }),
        })
        if (res.ok) created.push(await res.json())
      }
      setItems(prev => [...created.reverse(), ...prev])
      setShowImportModal(false)
    } catch {
      setImportError('Error al importar. Revisa la consola.')
    } finally {
      setImporting(false)
    }
  }

  const changeStatus = async (item: BacklogItem, newStatus: string) => {
    const res = await fetch(`/api/backlog/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, status: newStatus, solucionId: item.solucionId, assigneeName: item.assigneeName }),
    })
    if (res.ok) { const updated = await res.json(); setItems(prev => prev.map(i => i.id === updated.id ? updated : i)) }
  }

  const filtered = items.filter(i => {
    if (filterSolution && i.solucionId !== filterSolution) return false
    if (filterType && i.type !== filterType) return false
    if (filterPriority && i.priority !== filterPriority) return false
    if (filterAssignee && i.assigneeId !== filterAssignee) return false
    return true
  })

  const byStatus = (status: string) => filtered.filter(i => i.status === status)

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none transition-all'

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-orange-500" size={28} /></div>

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800 flex items-center gap-2 min-w-0">
        {/* Filters — scroll horizontal en pantallas pequeñas */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">
          <FilterSelect
            value={filterSolution}
            onChange={setFilterSolution}
            placeholder="Todas las soluciones"
            options={soluciones.map(s => ({ value: s.id, label: `${SOLUCION_TIPO_LABELS[s.tipo] ?? s.tipo}: ${s.nombre}` }))}
          />
          <FilterSelect
            value={filterType}
            onChange={setFilterType}
            placeholder="Todos los tipos"
            options={TYPES.map(t => ({ value: t.key, label: t.label }))}
          />
          <FilterSelect
            value={filterPriority}
            onChange={setFilterPriority}
            placeholder="Todas las prioridades"
            options={PRIORITIES.map(p => ({ value: p.key, label: p.label }))}
          />
          {/* Assignee avatar filter */}
          {(() => {
            const assignees = Array.from(new Map(items.filter(i => i.assigneeId && i.assigneeName).map(i => [i.assigneeId, { id: i.assigneeId, name: i.assigneeName }])).values())
            if (assignees.length === 0) return null
            return (
              <>
                <div className="w-px h-4 bg-gray-700 mx-1 flex-shrink-0" />
                <div className="flex items-center gap-1 flex-shrink-0">
                  {assignees.map(a => {
                    const active = filterAssignee === a.id
                    return (
                      <button
                        key={a.id}
                        title={a.name ?? undefined}
                        onClick={() => setFilterAssignee(active ? "" : (a.id ?? ""))}
                        className="flex items-center gap-1 rounded-full transition-all text-[11px] font-medium"
                        style={{
                          padding: active ? '2px 8px 2px 3px' : '2px',
                          background: active ? 'rgba(249,115,22,0.15)' : 'transparent',
                          border: active ? '1px solid rgba(249,115,22,0.4)' : '1px solid transparent',
                          opacity: filterAssignee && !active ? 0.4 : 1
                        }}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black flex-shrink-0"
                          style={{ background: active ? 'linear-gradient(135deg,#f97316,#fb923c)' : 'linear-gradient(135deg,#6b7280,#9ca3af)' }}
                        >
                          {(a.name ?? "").split(' ').map((w: string) => w[0]).slice(0,2).join('')}
                        </div>
                        {active && <span className="text-orange-300 whitespace-nowrap">{(a.name ?? "").split(' ')[0]}</span>}
                      </button>
                    )
                  })}
                </div>
              </>
            )
          })()}
        </div>

        {/* Acciones — siempre visibles, nunca bajan de línea */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Main view tab toggle */}
          <div className="flex items-center gap-0.5 rounded-lg p-1 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setMainView('backlog')}
              className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all"
              style={{ background: mainView === 'backlog' ? 'rgba(249,115,22,0.2)' : 'transparent', color: mainView === 'backlog' ? '#f97316' : '#6b7280', border: mainView === 'backlog' ? '1px solid rgba(249,115,22,0.3)' : '1px solid transparent' }}
            >
              Backlog
            </button>
            <button
              onClick={() => setMainView('sprint')}
              className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1"
              style={{ background: mainView === 'sprint' ? 'rgba(16,185,129,0.2)' : 'transparent', color: mainView === 'sprint' ? '#10b981' : '#6b7280', border: mainView === 'sprint' ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent' }}
            >
              <Rocket size={10} /> Sprint
            </button>
          </div>
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <button onClick={() => setView('kanban')} className={`p-1.5 rounded-md transition-colors ${view === 'kanban' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-white'}`}><LayoutGrid size={14} /></button>
            <button onClick={() => setView('lista')}  className={`p-1.5 rounded-md transition-colors ${view === 'lista'  ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-white'}`}><List size={14} /></button>
          </div>
          {view === 'kanban' && (
            <button
              onClick={() => setKanbanExpanded(v => !v)}
              title={kanbanExpanded ? 'Vista compacta' : 'Vista expandida'}
              className={`p-1.5 rounded-lg border transition-colors ${kanbanExpanded ? 'bg-orange-600/20 border-orange-500/40 text-orange-400' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white'}`}
            >
              {kanbanExpanded ? <ChevronDown size={14} /> : <Filter size={14} />}
            </button>
          )}
          <button
            onClick={() => importFileRef.current?.click()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 rounded-lg transition-colors font-medium"
          >
            <Upload size={13} /> Import
          </button>
          <input ref={importFileRef} type="file" accept=".txt,.md,.markdown,.xml,.html,.htm" className="hidden" onChange={handleFileSelect} />
          <button
            onClick={() => setShowSprintModal(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/60"
            style={{ background: 'rgba(16,185,129,0.08)' }}
          >
            <Rocket size={13} /> Sprint
          </button>
          <button onClick={() => openNew()} className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors font-medium">
            <Plus size={13} /> New
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 min-h-0 ${mainView === 'sprint' ? 'overflow-auto p-6' : (view === 'kanban' ? 'overflow-hidden flex flex-col p-6' : 'overflow-auto p-6')}`}>
        {mainView === 'sprint' && (() => {
          const activeSprint = sprints.find(s => s.status === 'ACTIVE') ?? sprints.find(s => s.status === 'PLANNED') ?? sprints[0]
          if (!activeSprint) return (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <Rocket size={28} className="text-emerald-400" />
              </div>
              <p className="text-gray-400 text-sm">No hay sprints. Crea uno con el botón <span className="text-emerald-400 font-medium">+ Sprint</span>.</p>
              <button onClick={() => setShowSprintModal(true)} className="px-4 py-2 rounded-lg text-sm font-semibold text-emerald-400 transition-all" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
                <Rocket size={13} className="inline mr-1.5" />Nuevo Sprint
              </button>
            </div>
          )
          const sprintItems = items.filter(i => i.sprintId === activeSprint.id)
          const doneCount = sprintItems.filter(i => i.status === 'DONE').length
          const progress = sprintItems.length > 0 ? Math.round((doneCount / sprintItems.length) * 100) : 0
          const bySprintStatus = (status: string) => sprintItems.filter(i => i.status === status)
          const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : null
          const updateSprintStatus = async (newStatus: string) => {
            if (newStatus === 'ACTIVE') {
              const existingActive = sprints.find(s => s.status === 'ACTIVE')
              if (existingActive && existingActive.id !== activeSprint.id) {
                if (!confirm('Ya hay un sprint activo. ¿Cerrarlo y activar este?')) return
                await fetch('/api/backlog/sprints', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: existingActive.id, status: 'CLOSED' }) })
              }
            }
            if (newStatus === 'CLOSED') {
              // Return unfinished items to BACKLOG status (but keep in sprint for history) — or just close
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
            <div className="flex flex-col h-full gap-4">
              {/* Sprint header */}
              <div className="rounded-2xl flex-shrink-0 overflow-hidden" style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)' }}>
                {/* Top bar: ID + status + actions */}
                <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(16,185,129,0.1)', background: 'rgba(16,185,129,0.04)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-mono font-bold tracking-wider" style={{ color: '#10b981' }}>{activeSprint.sprintCode ?? 'SP-???'}</span>
                    <span className="w-px h-3" style={{ background: 'rgba(255,255,255,0.12)' }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ background: activeSprint.status === 'ACTIVE' ? 'rgba(16,185,129,0.2)' : activeSprint.status === 'PLANNED' ? 'rgba(251,191,36,0.2)' : 'rgba(107,114,128,0.2)', color: activeSprint.status === 'ACTIVE' ? '#10b981' : activeSprint.status === 'PLANNED' ? '#fbbf24' : '#9ca3af' }}>
                      {activeSprint.status === 'ACTIVE' ? 'Activo' : activeSprint.status === 'PLANNED' ? 'Planificado' : 'Cerrado'}
                    </span>
                    {fmtDate(activeSprint.startDate) && <span className="text-[11px] text-gray-600">{fmtDate(activeSprint.startDate)} → {fmtDate(activeSprint.endDate) ?? '?'}</span>}
                    {sprints.length > 1 && (
                      <select value={activeSprint.id} onChange={() => {}} className="text-[10px] rounded px-1.5 py-0.5 text-gray-500 focus:outline-none ml-1" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {sprints.map(s => <option key={s.id} value={s.id}>{s.sprintCode ?? '?'} — {s.name.slice(0,30)}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {activeSprint.status === 'PLANNED' && (
                      <button onClick={() => updateSprintStatus('ACTIVE')} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all" style={{ background: 'rgba(16,185,129,0.3)', border: '1px solid rgba(16,185,129,0.5)' }}>▶ Activar</button>
                    )}
                    {activeSprint.status === 'ACTIVE' && (
                      <button onClick={() => { if (confirm('¿Cerrar sprint? Los items sin terminar volverán al Backlog.')) updateSprintStatus('CLOSED') }} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all" style={{ background: 'rgba(107,114,128,0.15)', border: '1px solid rgba(107,114,128,0.35)', color: '#9ca3af' }}>✓ Cerrar Sprint</button>
                    )}
                    <button onClick={() => { setSprintEditForm({ name: activeSprint.name, goal: activeSprint.goal ?? '', startDate: activeSprint.startDate ? activeSprint.startDate.slice(0,10) : '', endDate: activeSprint.endDate ? activeSprint.endDate.slice(0,10) : '' }); setEditingSprint(activeSprint) }} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#6b7280' }}>✎ Editar</button>
                    <button onClick={() => setShowSprintModal(true)} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-400 transition-all" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}>+ Nuevo Sprint</button>
                  </div>
                </div>
                {/* Sprint meta + activities */}
                <div className="px-5 py-4">
                  <h2 className="text-base font-bold text-white leading-snug mb-1">{activeSprint.name}</h2>
                  {activeSprint.goal && <p className="text-[12px] text-gray-500 leading-relaxed mb-3" style={{ whiteSpace: 'pre-line', maxHeight: '60px', overflow: 'hidden' }}>{activeSprint.goal}</p>}
                  {/* Progress bar */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progress}%`, background: progress === 100 ? '#10b981' : 'linear-gradient(90deg,#10b981,#34d399)' }} />
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-400 flex-shrink-0">{doneCount}/{sprintItems.length} · {progress}%</span>
                  </div>
                  {/* Activities breakdown */}
                  <div>
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Actividades ({sprintItems.length})</span>
                      <div className="relative">
                        <button onClick={() => setShowAddItems(v => !v)} className="flex items-center gap-1 text-[10px] font-medium transition-all" style={{ color: showAddItems ? '#f97316' : '#6b7280' }}>
                          <Plus size={10} /> {showAddItems ? 'Cerrar' : 'Gestionar'}
                        </button>
                      </div>
                    </div>

                    {/* Inline add / manage panel — shown when Gestionar is open */}
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
                          {/* Quick-add row */}
                          <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            <input
                              value={sprintQuickAdd.title}
                              onChange={e => setSprintQuickAdd(f => ({ ...f, title: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key !== 'Enter' || !sprintQuickAdd.title.trim()) return
                                setPendingSprintId(activeSprint.id)
                                setForm({ ...EMPTY_FORM, title: sprintQuickAdd.title, type: sprintQuickAdd.type, priority: sprintQuickAdd.priority, assigneeName: userName })
                                setEditItem(null)
                                setSprintQuickAdd(f => ({ ...f, title: '' }))
                                setShowModal(true)
                              }}
                              placeholder="Nueva actividad..."
                              className="flex-1 text-[12px] text-white placeholder-gray-600 focus:outline-none bg-transparent min-w-0"
                            />
                            <select value={sprintQuickAdd.type} onChange={e => setSprintQuickAdd(f => ({ ...f, type: e.target.value }))} className="text-[10px] rounded px-1.5 py-1 text-gray-400 focus:outline-none flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                              {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                            </select>
                            <select value={sprintQuickAdd.priority} onChange={e => setSprintQuickAdd(f => ({ ...f, priority: e.target.value }))} className="text-[10px] rounded px-1.5 py-1 text-gray-400 focus:outline-none flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                              {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                            </select>
                            <button onClick={() => { if (!sprintQuickAdd.title.trim()) return; setPendingSprintId(activeSprint.id); setForm({ ...EMPTY_FORM, title: sprintQuickAdd.title, type: sprintQuickAdd.type, priority: sprintQuickAdd.priority, assigneeName: userName }); setEditItem(null); setSprintQuickAdd(f => ({ ...f, title: '' })); setShowModal(true) }} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-white flex-shrink-0 transition-all" style={{ background: 'rgba(249,115,22,0.3)', border: '1px solid rgba(249,115,22,0.5)' }}>
                              <Plus size={10} /> Agregar
                            </button>
                            <button onClick={() => importFileRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium flex-shrink-0 transition-all" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#6b7280' }}>
                              <Upload size={10} /> Importar
                            </button>
                          </div>
                          {/* Existing backlog items to pull in */}
                          {availableItems.length > 0 && (
                            <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                              <div className="px-3 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <p className="text-[10px] text-gray-600 uppercase tracking-wide font-semibold">Agregar del backlog</p>
                              </div>
                              {availableItems.map(item => (
                                <button key={item.id} onClick={() => addToSprint(item)} className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                  <Plus size={9} className="text-emerald-400 flex-shrink-0" />
                                  <span className="text-[11px] text-gray-400 truncate flex-1">{item.title}</span>
                                  <span className="text-[10px] text-gray-600 flex-shrink-0">{STATUSES.find(s => s.key === item.status)?.label ?? item.status}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {/* Items in sprint to remove */}
                          {sprintItems.length > 0 && (
                            <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                              <div className="px-3 py-1.5" style={{ borderTop: availableItems.length > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <p className="text-[10px] text-gray-600 uppercase tracking-wide font-semibold">Quitar del sprint</p>
                              </div>
                              {sprintItems.map(item => (
                                <button key={item.id} onClick={() => removeFromSprint(item)} className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                  <X size={9} className="text-red-400 flex-shrink-0" />
                                  <span className="text-[11px] text-gray-400 truncate flex-1">{item.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* Activities list */}
                    {sprintItems.length === 0 ? (
                      <p className="text-[11px] text-gray-700 py-1">Sin actividades — abrí Gestionar para agregar.</p>
                    ) : (
                      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                        {sprintItems.map((item, idx) => {
                          const statusMeta = STATUSES.find(s => s.key === item.status)
                          const typeMeta = TYPES.find(t => t.key === item.type)
                          const TypeIcon = typeMeta?.icon
                          return (
                            <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:bg-white/[0.03]" style={{ borderBottom: idx < sprintItems.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }} onClick={() => setViewItem(item)}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusMeta?.color ?? 'bg-gray-500'}`} />
                              {item.taskCode && <span className="text-[9px] font-bold flex-shrink-0 px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>{item.taskCode}</span>}
                              <span className="text-[12px] text-gray-200 flex-1 truncate">{item.title}</span>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {TypeIcon && <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${typeMeta?.color}`}><TypeIcon size={9} /></span>}
                                <PriorityDot priority={item.priority} />
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: item.status === 'DONE' ? 'rgba(16,185,129,0.15)' : item.status === 'IN_PROGRESS' ? 'rgba(59,130,246,0.15)' : item.status === 'BLOCKED' ? 'rgba(239,68,68,0.15)' : 'rgba(107,114,128,0.15)', color: item.status === 'DONE' ? '#10b981' : item.status === 'IN_PROGRESS' ? '#60a5fa' : item.status === 'BLOCKED' ? '#f87171' : '#9ca3af' }}>
                                  {statusMeta?.label ?? item.status}
                                </span>
                                {item.assigneeName && <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-black flex-shrink-0" style={{ background: 'linear-gradient(135deg,#f97316,#fb923c)' }} title={item.assigneeName}>{item.assigneeName.split(' ').map((w: string) => w[0]).slice(0,2).join('')}</div>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
        {mainView === 'backlog' && <>

        {/* Kanban */}
        {view === 'kanban' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex gap-3 flex-1 min-h-0 overflow-x-auto">
            {STATUSES.map(col => {
              const colItems = byStatus(col.key)
              return (
                <div key={col.key} className="flex flex-col flex-1 min-w-[200px] min-h-0 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {/* Column header */}
                  <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-4 rounded-full ${col.color} opacity-80`} />
                      <span className="text-[13px] font-semibold text-white tracking-tight">{col.label}</span>
                      <span className="text-[10px] font-medium text-gray-400 px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,0.06)' }}>{colItems.length}</span>
                    </div>
                    <button onClick={() => openNew(col.key)} className="text-gray-600 hover:text-orange-400 transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto space-y-1.5 p-2">
                    {colItems.map(item => (
                      <div key={item.id} className="rounded-xl transition-all group cursor-default" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }} onMouseEnter={e => (e.currentTarget.style.borderColor='rgba(255,255,255,0.13)')} onMouseLeave={e => (e.currentTarget.style.borderColor='rgba(255,255,255,0.07)')}>

                        {/* Compact view (default) */}
                        {!kanbanExpanded ? (
                          <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer" onClick={() => setViewItem(item)}>
                            <PriorityDot priority={item.priority} />
                            <p className="flex-1 text-[11px] text-white leading-snug truncate">{item.title}</p>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {item.taskCode && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>{item.taskCode}</span>
                              )}
                              {item.assigneeName && (
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-[9px] font-bold text-black" title={item.assigneeName}>
                                  {item.assigneeName.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                        /* Expanded view */
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <PriorityDot priority={item.priority} />
                              <TypeBadge type={item.type} />
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button onClick={() => setViewItem(item)} className="text-gray-500 hover:text-blue-400 transition-colors"><Eye size={11} /></button>
                            </div>
                          </div>
                          <p className="text-[11px] text-white font-medium leading-snug mb-2.5">{item.title}</p>
                          {item.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2.5">{item.description}</p>}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <SolutionBadge solucion={item.solucion} />
                              {item.taskCode && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>{item.taskCode}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {item.assigneeName && (
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-[9px] font-bold text-black flex-shrink-0" title={item.assigneeName}>
                                  {item.assigneeName.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                                </div>
                              )}
                              <span className="text-[10px] text-gray-500">{new Date(item.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>
                            </div>
                          </div>
                        </div>
                        )}
                      </div>
                    ))}

                    {colItems.length === 0 && (
                      <button onClick={() => openNew(col.key)} className="w-full py-6 border-2 border-dashed border-gray-800 rounded-xl text-xs text-gray-700 hover:border-gray-700 hover:text-gray-500 transition-colors">
                        + Agregar tarea
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
            </div>
          </div>
        )}

        {/* Lista */}

        {view === 'lista' && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr className="text-xs text-gray-400 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Tarea</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-left px-4 py-3">Prioridad</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-left px-4 py-3">Solución</th>
                  <th className="text-left px-4 py-3">Responsable</th>
                  <th className="text-center px-4 py-3">Pts</th>
                  <th className="text-center px-4 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-600 text-sm">Sin ítems en el backlog</td></tr>
                ) : filtered.map(item => {
                  const st = STATUSES.find(s => s.key === item.status)
                  const pr = PRIORITIES.find(p => p.key === item.priority)
                  return (
                    <tr key={item.id} className="hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-white font-medium">{item.title}</p>
                          {item.taskCode && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>{item.taskCode}</span>}
                        </div>
                        {item.description && <p className="text-xs text-gray-500 truncate max-w-xs">{item.description}</p>}
                      </td>
                      <td className="px-4 py-3"><TypeBadge type={item.type} /></td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 text-xs ${pr?.color}`}>
                          <span className={`w-2 h-2 rounded-full ${pr?.dot}`} /> {pr?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <select value={item.status} onChange={e => changeStatus(item, e.target.value)}
                          className="text-xs bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-orange-500">
                          {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3"><SolutionBadge solucion={item.solucion} /></td>
                      <td className="px-4 py-3 text-xs text-gray-400">{item.assigneeName ?? '—'}</td>
                      <td className="px-4 py-3 text-center"><PointsBadge points={item.points} /></td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => setViewItem(item)} className="text-gray-500 hover:text-blue-400 transition-colors"><Eye size={13} /></button>
                          <button onClick={() => openEdit(item)} className="text-gray-500 hover:text-white transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => setConfirmDel(item)} className="text-gray-600 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        </>
      }
      </div>

      {/* Modal crear/editar ítem */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="w-full max-w-lg shadow-2xl rounded-2xl overflow-hidden" style={{ background: 'rgba(10,12,28,0.98)', border: '1px solid rgba(255,255,255,0.09)' }}>
            {/* Accent bar */}
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #f97316, #fb923c44)' }} />
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <h2 className="text-base font-semibold text-white">{editItem ? 'Editar tarea' : 'Nueva tarea'}</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">Completá los campos para registrar el ítem</p>
              </div>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.05)' }}><X size={14} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Título *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                  placeholder="¿Qué hay que hacer?"
                  className={inputCls}
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', fontSize: '15px', fontWeight: 500, padding: '10px 14px' }}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide">Descripción</label>
                  <span className="text-[10px] text-gray-600">{form.description.length} chars</span>
                </div>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Contexto, objetivos, criterios de aceptación..."
                  className={inputCls + ' resize-y'}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', minHeight: '88px', lineHeight: '1.6', padding: '10px 14px' }}
                />
              </div>
              {/* Separador */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Tipo</label>
                  <CustomSelect value={form.type} onChange={v => setForm({...form, type: v})} options={TYPES.map(t => ({ value: t.key, label: t.label }))} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Prioridad</label>
                  <CustomSelect value={form.priority} onChange={v => setForm({...form, priority: v})} options={PRIORITIES.map(p => ({ value: p.key, label: p.label }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Estado</label>
                  <CustomSelect value={form.status} onChange={v => setForm({...form, status: v})} options={STATUSES.map(s => ({ value: s.key, label: s.label }))} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Story points</label>
                  <input type="number" min={0} max={100} value={form.points} onChange={e => setForm({...form, points: e.target.value})} placeholder="0" className={inputCls} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', padding: '8px 12px' }} />
                </div>
              </div>

              {/* Separador */}
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

              <div className="grid grid-cols-2 gap-3">

                <div>
                  <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Solución asociada *</label>
                  <CustomSelect value={form.solucionId} onChange={v => setForm({...form, solucionId: v})} placeholder="Selecciona una solución…" options={soluciones.map(s => ({ value: s.id, label: `${SOLUCION_TIPO_LABELS[s.tipo] ?? s.tipo}: ${s.nombre}` }))} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Responsable</label>
                <CustomSelect
                  value={form.assigneeId}
                  onChange={v => { const u = users.find(x => x.id === v); setForm({ ...form, assigneeId: v, assigneeName: u?.name ?? '' }) }}
                  placeholder="Sin asignar"
                  options={[{ value: '', label: 'Sin asignar' }, ...users.map(u => ({ value: u.id, label: u.name }))]}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 pb-1">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancelar</button>
                <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 transition-colors disabled:opacity-50" style={{ background: saving ? '#c2410c' : '#ea580c' }}>
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {editItem ? 'Guardar cambios' : 'Crear tarea'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item detail popup */}
      {viewItem && (
        <BacklogItemDetail
          item={viewItem}
          onClose={() => setViewItem(null)}
          currentUserName={userName}
          onEdit={() => { setViewItem(null); openEdit(viewItem) }}
          onDelete={() => { setViewItem(null); setConfirmDel(viewItem) }}
          onStatusChange={async (item, newStatus) => {
            const res = await fetch(`/api/backlog/${item.id}`, {
              method: 'PUT', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...item, status: newStatus, solucionId: item.solucionId, assigneeName: item.assigneeName }),
            })
            if (res.ok) {
              const updated = await res.json()
              setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
              setViewItem(updated)
            }
          }}
        />
      )}

      {/* Import modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)' }}>
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
                  <Upload className="text-orange-400" size={16} />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg leading-none">Importar tareas</h2>
                  <p className="text-orange-400/70 text-xs mt-0.5">{importTasks.filter(t => t.selected).length} de {importTasks.length} seleccionadas</p>
                </div>
              </div>
              <button onClick={() => setShowImportModal(false)} disabled={importing} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors disabled:opacity-50">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
              {/* Defaults */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-3">Configuración por defecto (aplica a todas)</p>
                <div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Solución asociada <span className="text-orange-400">*</span></label>
                    <select value={importDefaults.solucionId} onChange={e => setImportDefaults(d => ({ ...d, solucionId: e.target.value }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500">
                      <option value="">Selecciona una solución…</option>
                      {soluciones.map(s => <option key={s.id} value={s.id}>{SOLUCION_TIPO_LABELS[s.tipo] ?? s.tipo}: {s.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                    <select value={importDefaults.type} onChange={e => setImportDefaults(d => ({ ...d, type: e.target.value }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500">
                      {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Prioridad</label>
                    <select value={importDefaults.priority} onChange={e => setImportDefaults(d => ({ ...d, priority: e.target.value }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500">
                      {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Estado inicial</label>
                    <select value={importDefaults.status} onChange={e => setImportDefaults(d => ({ ...d, status: e.target.value }))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500">
                      {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Story points</label>
                    <input type="number" min={0} max={100} value={importDefaults.points} onChange={e => setImportDefaults(d => ({ ...d, points: e.target.value }))} placeholder="0" className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">Responsable</label>
                    <select value={importDefaults.assigneeId} onChange={e => { const u = users.find(x => x.id === e.target.value); setImportDefaults(d => ({ ...d, assigneeId: e.target.value, assigneeName: u?.name ?? '' })) }} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500">
                      <option value="">Sin asignar</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Task list */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Tareas detectadas</p>
                  <div className="flex gap-3">
                    <button onClick={() => setImportTasks(ts => ts.map(t => ({ ...t, selected: true })))} className="text-xs text-orange-400 hover:text-orange-300 transition-colors">Seleccionar todo</button>
                    <button onClick={() => setImportTasks(ts => ts.map(t => ({ ...t, selected: false })))} className="text-xs text-gray-500 hover:text-gray-400 transition-colors">Deseleccionar</button>
                  </div>
                </div>
                <div className="space-y-2">
                  {importTasks.map(task => (
                    <div key={task.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${task.selected ? 'bg-gray-800 border-gray-700' : 'bg-gray-950 border-gray-800 opacity-50'}`}>
                      <button onClick={() => setImportTasks(ts => ts.map(t => t.id === task.id ? { ...t, selected: !t.selected } : t))} className="mt-0.5 flex-shrink-0 text-orange-400">
                        {task.selected ? <CheckSquare size={16} /> : <Square size={16} className="text-gray-600" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          value={task.title}
                          onChange={e => setImportTasks(ts => ts.map(t => t.id === task.id ? { ...t, title: e.target.value } : t))}
                          className="w-full bg-transparent text-sm text-white focus:outline-none border-b border-transparent focus:border-orange-500 pb-0.5 transition-colors"
                        />
                        {task.description && <p className="text-xs text-gray-500 mt-1 truncate">{task.description}</p>}
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={task.points ?? importDefaults.points}
                        onChange={e => setImportTasks(ts => ts.map(t => t.id === task.id ? { ...t, points: e.target.value } : t))}
                        className="w-14 flex-shrink-0 text-center text-xs bg-gray-700 border border-gray-600 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-orange-500"
                        placeholder="pts"
                        title="Story points"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-gray-800">
              {importError && (
                <p className="text-red-400 text-xs mb-3 flex items-center gap-1.5"><X size={12} />{importError}</p>
              )}
              <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={() => setShowImportModal(false)} disabled={importing} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 text-sm disabled:opacity-50">Cancelar</button>
                <button onClick={handleImportSubmit} disabled={importing} className="inline-flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-800 text-white rounded-lg text-sm font-semibold transition-colors">
                  {importing ? <><Loader2 size={13} className="animate-spin" /> Importando…</> : <><Upload size={13} /> Importar {importTasks.filter(t => t.selected).length} tareas</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="text-white font-semibold mb-2">Eliminar tarea</h3>
            <p className="text-gray-400 text-sm mb-5">¿Eliminar <span className="text-white font-medium">"{confirmDel.title}"</span>? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 text-sm">Cancelar</button>
              <button onClick={deleteItem} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm">Eliminar</button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Sprint Modal */}
      {editingSprint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setEditingSprint(null)}>
          <div className="w-full rounded-2xl overflow-hidden" style={{ maxWidth: '480px', background: 'rgba(10,12,26,0.98)', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#10b981,#34d399)' }} />
            <div className="p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Rocket size={16} className="text-emerald-400" /><h2 className="text-sm font-semibold text-white">Editar Sprint</h2></div>
                <button onClick={() => setEditingSprint(null)} className="text-gray-600 hover:text-white transition-colors"><X size={16} /></button>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              <div><label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Nombre del sprint</label><input autoFocus value={sprintEditForm.name} onChange={e => setSprintEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Sprint 1" className="w-full rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', padding: '10px 14px' }} /></div>
              <div><label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Objetivo</label><textarea value={sprintEditForm.goal} onChange={e => setSprintEditForm(f => ({ ...f, goal: e.target.value }))} placeholder="¿Qué queremos lograr?" rows={2} className="w-full rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none resize-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', padding: '10px 14px' }} /></div>
              {/* Activities in this sprint */}
              {(() => {
                const currentItems = items.filter(i => i.sprintId === editingSprint.id)
                const available = items.filter(i => !i.sprintId && i.status !== 'DONE')
                const addItem = async (item: BacklogItem) => {
                  const res = await fetch(`/api/backlog/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...item, sprintId: editingSprint.id, solucionId: item.solucionId }) })
                  if (res.ok) { const u = await res.json(); setItems(prev => prev.map(i => i.id === u.id ? u : i)) }
                }
                const removeItem = async (item: BacklogItem) => {
                  const res = await fetch(`/api/backlog/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...item, sprintId: null, solucionId: item.solucionId }) })
                  if (res.ok) { const u = await res.json(); setItems(prev => prev.map(i => i.id === u.id ? u : i)) }
                }
                return (
                  <div>
                    <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Actividades</label>
                    {/* Quick-add nueva */}
                    <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <input
                        value={sprintQuickAdd.title}
                        onChange={e => setSprintQuickAdd(f => ({ ...f, title: e.target.value }))}
                        onKeyDown={e => {
                          if (e.key !== 'Enter' || !sprintQuickAdd.title.trim()) return
                          setPendingSprintId(editingSprint.id)
                          setForm({ ...EMPTY_FORM, title: sprintQuickAdd.title, type: sprintQuickAdd.type, priority: sprintQuickAdd.priority, assigneeName: userName })
                          setEditItem(null)
                          setSprintQuickAdd(f => ({ ...f, title: '' }))
                          setEditingSprint(null)
                          setShowModal(true)
                        }}
                        placeholder="Nueva actividad (Enter para formulario)..."
                        className="flex-1 text-[12px] text-white placeholder-gray-600 focus:outline-none bg-transparent min-w-0"
                      />
                      <select value={sprintQuickAdd.type} onChange={e => setSprintQuickAdd(f => ({ ...f, type: e.target.value }))} className="text-[10px] rounded px-1.5 py-1 text-gray-500 focus:outline-none flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                      <button onClick={() => { if (!sprintQuickAdd.title.trim()) return; setPendingSprintId(editingSprint.id); setForm({ ...EMPTY_FORM, title: sprintQuickAdd.title, type: sprintQuickAdd.type, priority: sprintQuickAdd.priority, assigneeName: userName }); setEditItem(null); setSprintQuickAdd(f => ({ ...f, title: '' })); setEditingSprint(null); setShowModal(true) }} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-white flex-shrink-0" style={{ background: 'rgba(249,115,22,0.3)', border: '1px solid rgba(249,115,22,0.5)' }}>
                        <Plus size={9} /> Agregar
                      </button>
                    </div>
                    {/* Current activities */}
                    {currentItems.length > 0 && (
                      <div className="rounded-xl overflow-hidden mb-2" style={{ border: '1px solid rgba(255,255,255,0.07)', maxHeight: '120px', overflowY: 'auto' }}>
                        {currentItems.map((item, idx) => {
                          const st = STATUSES.find(s => s.key === item.status)
                          return (
                            <div key={item.id} className="flex items-center gap-2 px-3 py-2 group" style={{ borderBottom: idx < currentItems.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: 'rgba(255,255,255,0.02)' }}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st?.color ?? 'bg-gray-500'}`} />
                              {item.taskCode && <span className="text-[9px] font-bold flex-shrink-0 px-1 py-0.5 rounded" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>{item.taskCode}</span>}
                              <span className="text-[11px] text-gray-300 flex-1 truncate">{item.title}</span>
                              <span className="text-[10px] text-gray-600 flex-shrink-0 mr-1">{st?.label}</span>
                              <button onClick={() => removeItem(item)} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400 flex-shrink-0"><X size={11} /></button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {/* Backlog items to add - colapsable */}
                    {available.length > 0 && (
                      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                        <button
                          type="button"
                          onClick={() => setShowAddItems(v => !v)}
                          className="w-full flex items-center justify-between px-3 py-2 transition-colors hover:bg-white/[0.03]"
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Del backlog</p>
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>{available.length}</span>
                          </div>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 transition-transform" style={{ transform: showAddItems ? 'rotate(180deg)' : 'rotate(0deg)' }}><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        {showAddItems && (
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', maxHeight: '150px', overflowY: 'auto' }}>
                            {available.map(item => (
                              <button key={item.id} onClick={() => addItem(item)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.04]" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <Plus size={9} className="text-emerald-400 flex-shrink-0" />
                                <span className="text-[11px] text-gray-400 truncate flex-1">{item.title}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })()}
              {/* Dates - below activities */}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5"><Calendar size={11} className="text-gray-500" /> Inicio</label><input type="date" value={sprintEditForm.startDate} onChange={e => setSprintEditForm(f => ({ ...f, startDate: e.target.value }))} className="w-full rounded-lg text-sm text-white focus:outline-none" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', padding: '8px 12px', colorScheme: 'dark' }} /></div>
                <div><label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5"><Calendar size={11} className="text-gray-500" /> Fin</label><input type="date" value={sprintEditForm.endDate} onChange={e => setSprintEditForm(f => ({ ...f, endDate: e.target.value }))} className="w-full rounded-lg text-sm text-white focus:outline-none" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', padding: '8px 12px', colorScheme: 'dark' }} /></div>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditingSprint(null)} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancelar</button>
                <button type="button" disabled={!sprintEditForm.name.trim() || savingSprintEdit} onClick={async () => {
                  if (!sprintEditForm.name.trim()) return
                  setSavingSprintEdit(true)
                  try {
                    const res = await fetch('/api/backlog/sprints/edit', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: editingSprint.id, name: sprintEditForm.name, goal: sprintEditForm.goal, startDate: sprintEditForm.startDate, endDate: sprintEditForm.endDate }),
                    })
                    if (res.ok) { const updated = await res.json(); setSprints(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s)) }
                  } finally {
                    setSavingSprintEdit(false)
                    setEditingSprint(null)
                  }
                }} className="px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-50" style={{ background: savingSprintEdit ? '#059669' : '#10b981' }}>{savingSprintEdit ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}{savingSprintEdit ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Sprint Modal */}
      {showSprintModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowSprintModal(false) }}
        >
          <div className="w-full shadow-2xl rounded-2xl overflow-hidden flex flex-col" style={{ maxWidth: '560px', background: 'rgba(10,12,28,0.98)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #10b981, #34d39944)' }} />
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}><Rocket size={15} className="text-emerald-400" /></div>
                <div><h2 className="text-sm font-semibold text-white">Nuevo Sprint</h2><p className="text-[11px] text-gray-500 mt-0.5">Agrupa items del backlog en un ciclo</p></div>
              </div>
              <button onClick={() => setShowSprintModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.05)' }}><X size={14} /></button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5">Nombre del sprint *</label>
                <input value={sprintForm.name} onChange={e => setSprintForm({ ...sprintForm, name: e.target.value })} placeholder="Ej: Sprint 1 - MVP Backlog" className="w-full rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', padding: '10px 14px' }} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5"><label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide">Objetivo del sprint</label><span className="text-[10px] text-gray-600">{sprintForm.goal.length} chars</span></div>
                <textarea rows={3} value={sprintForm.goal} onChange={e => setSprintForm({ ...sprintForm, goal: e.target.value })} placeholder="Que se espera lograr al finalizar este sprint?" className="w-full rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none resize-none" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '10px 14px', lineHeight: '1.6' }} />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">Actividades</label>
                {/* Quick-add nueva */}
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <input
                    value={sprintQuickAdd.title}
                    onChange={e => setSprintQuickAdd(f => ({ ...f, title: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key !== 'Enter' || !sprintQuickAdd.title.trim()) return
                      setPendingSprintId('__new__')
                      setForm({ ...EMPTY_FORM, title: sprintQuickAdd.title, type: sprintQuickAdd.type, priority: sprintQuickAdd.priority, assigneeName: userName })
                      setEditItem(null)
                      setSprintQuickAdd(f => ({ ...f, title: '' }))
                      setShowSprintModal(false)
                      setShowModal(true)
                    }}
                    placeholder="Nueva actividad (Enter abre formulario)..."
                    className="flex-1 text-[12px] text-white placeholder-gray-600 focus:outline-none bg-transparent min-w-0"
                  />
                  <select value={sprintQuickAdd.type} onChange={e => setSprintQuickAdd(f => ({ ...f, type: e.target.value }))} className="text-[10px] rounded px-1.5 py-1 text-gray-500 focus:outline-none flex-shrink-0" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                  <button type="button" onClick={() => { if (!sprintQuickAdd.title.trim()) return; setPendingSprintId('__new__'); setForm({ ...EMPTY_FORM, title: sprintQuickAdd.title, type: sprintQuickAdd.type, priority: sprintQuickAdd.priority, assigneeName: userName }); setEditItem(null); setSprintQuickAdd(f => ({ ...f, title: '' })); setShowSprintModal(false); setShowModal(true) }} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-white flex-shrink-0" style={{ background: 'rgba(249,115,22,0.3)', border: '1px solid rgba(249,115,22,0.5)' }}>
                    <Plus size={9} /> Agregar
                  </button>
                </div>
                {/* Items ya seleccionados */}
                {sprintForm.items.length > 0 && (
                  <div className="rounded-xl overflow-hidden mb-2" style={{ border: '1px solid rgba(16,185,129,0.15)', maxHeight: '100px', overflowY: 'auto' }}>
                    {items.filter(i => sprintForm.items.includes(i.id)).map((item, idx, arr) => (
                      <div key={item.id} className="flex items-center gap-2 px-3 py-2 group" style={{ borderBottom: idx < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: 'rgba(16,185,129,0.03)' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                        <span className="text-[11px] text-gray-300 flex-1 truncate">{item.title}</span>
                        <button type="button" onClick={() => setSprintForm(f => ({ ...f, items: f.items.filter((x: string) => x !== item.id) }))} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-400 flex-shrink-0"><X size={11} /></button>
                      </div>
                    ))}
                  </div>
                )}
                {/* Del backlog disponible - colapsable */}
                {(() => {
                  const available = items.filter(i => !i.sprintId && i.status !== 'DONE' && !sprintForm.items.includes(i.id))
                  if (available.length === 0) return null
                  return (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                      <button
                        type="button"
                        onClick={() => setShowAddItems(v => !v)}
                        className="w-full flex items-center justify-between px-3 py-2 transition-colors hover:bg-white/[0.03]"
                      >
                        <div className="flex items-center gap-2">
                          <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Del backlog disponible</p>
                          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#6b7280' }}>{available.length}</span>
                        </div>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600 transition-transform" style={{ transform: showAddItems ? 'rotate(180deg)' : 'rotate(0deg)' }}><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                      {showAddItems && (
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', maxHeight: '150px', overflowY: 'auto' }}>
                          {available.map(item => (
                            <button key={item.id} type="button" onClick={() => setSprintForm(f => ({ ...f, items: [...f.items, item.id] }))} className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-white/[0.04]" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                              <Plus size={9} className="text-emerald-400 flex-shrink-0" />
                              <span className="text-[11px] text-gray-400 truncate flex-1">{item.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5"><Calendar size={11} className="text-gray-500" /> Inicio</label><input type="date" value={sprintForm.startDate} onChange={e => setSprintForm({ ...sprintForm, startDate: e.target.value })} className="w-full rounded-lg text-sm text-white focus:outline-none" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', padding: '8px 12px', colorScheme: 'dark' }} /></div>
                <div><label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-1.5"><Calendar size={11} className="text-gray-500" /> Fin</label><input type="date" value={sprintForm.endDate} onChange={e => setSprintForm({ ...sprintForm, endDate: e.target.value })} className="w-full rounded-lg text-sm text-white focus:outline-none" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', padding: '8px 12px', colorScheme: 'dark' }} /></div>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />
              <div className="flex justify-end gap-2 pt-1 pb-1">
                <button type="button" onClick={() => { setShowSprintModal(false); setSprintForm({ name: '', goal: '', startDate: '', endDate: '', items: [] }) }} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>Cancelar</button>
                <button type="button" disabled={!sprintForm.name.trim() || savingSprint} onClick={async () => {
                  if (!sprintForm.name.trim()) return
                  setSavingSprint(true)
                  try {
                    const res = await fetch('/api/backlog/sprints', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: sprintForm.name, goal: sprintForm.goal, startDate: sprintForm.startDate, endDate: sprintForm.endDate }),
                    })
                    if (res.ok) {
                      const newSprint: Sprint = await res.json()
                      // assign selected items to this sprint
                      const assigned: BacklogItem[] = []
                      for (const itemId of sprintForm.items) {
                        const item = items.find(i => i.id === itemId)
                        if (!item) continue
                        const r = await fetch(`/api/backlog/${itemId}`, {
                          method: 'PUT', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ ...item, sprintId: newSprint.id, solucionId: item.solucionId }),
                        })
                        if (r.ok) assigned.push(await r.json())
                      }
                      setItems(prev => prev.map(i => { const a = assigned.find(x => x.id === i.id); return a ?? i }))
                      setSprints(prev => [newSprint, ...prev])
                      setMainView('sprint')
                    }
                  } finally {
                    setSavingSprint(false)
                    setShowSprintModal(false)
                    setSprintForm({ name: '', goal: '', startDate: '', endDate: '', items: [] })
                  }
                }} className="px-5 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2 disabled:opacity-50" style={{ background: savingSprint ? '#059669' : '#10b981' }}>{savingSprint ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}{savingSprint ? 'Creando...' : 'Crear Sprint'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
