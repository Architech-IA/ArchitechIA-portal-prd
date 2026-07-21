'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Loader2, FlaskConical, Pencil, Wrench, CheckCircle } from 'lucide-react'
import SolucionesList, { type Solucion } from '@/components/SolucionesList'

const STEPS = [
  {
    num: '01',
    icon: Pencil,
    title: 'Definición',
    desc: 'Caso de uso, datos disponibles y criterios de éxito.',
    color: '#06b6d4',
  },
  {
    num: '02',
    icon: FlaskConical,
    title: 'Diseño',
    desc: 'Experimento mínimo viable y arquitectura técnica.',
    color: '#8b5cf6',
  },
  {
    num: '03',
    icon: Wrench,
    title: 'Implementación',
    desc: 'Demo funcional construido en tiempo récord.',
    color: '#f97316',
  },
  {
    num: '04',
    icon: CheckCircle,
    title: 'Validación',
    desc: 'Resultados medidos, recomendación go/no-go.',
    color: '#10b981',
  },
]

interface LeadOption {
  id: string
  companyName: string
  contactName: string
  solucion: { id: string } | null
}

export default function PocSolutionPage() {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [leadId, setLeadId] = useState('')
  const [nombre, setNombre] = useState('')
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  async function openCreateModal() {
    setShowModal(true)
    setLeadId('')
    setNombre('')
    setError('')
    setLoadingLeads(true)
    try {
      const res = await fetch('/api/leads?status=ACTIVO')
      const data = await res.json()
      setLeads(Array.isArray(data) ? data : [])
    } catch {
      setLeads([])
    } finally {
      setLoadingLeads(false)
    }
  }

  function closeModal() {
    if (saving) return
    setShowModal(false)
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Error al crear el PoC.')
      }
      const created = await res.json()
      setShowModal(false)
      router.push(`/solutions/pilots/${created.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado.')
      setSaving(false)
    }
  }

  function goToDetail(solucion: Solucion) {
    router.push(`/solutions/pilots/${solucion.id}`)
  }

  const availableLeads = leads.filter(l => !l.solucion)

  const addButton = (
    <button
      onClick={openCreateModal}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors"
      style={{ background: '#06b6d4' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#0891b2'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#06b6d4'}
    >
      <Plus size={14} />
      Nueva PoC
    </button>
  )

  return (
    <div className="p-4 md:p-8 space-y-6">

      {/* Metodologia del PoC */}
      <div
        className="rounded-2xl p-6 md:p-8"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <h2 className="text-sm font-semibold text-white mb-6 uppercase tracking-wider" style={{ color: '#06b6d4' }}>
          Metodología del PoC
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-0">
          {STEPS.map((s, idx) => {
            const Icon = s.icon
            return (
              <div key={s.num} className="relative flex md:flex-col items-start md:items-start gap-4 md:gap-0 pb-6 md:pb-0">
                {/* Connector line */}
                {idx < STEPS.length - 1 && (
                  <div
                    className="hidden md:block absolute top-5 left-[calc(50%+24px)] right-0 h-px"
                    style={{ background: `linear-gradient(to right, ${s.color}60, transparent)` }}
                  />
                )}
                {idx < STEPS.length - 1 && (
                  <div
                    className="md:hidden absolute left-5 top-12 bottom-0 w-px"
                    style={{ background: `linear-gradient(to bottom, ${s.color}60, transparent)` }}
                  />
                )}

                <div className="flex md:flex-col items-center md:items-start gap-3 md:gap-4 w-full md:pr-6">
                  {/* Step icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10"
                    style={{ background: s.color + '18', border: `1px solid ${s.color}40` }}
                  >
                    <Icon size={17} style={{ color: s.color }} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold tracking-widest" style={{ color: s.color + '99' }}>{s.num}</span>
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

      {/* Lista de PoCs */}
      <SolucionesList
        tipo="DEMO"
        color="cyan"
        title="PRUEBAS DE CONCEPTO"
        hideIcon
        refreshKey={refreshKey}
        headerAction={addButton}
        onSelect={goToDetail}
      />

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between px-6 py-5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(6,182,212,0.06)' }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.25)' }}>
                  <Plus className="text-cyan-400" size={16} />
                </div>
                <h2 className="text-sm font-semibold text-white">Nueva PoC</h2>
              </div>
              <button onClick={closeModal} disabled={saving} className="text-gray-500 hover:text-gray-300">
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
                  <select
                    value={leadId}
                    onChange={e => handleLeadChange(e.target.value)}
                    disabled={saving}
                    required
                    style={{
                      width: '100%', background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                      padding: '8px 12px', color: '#e5e7eb', fontSize: '13px',
                      outline: 'none', colorScheme: 'dark', appearance: 'none',
                    }}
                  >
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
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej. Empresa XYZ — Demo"
                  disabled={saving}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                    padding: '8px 12px', color: '#e5e7eb', fontSize: '13px', outline: 'none',
                  }}
                />
              </div>

              <p className="text-xs text-gray-600">Arquitectura, plan y cronograma se completan en la página de la PoC.</p>

              {error && <p className="text-xs text-red-400">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={closeModal} disabled={saving}
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
