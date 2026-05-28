'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, LayoutGrid, List, X, Loader2, Flag, Zap, Bug, Wrench, TrendingUp, CreditCard, ChevronDown, Pencil, Trash2, Filter, Eye } from 'lucide-react'
import BacklogItemDetail from '@/components/BacklogItemDetail'

interface Project {
  id: string
  name: string
}

interface BacklogItem {
  id: string
  title: string
  description: string | null
  type: string
  priority: string
  status: string
  points: number | null
  projectId: string | null
  project: { id: string; name: string } | null
  assigneeId: string | null
  assigneeName: string | null
  createdAt: string
}

const STATUSES = [
  { key: 'BACKLOG',     label: 'Backlog',      color: 'bg-gray-500',   border: 'border-gray-500/30', bg: 'bg-gray-500/5'   },
  { key: 'IN_PROGRESS', label: 'En Progreso',  color: 'bg-blue-500',   border: 'border-blue-500/30', bg: 'bg-blue-500/5'   },
  { key: 'REVIEW',      label: 'Review',       color: 'bg-yellow-500', border: 'border-yellow-500/30', bg: 'bg-yellow-500/5' },
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
  status: 'BACKLOG', points: '', projectId: '', assigneeId: '', assigneeName: '',
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

export default function BacklogPage() {
  const { data: session } = useSession()
  const [items, setItems]   = useState<BacklogItem[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView]         = useState<'kanban' | 'lista'>('kanban')
  const [kanbanExpanded, setKanbanExpanded] = useState(false)
  const [viewItem, setViewItem] = useState<BacklogItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem]   = useState<BacklogItem | null>(null)
  const [form, setForm]     = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDel, setConfirmDel] = useState<BacklogItem | null>(null)
  const [filterProject, setFilterProject] = useState('')
  const [filterType, setFilterType]     = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([])

  const userName = (session?.user as any)?.name ?? ''

  const load = async () => {
    const [i, p, u] = await Promise.all([
      fetch('/api/backlog').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ])
    setItems(Array.isArray(i) ? i : [])
    setProjects(Array.isArray(p) ? p.map((x: any) => ({ id: x.id, name: x.name })) : [])
    setUsers(Array.isArray(u) ? u.filter((x: any) => x.role !== 'SUPERADMIN') : [])
    setLoading(false)
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
      projectId: item.projectId ?? '', assigneeId: item.assigneeId ?? '', assigneeName: item.assigneeName ?? '',
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)
    const body = { ...form, points: form.points ? Number(form.points) : null, projectId: form.projectId || null }
    if (editItem) {
      const res = await fetch(`/api/backlog/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) { const updated = await res.json(); setItems(prev => prev.map(i => i.id === updated.id ? updated : i)) }
    } else {
      const res = await fetch('/api/backlog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) { const created = await res.json(); setItems(prev => [created, ...prev]) }
    }
    setSaving(false)
    setShowModal(false)
  }

  const deleteItem = async () => {
    if (!confirmDel) return
    await fetch(`/api/backlog/${confirmDel.id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== confirmDel.id))
    setConfirmDel(null)
  }

  const changeStatus = async (item: BacklogItem, newStatus: string) => {
    const res = await fetch(`/api/backlog/${item.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...item, status: newStatus, projectId: item.projectId, assigneeName: item.assigneeName }),
    })
    if (res.ok) { const updated = await res.json(); setItems(prev => prev.map(i => i.id === updated.id ? updated : i)) }
  }

  const filtered = items.filter(i => {
    if (filterProject && i.projectId !== filterProject) return false
    if (filterType && i.type !== filterType) return false
    if (filterPriority && i.priority !== filterPriority) return false
    return true
  })

  const byStatus = (status: string) => filtered.filter(i => i.status === status)
  const totalDone = items.filter(i => i.status === 'DONE').length
  const totalPoints = items.filter(i => i.status === 'DONE').reduce((a, i) => a + (i.points ?? 0), 0)

  const inputCls = 'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500'

  if (loading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin text-orange-500" size={28} /></div>

  return (
    <div className="flex flex-col h-screen overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-gray-800 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Backlog</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {items.length} ítems · {totalDone} completados · {totalPoints} pts entregados
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Filters */}
          <div className="flex items-center gap-1.5">
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-300 focus:outline-none focus:border-orange-500">
              <option value="">Todos los proyectos</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-300 focus:outline-none focus:border-orange-500">
              <option value="">Todos los tipos</option>
              {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-300 focus:outline-none focus:border-orange-500">
              <option value="">Todas las prioridades</option>
              {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
            <button onClick={() => setView('kanban')} className={`p-1.5 rounded-md transition-colors ${view === 'kanban' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-white'}`}><LayoutGrid size={14} /></button>
            <button onClick={() => setView('lista')}  className={`p-1.5 rounded-md transition-colors ${view === 'lista'  ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-white'}`}><List size={14} /></button>
          </div>
          {view === 'kanban' && (
            <button
              onClick={() => setKanbanExpanded(v => !v)}
              title={kanbanExpanded ? 'Vista compacta' : 'Vista expandida'}
              className={`p-1.5 rounded-lg border transition-colors text-xs ${kanbanExpanded ? 'bg-orange-600/20 border-orange-500/40 text-orange-400' : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-white'}`}
            >
              {kanbanExpanded ? <ChevronDown size={14} /> : <Filter size={14} />}
            </button>
          )}

          <button onClick={() => openNew()} className="flex items-center gap-1.5 text-xs px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors font-medium">
            <Plus size={14} /> Nueva tarea
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 min-h-0 p-6 ${view === 'kanban' ? 'overflow-hidden flex flex-col' : 'overflow-auto'}`}>

        {/* Kanban */}
        {view === 'kanban' && (
          <div className="flex gap-3 flex-1 min-h-0 overflow-x-auto">
            {STATUSES.map(col => {
              const colItems = byStatus(col.key)
              return (
                <div key={col.key} className="flex flex-col flex-1 min-w-[180px] min-h-0">
                  {/* Column header */}
                  <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border ${col.border} ${col.bg} mb-2`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                      <span className="text-sm font-semibold text-white">{col.label}</span>
                      <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded-full">{colItems.length}</span>
                    </div>
                    <button onClick={() => openNew(col.key)} className="text-gray-600 hover:text-orange-400 transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {colItems.map(item => (
                      <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors group">

                        {/* Compact view (default) */}
                        {!kanbanExpanded ? (
                          <div className="flex items-center gap-2 px-3 py-2.5">
                            <PriorityDot priority={item.priority} />
                            <p className="flex-1 text-[11px] text-white leading-snug truncate">{item.title}</p>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {item.assigneeName && (
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-[9px] font-bold text-black" title={item.assigneeName}>
                                  {item.assigneeName.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                                </div>
                              )}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setViewItem(item)} className="text-gray-600 hover:text-blue-400 transition-colors"><Eye size={11} /></button>
                              </div>
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
                          <p className="text-[11px] text-white font-medium leading-snug mb-2">{item.title}</p>
                          {item.description && <p className="text-xs text-gray-500 line-clamp-2 mb-2">{item.description}</p>}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <PointsBadge points={item.points} />
                              {item.project && <span className="text-[10px] text-orange-400/70 bg-orange-500/10 px-1.5 py-0.5 rounded truncate max-w-[120px]">{item.project.name}</span>}
                            </div>
                            {item.assigneeName && (
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-[9px] font-bold text-black flex-shrink-0" title={item.assigneeName}>
                                {item.assigneeName.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                              </div>
                            )}
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-800">
                            <select value={item.status} onChange={e => changeStatus(item, e.target.value)}
                              className="w-full text-[10px] bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-gray-400 focus:outline-none focus:border-orange-500">
                              {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                            </select>
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
                  <th className="text-left px-4 py-3">Proyecto</th>
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
                        <p className="text-sm text-white font-medium">{item.title}</p>
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
                      <td className="px-4 py-3 text-xs text-orange-400/70">{item.project?.name ?? '—'}</td>
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
      </div>

      {/* Modal crear/editar ítem */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <h2 className="text-lg font-bold text-white">{editItem ? 'Editar tarea' : 'Nueva tarea'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Título *</label>
                <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="¿Qué hay que hacer?" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Descripción</label>
                <textarea rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Detalle opcional..." className={inputCls + ' resize-none'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                  <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className={inputCls}>
                    {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Prioridad</label>
                  <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value})} className={inputCls}>
                    {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Estado</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inputCls}>
                    {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Story points</label>
                  <input type="number" min={0} max={100} value={form.points} onChange={e => setForm({...form, points: e.target.value})} placeholder="0" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Proyecto *</label>
                  <select required value={form.projectId} onChange={e => setForm({...form, projectId: e.target.value})} className={inputCls}>
                    <option value="">Selecciona un proyecto…</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Responsable</label>
                  <select
                    value={form.assigneeId}
                    onChange={e => {
                      const u = users.find(x => x.id === e.target.value)
                      setForm({ ...form, assigneeId: e.target.value, assigneeName: u?.name ?? '' })
                    }}
                    className={inputCls}
                  >
                    <option value="">Sin asignar</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2">
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  {editItem ? 'Guardar' : 'Crear'}
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
              body: JSON.stringify({ ...item, status: newStatus, projectId: item.projectId, assigneeName: item.assigneeName }),
            })
            if (res.ok) {
              const updated = await res.json()
              setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
              setViewItem(updated)
            }
          }}
        />
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
    </div>
  )
}
