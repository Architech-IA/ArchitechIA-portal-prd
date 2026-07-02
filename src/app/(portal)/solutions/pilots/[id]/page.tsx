'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Sliders, LayoutGrid, FileText, Calendar, Code2,
  Loader2, FolderGit2, ExternalLink, Upload, Eye, Code, Wand2, List, BarChart3,
  Trash2, Save, Plus, ListPlus,
} from 'lucide-react'
import ArchitectureCanvas, { type ArchNode, type ArchConnection } from '@/components/ArchitectureCanvas'
import PlanVisualView from '@/components/PlanVisualView'
import CronogramaTimeline from '@/components/CronogramaTimeline'
import { extractStepsFromPlan } from '@/lib/planUtils'
import { useSetPageTitle } from '@/lib/pageTitleContext'

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
  backlogItemId?: string
}

const ESTADO_A_BACKLOG: Record<string, string> = {
  PENDIENTE: 'BACKLOG',
  EN_CURSO: 'IN_PROGRESS',
  COMPLETADA: 'DONE',
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

const emptyForm: FormState = {
  nombre: '', descripcion: '', estado: 'ACTIVO', valorEstimado: '0', leadId: '', repositorio: '', planTrabajo: '',
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

export default function PocDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = String(params.id)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('general')
  const [form, setForm] = useState<FormState>(emptyForm)
  const [archNodes, setArchNodes] = useState<ArchNode[]>([])
  const [archConnections, setArchConnections] = useState<ArchConnection[]>([])
  const [fases, setFases] = useState<FaseCronograma[]>([])
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [loadingLeads, setLoadingLeads] = useState(true)
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [cargandoBacklogMasivo, setCargandoBacklogMasivo] = useState(false)

  const [arquitecturaHtml, setArquitecturaHtml] = useState<string | null>(null)
  const [archView, setArchView] = useState<'canvas' | 'html'>('canvas')

  const [draggiingPlan, setDraggingPlan] = useState(false)
  const [planFileError, setPlanFileError] = useState('')
  const [planView, setPlanView] = useState<'markdown' | 'visual'>('visual')
  const [cronogramaView, setCronogramaView] = useState<'lista' | 'linea'>('linea')
  const planFileInputRef = useRef<HTMLInputElement>(null)
  const htmlFileInputRef = useRef<HTMLInputElement>(null)

  useSetPageTitle(form.nombre || null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/soluciones/${id}`)
        if (res.status === 404) { if (!cancelled) { setNotFound(true); setLoading(false) }; return }
        const s = await res.json()
        if (cancelled) return
        setForm({
          nombre: s.nombre,
          descripcion: s.descripcion || '',
          estado: s.estado,
          valorEstimado: String(s.valorEstimado ?? 0),
          leadId: s.leadId || '',
          repositorio: s.repositorio || '',
          planTrabajo: s.planTrabajo || '',
        })
        setCurrentLeadId(s.leadId || null)
        setArquitecturaHtml(s.arquitecturaHtml || null)
        try {
          const parsedArch = s.arquitectura ? JSON.parse(s.arquitectura) : null
          if (Array.isArray(parsedArch)) {
            setArchNodes(parsedArch)
            setArchConnections([])
          } else if (parsedArch && typeof parsedArch === 'object') {
            setArchNodes(Array.isArray(parsedArch.nodes) ? parsedArch.nodes : [])
            setArchConnections(Array.isArray(parsedArch.connections) ? parsedArch.connections : [])
          } else {
            setArchNodes([])
            setArchConnections([])
          }
        } catch { setArchNodes([]); setArchConnections([]) }
        try { setFases(s.cronograma ? JSON.parse(s.cronograma) : []) } catch { setFases([]) }
      } catch {
        setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    async function loadLeads() {
      try {
        const res = await fetch('/api/leads')
        const data = await res.json()
        if (!cancelled) setLeads(Array.isArray(data) ? data : [])
      } catch {
        if (!cancelled) setLeads([])
      } finally {
        if (!cancelled) setLoadingLeads(false)
      }
    }
    load()
    loadLeads()
    return () => { cancelled = true }
  }, [id])

  function importPlanFile(file: File | undefined) {
    if (!file) return
    const okExt = /\.(md|markdown|txt)$/i.test(file.name)
    if (!okExt) { setPlanFileError('Solo se aceptan archivos .md, .markdown o .txt.'); return }
    setPlanFileError('')
    const reader = new FileReader()
    reader.onload = () => setForm(f => ({ ...f, planTrabajo: String(reader.result || '') }))
    reader.onerror = () => setPlanFileError('No se pudo leer el archivo.')
    reader.readAsText(file)
  }

  function importHtmlFile(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setArquitecturaHtml(String(reader.result || ''))
    reader.readAsText(file)
  }

  function addFase() {
    setFases(prev => [...prev, { id: makeId(), fase: '', fechaInicio: '', fechaFin: '', estado: 'PENDIENTE' }])
  }
  function updateFase(fid: string, patch: Partial<FaseCronograma>) {
    setFases(prev => prev.map(f => f.id === fid ? { ...f, ...patch } : f))
  }
  function removeFase(fid: string) {
    setFases(prev => prev.filter(f => f.id !== fid))
  }
  function generarCronogramaDesdePlan() {
    const steps = extractStepsFromPlan(form.planTrabajo)
    if (steps.length === 0) {
      setError('No se encontraron pasos numerados en el Plan de Trabajo.')
      return
    }
    if (fases.length > 0 && !window.confirm(`Esto va a reemplazar las ${fases.length} fase(s) actuales por ${steps.length} fase(s) extraída(s) del plan. ¿Continuar?`)) return
    setError('')
    setFases(steps.map(s => ({ id: makeId(), fase: s, fechaInicio: '', fechaFin: '', estado: 'PENDIENTE' })))
  }

  async function cargarTodasAlBacklog() {
    const pendientes = fases.filter(f => !f.backlogItemId)
    if (pendientes.length === 0) return
    if (!window.confirm(`Esto va a crear ${pendientes.length} tarea(s) nueva(s) en el Backlog (las que ya están cargadas se omiten). ¿Continuar?`)) return
    setCargandoBacklogMasivo(true)
    setError('')
    try {
      for (const f of pendientes) {
        const res = await fetch('/api/backlog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: f.fase || 'Sin nombre',
            solutionId: id,
            type: 'TASK',
            priority: 'MEDIUM',
            status: ESTADO_A_BACKLOG[f.estado] || 'BACKLOG',
          }),
        })
        if (!res.ok) continue
        const created = await res.json()
        updateFase(f.id, { backlogItemId: created.id })
      }
    } catch {
      setError('Hubo un error cargando algunas fases al backlog.')
    } finally {
      setCargandoBacklogMasivo(false)
    }
  }

  function handleLeadChange(leadId: string) {
    setForm(f => ({ ...f, leadId }))
  }

  async function handleSave() {
    if (!form.leadId) { setError('Selecciona un lead asociado.'); setActiveTab('general'); return }
    if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); setActiveTab('general'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/soluciones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || null,
          tipo: 'DEMO',
          estado: form.estado,
          valorEstimado: parseFloat(form.valorEstimado) || 0,
          leadId: form.leadId,
          repositorio: form.repositorio.trim() || null,
          arquitectura: JSON.stringify({ nodes: archNodes, connections: archConnections }),
          arquitecturaHtml: arquitecturaHtml || null,
          planTrabajo: form.planTrabajo.trim() || null,
          cronograma: JSON.stringify(fases),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Error al guardar.')
      }
      setCurrentLeadId(form.leadId)
      setSavedAt(Date.now())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('¿Eliminar esta PoC? Esta acción no se puede deshacer.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/soluciones/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.push('/soluciones/pilotos')
    } catch {
      setError('No se pudo eliminar la PoC.')
      setDeleting(false)
    }
  }

  const availableLeads = leads.filter(l => !l.solucion || l.id === currentLeadId || l.id === form.leadId)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="text-cyan-500 animate-spin" size={28} />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="p-4 md:p-8">
        <Link href="/soluciones/pilotos" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-cyan-400 transition-colors mb-4">
          <ArrowLeft size={14} /> Volver a Pilotos
        </Link>
        <div className="card p-8 text-center">
          <p className="text-white font-semibold">PoC no encontrada</p>
          <p className="text-gray-500 text-sm mt-1">Puede que haya sido eliminada.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Tabs */}
      <div className="border-b border-gray-700 bg-gray-900/60 px-4 md:px-8">
        <nav className="flex gap-1 overflow-x-auto overflow-y-hidden">
          <Link
            href="/soluciones/pilotos"
            className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-300 border-b-2 border-transparent -mb-px rounded-t-md hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
          >
            <ArrowLeft size={15} /> Volver a Pilotos
          </Link>
          <span className="w-px my-3 bg-gray-700 flex-shrink-0" />
          {TABS.map((t, i) => {
            const active = activeTab === t.key
            return (
              <span key={t.key} className="flex items-stretch flex-shrink-0">
                {i > 0 && <span className="w-px my-3 bg-gray-700 flex-shrink-0" />}
                <button
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px rounded-t-md transition-colors flex-shrink-0 ${
                    active
                      ? 'text-orange-400 border-orange-500 bg-orange-500/10'
                      : 'text-gray-300 border-transparent hover:text-white hover:bg-white/5'
                  }`}
                >
                  <t.icon size={15} />
                  {t.label}
                </button>
              </span>
            )
          })}
        </nav>
      </div>

      <div className="p-4 space-y-4">
        <div className="card p-4 space-y-5">

          {/* Tab: General */}
          {activeTab === 'general' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                        <option key={l.id} value={l.id}>{l.companyName} – {l.contactName}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Nombre <span className="text-cyan-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    disabled={saving}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Estado</label>
                  <select
                    value={form.estado}
                    onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    disabled={saving}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60 appearance-none cursor-pointer"
                  >
                    {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
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

                <div className="md:col-span-2">
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

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Descripción <span className="text-gray-600 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={form.descripcion}
                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                    rows={5}
                    disabled={saving}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm resize-none focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="border border-red-900/40 bg-red-950/10 rounded-xl p-4 mt-6">
                <p className="text-red-400 text-sm font-semibold mb-1">Eliminar esta PoC</p>
                <p className="text-gray-500 text-xs mb-3">Esta acción no se puede deshacer – se borra junto con su arquitectura, plan, cronograma y código asociado.</p>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || saving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Eliminar PoC
                </button>
              </div>
            </>
          )}

          {/* Tab: Arquitectura */}
          {activeTab === 'arquitectura' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-0.5 bg-gray-800 border border-gray-700 rounded-lg p-0.5">
                  <button type="button" onClick={() => setArchView('canvas')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${archView === 'canvas' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:text-white'}`}>
                    <LayoutGrid size={12} /> Canvas
                  </button>
                  <button type="button" onClick={() => setArchView('html')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${archView === 'html' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:text-white'}`}>
                    <Code size={12} /> HTML
                  </button>
                </div>
                {archView === 'html' && (
                  <button type="button" onClick={() => htmlFileInputRef.current?.click()} disabled={saving}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors disabled:opacity-50">
                    <Upload size={12} /> Importar HTML
                  </button>
                )}
                <input ref={htmlFileInputRef} type="file" accept=".html" className="hidden"
                  onChange={e => { importHtmlFile(e.target.files?.[0]); e.target.value = '' }} />
              </div>
              {archView === 'canvas' ? (
                <ArchitectureCanvas
                  nodes={archNodes}
                  connections={archConnections}
                  onChange={(n, c) => { setArchNodes(n); setArchConnections(c) }}
                />
              ) : arquitecturaHtml ? (
                <iframe
                  srcDoc={arquitecturaHtml}
                  className="w-full rounded-xl border border-gray-700"
                  style={{ height: '680px' }}
                  title="Diagrama de arquitectura"
                  sandbox="allow-scripts"
                />
              ) : (
                <div
                  className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed border-gray-700 cursor-pointer hover:border-cyan-500/40 transition-colors"
                  onClick={() => htmlFileInputRef.current?.click()}
                >
                  <Upload size={24} className="text-gray-600 mb-3" />
                  <p className="text-gray-400 text-sm font-medium">Importar diagrama HTML</p>
                  <p className="text-gray-600 text-xs mt-1">Hacé clic para seleccionar un archivo .html</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Plan de Trabajo */}
          {activeTab === 'plan' && (
            <div>
              <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
                <label className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
                  <FileText size={14} className="text-gray-500" />
                  Plan de trabajo
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 bg-gray-800 rounded-lg p-0.5">
                    <button type="button" onClick={() => setPlanView('visual')}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${planView === 'visual' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                      <Eye size={12} /> Vista visual
                    </button>
                    <button type="button" onClick={() => setPlanView('markdown')}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${planView === 'markdown' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                      <Code size={12} /> Markdown
                    </button>
                  </div>
                  <button type="button" onClick={() => planFileInputRef.current?.click()} disabled={saving}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors disabled:opacity-50">
                    <Upload size={12} /> Subir archivo
                  </button>
                  <input ref={planFileInputRef} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="hidden"
                    onChange={e => { importPlanFile(e.target.files?.[0]); e.target.value = '' }} />
                </div>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDraggingPlan(true) }}
                onDragLeave={() => setDraggingPlan(false)}
                onDrop={e => { e.preventDefault(); setDraggingPlan(false); importPlanFile(e.dataTransfer.files?.[0]) }}
                className="rounded-xl border-2 border-dashed transition-colors mb-3 px-4 py-3 flex items-center gap-2.5"
                style={{ borderColor: draggiingPlan ? 'rgba(6,182,212,0.6)' : 'rgba(255,255,255,0.08)', background: draggiingPlan ? 'rgba(6,182,212,0.06)' : 'transparent' }}
              >
                <Upload size={14} className="text-gray-500 flex-shrink-0" />
                <p className="text-gray-500 text-xs">Arrastrá acá un archivo <span className="text-gray-400">.md / .markdown / .txt</span> para importarlo, o usá el botón de arriba.</p>
              </div>
              {planFileError && <p className="text-red-400 text-xs mb-2">{planFileError}</p>}

              {planView === 'visual' ? (
                <PlanVisualView markdown={form.planTrabajo} />
              ) : (
                <>
                  <textarea
                    value={form.planTrabajo}
                    onChange={e => setForm(f => ({ ...f, planTrabajo: e.target.value }))}
                    placeholder={'# Plan de trabajo\n\n# Contexto\n...\n\n# Pasos de ejecución\n1. ...'}
                    rows={24}
                    disabled={saving}
                    className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-xs font-mono leading-relaxed resize-none focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors disabled:opacity-60"
                  />
                  <p className="text-gray-600 text-xs mt-1.5">Los títulos <code className="bg-gray-800 px-1 rounded">#</code> y <code className="bg-gray-800 px-1 rounded">##</code> se usan para armar la Vista visual.</p>
                </>
              )}
            </div>
          )}

          {/* Tab: Cronograma */}
          {activeTab === 'cronograma' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-0.5 bg-gray-800 border border-gray-700 rounded-lg p-0.5">
                  <button type="button" onClick={() => setCronogramaView('lista')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${cronogramaView === 'lista' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:text-white'}`}>
                    <List size={12} /> Lista
                  </button>
                  <button type="button" onClick={() => setCronogramaView('linea')}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${cronogramaView === 'linea' ? 'bg-cyan-600 text-white' : 'text-gray-300 hover:text-white'}`}>
                    <BarChart3 size={12} /> Línea de tiempo
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={cargarTodasAlBacklog} disabled={cargandoBacklogMasivo || fases.length === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-200 hover:text-white text-xs font-medium transition-colors disabled:opacity-50">
                    {cargandoBacklogMasivo ? <Loader2 size={12} className="animate-spin" /> : <ListPlus size={12} />}
                    {cargandoBacklogMasivo ? 'Cargando…' : 'Agregar todas al backlog'}
                  </button>
                  <button type="button" onClick={generarCronogramaDesdePlan} disabled={saving}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-200 hover:text-white text-xs font-medium transition-colors disabled:opacity-50">
                    <Wand2 size={12} /> Generar desde el Plan
                  </button>
                </div>
              </div>

              {cronogramaView === 'linea' ? (
                <CronogramaTimeline fases={fases} onUpdate={updateFase} onRemove={removeFase} solucionId={id} planMarkdown={form.planTrabajo} />
              ) : (
                <>
                  {fases.length === 0 && (
                    <p className="text-gray-600 text-sm text-center py-4">Sin fases todavía. Agregá la primera abajo, o generálas desde el Plan de Trabajo.</p>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {fases.map(f => (
                      <div key={f.id} className="bg-gray-950 border border-gray-700 rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <input type="text" value={f.fase} onChange={e => updateFase(f.id, { fase: e.target.value })}
                            placeholder="Nombre de la fase" disabled={saving}
                            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60" />
                          <button type="button" onClick={() => removeFase(f.id)} disabled={saving}
                            className="w-8 h-8 flex-shrink-0 rounded-lg bg-gray-900 hover:bg-red-900/30 text-gray-500 hover:text-red-400 flex items-center justify-center transition-colors disabled:opacity-50">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <input type="date" value={f.fechaInicio} onChange={e => updateFase(f.id, { fechaInicio: e.target.value })} disabled={saving}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60" />
                          <input type="date" value={f.fechaFin} onChange={e => updateFase(f.id, { fechaFin: e.target.value })} disabled={saving}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60" />
                          <select value={f.estado} onChange={e => updateFase(f.id, { estado: e.target.value })} disabled={saving}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60 appearance-none cursor-pointer">
                            {ESTADOS_FASE.map(es => <option key={es} value={es}>{es}</option>)}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addFase} disabled={saving}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40 text-sm transition-colors disabled:opacity-50">
                    <Plus size={14} /> Agregar fase
                  </button>
                </>
              )}
            </div>
          )}

          {/* Tab: Código fuente */}
          {activeTab === 'codigo' && (
            <div className="space-y-3">
              {form.repositorio ? (
                <a href={form.repositorio} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-gray-950 border border-gray-700 hover:border-cyan-500/40 rounded-xl px-4 py-3.5 transition-colors group max-w-md">
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
                  <button type="button" onClick={() => setActiveTab('general')} className="text-cyan-400 hover:text-cyan-300 text-xs mt-1.5 transition-colors">
                    Agregarlo en la pestaña General →
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-800/50 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Guardar cambios */}
        <div className="flex items-center justify-end gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          {savedAt && !saving && (
            <p className="text-emerald-400 text-xs">Guardado {new Date(savedAt).toLocaleTimeString('es-CO')}</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white text-sm font-semibold transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
