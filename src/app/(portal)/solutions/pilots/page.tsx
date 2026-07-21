'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, X, Loader2, FlaskConical, Pencil, Wrench, CheckCircle,
  DollarSign, Clock, TrendingUp, CalendarRange,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CronogramaFase {
  fase: string
  fechaInicio: string
  fechaFin: string
  estado: string // completado | activo | pendiente
}

interface Solucion {
  id: string
  nombre: string
  descripcion: string | null
  estado: string
  valorEstimado: number
  cronograma: string | null
  createdAt: string
  updatedAt: string
  lead: { id: string; companyName: string } | null
}

interface LeadOption {
  id: string
  companyName: string
  contactName: string
  solucion: { id: string } | null
}

// ─── Metodología steps ───────────────────────────────────────────────────────

const STEPS = [
  { num: '01', icon: Pencil,       title: 'Definición',      desc: 'Caso de uso, datos disponibles y criterios de éxito.', color: '#06b6d4' },
  { num: '02', icon: FlaskConical, title: 'Diseño',          desc: 'Experimento mínimo viable y arquitectura técnica.',     color: '#8b5cf6' },
  { num: '03', icon: Wrench,       title: 'Implementación',  desc: 'Demo funcional construido en tiempo récord.',           color: '#f97316' },
  { num: '04', icon: CheckCircle,  title: 'Validación',      desc: 'Resultados medidos, recomendación go/no-go.',           color: '#10b981' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseCronograma(raw: string | null): CronogramaFase[] {
  if (!raw) return []
  try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : [] } catch { return [] }
}

function calcProgress(fases: CronogramaFase[]): number {
  if (!fases.length) return 0
  const done = fases.filter(f => f.estado === 'completado').length
  return Math.round((done / fases.length) * 100)
}

function weeksSince(date: string): number {
  return Math.round((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24 * 7))
}

function avgWeeks(pocs: Solucion[]): number | null {
  const done = pocs.filter(p => p.estado === 'INACTIVO' || p.estado === 'Completado')
  if (!done.length) return null
  const total = done.reduce((sum, p) => sum + weeksSince(p.createdAt), 0)
  return Math.round(total / done.length)
}

const ESTADO_COLOR: Record<string, { bg: string; text: string }> = {
  ACTIVO:      { bg: 'rgba(16,185,129,0.12)', text: '#10b981' },
  INACTIVO:    { bg: 'rgba(107,114,128,0.12)', text: '#6b7280' },
  Completado:  { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' },
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PocSolutionPage() {
  const router = useRouter()
  const [pocs, setPocs]             = useState<Solucion[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState<'todos' | 'activos' | 'completados'>('todos')
  const [showModal, setShowModal]   = useState(false)
  const [leadId, setLeadId]         = useState('')
  const [nombre, setNombre]         = useState('')
  const [leads, setLeads]           = useState<LeadOption[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const fetchPocs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/soluciones?tipo=DEMO')
      const data = await res.json()
      setPocs(Array.isArray(data) ? data : [])
    } catch { setPocs([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPocs() }, [fetchPocs])

  // ── Stats ──
  const total      = pocs.length
  const activos    = pocs.filter(p => p.estado === 'ACTIVO').length
  const completados = pocs.filter(p => p.estado === 'INACTIVO' || p.estado === 'Completado').length
  const avg        = avgWeeks(pocs)

  // ── Filtered list ──
  const filtered = pocs.filter(p => {
    if (filter === 'activos')     return p.estado === 'ACTIVO'
    if (filter === 'completados') return p.estado === 'INACTIVO' || p.estado === 'Completado'
    return true
  })

  // ── Gantt data: only pocs with cronograma and at least 1 fecha ──
  const ganttPocs = pocs
    .filter(p => p.estado === 'ACTIVO')
    .map(p => ({ ...p, fases: parseCronograma(p.cronograma) }))
    .filter(p => p.fases.some(f => f.fechaInicio && f.fechaFin))

  const allDates = ganttPocs.flatMap(p => p.fases.flatMap(f => [f.fechaInicio, f.fechaFin].filter(Boolean)))
  const ganttMin = allDates.length ? new Date(Math.min(...allDates.map(d => new Date(d).getTime()))) : null
  const ganttMax = allDates.length ? new Date(Math.max(...allDates.map(d => new Date(d).getTime()))) : null
  const ganttSpan = ganttMin && ganttMax ? ganttMax.getTime() - ganttMin.getTime() : 0

  function pct(dateStr: string) {
    if (!ganttMin || !ganttSpan) return 0
    return ((new Date(dateStr).getTime() - ganttMin.getTime()) / ganttSpan) * 100
  }

  const FASE_COLOR: Record<string, string> = {
    completado: '#10b981',
    activo:     '#06b6d4',
    pendiente:  '#374151',
  }

  // ── Modal ──
  async function openCreateModal() {
    setShowModal(true); setLeadId(''); setNombre(''); setError('')
    setLoadingLeads(true)
    try {
      const res = await fetch('/api/leads?status=ACTIVO')
      const data = await res.json()
      setLeads(Array.isArray(data) ? data : [])
    } catch { setLeads([]) }
    finally { setLoadingLeads(false) }
  }

  function handleLeadChange(id: string) {
    setLeadId(id)
    const lead = leads.find(l => l.id === id)
    if (lead && !nombre) setNombre(`${lead.companyName} — Demo`)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!leadId || !nombre.trim()) { setError('Completa todos los campos.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/soluciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), tipo: 'DEMO', estado: 'ACTIVO', leadId }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Error al crear.')
      const created = await res.json()
      setShowModal(false)
      router.push(`/solutions/pilots/${created.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado.')
      setSaving(false)
    }
  }

  const availableLeads = leads.filter(l => !l.solucion)

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px', padding: '8px 12px', color: '#e5e7eb', fontSize: '13px', outline: 'none',
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 space-y-6">

      {/* ── Metodología ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <h2 className="text-[11px] font-bold uppercase tracking-wider mb-5" style={{ color: '#06b6d4' }}>
          Metodología del PoC
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-0">
          {STEPS.map((s, idx) => {
            const Icon = s.icon
            return (
              <div key={s.num} className="relative flex md:flex-col items-start gap-4 md:gap-0 pb-6 md:pb-0">
                {idx < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-5 left-[calc(50%+20px)] right-0 h-px"
                    style={{ background: `linear-gradient(to right, ${s.color}60, transparent)` }} />
                )}
                <div className="flex md:flex-col items-center md:items-start gap-3 md:gap-3 w-full md:pr-6">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10"
                    style={{ background: s.color + '18', border: `1px solid ${s.color}40` }}>
                    <Icon size={16} style={{ color: s.color }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold tracking-widest" style={{ color: s.color + '80' }}>{s.num}</span>
                      <h3 className="text-sm font-semibold text-white">{s.title}</h3>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total PoCs', value: total, icon: FlaskConical, color: '#06b6d4' },
          { label: 'En curso',   value: activos,    icon: TrendingUp,   color: '#10b981' },
          { label: 'Completadas', value: completados, icon: CheckCircle,  color: '#3b82f6' },
          { label: 'Duración prom.', value: avg != null ? `${avg}w` : '—', icon: Clock, color: '#f97316' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: s.color + '18', border: `1px solid ${s.color}30` }}>
                <Icon size={16} style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-lg font-bold text-white leading-none">{s.value}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{s.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Gantt (solo si hay datos) ────────────────────────────────────── */}
      {ganttPocs.length > 0 && ganttMin && ganttMax && (
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-4">
            <CalendarRange size={14} style={{ color: '#06b6d4' }} />
            <h2 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: '#06b6d4' }}>
              Timeline PoCs activas
            </h2>
            <span className="text-[10px] text-gray-600 ml-auto">
              {ganttMin.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}
              {' → '}
              {ganttMax.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}
            </span>
          </div>
          <div className="space-y-3">
            {ganttPocs.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <p className="text-xs text-gray-300 w-36 flex-shrink-0 truncate cursor-pointer hover:text-white"
                  onClick={() => router.push(`/solutions/pilots/${p.id}`)}>
                  {p.nombre}
                </p>
                <div className="flex-1 relative h-5 rounded-md overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  {p.fases.filter(f => f.fechaInicio && f.fechaFin).map((f, i) => (
                    <div key={i}
                      className="absolute top-0 h-full rounded-sm flex items-center px-1.5"
                      style={{
                        left: `${pct(f.fechaInicio)}%`,
                        width: `${Math.max(pct(f.fechaFin) - pct(f.fechaInicio), 2)}%`,
                        background: FASE_COLOR[f.estado] || '#374151',
                        opacity: 0.85,
                      }}
                      title={`${f.fase} (${f.estado})`}
                    >
                      <span className="text-[9px] font-medium text-white truncate">{f.fase}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            {[['completado','#10b981'],['activo','#06b6d4'],['pendiente','#374151']].map(([lbl,col]) => (
              <div key={lbl} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: col }} />
                <span className="text-[10px] text-gray-500 capitalize">{lbl}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Lista con filtro ─────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between"
          style={{ background: 'rgba(6,182,212,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-white">Pruebas de Concepto</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>{total}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Filter tabs */}
            <div className="flex items-center gap-0.5 rounded-lg p-0.5"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {(['todos','activos','completados'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className="px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors"
                  style={{
                    background: filter === f ? 'rgba(6,182,212,0.2)' : 'transparent',
                    color: filter === f ? '#06b6d4' : '#6b7280',
                  }}>
                  {f}
                </button>
              ))}
            </div>
            <button onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
              style={{ background: '#06b6d4' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#0891b2'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#06b6d4'}>
              <Plus size={13} /> Nueva PoC
            </button>
          </div>
        </div>

        {/* List body */}
        {loading ? (
          <div className="flex justify-center py-12" style={{ background: 'rgba(255,255,255,0.01)' }}>
            <Loader2 size={20} className="animate-spin text-cyan-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10" style={{ background: 'rgba(255,255,255,0.01)' }}>
            <p className="text-sm text-gray-500">No hay PoCs {filter !== 'todos' ? `(${filter})` : ''}</p>
          </div>
        ) : (
          <div className="divide-y" style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.05)' }}>
            {filtered.map(p => {
              const fases = parseCronograma(p.cronograma)
              const progress = calcProgress(fases)
              const weeks = weeksSince(p.createdAt)
              const estadoMeta = ESTADO_COLOR[p.estado] || ESTADO_COLOR.ACTIVO
              return (
                <div key={p.id}
                  className="px-5 py-4 flex items-center gap-4 cursor-pointer transition-colors"
                  style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                  onClick={() => router.push(`/solutions/pilots/${p.id}`)}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-white truncate">{p.nombre}</p>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: estadoMeta.bg, color: estadoMeta.text }}>
                        {p.estado}
                      </span>
                    </div>
                    {p.lead && <p className="text-xs text-gray-500">{p.lead.companyName}</p>}
                  </div>

                  {/* Value */}
                  {p.valorEstimado > 0 && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                      <DollarSign size={11} />
                      {p.valorEstimado.toLocaleString()}
                    </div>
                  )}

                  {/* Week counter */}
                  <div className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0 w-12">
                    <Clock size={11} />
                    {weeks}w
                  </div>

                  {/* Progress bar */}
                  {fases.length > 0 ? (
                    <div className="flex-shrink-0 w-32">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-gray-500">{progress}%</span>
                        <span className="text-[10px] text-gray-600">{fases.filter(f => f.estado === 'completado').length}/{fases.length} fases</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${progress}%`, background: progress === 100 ? '#10b981' : '#06b6d4' }} />
                      </div>
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-32">
                      <p className="text-[10px] text-gray-600 text-right">Sin cronograma</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Modal nueva PoC ──────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget && !saving) setShowModal(false) }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(6,182,212,0.06)' }}>
              <h2 className="text-sm font-semibold text-white">Nueva PoC</h2>
              <button onClick={() => { if (!saving) setShowModal(false) }} className="text-gray-500 hover:text-gray-300">
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Lead asociado *</label>
                {loadingLeads ? (
                  <div className="flex items-center gap-2 text-gray-500 text-xs py-2">
                    <Loader2 size={13} className="animate-spin" /> Cargando leads…
                  </div>
                ) : (
                  <select value={leadId} onChange={e => handleLeadChange(e.target.value)}
                    disabled={saving} required
                    style={{ ...inputStyle, colorScheme: 'dark', appearance: 'none' as const }}>
                    <option value="" disabled>Selecciona un lead…</option>
                    {availableLeads.map(l => (
                      <option key={l.id} value={l.id}>{l.companyName} — {l.contactName}</option>
                    ))}
                  </select>
                )}
                {!loadingLeads && availableLeads.length === 0 && (
                  <p className="text-gray-600 text-xs mt-1">No hay leads sin PoC asociada.</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Nombre *</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Ej. Empresa XYZ — Demo" disabled={saving} style={inputStyle} />
              </div>
              <p className="text-xs text-gray-600">Arquitectura, plan y cronograma se completan en la página de la PoC.</p>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)} disabled={saving}
                  className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-400"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                  style={{ background: '#06b6d4' }}>
                  {saving ? <><Loader2 size={13} className="animate-spin" /> Creando…</> : <><Plus size={13} /> Crear y continuar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
