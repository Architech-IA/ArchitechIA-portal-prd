'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePageActions } from '@/lib/pageActionsContext'
import {
  ArrowLeft, CheckCircle2, Circle, Clock, Loader2,
  Save, Paperclip, X, Download, Trash2, FileText,
  ChevronRight,
} from 'lucide-react'

interface Lead {
  id: string
  companyName: string
  contactName: string
  status: string
  estimatedValue: number
  source: string
  notes: string | null
  user: { name: string }
}

interface HubFile {
  id: string
  name: string
  size: number
  mimeType: string
  uploadedBy: string
  createdAt: string
}

interface PhaseData {
  id: string
  phase: string
  content: string | null
  updatedBy: string | null
  updatedAt: string
  files: HubFile[]
}

const PHASES = [
  { key: 'NEW',             label: 'Identificación',  desc: 'Primera identificación del prospecto',          color: 'blue'   },
  { key: 'CONTACTED',       label: 'Contacto',         desc: 'Primer contacto establecido con el cliente',    color: 'purple' },
  { key: 'DIAGNOSIS',       label: 'Diagnóstico',      desc: 'Análisis de necesidades y alcance del proyecto', color: 'cyan'   },
  { key: 'DEMO_VALIDATION', label: 'Demo',             desc: 'Demostración de la solución propuesta',          color: 'teal'   },
  { key: 'PROPOSAL_SENT',   label: 'Propuesta',        desc: 'Propuesta técnica y comercial enviada',          color: 'indigo' },
  { key: 'NEGOTIATION',     label: 'Negociación',      desc: 'Negociación de términos y condiciones',          color: 'orange' },
  { key: 'WON',             label: 'Resultado',        desc: 'Cierre y resultado del proceso',                 color: 'green'  },
]

const STATUS_ORDER = PHASES.map(p => p.key)

