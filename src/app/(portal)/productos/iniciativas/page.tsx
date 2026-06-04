'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Plus, X, Loader2, LayoutGrid, List, Search, Pencil, Trash2, Eye,
  Rocket, Inbox, Check, Ban, Lightbulb,
} from 'lucide-react'

interface Iniciativa {
  id: string
  nombre: string
  descripcion: string
  categoria: string
  estado: string
  prioridad: string
  sector: string | null
  problema: string | null
  beneficios: string | null
  tecnologias: string[]
  responsable: string | null
  responsableId: string | null
  costoMin: number | null
  costoMax: number | null
  tiempoEstimado: string | null
  roiEstimado: string | null
  proyectoId: string | null
  color: string
  createdAt: string
}

interface DeleteRequest {
  id: string
  iniciativaId: string
  requesterName: string | null
  reason: string | null
  createdAt: string
  iniciativa: { id: string; nombre: string } | null
}

const CATEGORIAS = [
  'IA/ML', 'Automatización', 'Analítica de datos', 'Cloud',
  'Ciberseguridad', 'Integración', 'App a medida',
]

const ESTADOS: Record<string, { label: string; dot: string; chip: string }> = {
  IDEA:         { label: 'Idea',         dot: 'bg-gray-500',   chip: 'bg-gray-500/10 text-gray-300 border-gray-500/30' },
  EVALUACION:   { label: 'Evaluación',   dot: 'bg-blue-500',   chip: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  APROBADA:     { label: 'Aprobada',     dot: 'bg-purple-500', chip: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  EN_EJECUCION: { label: 'En ejecución', dot: 'bg-orange-500', chip: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
  COMPLETADA:   { label: 'Completada',   dot: 'bg-green-500',  chip: 'bg-green-500/10 text-green-400 border-green-500/30' },
  DESCARTADA:   { label: 'Descartada',   dot: 'bg-red-500',    chip: 'bg-red-500/10 text-red-400 border-red-500/30' },
}
const ESTADO_KEYS = Object.keys(ESTADOS)

const PRIORIDADES: Record<string, { label: string; color: string; dot: string }> = {
  BAJA:    { label: 'Baja',    color: 'text-gray-400',   dot: 'bg-gray-500' },
  MEDIA:   { label: 'Media',   color: 'text-yellow-400', dot: 'bg-yellow-500' },
  ALTA:    { label: 'Alta',    color: 'text-orange-400', dot: 'bg-orange-500' },
  CRITICA: { label: 'Crítica', color: 'text-red-400',    dot: 'bg-red-500' },
}
const PRIORIDAD_KEYS = Object.keys(PRIORIDADES)

const COLORES = [
  { label: 'Naranja → Rojo',    value: 'from-orange-500 to-red-600' },
  { label: 'Azul → Índigo',     value: 'from-blue-500 to-indigo-600' },
  { label: 'Verde → Teal',      value: 'from-green-500 to-teal-600' },
  { label: 'Violeta → Púrpura', value: 'from-violet-500 to-purple-600' },
  { label: 'Cyan → Azul',       value: 'from-cyan-500 to-blue-600' },
]

const EMPTY_FORM = {
  nombre: '', descripcion: '', categoria: 'IA/ML', estado: 'IDEA', prioridad: 'MEDIA',
  sector: '', problema: '', beneficios: '', tecnologias: '',
  costoMin: '', costoMax: '', tiempoEstimado: '', roiEstimado: '',
  color: 'from-orange-500 to-red-600',
}

function formFrom(i: Iniciativa) {
  return {
    nombre: i.nombre, descripcion: i.descripcion, categoria: i.categoria, estado: i.estado,
    prioridad: i.prioridad, sector: i.sector ?? '', problema: i.problema ?? '',
    beneficios: i.beneficios ?? '', tecnologias: i.tecnologias.join(', '),
    costoMin: i.costoMin != null ? String(i.costoMin) : '',
    costoMax: i.costoMax != null ? String(i.costoMax) : '',
    tiempoEstimado: i.tiempoEstimado ?? '',
    roiEstimado: i.roiEstimado ?? '', color: i.color,
  }
}

const money = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

// Rango de costo: "$X – $Y", o un solo extremo si falta el otro.
const costoRango = (min: number | null, max: number | null) => {
  if (min == null && max == null) return '—'
  if (min != null && max != null) return min === max ? money(min) : `${money(min)} – ${money(max)}`
  return min != null ? `Desde ${money(min)}` : `Hasta ${money(max)}`
}

const inputCls = 'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500'

function EstadoChip({ estado }: { estado: string }) {
  const e = ESTADOS[estado] ?? ESTADOS.IDEA
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full border ${e.chip}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${e.dot}`} /> {e.label}
    </span>
  )
}

function PrioridadTag({ prioridad }: { prioridad: string }) {
  const p = PRIORIDADES[prioridad] ?? PRIORIDADES.MEDIA
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${p.color}`}>
      <span className={`w-2 h-2 rounded-full ${p.dot}`} /> {p.label}
    </span>
  )
}

export default function IniciativasPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role ?? ''
  const isSuperAdmin = role === 'SUPERADMIN'

  const [iniciativas, setIniciativas] = useState<Iniciativa[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'cards' | 'tabla'>('cards')
  const [page, setPage] = useState(1)
  const PER_PAGE = 12

  const [search, setSearch] = useState('')
  const [fCategoria, setFCategoria] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [fPrioridad, setFPrioridad] = useState('')

  const [selected, setSelected] = useState<Iniciativa | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Iniciativa | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [converting, setConverting] = useState(false)

  // Eliminación / solicitud
  const [delTarget, setDelTarget] = useState<Iniciativa | null>(null)
  const [delReason, setDelReason] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const [delMsg, setDelMsg] = useState('')

  // Bandeja de solicitudes (superadmin)
  const [showRequests, setShowRequests] = useState(false)
  const [requests, setRequests] = useState<DeleteRequest[]>([])
  const [reqBusy, setReqBusy] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/iniciativas')
    const data = await res.json()
    setIniciativas(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  const loadRequests = useCallback(async () => {
    if (!isSuperAdmin) return
    const res = await fetch('/api/iniciativas/delete-requests')
    if (res.ok) setRequests(await res.json())
  }, [isSuperAdmin])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadRequests() }, [loadRequests])

  const openNew = () => { setEditItem(null); setForm(EMPTY_FORM); setShowModal(true) }
  const openEdit = (i: Iniciativa) => { setEditItem(i); setForm(formFrom(i)); setShowModal(true) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim() || !form.descripcion.trim()) return
    setSaving(true)
    const body = {
      ...form,
      tecnologias: form.tecnologias.split(',').map(t => t.trim()).filter(Boolean),
      costoMin: form.costoMin === '' ? null : Number(form.costoMin),
      costoMax: form.costoMax === '' ? null : Number(form.costoMax),
      tiempoEstimado: form.tiempoEstimado.trim() || null,
    }
    const res = editItem
      ? await fetch(`/api/iniciativas/${editItem.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      : await fetch('/api/iniciativas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      const saved = await res.json()
      setIniciativas(prev => editItem ? prev.map(i => i.id === saved.id ? saved : i) : [saved, ...prev])
      if (selected?.id === saved.id) setSelected(saved)
    }
    setSaving(false)
    setShowModal(false)
  }

  const convertir = async (i: Iniciativa) => {
    setConverting(true)
    const res = await fetch(`/api/iniciativas/${i.id}/convertir`, { method: 'POST' })
    if (res.ok) {
      const { iniciativa } = await res.json()
      setIniciativas(prev => prev.map(x => x.id === iniciativa.id ? { ...x, ...iniciativa, tecnologias: x.tecnologias } : x))
      setSelected(prev => prev ? { ...prev, ...iniciativa, tecnologias: prev.tecnologias } : prev)
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error ?? 'No se pudo convertir')
    }
    setConverting(false)
  }

  // Abrir flujo de eliminación: superadmin elimina; el resto solicita.
  const askDelete = (i: Iniciativa) => { setDelTarget(i); setDelReason(''); setDelMsg('') }

  const confirmDelete = async () => {
    if (!delTarget) return
    setDelBusy(true)
    if (isSuperAdmin) {
      const res = await fetch(`/api/iniciativas/${delTarget.id}`, { method: 'DELETE' })
      if (res.ok) {
        setIniciativas(prev => prev.filter(i => i.id !== delTarget.id))
        if (selected?.id === delTarget.id) setSelected(null)
        setDelTarget(null)
      } else {
        const err = await res.json().catch(() => ({}))
        setDelMsg(err.error ?? 'Error al eliminar')
      }
    } else {
      const res = await fetch('/api/iniciativas/delete-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iniciativaId: delTarget.id, reason: delReason }),
      })
      if (res.ok) {
        setDelMsg('✓ Solicitud enviada al Super Admin para aprobación.')
        setTimeout(() => setDelTarget(null), 1600)
      } else {
        const err = await res.json().catch(() => ({}))
        setDelMsg(err.error ?? 'Error al enviar la solicitud')
      }
    }
    setDelBusy(false)
  }

  const resolveRequest = async (reqId: string, action: 'APROBAR' | 'RECHAZAR') => {
    setReqBusy(reqId)
    const res = await fetch(`/api/iniciativas/delete-requests/${reqId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
    })
    if (res.ok) {
      const data = await res.json()
      setRequests(prev => prev.filter(r => r.id !== reqId))
      if (action === 'APROBAR' && data.deleted) {
        setIniciativas(prev => prev.filter(i => i.id !== data.deleted))
        if (selected?.id === data.deleted) setSelected(null)
      }
    }
    setReqBusy('')
  }

  const filtered = iniciativas.filter(i => {
    if (search && !`${i.nombre} ${i.descripcion}`.toLowerCase().includes(search.toLowerCase())) return false
    if (fCategoria && i.categoria !== fCategoria) return false
    if (fEstado && i.estado !== fEstado) return false
    if (fPrioridad && i.prioridad !== fPrioridad) return false
    return true
  })

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const currentPage = Math.min(page, pageCount)
  const pagedCards = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE)

  // Vuelve a la primera página al cambiar filtros, búsqueda o vista.
  useEffect(() => { setPage(1) }, [search, fCategoria, fEstado, fPrioridad, view])

  const kpis = {
    total: iniciativas.length,
    enEjecucion: iniciativas.filter(i => i.estado === 'EN_EJECUCION').length,
    aprobadas: iniciativas.filter(i => i.estado === 'APROBADA').length,
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Iniciativas</h1>
          <p className="text-gray-400 mt-1 text-sm">Soluciones tecnológicas de transformación digital</p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <button onClick={() => { setShowRequests(true); loadRequests() }}
              className="relative flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
              <Inbox size={15} /> Solicitudes
              {requests.length > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{requests.length}</span>
              )}
            </button>
          )}
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> Nueva iniciativa
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total', value: kpis.total, color: 'text-white' },
          { label: 'Aprobadas', value: kpis.aprobadas, color: 'text-purple-400' },
          { label: 'En ejecución', value: kpis.enEjecucion, color: 'text-orange-400' },
        ].map(k => (
          <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar iniciativa…"
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500" />
        </div>
        <select value={fCategoria} onChange={e => setFCategoria(e.target.value)} className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-gray-300 focus:outline-none focus:border-orange-500">
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fEstado} onChange={e => setFEstado(e.target.value)} className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-gray-300 focus:outline-none focus:border-orange-500">
          <option value="">Todos los estados</option>
          {ESTADO_KEYS.map(k => <option key={k} value={k}>{ESTADOS[k].label}</option>)}
        </select>
        <select value={fPrioridad} onChange={e => setFPrioridad(e.target.value)} className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-gray-300 focus:outline-none focus:border-orange-500">
          <option value="">Todas las prioridades</option>
          {PRIORIDAD_KEYS.map(k => <option key={k} value={k}>{PRIORIDADES[k].label}</option>)}
        </select>
        <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
          <button onClick={() => setView('cards')} className={`p-1.5 rounded-md transition-colors ${view === 'cards' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-white'}`}><LayoutGrid size={15} /></button>
          <button onClick={() => setView('tabla')} className={`p-1.5 rounded-md transition-colors ${view === 'tabla' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-white'}`}><List size={15} /></button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl h-44 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-800 rounded-2xl">
          <Lightbulb className="mx-auto text-gray-700 mb-3" size={32} />
          <p className="text-gray-500 text-sm">No hay iniciativas que coincidan.</p>
          <button onClick={openNew} className="mt-3 text-orange-400 hover:text-orange-300 text-sm">+ Crear la primera</button>
        </div>
      ) : view === 'cards' ? (
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {pagedCards.map(i => (
            <div key={i.id} onClick={() => setSelected(i)}
              className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden cursor-pointer hover:border-orange-500/40 transition-all group">
              <div className={`bg-gradient-to-r ${i.color} h-1.5`} />
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-white leading-tight">{i.nombre}</h3>
                  {i.proyectoId && <span title="Convertida en proyecto" className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/30 px-1.5 py-0.5 rounded-full flex-shrink-0">● proyecto</span>}
                </div>
                <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed mb-3">{i.descripcion}</p>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <EstadoChip estado={i.estado} />
                  <span className="text-[11px] text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">{i.categoria}</span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                  <PrioridadTag prioridad={i.prioridad} />
                  <span className="text-xs text-gray-600">{new Date(i.createdAt).toLocaleDateString('es-CO')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-6">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors">
              Anterior
            </button>
            {Array.from({ length: pageCount }, (_, idx) => idx + 1).map(n => (
              <button key={n} onClick={() => setPage(n)}
                className={`min-w-[34px] px-2.5 py-1.5 rounded-lg text-sm border transition-colors ${
                  n === currentPage
                    ? 'bg-orange-600 border-orange-500 text-white font-medium'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'
                }`}>
                {n}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={currentPage === pageCount}
              className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-300 text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors">
              Siguiente
            </button>
          </div>
        )}
        </>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr className="text-xs text-gray-400 uppercase tracking-wider">
                <th className="text-left px-4 py-3">Iniciativa</th>
                <th className="text-left px-4 py-3">Categoría</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-left px-4 py-3">Prioridad</th>
                <th className="text-left px-4 py-3">Costo est.</th>
                <th className="text-left px-4 py-3">Tiempo est.</th>
                <th className="text-left px-4 py-3">Responsable</th>
                <th className="text-center px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map(i => (
                <tr key={i.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm text-white font-medium flex items-center gap-2">
                      {i.nombre}
                      {i.proyectoId && <span title="Convertida en proyecto" className="w-1.5 h-1.5 rounded-full bg-green-400" />}
                    </p>
                    <p className="text-xs text-gray-500 truncate max-w-xs">{i.descripcion}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-300">{i.categoria}</td>
                  <td className="px-4 py-3"><EstadoChip estado={i.estado} /></td>
                  <td className="px-4 py-3"><PrioridadTag prioridad={i.prioridad} /></td>
                  <td className="px-4 py-3 text-xs text-gray-300 whitespace-nowrap">{costoRango(i.costoMin, i.costoMax)}</td>
                  <td className="px-4 py-3 text-xs text-gray-300 whitespace-nowrap">{i.tiempoEstimado || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{i.responsable ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setSelected(i)} className="text-gray-500 hover:text-blue-400 transition-colors"><Eye size={14} /></button>
                      <button onClick={() => openEdit(i)} className="text-gray-500 hover:text-white transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => askDelete(i)} className="text-gray-600 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- Detalle (popup) ---------- */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div onClick={e => e.stopPropagation()} className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className={`bg-gradient-to-r ${selected.color} p-6 relative`}>
              <button onClick={() => setSelected(null)} className="absolute top-4 right-4 text-white/80 hover:text-white"><X size={18} /></button>
              <div className="flex items-center gap-2 mb-2">
                <EstadoChip estado={selected.estado} />
                {selected.proyectoId && <span className="text-[11px] text-white bg-white/20 px-2 py-0.5 rounded-full">Proyecto creado</span>}
              </div>
              <h2 className="text-2xl font-bold text-white">{selected.nombre}</h2>
              <p className="text-white/80 text-sm mt-1">{selected.categoria}</p>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Descripción</p>
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{selected.descripcion}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800/60 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 mb-1">Prioridad</p>
                  <PrioridadTag prioridad={selected.prioridad} />
                </div>
                <div className="bg-gray-800/60 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 mb-1">Sector</p>
                  <p className="text-sm text-gray-300">{selected.sector || '—'}</p>
                </div>
                <div className="bg-gray-800/60 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 mb-1">Costo estimado</p>
                  <p className="text-sm text-gray-300">{costoRango(selected.costoMin, selected.costoMax)}</p>
                </div>
                <div className="bg-gray-800/60 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 mb-1">Tiempo estimado</p>
                  <p className="text-sm text-gray-300">{selected.tiempoEstimado || '—'}</p>
                </div>
                <div className="bg-gray-800/60 rounded-lg p-3">
                  <p className="text-[10px] text-gray-500 mb-1">ROI estimado</p>
                  <p className="text-sm text-gray-300">{selected.roiEstimado || '—'}</p>
                </div>
              </div>

              {selected.problema && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Problema que resuelve</p>
                  <p className="text-sm text-gray-300 leading-relaxed">{selected.problema}</p>
                </div>
              )}
              {selected.beneficios && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Beneficios esperados</p>
                  <p className="text-sm text-gray-300 leading-relaxed">{selected.beneficios}</p>
                </div>
              )}

              {selected.tecnologias.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Tecnologías</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.tecnologias.map(t => (
                      <span key={t} className="px-2.5 py-1 bg-orange-900/30 text-orange-400 text-xs rounded-full border border-orange-800">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {selected.responsable && (
                <p className="text-xs text-gray-500">Responsable: <span className="text-gray-300">{selected.responsable}</span></p>
              )}

              {/* Acciones */}
              <div className="flex items-center gap-2 flex-wrap pt-4 border-t border-gray-800">
                <button onClick={() => openEdit(selected)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm transition-colors">
                  <Pencil size={14} /> Editar
                </button>
                {!selected.proyectoId && (
                  <button onClick={() => convertir(selected)} disabled={converting}
                    className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm transition-colors">
                    {converting ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />} Convertir en proyecto
                  </button>
                )}
                <button onClick={() => askDelete(selected)} className="flex items-center gap-1.5 px-3 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-300 rounded-lg text-sm transition-colors ml-auto">
                  <Trash2 size={14} /> {isSuperAdmin ? 'Eliminar' : 'Solicitar eliminación'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Modal crear/editar ---------- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <h2 className="text-lg font-bold text-white">{editItem ? 'Editar iniciativa' : 'Nueva iniciativa'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nombre *</label>
                <input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Plataforma de RPA para facturación" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Descripción *</label>
                <textarea required rows={3} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="¿En qué consiste la solución?" className={inputCls + ' resize-none'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Categoría</label>
                  <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className={inputCls}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Sector objetivo</label>
                  <input value={form.sector} onChange={e => setForm({ ...form, sector: e.target.value })} placeholder="Salud, retail, logística…" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Estado</label>
                  <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className={inputCls}>
                    {ESTADO_KEYS.map(k => <option key={k} value={k}>{ESTADOS[k].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Prioridad</label>
                  <select value={form.prioridad} onChange={e => setForm({ ...form, prioridad: e.target.value })} className={inputCls}>
                    {PRIORIDAD_KEYS.map(k => <option key={k} value={k}>{PRIORIDADES[k].label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Problema que resuelve</label>
                <textarea rows={2} value={form.problema} onChange={e => setForm({ ...form, problema: e.target.value })} placeholder="Dolor del cliente / oportunidad" className={inputCls + ' resize-none'} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Beneficios esperados</label>
                <textarea rows={2} value={form.beneficios} onChange={e => setForm({ ...form, beneficios: e.target.value })} placeholder="Impacto / valor esperado" className={inputCls + ' resize-none'} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Tecnologías <span className="text-gray-600">(separadas por coma)</span></label>
                <input value={form.tecnologias} onChange={e => setForm({ ...form, tecnologias: e.target.value })} placeholder="n8n, Python, OpenAI, Supabase" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Costo estimado mín. (COP)</label>
                  <input type="number" min={0} value={form.costoMin} onChange={e => setForm({ ...form, costoMin: e.target.value })} placeholder="Ej: 3.000.000" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Costo estimado máx. (COP)</label>
                  <input type="number" min={0} value={form.costoMax} onChange={e => setForm({ ...form, costoMax: e.target.value })} placeholder="Ej: 6.000.000" className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tiempo estimado</label>
                  <input value={form.tiempoEstimado} onChange={e => setForm({ ...form, tiempoEstimado: e.target.value })} placeholder="Ej: 2 a 4 semanas" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">ROI estimado</label>
                  <input value={form.roiEstimado} onChange={e => setForm({ ...form, roiEstimado: e.target.value })} placeholder="Ej: 30% en 6 meses" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORES.map(c => (
                    <button key={c.value} type="button" onClick={() => setForm({ ...form, color: c.value })} title={c.label}
                      className={`w-8 h-8 rounded-lg bg-gradient-to-r ${c.value} border-2 transition-all ${form.color === c.value ? 'border-white scale-110' : 'border-transparent'}`} />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2">
                  {saving && <Loader2 size={13} className="animate-spin" />} {editItem ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Eliminar / Solicitar eliminación ---------- */}
      {delTarget && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <h3 className="text-white font-semibold mb-2">{isSuperAdmin ? 'Eliminar iniciativa' : 'Solicitar eliminación'}</h3>
            <p className="text-gray-400 text-sm mb-4">
              {isSuperAdmin
                ? <>¿Eliminar <span className="text-white font-medium">&quot;{delTarget.nombre}&quot;</span>? Esta acción no se puede deshacer.</>
                : <>No tienes permiso para eliminar. Se enviará una solicitud al Super Admin para <span className="text-white font-medium">&quot;{delTarget.nombre}&quot;</span>.</>}
            </p>
            {!isSuperAdmin && (
              <textarea value={delReason} onChange={e => setDelReason(e.target.value)} rows={2} placeholder="Motivo (opcional)" className={inputCls + ' resize-none mb-3'} />
            )}
            {delMsg && <p className="text-sm text-green-400 mb-3">{delMsg}</p>}
            <div className="flex justify-end gap-3">
              <button onClick={() => setDelTarget(null)} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 text-sm">Cancelar</button>
              <button onClick={confirmDelete} disabled={delBusy} className={`px-4 py-2 ${isSuperAdmin ? 'bg-red-600 hover:bg-red-500' : 'bg-orange-600 hover:bg-orange-500'} disabled:opacity-50 text-white rounded-lg text-sm flex items-center gap-2`}>
                {delBusy && <Loader2 size={13} className="animate-spin" />} {isSuperAdmin ? 'Eliminar' : 'Enviar solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Bandeja de solicitudes (superadmin) ---------- */}
      {showRequests && isSuperAdmin && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowRequests(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 sticky top-0 bg-gray-900">
              <h2 className="text-lg font-bold text-white flex items-center gap-2"><Inbox size={18} /> Solicitudes de eliminación</h2>
              <button onClick={() => setShowRequests(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3">
              {requests.length === 0 ? (
                <p className="text-center text-gray-500 text-sm py-8">No hay solicitudes pendientes.</p>
              ) : requests.map(r => (
                <div key={r.id} className="bg-gray-800/60 border border-gray-800 rounded-xl p-4">
                  <p className="text-white font-medium text-sm">{r.iniciativa?.nombre ?? 'Iniciativa eliminada'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Solicitado por {r.requesterName ?? 'desconocido'} · {new Date(r.createdAt).toLocaleDateString('es-CO')}</p>
                  {r.reason && <p className="text-sm text-gray-400 mt-2 italic">&quot;{r.reason}&quot;</p>}
                  <div className="flex justify-end gap-2 mt-3">
                    <button onClick={() => resolveRequest(r.id, 'RECHAZAR')} disabled={reqBusy === r.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 rounded-lg text-xs transition-colors">
                      <Ban size={13} /> Rechazar
                    </button>
                    <button onClick={() => resolveRequest(r.id, 'APROBAR')} disabled={reqBusy === r.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-xs transition-colors">
                      {reqBusy === r.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprobar y eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
