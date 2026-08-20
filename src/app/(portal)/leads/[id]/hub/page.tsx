'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'

const TabbedNotes = dynamic(() => import('./TabbedNotes'), { ssr: false })
const ArchitectureTab = dynamic(() => import('./ArchitectureTab'), { ssr: false })
const DiagramTab = dynamic(() => import('./DiagramTab'), { ssr: false })
import { useParams } from 'next/navigation'
import { usePageActions } from '@/lib/pageActionsContext'
import {
  CheckCircle2, Circle, Clock, Loader2,
  Save, Paperclip, X, Download, Trash2, FileText,
  ChevronRight, Phone, Mail, Users, Briefcase, CheckSquare, Square, Plus,
} from 'lucide-react'

interface Lead {
  id: string
  companyName: string
  contactName: string
  status: string
  estimatedValue: number
  scope: string | null
  source: string
  notes: string | null
  createdAt: string
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

interface Interaction {
  id: string
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP'
  description: string
  date: string
  createdAt: string
  user: { name: string }
}

interface BacklogItem {
  id: string
  title: string
  type: string
  status: string
  taskCode: string | null
  sprint: { name: string; sprintCode: string | null } | null | null
}

interface Proposal {
  id: string
  title: string
  description: string
  amount: number
  status: string
  sentDate: string | null
  acceptedDate: string | null
  user: { name: string }
  tasks: { id: string; title: string; completed: boolean }[]
  documents: { id: string; name: string; url: string }[]
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
    <div className="flex flex-col h-full min-h-0">
      {/* Header: title + actions */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/[0.05] shrink-0">
        <h2 className="text-xl font-bold text-white">{phase.desc}</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-all"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
            {uploading ? 'Subiendo...' : 'Adjuntar'}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
            {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
        {/* Text editor */}
        <TabbedNotes value={content} onChange={setContent} />

        <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => { Array.from(e.target.files ?? []).forEach(uploadFile); e.target.value = '' }}
          />


      </div>
    </div>
  )
}


// ── Sub-panels ───────────────────────────────────────────────────────────────

const INT_ICONS: Record<string, React.ReactNode> = {
  CALL:      <Phone     size={12} className="text-blue-400" />,
  EMAIL:     <Mail      size={12} className="text-purple-400" />,
  MEETING:   <Users     size={12} className="text-teal-400" />,
  WHATSAPP:  <Phone     size={12} className="text-green-400" />,
}
const INT_LABELS: Record<string, string> = {
  CALL: 'Llamada', EMAIL: 'Email', MEETING: 'Reunión', WHATSAPP: 'WhatsApp',
}

function HubInteracciones({ leadId, items, onAdd }: {
  leadId: string
  items: Interaction[]
  onAdd: (i: Interaction) => void
}) {
  const [type, setType]   = useState<'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP'>('CALL')
  const [desc, setDesc]   = useState('')
  const [date, setDate]   = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  const add = async () => {
    if (!desc.trim()) return
    setSaving(true)
    const res = await fetch(`/api/leads/${leadId}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, description: desc, date }),
    })
    if (res.ok) {
      const created = await res.json()
      onAdd(created)
      setDesc('')
    }
    setSaving(false)
  }

  const boxStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px' }
  const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '7px 10px', fontSize: '12px', color: '#f1f5f9', outline: 'none', width: '100%' }

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Agregar */}
      <div style={{ ...boxStyle, padding: '14px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Nueva interacción</p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          {(['CALL','EMAIL','MEETING','WHATSAPP'] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: type === t ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.08)', background: type === t ? 'rgba(249,115,22,0.1)' : 'transparent', color: type === t ? '#f97316' : '#475569' }}>
              {INT_ICONS[t]}{INT_LABELS[t]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: '140px', flexShrink: 0, colorScheme: 'dark' }} />
          <input placeholder="Descripción de la interacción..." value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} style={inputStyle} />
          <button onClick={add} disabled={saving || !desc.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', border: 'none', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', opacity: saving ? 0.6 : 1, flexShrink: 0 }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}Agregar
          </button>
        </div>
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#334155', fontSize: '13px' }}>Sin interacciones registradas</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {items.map(item => (
            <div key={item.id} style={{ ...boxStyle, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ marginTop: '2px', flexShrink: 0 }}>{INT_ICONS[item.type]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>{INT_LABELS[item.type]}</span>
                  <span style={{ fontSize: '10px', color: '#334155' }}>{new Date(item.date || item.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  <span style={{ fontSize: '10px', color: '#334155' }}>· {item.user?.name ?? 'Sistema'}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HubTareas({ leadId, items, onToggle }: {
  leadId: string
  items: BacklogItem[]
  onToggle: (updated: BacklogItem) => void
}) {
  const [toggling, setToggling] = useState<string | null>(null)

  const toggle = async (item: BacklogItem) => {
    setToggling(item.id)
    const nextStatus = item.status === 'DONE' ? 'TODO' : 'DONE'
    const res = await fetch(`/api/leads/${leadId}/backlog-items`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.id, status: nextStatus }),
    })
    if (res.ok) onToggle({ ...item, status: nextStatus })
    setToggling(null)
  }

  const grouped: Record<string, BacklogItem[]> = {}
  items.forEach(i => {
    const key = i.sprint?.name ?? 'Sin sprint'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(i)
  })

  const boxStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px' }

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#334155', fontSize: '13px' }}>No hay ítems de sprint asociados a esta solución</div>
      ) : (
        Object.entries(grouped).map(([sprint, sprintItems]) => {
          const done = sprintItems.filter(i => i.status === 'DONE').length
          return (
            <div key={sprint} style={boxStyle}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#f97316' }}>{sprint}</span>
                <span style={{ fontSize: '10px', color: '#475569' }}>{done}/{sprintItems.length} completados</span>
              </div>
              <div style={{ padding: '8px' }}>
                {sprintItems.map(item => (
                  <button key={item.id} onClick={() => toggle(item)} disabled={toggling === item.id}
                    style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '7px 8px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', opacity: toggling === item.id ? 0.5 : 1 }}>
                    <div style={{ marginTop: '1px', flexShrink: 0, color: item.status === 'DONE' ? '#22c55e' : '#334155' }}>
                      {item.status === 'DONE' ? <CheckSquare size={14} /> : <Square size={14} />}
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: item.status === 'DONE' ? '#475569' : '#94a3b8', textDecoration: item.status === 'DONE' ? 'line-through' : 'none' }}>{item.title}</span>
                      {item.taskCode && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#334155' }}>{item.taskCode}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

const PROPOSAL_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:    { label: 'Borrador',   color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  SENT:     { label: 'Enviada',    color: '#60a5fa', bg: 'rgba(96,165,250,0.1)'  },
  ACCEPTED: { label: 'Aceptada',   color: '#4ade80', bg: 'rgba(74,222,128,0.1)'  },
  REJECTED: { label: 'Rechazada',  color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
}

function HubPropuesta({ leadId, proposal, onSave }: {
  leadId: string
  proposal: Proposal | null
  onSave: (p: Proposal) => void
}) {
  const [title, setTitle]   = useState(proposal?.title ?? '')
  const [desc, setDesc]     = useState(proposal?.description ?? '')
  const [amount, setAmount] = useState(proposal?.amount?.toString() ?? '')
  const [status, setStatus] = useState(proposal?.status ?? 'DRAFT')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  const save = async () => {
    if (!title.trim()) return
    setSaving(true)
    const res = await fetch(`/api/leads/${leadId}/proposal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: desc, amount: parseFloat(amount) || 0, status }),
    })
    if (res.ok) {
      const p = await res.json()
      onSave(p)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  const changeStatus = async (s: string) => {
    if (!proposal?.id) return
    const res = await fetch(`/api/leads/${leadId}/proposal`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: s }),
    })
    if (res.ok) {
      const p = await res.json()
      onSave(p)
      setStatus(p.status)
    }
  }

  const boxStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '16px' }
  const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: '#f1f5f9', outline: 'none', width: '100%' }
  const labelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: '5px', display: 'block' }

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Form */}
      <div style={boxStyle}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
          {proposal ? 'Propuesta comercial' : 'Crear propuesta'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div>
            <label style={labelStyle}>Título</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Propuesta de implementación..." style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Valor (USD)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" style={inputStyle} />
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={labelStyle}>Descripción / condiciones</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="Alcance, condiciones, términos de pago..." rows={4} style={{ ...inputStyle, resize: 'vertical' as const }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Estado */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {Object.entries(PROPOSAL_STATUS_LABELS).map(([key, val]) => (
              <button key={key} onClick={() => proposal ? changeStatus(key) : setStatus(key)}
                style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', border: status === key ? `1px solid ${val.color}` : '1px solid rgba(255,255,255,0.08)', background: status === key ? val.bg : 'transparent', color: status === key ? val.color : '#334155' }}>
                {val.label}
              </button>
            ))}
          </div>

          <button onClick={save} disabled={saving || !title.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', border: 'none', background: saved ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg,#f97316,#ea580c)', color: saved ? '#4ade80' : '#fff', opacity: saving ? 0.6 : 1 }}>
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {saved ? 'Guardado' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Fechas si ya existe */}
      {proposal && (proposal.sentDate || proposal.acceptedDate) && (
        <div style={{ ...boxStyle, padding: '10px 14px', display: 'flex', gap: '24px' }}>
          {proposal.sentDate && (
            <div>
              <p style={{ fontSize: '10px', color: '#475569', marginBottom: '2px' }}>Enviada</p>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#60a5fa' }}>{new Date(proposal.sentDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          )}
          {proposal.acceptedDate && (
            <div>
              <p style={{ fontSize: '10px', color: '#475569', marginBottom: '2px' }}>Aceptada</p>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#4ade80' }}>{new Date(proposal.acceptedDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

export default function LeadHubPage() {
  const { id } = useParams() as { id: string }
  const { setActions } = usePageActions()

  const [lead, setLead]       = useState<Lead | null>(null)
  const [phases, setPhases]   = useState<PhaseData[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive]   = useState<string | null>(null)
  const [tab, setTab]         = useState<'fases' | 'interacciones' | 'tareas' | 'propuesta' | 'arquitectura' | 'diagrama'>('fases')
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>([])
  const [proposal, setProposal]         = useState<Proposal | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/leads/${id}`).then(r => r.json()),
      fetch(`/api/leads/hub-phase?leadId=${id}`).then(r => r.json()),
    ]).then(([l, p]) => {
      setLead(l)
      setPhases(Array.isArray(p) ? p : [])
      setLoading(false)
      setActions(
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => window.history.back()} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '4px 10px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
            <svg width='12' height='12' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' /></svg>
            Volver a Leads
          </button>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.07)' }} />
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#f1f5f9' }}>{l.companyName}</span>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.07)' }} />
          {l.scope && <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{l.scope.toUpperCase()}</span>}
        </div>
      )
    })
    return () => setActions(null)
  }, [id])

  useEffect(() => {
    if (!lead) return
    Promise.all([
      fetch(`/api/leads/${id}/interactions`).then(r => r.json()),
      fetch(`/api/leads/${id}/backlog-items`).then(r => r.json()),
      fetch(`/api/leads/${id}/proposal`).then(r => r.json()),
    ]).then(([ints, items, prop]) => {
      setInteractions(Array.isArray(ints) ? ints : [])
      setBacklogItems(Array.isArray(items) ? items : [])
      setProposal(prop && prop.id ? prop : null)
    })
  }, [lead, id])

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
      <div className="w-[250px] flex-shrink-0 bg-gray-950 border-r border-gray-800 flex flex-col overflow-hidden">

        {/* Widget info general del lead */}
        <div style={{ margin: '12px', marginBottom: '0', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', flexShrink: 0 }}>
          <p style={{ fontSize: '9px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Info del Lead</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ fontSize: '10px', color: '#475569', flexShrink: 0 }}>Contacto</span>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', textAlign: 'right' }}>{lead.contactName}</span>
            </div>
            {lead.scope && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '10px', color: '#475569', flexShrink: 0 }}>Alcance</span>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', textAlign: 'right', maxWidth: '130px' }}>{lead.scope}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '10px', color: '#475569' }}>Fuente</span>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>{lead.source || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '10px', color: '#475569' }}>Valor</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#f97316', fontFamily: 'monospace' }}>${lead.estimatedValue.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '10px', color: '#475569' }}>Responsable</span>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>{lead.user.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '10px', color: '#475569' }}>Creado</span>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#475569' }}>{new Date(lead.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Timeline — panel */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest px-3 pt-2.5 pb-1.5">Pipeline</p>
            <div className="relative px-2 pb-2">
              {/* Vertical rail — single line behind all dots */}
              <div className="absolute left-[27px] top-5 bottom-5 w-px bg-gray-800" />

              {PHASES.map((phase, i) => {
                const status   = getPhaseStatus(phase.key)
                const isActive = active === phase.key
                const c        = COLOR_MAP[phase.color]
                const hasData  = getPhaseData(phase.key) !== null
                const isDone   = status === 'done'
                const isActSt  = status === 'active'

                return (
                  <button
                    key={phase.key}
                    onClick={() => { setActive(phase.key); setTab('fases') }}
                    className={`relative z-10 w-full flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all duration-150 mb-0.5 text-left group ${
                      isActive
                        ? `${c.bg} ${c.border} border`
                        : 'border border-transparent hover:bg-white/[0.04] hover:border-white/[0.06]'
                    }`}
                  >
                    {/* Dot — sits on top of the rail */}
                    <div className={`relative z-10 w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                      isDone  ? 'bg-orange-500/20 ring-2 ring-orange-500/40' :
                      isActSt ? `${c.bg} ring-2 ${c.ring}` :
                                'bg-gray-900 ring-1 ring-gray-700/80'
                    }`}>
                      {isDone
                        ? <CheckCircle2 size={12} className="text-orange-400" />
                        : isActSt
                        ? <div className={`w-2 h-2 rounded-full ${c.dot} animate-pulse`} />
                        : <Circle size={10} className="text-gray-700 group-hover:text-gray-600 transition-colors" />
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold leading-tight transition-colors duration-150 ${
                        isActive ? c.text :
                        isDone   ? 'text-gray-300' :
                        isActSt  ? 'text-white' :
                                   'text-gray-500 group-hover:text-gray-400'
                      }`}>
                        {phase.label}
                      </p>
                      {hasData && (
                        <p className="text-[9px] text-orange-400/60 mt-0.5">Con contenido</p>
                      )}
                    </div>

                    <ChevronRight size={11} className={`flex-shrink-0 transition-all duration-150 ${
                      isActive ? `${c.text} opacity-100` : 'text-gray-700 opacity-0 group-hover:opacity-60'
                    }`} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content panel */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '2px', padding: '0 16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, background: 'rgba(8,8,26,0.7)' }}>
          {([ { key: 'fases' as const, label: 'Fases', Icon: Clock }, { key: 'interacciones' as const, label: 'Interacciones', Icon: Phone }, { key: 'tareas' as const, label: 'Tareas', Icon: CheckSquare }, { key: 'propuesta' as const, label: 'Propuesta', Icon: Briefcase }, { key: 'arquitectura' as const, label: 'Arquitectura', Icon: Briefcase }, { key: 'diagrama' as const, label: 'Diagrama', Icon: Briefcase } ]).map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-md border-0 border-b-2 transition-all duration-150 ${
                tab === key
                  ? 'border-b-orange-500 bg-orange-500/[0.07] text-orange-400'
                  : 'border-b-transparent bg-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
              }`}>
              <Icon size={11} />{label}
            </button>
          ))}
        </div>

        <div className={`flex-1 ${tab === 'diagrama' || tab === 'fases' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>

          {/* FASES */}
          {tab === 'fases' && (active ? (
            <PhasePanel key={active} phase={PHASES.find(p => p.key === active)!} data={getPhaseData(active)} leadId={id} onSaved={updatePhase} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-4">
                <Clock size={28} className="text-orange-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">HUB de {lead.companyName}</h2>
              <p className="text-sm text-gray-500 max-w-xs">Selecciona una fase del timeline para ver o editar su contenido y archivos.</p>
            </div>
          ))}

          {/* INTERACCIONES */}
          {tab === 'interacciones' && (
            <HubInteracciones leadId={id} items={interactions} onAdd={i => setInteractions(prev => [i, ...prev])} />
          )}

          {/* TAREAS */}
          {tab === 'tareas' && (
            <HubTareas leadId={id} items={backlogItems} onToggle={updated => setBacklogItems(prev => prev.map(x => x.id === updated.id ? updated : x))} />
          )}

          {/* PROPUESTA */}
          {tab === 'propuesta' && (
            <HubPropuesta leadId={id} proposal={proposal} onSave={setProposal} />
          )}

          {tab === 'arquitectura' && (
            <ArchitectureTab leadId={id} />
          )}

          {tab === 'diagrama' && (
            <div className="p-4 flex-1 flex flex-col min-h-0"><DiagramTab leadId={id} /></div>
          )}

        </div>
      </div>

    </div>
  )
}
