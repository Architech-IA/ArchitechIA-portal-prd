'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Pencil, Loader2, Plus, X, ExternalLink, DollarSign, Tag, Calendar, User, Trash2, ChevronRight, FolderKanban, FlaskConical, Handshake, Building2, Package, Lightbulb, Map as MapIcon, Layers, Rocket } from 'lucide-react'
import { usePageActions } from '@/lib/pageActionsContext'

interface Solucion {
  id: string
  solucionCode: string | null
  nombre: string
  tipo: string
  estado: string
  descripcion: string | null
  valorEstimado: number
  repositorio: string | null
  createdAt: string
  epics?: { id: string }[]
  lead?: { id: string; companyName: string; contactName: string } | null
}

const TIPO_META: Record<string, { label: string; color: string; icon: React.ElementType; href: string }> = {
  PROJECT:     { label: 'Project',     color: '#3b82f6', icon: FolderKanban, href: '/solutions/projects' },
  DEMO:        { label: 'Pilot',       color: '#f59e0b', icon: FlaskConical,  href: '/solutions/pilots' },
  PARTNERSHIP: { label: 'Partnership', color: '#1D9375', icon: Handshake,     href: '/solutions/partnership' },
  PRODUCT:     { label: 'Product',     color: '#7F77DD', icon: Package,       href: '/solutions/productos' },
  INTERN:      { label: 'Intern',      color: '#9aa6b8', icon: Building2,     href: '/solutions/intern' },
}

const ESTADO_COLOR: Record<string, string> = {
  ACTIVO:          '#10b981',
  INACTIVO:        '#6b7280',
  'En Desarrollo': '#f97316',
  Lanzado:         '#3b82f6',
  Archivado:       '#4b5563',
}

const SECTIONS = [
  { href: '/solutions/projects',    label: 'Projects',     icon: FolderKanban, color: '#3b82f6' },
  { href: '/solutions/pilots',      label: 'Pilots',       icon: FlaskConical, color: '#f59e0b' },
  { href: '/solutions/partnership', label: 'Partnership',  icon: Handshake,    color: '#1D9375' },
  { href: '/solutions/productos',   label: 'Productos',    icon: Package,      color: '#7F77DD' },
  { href: '/solutions/intern',      label: 'Intern',       icon: Building2,    color: '#9aa6b8' },
  { href: '/solutions/iniciativas', label: 'Iniciativas',  icon: Lightbulb,    color: '#eab308' },
]

const EMPTY_FORM = { id: '', nombre: '', tipo: 'PROJECT', estado: 'ACTIVO', descripcion: '', valorEstimado: '' }

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '8px',
  padding: '8px 12px',
  color: '#e5e7eb',
  fontSize: '13px',
  outline: 'none',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  colorScheme: 'dark',
  backgroundColor: '#0e1420',
  cursor: 'pointer',
}

