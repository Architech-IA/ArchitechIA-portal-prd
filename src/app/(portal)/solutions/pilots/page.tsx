'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import {
  FlaskConical, CheckCircle2, ArrowRight, Zap, Gauge,
  Target, ShieldCheck, Plus, X, Loader2, FolderGit2, Sliders, LayoutGrid, Code2, ExternalLink,
  FileText, Calendar, Trash2, Pencil, Upload,
} from 'lucide-react'
import SolucionesList, { type Solucion } from '@/components/SolucionesList'
import ArchitectureCanvas, { type ArchNode } from '@/components/ArchitectureCanvas'

const benefits = [
  {
    icon: FlaskConical,
    title: 'Validación técnica',
    desc: 'Comprobamos que la tecnología elegida resuelve el caso de uso antes de invertir en desarrollo completo.',
  },
  {
    icon: Gauge,
    title: 'Rápido y enfocado',
    desc: 'PoC de 2 a 6 semanas con un alcance reducido y métricas claras de éxito.',
  },
  {
    icon: Target,
    title: 'Medición de impacto',
    desc: 'Definimos KPIs concretos para demostrar ROI y tomar decisiones con datos.',
  },
  {
    icon: ShieldCheck,
    title: 'Reducción de riesgo',
    desc: 'Identificamos limitaciones técnicas, costos reales y ajustes necesarios a tiempo.',
  },
]

const deliverables = [
  { title: 'Demo funcional', desc: 'Un prototipo ejecutable del caso de uso prioritario.' },
  { title: 'Informe técnico', desc: 'Arquitectura, stack, limitaciones y recomendaciones.' },
  { title: 'Propuesta de escala', desc: 'Roadmap y estimación para llevar el PoC a producción.' },
  { title: 'KPIs validados', desc: 'Resultados medibles contra los objetivos definidos.' },
]

const ESTADOS = ['ACTIVO', 'EN_DESARROLLO', 'PENDIENTE', 'PAUSADO', 'FINALIZADO']
const ESTADOS_FASE = ['PENDIENTE', 'EN_CURSO', 'COMPLETADA']

interface LeadOption {
  id: string
  companyName: string
  contactName: string
  solucion: { id: string } | null
}

interface FaseCronograma {
  id: string
  fase: string
  fechaInicio: string
  fechaFin: string
  estado: string
}

interface FormState {
  nombre: string
  descripcion: string
  estado: string
  valorEstimado: string
  leadId: string
  repositorio: string
  planTrabajo: string
}

const defaultForm: FormState = {
  nombre: '',
  descripcion: '',
  estado: 'ACTIVO',
  valorEstimado: '0',
  leadId: '',
  repositorio: '',
  planTrabajo: '',
}

type TabKey = 'general' | 'arquitectura' | 'plan' | 'cronograma' | 'codigo'

const TABS: { key: TabKey; label: string; icon: typeof Sliders }[] = [
  { key: 'general', label: 'General', icon: Sliders },
  { key: 'arquitectura', label: 'Arquitectura', icon: LayoutGrid },
  { key: 'plan', label: 'Plan de Trabajo', icon: FileText },
  { key: 'cronograma', label: 'Cronograma', icon: Calendar },
  { key: 'codigo', label: 'Código fuente', icon: Code2 },
]

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