const COLOR_MAP: Record<string, { dot: string; ring: string; bg: string; text: string; border: string }> = {
  blue:   { dot: 'bg-blue-500',   ring: 'ring-blue-500/30',   bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/30'   },
  purple: { dot: 'bg-purple-500', ring: 'ring-purple-500/30', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  cyan:   { dot: 'bg-cyan-500',   ring: 'ring-cyan-500/30',   bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   border: 'border-cyan-500/30'   },
  teal:   { dot: 'bg-teal-500',   ring: 'ring-teal-500/30',   bg: 'bg-teal-500/10',   text: 'text-teal-400',   border: 'border-teal-500/30'   },
  indigo: { dot: 'bg-indigo-500', ring: 'ring-indigo-500/30', bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  orange: { dot: 'bg-orange-500', ring: 'ring-orange-500/30', bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  green:  { dot: 'bg-green-500',  ring: 'ring-green-500/30',  bg: 'bg-green-500/10',  text: 'text-green-400',  border: 'border-green-500/30'  },
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function PhasePanel({
  phase, data, leadId, onSaved,
}: {
  phase: typeof PHASES[0]
  data: PhaseData | null
  leadId: string
  onSaved: (updated: PhaseData) => void
}) {
  const [content, setContent] = useState(data?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingFile, setDeletingFile] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const c = COLOR_MAP[phase.color]

  useEffect(() => { setContent(data?.content ?? '') }, [data])

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/leads/hub-phase', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, phase: phase.key, content }),
      })
      if (res.ok) {
        const updated = await res.json()
        onSaved(updated)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally { setSaving(false) }
  }

  const uploadFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { alert('Máximo 5MB por archivo'); return }
    setUploading(true)
    try {
      // Ensure hub exists first
      let hubId = data?.id
      if (!hubId) {
        const res = await fetch('/api/leads/hub-phase', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId, phase: phase.key, content }),
        })
        const hub = await res.json()
        hubId = hub.id
        onSaved(hub)
      }

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/leads/hub-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hubId, name: file.name, mimeType: file.type, base64 }),
      })
      if (res.ok) {
        const newFile = await res.json()
        onSaved({ ...(data ?? { id: hubId!, phase: phase.key, content, updatedBy: null, updatedAt: new Date().toISOString(), files: [] }), files: [...(data?.files ?? []), newFile] })
      }
    } finally { setUploading(false) }
  }

  const downloadFile = async (fileId: string, name: string) => {
    const res = await fetch(`/api/leads/hub-file?id=${fileId}`)
    const { base64, mimeType } = await res.json()
    const a = document.createElement('a')
    a.href = `data:${mimeType};base64,${base64}`
    a.download = name
    a.click()
  }

  const deleteFile = async (fileId: string) => {
    setDeletingFile(fileId)
    await fetch('/api/leads/hub-file', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: fileId }),
    })
    onSaved({ ...data!, files: data!.files.filter(f => f.id !== fileId) })
    setDeletingFile(null)
  }

  return (
    <div className="space-y-4">
      {/* Text editor */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 block">Notas y contenido</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={6}
          placeholder={`Escribe aquí el contenido de la fase "${phase.label}"...`}
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none"
        />
      </div>

      {/* Save button */}
      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
        {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar'}
      </button>

      {/* Files */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-500 uppercase tracking-wider">Archivos adjuntos</label>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs text-orange-400 hover:text-orange-300 transition-colors"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
            {uploading ? 'Subiendo...' : 'Adjuntar archivo'}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => { Array.from(e.target.files ?? []).forEach(uploadFile); e.target.value = '' }}
          />
        </div>

        {data?.files.length === 0 || !data ? (
          <div
            className="border-2 border-dashed border-gray-800 rounded-xl p-6 text-center text-gray-600 text-xs cursor-pointer hover:border-gray-700 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip size={20} className="mx-auto mb-2 opacity-40" />
            Arrastra archivos o haz click para adjuntar
          </div>
        ) : (
          <div className="space-y-2">
            {data.files.map(f => (
              <div key={f.id} className="flex items-center gap-3 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-2">
                <FileText size={14} className={c.text} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{f.name}</p>
                  <p className="text-[10px] text-gray-500">{formatBytes(f.size)} · {f.uploadedBy}</p>
                </div>
                <button onClick={() => downloadFile(f.id, f.name)} className="text-gray-500 hover:text-white transition-colors" title="Descargar">
                  <Download size={13} />
                </button>
                <button onClick={() => deleteFile(f.id)} disabled={deletingFile === f.id} className="text-gray-600 hover:text-red-400 transition-colors" title="Eliminar">
                  {deletingFile === f.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {data?.updatedBy && (
        <p className="text-[10px] text-gray-600">
          Última actualización por <span className="text-gray-500">{data.updatedBy}</span> · {new Date(data.updatedAt).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}

export default function LeadHubPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const { setActions } = usePageActions()

  const [lead, setLead]       = useState<Lead | null>(null)
  const [phases, setPhases]   = useState<PhaseData[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive]   = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/leads/${id}`).then(r => r.json()),
      fetch(`/api/leads/hub-phase?leadId=${id}`).then(r => r.json()),
    ]).then(([l, p]) => {
      setLead(l)
      setPhases(Array.isArray(p) ? p : [])
      setLoading(false)
      setActions(
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.2 }}>{l.companyName}</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{l.contactName}</span>
          </div>
          <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#f97316', fontFamily: 'monospace' }}>${l.estimatedValue.toLocaleString()}</span>
            <span style={{ fontSize: '11px', color: '#475569' }}>{l.user.name}</span>
          </div>
        </div>
      )
    })
    return () => setActions(null)
  }, [id])

  const getPhaseData = (key: string) => phases.find(p => p.phase === key) ?? null

  const currentIdx = lead ? STATUS_ORDER.indexOf(lead.status) : -1

  const getPhaseStatus = (key: string) => {
    const idx = STATUS_ORDER.indexOf(key)
    if (idx < currentIdx) return 'done'
    if (idx === currentIdx) return 'active'
    return 'pending'
  }

  const updatePhase = useCallback((updated: PhaseData) => {
    setPhases(prev => {
      const exists = prev.find(p => p.phase === updated.phase)
      if (exists) return prev.map(p => p.phase === updated.phase ? updated : p)
      return [...prev, updated]
    })
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: "calc(100vh - 52px)" }}>
      <Loader2 className="animate-spin text-orange-500" size={32} />
    </div>
  )

  if (!lead) return (
    <div className="flex items-center justify-center text-gray-500" style={{ height: "calc(100vh - 52px)" }}>Lead no encontrado</div>
  )

  return (
    <div className="flex overflow-hidden" style={{ height: "calc(100vh - 52px)" }}>

      {/* Timeline sidebar */}
      <div className="w-72 flex-shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 py-5 border-b border-gray-800">
          <button
            onClick={() => router.push('/leads')}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={13} /> Volver a Leads
          </button>
          <h1 className="text-base font-bold text-white leading-tight">{lead.companyName}</h1>
          <p className="text-xs text-gray-500 mt-0.5">{lead.contactName}</p>
          <div className="flex items-center gap-2 mt-3">
            <span className="text-xs text-orange-400 font-mono">${lead.estimatedValue.toLocaleString()}</span>
            <span className="text-gray-700">·</span>
            <span className="text-xs text-gray-500">{lead.user.name}</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto py-4 px-3">
          {PHASES.map((phase, i) => {
            const status   = getPhaseStatus(phase.key)
            const isActive = active === phase.key
            const c        = COLOR_MAP[phase.color]
            const hasData  = getPhaseData(phase.key) !== null

            return (
              <div key={phase.key} className="relative">
                {/* Connector line */}
                {i < PHASES.length - 1 && (
                  <div className={`absolute left-[1.375rem] top-10 w-0.5 h-8 ${status === 'done' ? 'bg-orange-500/40' : 'bg-gray-800'}`} />
                )}

                <button
                  onClick={() => setActive(isActive ? null : phase.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all mb-1 text-left ${
                    isActive ? `${c.bg} ${c.border} border` : 'hover:bg-gray-800/60'
                  }`}
                >
                  {/* Status icon */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    status === 'done'   ? 'bg-orange-500/20 ring-2 ring-orange-500/30' :
                    status === 'active' ? `${c.bg} ring-2 ${c.ring}` :
                                         'bg-gray-800'
                  }`}>
                    {status === 'done'
                      ? <CheckCircle2 size={14} className="text-orange-400" />
                      : status === 'active'
                      ? <div className={`w-2.5 h-2.5 rounded-full ${c.dot} animate-pulse`} />
                      : <Circle size={12} className="text-gray-700" />
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isActive ? c.text : status === 'done' ? 'text-gray-300' : status === 'active' ? 'text-white' : 'text-gray-500'}`}>
                      {phase.label}
                    </p>
                    {hasData && (
                      <p className="text-[10px] text-orange-400/70">Con contenido</p>
                    )}
                  </div>

                  <ChevronRight size={13} className={`flex-shrink-0 transition-transform ${isActive ? `rotate-90 ${c.text}` : 'text-gray-700'}`} />
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Content panel */}
      <div className="flex-1 overflow-y-auto">
        {active ? (
          <div className="max-w-3xl mx-auto p-8">
            {(() => {
              const phase = PHASES.find(p => p.key === active)!
              const c = COLOR_MAP[phase.color]
              return (
                <>
                  <div className="mb-6">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text} ${c.border} border mb-2`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                      {phase.label}
                    </div>
                    <h2 className="text-2xl font-bold text-white">{phase.desc}</h2>
                  </div>
                  <PhasePanel
                    phase={phase}
                    data={getPhaseData(active)}
                    leadId={id}
                    onSaved={updatePhase}
                  />
                </>
              )
            })()}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4">
              <Clock size={28} className="text-orange-400" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">HUB de {lead.companyName}</h2>
            <p className="text-sm text-gray-500 max-w-xs">
              Selecciona una fase del timeline para ver o editar su contenido y archivos.
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