export default function SolutionsPage() {
  const [soluciones, setSoluciones] = useState<Solucion[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTipo, setFilterTipo] = useState('ALL')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<Solucion | null>(null)
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
        <Link href="/solutions" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1"
          style={{ background: 'rgba(127,119,221,0.2)', color: '#7F77DD', border: '1px solid rgba(127,119,221,0.3)' }}>
          <MapIcon size={10}/> Solution
        </Link>
      </div>
    )
    return () => setActions(null)
  }, [])

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/soluciones')
    if (res.ok) setSoluciones(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true); setError('')
    try {
      const isEdit = !!form.id
      const res = await fetch(isEdit ? `/api/soluciones/${form.id}` : '/api/soluciones', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          tipo: form.tipo,
          estado: form.estado,
          descripcion: form.descripcion.trim() || null,
          valorEstimado: parseFloat(form.valorEstimado) || 0,
        }),
      })
      if (!res.ok) throw new Error()
      setShowModal(false)
      setDetail(null)
      setForm(EMPTY_FORM)
      load()
    } catch {
      setError('No se pudo guardar la solución')
    } finally {
      setSaving(false)
    }
  }

  const filtered = filterTipo === 'ALL' ? soluciones : soluciones.filter(s => s.tipo === filterTipo)

  const TIPOS = [
    { key: 'ALL', label: 'Todas' },
    { key: 'PROJECT', label: 'Project' },
    { key: 'DEMO', label: 'Pilot' },
    { key: 'PARTNERSHIP', label: 'Partnership' },
    { key: 'PRODUCT', label: 'Product' },
    { key: 'INTERN', label: 'Intern' },
  ]

  return (
    <div className="flex flex-col h-full overflow-auto p-6" style={{ background: '#080c12' }}>

      {/* Sub-nav sections */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        {SECTIONS.map(s => {
          const Icon = s.icon
          return (
            <Link key={s.href} href={s.href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.35)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = s.color; (e.currentTarget as HTMLElement).style.borderColor = s.color + '44' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}>
              <Icon size={11}/> {s.label}
            </Link>
          )
        })}
      </div>

      {/* Filter tabs + button */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {TIPOS.map(tab => {
            const meta = TIPO_META[tab.key]
            const count = tab.key === 'ALL' ? soluciones.length : soluciones.filter(s => s.tipo === tab.key).length
            const active = filterTipo === tab.key
            const activeColor = meta?.color || '#7F77DD'
            return (
              <button key={tab.key} onClick={() => setFilterTipo(tab.key)}
                className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all"
                style={{
                  background: active ? `${activeColor}22` : 'transparent',
                  color: active ? activeColor : '#6b7280',
                  border: active ? `1px solid ${activeColor}44` : '1px solid transparent',
                }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#d1d5db' } }}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' } }}>
                {tab.label} {count > 0 && <span style={{ opacity: 0.5 }}>{count}</span>}
              </button>
            )
          })}
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setError(''); setShowModal(true) }}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-colors"
          style={{ background: '#7F77DD' }}>
          <Plus size={13}/> Nueva solución
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={22} className="animate-spin" style={{ color: 'rgba(255,255,255,0.15)' }}/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <MapIcon size={40} style={{ color: 'rgba(255,255,255,0.08)', marginBottom: 16 }}/>
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>Sin soluciones</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.12)' }}>Crea la primera solución para comenzar</p>
          <button onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }}
            className="mt-5 px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
            style={{ background: '#7F77DD' }}>
            <Plus size={13}/> Nueva solución
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(sol => {
            const meta = TIPO_META[sol.tipo] || { label: sol.tipo, color: '#6b7280', icon: Package }
            const Icon = meta.icon
            const estadoColor = ESTADO_COLOR[sol.estado] || '#6b7280'
            return (
              <div key={sol.id}
                className="flex items-center gap-4 px-5 py-3.5 rounded-2xl cursor-pointer transition-all"
                style={{ border: '1px solid rgba(255,255,255,0.08)', background: '#0c1118' }}
                onClick={() => setDetail(sol)}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = meta.color + '33'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}>

                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: meta.color + '18', border: `1px solid ${meta.color}30` }}>
                  <Icon size={14} style={{ color: meta.color }}/>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{sol.nombre}</span>
                    {sol.solucionCode && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
                        {sol.solucionCode}
                      </span>
                    )}
                    <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
                      style={{ color: meta.color, background: meta.color + '15' }}>
                      {meta.label}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
                      style={{ color: estadoColor, background: estadoColor + '15' }}>
                      {sol.estado}
                    </span>
                  </div>
                  {sol.descripcion && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.3)' }}>{sol.descripcion}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {sol.valorEstimado > 0 && (
                    <span className="text-xs tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      ${sol.valorEstimado.toLocaleString()}
                    </span>
                  )}
                  <button onClick={e => { e.stopPropagation(); setForm({ id: sol.id, nombre: sol.nombre, tipo: sol.tipo, estado: sol.estado, descripcion: sol.descripcion || '', valorEstimado: String(sol.valorEstimado || 0) }); setError(''); setShowModal(true) }}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'}>
                    <Pencil size={13}/>
                  </button>
                  <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.15)' }}/>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail modal */}
      {detail && (() => {
        const meta = TIPO_META[detail.tipo] || { label: detail.tipo, color: '#6b7280', icon: Package }
        const estadoColor = ESTADO_COLOR[detail.estado] || '#6b7280'
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) setDetail(null) }}>
            <div className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="px-5 py-4 flex items-start justify-between"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: meta.color + '11' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: estadoColor + '22', color: estadoColor, border: `1px solid ${estadoColor}44` }}>
                      {detail.estado}
                    </span>
                    {detail.solucionCode && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {detail.solucionCode}
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm font-semibold text-white leading-snug">{detail.nombre}</h2>
                </div>
                <button onClick={() => setDetail(null)} className="text-gray-500 hover:text-gray-300 ml-3 flex-shrink-0 mt-0.5"><X size={15}/></button>
              </div>
              <div className="p-5 space-y-4">
                {detail.valorEstimado > 0 && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <DollarSign size={11}/> {detail.valorEstimado.toLocaleString()} USD
                  </span>
                )}
                {detail.descripcion && (
                  <p className="text-xs text-gray-300 leading-relaxed">{detail.descripcion}</p>
                )}
                <div className="space-y-2">
                  {detail.lead && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <User size={12} className="flex-shrink-0 text-gray-600"/>
                      <span>{detail.lead.companyName}</span>
                      {detail.lead.contactName && <span className="text-gray-600">· {detail.lead.contactName}</span>}
                    </div>
                  )}
                  {detail.repositorio && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Tag size={12} className="flex-shrink-0 text-gray-600"/>
                      <a href={detail.repositorio} target="_blank" rel="noopener noreferrer"
                        className="truncate hover:text-white transition-colors" style={{ color: meta.color }}>
                        {detail.repositorio}
                      </a>
                    </div>
                  )}
                  {detail.createdAt && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar size={12} className="flex-shrink-0 text-gray-600"/>
                      {new Date(detail.createdAt).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setDetail(null)}
                    className="py-2 px-4 rounded-lg text-xs font-medium text-gray-400"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    Cerrar
                  </button>
                  <button onClick={() => { setForm({ id: detail.id, nombre: detail.nombre, tipo: detail.tipo, estado: detail.estado, descripcion: detail.descripcion || '', valorEstimado: String(detail.valorEstimado || 0) }); setError(''); setShowModal(true) }}
                    className="py-2 px-4 rounded-lg text-xs font-medium text-gray-300 flex items-center gap-1.5"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <Pencil size={11}/> Editar
                  </button>
                  <Link href={TIPO_META[detail.tipo]?.href || '/solutions'} onClick={() => setDetail(null)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white"
                    style={{ background: meta.color }}>
                    <ExternalLink size={11}/> Ver {meta.label}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Create/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <h2 className="text-sm font-semibold text-white">{form.id ? 'Editar solución' : 'Nueva solución'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300"><X size={15}/></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Nombre *</label>
                <input style={inputStyle} placeholder="Ej: Agente de cotizaciones"
                  value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                  <select style={selectStyle} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="PROJECT">Project</option>
                    <option value="DEMO">Pilot</option>
                    <option value="PARTNERSHIP">Partnership</option>
                    <option value="PRODUCT">Product</option>
                    <option value="INTERN">Intern</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Estado</label>
                  <select style={selectStyle} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                    <option value="ACTIVO">Activo</option>
                    <option value="En Desarrollo">En Desarrollo</option>
                    <option value="Lanzado">Lanzado</option>
                    <option value="INACTIVO">Inactivo</option>
                    <option value="Archivado">Archivado</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Descripción</label>
                <textarea style={{ ...inputStyle, resize: 'none' } as React.CSSProperties} rows={3}
                  placeholder="Breve descripción de la solución..."
                  value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}/>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Valor estimado (USD)</label>
                <input style={inputStyle} type="number" placeholder="0"
                  value={form.valorEstimado} onChange={e => setForm(f => ({ ...f, valorEstimado: e.target.value }))}/>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-400"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving || !form.nombre.trim()}
                className="flex-1 py-2 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: '#7F77DD' }}>
                {saving ? <Loader2 size={12} className="animate-spin"/> : null}
                {form.id ? 'Guardar' : 'Crear solución'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