export default function PocSolutionPage() {
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('general')
  const [form, setForm] = useState<FormState>(defaultForm)
  const [archNodes, setArchNodes] = useState<ArchNode[]>([])
  const [fases, setFases] = useState<FaseCronograma[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [draggingPlan, setDraggingPlan] = useState(false)
  const [planFileError, setPlanFileError] = useState('')
  const planFileInputRef = useRef<HTMLInputElement>(null)

  function importPlanFile(file: File | undefined) {
    if (!file) return
    const okExt = /\.(md|markdown|txt)$/i.test(file.name)
    if (!okExt) {
      setPlanFileError('Solo se aceptan archivos .md, .markdown o .txt.')
      return
    }
    setPlanFileError('')
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || '')
      setForm(f => ({ ...f, planTrabajo: text }))
    }
    reader.onerror = () => setPlanFileError('No se pudo leer el archivo.')
    reader.readAsText(file)
  }

  async function loadLeads() {
    setLoadingLeads(true)
    try {
      const res = await fetch('/api/leads')
      const data = await res.json()
      setLeads(Array.isArray(data) ? data : [])
    } catch {
      setLeads([])
    } finally {
      setLoadingLeads(false)
    }
  }

  async function openCreateModal() {
    setEditingId(null)
    setForm(defaultForm)
    setArchNodes([])
    setFases([])
    setActiveTab('general')
    setError('')
    setShowModal(true)
    await loadLeads()
  }

  async function openEditModal(solucion: Solucion) {
    setEditingId(solucion.id)
    setForm({
      nombre: solucion.nombre,
      descripcion: solucion.descripcion || '',
      estado: solucion.estado,
      valorEstimado: String(solucion.valorEstimado ?? 0),
      leadId: solucion.leadId || '',
      repositorio: solucion.repositorio || '',
      planTrabajo: solucion.planTrabajo || '',
    })
    try {
      setArchNodes(solucion.arquitectura ? JSON.parse(solucion.arquitectura) : [])
    } catch {
      setArchNodes([])
    }
    try {
      setFases(solucion.cronograma ? JSON.parse(solucion.cronograma) : [])
    } catch {
      setFases([])
    }
    setActiveTab('general')
    setError('')
    setShowModal(true)
    await loadLeads()
  }

  function closeModal() {
    if (saving) return
    setShowModal(false)
  }

  function handleLeadChange(leadId: string) {
    const lead = leads.find(l => l.id === leadId)
    setForm(f => ({
      ...f,
      leadId,
      nombre: lead && !f.nombre.trim() ? `${lead.companyName} — Demo` : f.nombre,
    }))
  }

  function addFase() {
    setFases(prev => [...prev, { id: makeId(), fase: '', fechaInicio: '', fechaFin: '', estado: 'PENDIENTE' }])
  }

  function updateFase(id: string, patch: Partial<FaseCronograma>) {
    setFases(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
  }

  function removeFase(id: string) {
    setFases(prev => prev.filter(f => f.id !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.leadId) {
      setError('Selecciona un lead asociado.')
      setActiveTab('general')
      return
    }
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.')
      setActiveTab('general')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        tipo: 'DEMO',
        estado: form.estado,
        valorEstimado: parseFloat(form.valorEstimado) || 0,
        leadId: form.leadId,
        repositorio: form.repositorio.trim() || null,
        arquitectura: JSON.stringify(archNodes),
        planTrabajo: form.planTrabajo.trim() || null,
        cronograma: JSON.stringify(fases),
      }
      const res = await fetch(editingId ? `/api/soluciones/${editingId}` : '/api/soluciones', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Error al guardar el PoC.')
      }
      setRefreshKey(k => k + 1)
      setShowModal(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setSaving(false)
    }
  }

  // Leads sin solución asociada, más el lead actual de la PoC que se está editando (si aplica)
  const availableLeads = leads.filter(l => !l.solucion || l.solucion.id === editingId)

  const addButton = (
    <button
      onClick={openCreateModal}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors"
    >
      <Plus size={14} />
      Nueva PoC
    </button>
  )

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {benefits.map(b => (
          <div
            key={b.title}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-cyan-500/30 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-cyan-600/15 flex items-center justify-center flex-shrink-0">
                <b.icon className="text-cyan-400" size={20} />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">{b.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{b.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8">
        <h2 className="text-xl font-bold text-white mb-6">Metodología del PoC</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: '01', title: 'Definición', desc: 'Seleccionamos el caso de uso, datos disponibles y criterios de éxito.' },
            { step: '02', title: 'Diseño', desc: 'Diseñamos el experimento mínimo viable y la arquitectura técnica.' },
            { step: '03', title: 'Implementación', desc: 'Construimos el demo funcional en tiempo record.' },
            { step: '04', title: 'Validación', desc: 'Medimos resultados y entregamos recomendación de go/no-go.' },
          ].map((p, idx, arr) => (
            <div key={p.step} className="relative">
              {idx < arr.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-gradient-to-r from-cyan-500/50 to-transparent" />
              )}
              <div className="flex items-center gap-3 mb-3">
                <span className="w-12 h-12 rounded-full bg-cyan-600/15 text-cyan-400 font-bold flex items-center justify-center border border-cyan-500/20">
                  {p.step}
                </span>
                <ArrowRight className="text-gray-600 lg:hidden" size={16} />
              </div>
              <h3 className="text-white font-semibold mb-1">{p.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Deliverables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {deliverables.map(d => (
          <div key={d.title} className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-xl p-5">
            <CheckCircle2 className="text-cyan-400 mt-0.5 flex-shrink-0" size={18} />
            <div>
              <h3 className="text-white font-medium mb-1">{d.title}</h3>
              <p className="text-gray-400 text-sm">{d.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Soluciones asociadas */}
      <SolucionesList
        tipo="DEMO"
        color="cyan"
        title="PRUEBAS DE CONCEPTO"
        hideIcon
        refreshKey={refreshKey}
        headerAction={addButton}
        onSelect={openEditModal}
      />

      {/* CTA */}
      <div className="card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <Zap className="text-cyan-400" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">¿Quieres validar una idea antes de invertir?</h2>
            <p className="text-gray-400 text-sm">Un PoC es la forma más segura de probar el valor de la IA en tu negocio.</p>
          </div>
        </div>
        <Link
          href="/leads"
          className="btn btn-primary flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)', borderColor: 'rgba(6,182,212,0.5)' }}
        >
          Empezar un PoC
          <ArrowRight size={16} />
        </Link>
      </div>

      {/* Modal: Nueva/Editar PoC */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header del modal */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800 bg-gradient-to-r from-cyan-900/40 to-gray-900">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center">
                  {editingId ? <Pencil className="text-cyan-400" size={16} /> : <Plus className="text-cyan-400" size={18} />}
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg leading-none">{editingId ? 'Editar PoC' : 'Nueva PoC'}</h2>
                  <p className="text-cyan-400/70 text-xs mt-0.5">Tipo: DEMO</p>
                </div>
              </div>
              <button
                onClick={closeModal}
                disabled={saving}
                className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-6 pt-4 border-b border-gray-800 overflow-x-auto">
              {TABS.map(t => {
                const active = activeTab === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className="relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors flex-shrink-0"
                    style={{ color: active ? '#22d3ee' : '#64748b' }}
                  >
                    <t.icon size={14} />
                    {t.label}
                    {active && (
                      <span className="absolute left-0 right-0 -bottom-px h-0.5 rounded-full bg-cyan-400" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">

                {/* ── Tab: General ───────────────────────────────────────── */}
                {activeTab === 'general' && (
                  <>
                    {/* Lead asociado */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Lead asociado <span className="text-cyan-400">*</span>
                      </label>
                      {loadingLeads ? (
                        <div className="flex items-center gap-2 text-gray-500 text-sm py-3">
                          <Loader2 size={14} className="animate-spin" /> Cargando leads…
                        </div>
                      ) : (
                        <select
                          value={form.leadId}
                          onChange={e => handleLeadChange(e.target.value)}
                          disabled={saving}
                          required
                          className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60 appearance-none cursor-pointer"
                        >
                          <option value="" disabled>Selecciona un lead…</option>
                          {availableLeads.map(l => (
                            <option key={l.id} value={l.id}>{l.companyName} — {l.contactName}</option>
                          ))}
                        </select>
                      )}
                      {!loadingLeads && availableLeads.length === 0 && (
                        <p className="text-gray-600 text-xs mt-1.5">No hay leads sin PoC/solución asociada todavía. Crea o libera un lead primero.</p>
                      )}
                    </div>

                    {/* Nombre */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Nombre <span className="text-cyan-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.nombre}
                        onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                        placeholder="Ej. Empresa XYZ — Demo"
                        disabled={saving}
                        className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60"
                      />
                    </div>

                    {/* Descripción */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Descripción <span className="text-gray-600 font-normal">(opcional)</span>
                      </label>
                      <textarea
                        value={form.descripcion}
                        onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                        placeholder="Describe el alcance del PoC..."
                        rows={3}
                        disabled={saving}
                        className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60"
                      />
                    </div>

                    {/* Repositorio */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-1.5">
                        <FolderGit2 size={14} className="text-gray-500" />
                        Repositorio <span className="text-gray-600 font-normal">(opcional)</span>
                      </label>
                      <input
                        type="url"
                        value={form.repositorio}
                        onChange={e => setForm(f => ({ ...f, repositorio: e.target.value }))}
                        placeholder="https://github.com/Architech-IA/..."
                        disabled={saving}
                        className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60"
                      />
                    </div>

                    {/* Estado + Valor en fila */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Estado</label>
                        <select
                          value={form.estado}
                          onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                          disabled={saving}
                          className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60 appearance-none cursor-pointer"
                        >
                          {ESTADOS.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Valor estimado ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={form.valorEstimado}
                          onChange={e => setForm(f => ({ ...f, valorEstimado: e.target.value }))}
                          disabled={saving}
                          className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* ── Tab: Arquitectura ──────────────────────────────────── */}
                {activeTab === 'arquitectura' && (
                  <ArchitectureCanvas nodes={archNodes} onChange={setArchNodes} />
                )}

                {/* ── Tab: Plan de Trabajo ───────────────────────────────── */}
                {activeTab === 'plan' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                        <FileText size={14} className="text-gray-500" />
                        Plan de trabajo <span className="text-gray-600 font-normal">(Markdown o texto libre)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => planFileInputRef.current?.click()}
                        disabled={saving}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        <Upload size={12} />
                        Subir archivo
                      </button>
                      <input
                        ref={planFileInputRef}
                        type="file"
                        accept=".md,.markdown,.txt,text/markdown,text/plain"
                        className="hidden"
                        onChange={e => { importPlanFile(e.target.files?.[0]); e.target.value = '' }}
                      />
                    </div>

                    {/* Dropzone */}
                    <div
                      onDragOver={e => { e.preventDefault(); setDraggingPlan(true) }}
                      onDragLeave={() => setDraggingPlan(false)}
                      onDrop={e => {
                        e.preventDefault()
                        setDraggingPlan(false)
                        importPlanFile(e.dataTransfer.files?.[0])
                      }}
                      className="rounded-xl border-2 border-dashed transition-colors mb-2 px-4 py-3 flex items-center gap-2.5"
                      style={{
                        borderColor: draggingPlan ? 'rgba(6,182,212,0.6)' : 'rgba(255,255,255,0.08)',
                        background: draggingPlan ? 'rgba(6,182,212,0.06)' : 'transparent',
                      }}
                    >
                      <Upload size={14} className="text-gray-500 flex-shrink-0" />
                      <p className="text-gray-500 text-xs">Arrastrá acá un archivo <span className="text-gray-400">.md / .markdown / .txt</span> para importarlo, o usá el botón de arriba.</p>
                    </div>
                    {planFileError && (
                      <p className="text-red-400 text-xs mb-2">{planFileError}</p>
                    )}

                    <textarea
                      value={form.planTrabajo}
                      onChange={e => setForm(f => ({ ...f, planTrabajo: e.target.value }))}
                      placeholder={'# Plan de trabajo\n\n## Contexto\n...\n\n## Pasos de ejecución\n1. ...'}
                      rows={14}
                      disabled={saving}
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-xs font-mono leading-relaxed resize-none focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60"
                    />
                    <p className="text-gray-600 text-xs mt-1.5">Importar un archivo reemplaza el contenido actual de este campo — podés seguir editándolo abajo después de importarlo.</p>
                  </div>
                )}

                {/* ── Tab: Cronograma ────────────────────────────────────── */}
                {activeTab === 'cronograma' && (
                  <div className="space-y-3">
                    {fases.length === 0 && (
                      <p className="text-gray-600 text-sm text-center py-4">Sin fases todavía. Agregá la primera abajo.</p>
                    )}
                    {fases.map(f => (
                      <div key={f.id} className="bg-gray-950 border border-gray-700 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={f.fase}
                            onChange={e => updateFase(f.id, { fase: e.target.value })}
                            placeholder="Nombre de la fase (ej. Scaffold + modelo de datos)"
                            disabled={saving}
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60"
                          />
                          <button
                            type="button"
                            onClick={() => removeFase(f.id)}
                            disabled={saving}
                            className="w-8 h-8 flex-shrink-0 rounded-lg bg-gray-900 hover:bg-red-900/30 text-gray-500 hover:text-red-400 flex items-center justify-center transition-colors disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="date"
                            value={f.fechaInicio}
                            onChange={e => updateFase(f.id, { fechaInicio: e.target.value })}
                            disabled={saving}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60"
                          />
                          <input
                            type="date"
                            value={f.fechaFin}
                            onChange={e => updateFase(f.id, { fechaFin: e.target.value })}
                            disabled={saving}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60"
                          />
                          <select
                            value={f.estado}
                            onChange={e => updateFase(f.id, { estado: e.target.value })}
                            disabled={saving}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60 appearance-none cursor-pointer"
                          >
                            {ESTADOS_FASE.map(es => <option key={es} value={es}>{es}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addFase}
                      disabled={saving}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40 text-sm transition-colors disabled:opacity-50"
                    >
                      <Plus size={14} /> Agregar fase
                    </button>
                  </div>
                )}

                {/* ── Tab: Código fuente ─────────────────────────────────── */}
                {activeTab === 'codigo' && (
                  <div className="space-y-3">
                    {form.repositorio ? (
                      <a
                        href={form.repositorio}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 bg-gray-950 border border-gray-700 hover:border-cyan-500/40 rounded-xl px-4 py-3.5 transition-colors group"
                      >
                        <div className="w-9 h-9 rounded-lg bg-cyan-600/15 flex items-center justify-center flex-shrink-0">
                          <FolderGit2 size={16} className="text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{form.repositorio}</p>
                          <p className="text-gray-500 text-xs">Abrir repositorio</p>
                        </div>
                        <ExternalLink size={14} className="text-gray-500 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                      </a>
                    ) : (
                      <div className="text-center py-8">
                        <FolderGit2 size={28} className="text-gray-700 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">Todavía no registraste un repositorio.</p>
                        <button
                          type="button"
                          onClick={() => setActiveTab('general')}
                          className="text-cyan-400 hover:text-cyan-300 text-xs mt-1.5 transition-colors"
                        >
                          Agregarlo en la pestaña General →
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 bg-red-900/30 border border-red-800/50 rounded-xl px-4 py-3">
                    <X size={14} className="text-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 bg-gray-900/60">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white rounded-xl text-sm font-semibold transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Guardando…
                    </>
                  ) : editingId ? (
                    <>
                      <CheckCircle2 size={15} />
                      Guardar cambios
                    </>
                  ) : (
                    <>
                      <Plus size={15} />
                      Crear PoC
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
