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
  Search, Link2, ExternalLink, Calendar, Eye, History, Pencil,
} from 'lucide-react'

interface Lead {
  id: string
  companyName: string
  contactName: string
  email: string
  phone: string | null
  status: string
  estimatedValue: number
  scope: string | null
  source: string
  solucionAsociada: string | null
  notes: string | null
  createdAt: string
  user: { id: string; name: string }
  cliente: { id: string; nombre: string } | null
}

interface HubFile {
  id: string
  name: string
  size: number
  mimeType: string
  uploadedBy: string
  createdAt: string
}

interface MeetingRef {
  id: string; title: string; type: string; status: string
  date: string; endDate: string | null; link: string | null
  attendees: string | null; location: string | null
}

interface Interaction {
  id: string
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP'
  description: string
  date: string
  createdAt: string
  user: { name: string }
  meeting?: MeetingRef | null
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
  documents: ProposalDoc[]
}

interface ProposalDoc {
  id: string
  name: string
  url: string
  type: string
  version: number
  archived: boolean
  replacesId: string | null
  previewUrl: string | null
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

const EMPTY_LEAD_FORM = {
  companyName: '', contactName: '', email: '', phone: '',
  status: 'NEW', source: '', solucionAsociada: '', scope: '', estimatedValue: '', notes: '', userId: '',
}

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

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractPhasePreview(content: string | null | undefined): string {
  if (!content) return ''
  try {
    const parsed = JSON.parse(content)
    if (parsed && Array.isArray(parsed.tabs)) {
      return parsed.tabs.map((t: { content: string }) => stripHtml(t.content || '')).filter(Boolean).join(' · ')
    }
  } catch {}
  return content.trim()
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
      <div className="flex-1 overflow-hidden flex flex-col px-8 py-6">
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

function HubInteracciones({ leadId, companyName, items, onAdd }: {
  leadId: string
  companyName: string
  items: Interaction[]
  onAdd: (i: Interaction) => void
}) {
  const [mode, setMode]   = useState<'manual' | 'meeting'>('manual')
  const [type, setType]   = useState<'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP'>('CALL')
  const [desc, setDesc]   = useState('')
  const [date, setDate]   = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  // Meeting picker state
  const [meetings, setMeetings] = useState<MeetingRef[]>([])
  const [meetSearch, setMeetSearch] = useState('')
  const [loadingMeet, setLoadingMeet] = useState(false)
  const [linkedMeetId, setLinkedMeetId] = useState<string | null>(null)

  const loadMeetings = async () => {
    if (meetings.length > 0) return
    setLoadingMeet(true)
    const res = await fetch('/api/meetings')
    if (res.ok) setMeetings(await res.json())
    setLoadingMeet(false)
  }

  const switchMode = (m: 'manual' | 'meeting') => {
    setMode(m)
    setLinkedMeetId(null)
    if (m === 'meeting') { loadMeetings(); setMeetSearch(companyName) }
  }

  const add = async () => {
    if (mode === 'manual' && !desc.trim()) return
    if (mode === 'meeting' && !linkedMeetId) return
    setSaving(true)
    const body = mode === 'meeting'
      ? { meetingId: linkedMeetId, type: 'MEETING' }
      : { type, description: desc, date }
    const res = await fetch(`/api/leads/${leadId}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const created = await res.json()
      onAdd(created)
      setDesc('')
      setLinkedMeetId(null)
      setMeetSearch('')
    }
    setSaving(false)
  }

  const STATUS_LABELS: Record<string, string> = { SCHEDULED: 'Programada', COMPLETED: 'Completada', CANCELLED: 'Cancelada' }
  const STATUS_COLORS: Record<string, React.CSSProperties> = {
    SCHEDULED: { background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)' },
    COMPLETED: { background: 'rgba(34,197,94,0.15)', color: '#86efac', border: '1px solid rgba(34,197,94,0.3)' },
    CANCELLED: { background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' },
  }
  const MEET_TYPE_LABELS: Record<string, string> = {
    INTERNAL_DAILY: 'Daily', INTERNAL_WORKSHOP: 'Workshop',
    COMMERCIAL: 'Comercial', ADVISORY: 'Asesoría', PROVIDER: 'Proveedores',
  }

  const filteredMeetings = meetings.filter(m => {
    const q = meetSearch.toLowerCase()
    return m.title.toLowerCase().includes(q) ||
      (MEET_TYPE_LABELS[m.type] || m.type).toLowerCase().includes(q) ||
      (m.attendees || '').toLowerCase().includes(q)
  })

  const boxStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px' }
  const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '7px 10px', fontSize: '12px', color: '#f1f5f9', outline: 'none', width: '100%' }
  const linkedMeeting = linkedMeetId ? meetings.find(m => m.id === linkedMeetId) : null

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Agregar */}
      <div style={{ ...boxStyle, padding: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Nueva interacción</p>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '3px' }}>
            <button onClick={() => switchMode('manual')}
              style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: 'none', background: mode === 'manual' ? 'rgba(249,115,22,0.15)' : 'transparent', color: mode === 'manual' ? '#f97316' : '#475569', transition: 'all 0.15s' }}>
              Manual
            </button>
            <button onClick={() => switchMode('meeting')}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: 'none', background: mode === 'meeting' ? 'rgba(249,115,22,0.15)' : 'transparent', color: mode === 'meeting' ? '#f97316' : '#475569', transition: 'all 0.15s' }}>
              <Calendar size={11} />Vincular reunión
            </button>
          </div>
        </div>

        {mode === 'manual' && (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              {(['CALL','EMAIL','MEETING','WHATSAPP'] as const).map(t => (
                <button key={t} onClick={() => setType(t)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: type === t ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.08)', background: type === t ? 'rgba(249,115,22,0.1)' : 'transparent', color: type === t ? '#f97316' : '#475569' }}>
                  {INT_ICONS[t]}{INT_LABELS[t]}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: '140px', flexShrink: 0, colorScheme: 'dark' }} />
              <input placeholder="Descripción de la interacción..." value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} style={inputStyle} />
              <button onClick={add} disabled={saving || !desc.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', border: 'none', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', opacity: saving ? 0.6 : 1, flexShrink: 0 }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}Agregar
              </button>
            </div>
          </>
        )}

        {mode === 'meeting' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
              <input
                placeholder="Buscar reunión por nombre o tipo..."
                value={meetSearch}
                onChange={e => setMeetSearch(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '30px' }}
              />
            </div>
            {/* Meeting list */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {loadingMeet ? (
                <div style={{ textAlign: 'center', padding: '16px', color: '#475569', fontSize: '12px' }}>
                  <Loader2 size={14} className="animate-spin" style={{ display: 'inline-block', marginRight: '6px' }} />Cargando reuniones...
                </div>
              ) : filteredMeetings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px', color: '#334155', fontSize: '12px' }}>No se encontraron reuniones</div>
              ) : filteredMeetings.map(m => {
                const isSelected = linkedMeetId === m.id
                return (
                  <button key={m.id} onClick={() => setLinkedMeetId(isSelected ? null : m.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', border: isSelected ? '1px solid rgba(249,115,22,0.5)' : '1px solid rgba(255,255,255,0.06)', background: isSelected ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.12s' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Calendar size={14} style={{ color: '#f97316' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '12px', color: '#f1f5f9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
                        <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', flexShrink: 0, ...(STATUS_COLORS[m.status] || STATUS_COLORS['SCHEDULED']) }}>{STATUS_LABELS[m.status] || m.status}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#475569' }}>{MEET_TYPE_LABELS[m.type] || m.type}</span>
                        <span style={{ fontSize: '10px', color: '#334155' }}>·</span>
                        <span style={{ fontSize: '10px', color: '#475569' }}>{new Date(m.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 size={15} style={{ color: '#f97316', flexShrink: 0 }} />}
                  </button>
                )
              })}
            </div>
            {/* Vincular button */}
            {linkedMeeting && (
              <button onClick={add} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', border: 'none', background: 'linear-gradient(135deg,#f97316,#ea580c)', color: '#fff', opacity: saving ? 0.6 : 1 }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                Vincular "{linkedMeeting.title}"
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lista */}
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#334155', fontSize: '11px' }}>Sin interacciones registradas</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {items.map(item => (
            <div key={item.id} style={{ ...boxStyle, padding: '10px 14px' }}>
              {item.meeting ? (
                /* ── Meeting-linked card ── */
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    <Calendar size={14} style={{ color: '#f97316' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Reunión vinculada</span>
                      <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '4px', ...(STATUS_COLORS[item.meeting.status] || STATUS_COLORS['SCHEDULED']) }}>{STATUS_LABELS[item.meeting.status] || item.meeting.status}</span>
                      <span style={{ fontSize: '10px', color: '#334155' }}>· {item.user?.name ?? 'Sistema'}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#f1f5f9', fontWeight: 600, margin: '0 0 3px' }}>{item.meeting.title}</p>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: '#475569' }}>{MEET_TYPE_LABELS[item.meeting.type] || item.meeting.type}</span>
                      <span style={{ fontSize: '11px', color: '#475569' }}>
                        {new Date(item.meeting.date).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {item.meeting.location && <span style={{ fontSize: '11px', color: '#334155' }}>📍 {item.meeting.location}</span>}
                      {item.meeting.link && (
                        <a href={item.meeting.link} target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: '#60a5fa', textDecoration: 'none' }}
                          onClick={e => e.stopPropagation()}>
                          <ExternalLink size={11} />Unirse
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Manual interaction card ── */
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
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
              )}
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
        <div style={{ textAlign: 'center', padding: '32px', color: '#334155', fontSize: '11px' }}>No hay ítems de sprint asociados a esta solución</div>
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

const DOC_TYPE_LABELS: Record<string, string> = {
  presentacion: 'Presentación (PPT)',
  tecnico:      'Documento Técnico',
  cotizacion:   'Cotización',
  requerimiento: 'Requerimiento',
  otro:         'Otro',
}

function HubPropuesta({ leadId, proposal, onSave }: {
  leadId: string
  proposal: Proposal | null
  onSave: (p: Proposal) => void
}) {
  const [docs, setDocs]         = useState<ProposalDoc[]>(proposal?.documents ?? [])
  const [docType, setDocType]   = useState('presentacion')
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [deletingDoc, setDeletingDoc]   = useState<string | null>(null)
  const [previewDoc, setPreviewDoc]     = useState<ProposalDoc | null>(null)
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set())
  const [hoveredDocId, setHoveredDocId] = useState<string | null>(null)
  const [pendingUpload, setPendingUpload] = useState<{ file: File; existing: ProposalDoc } | null>(null)
  const docFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setDocs(proposal?.documents ?? []) }, [proposal?.id])

  const activeDocs = docs.filter(d => !d.archived)

  const getHistory = (doc: ProposalDoc): ProposalDoc[] => {
    const chain: ProposalDoc[] = []
    let current = docs.find(d => d.id === doc.replacesId)
    while (current) {
      chain.push(current)
      current = docs.find(d => d.id === current!.replacesId)
    }
    return chain
  }

  const toggleHistory = (docId: string) => {
    setExpandedHistory(prev => {
      const next = new Set(prev)
      next.has(docId) ? next.delete(docId) : next.add(docId)
      return next
    })
  }

  const handleFileSelected = (file: File) => {
    const existing = activeDocs.find(d => d.type === docType)
    if (existing) setPendingUpload({ file, existing })
    else uploadDocument(file)
  }

  const uploadDocument = async (file: File, replacesId?: string) => {
    if (file.size > 10 * 1024 * 1024) { alert('Máximo 10MB por archivo'); return }
    setUploadingDoc(true)
    try {
      let activeProposal = proposal
      if (!activeProposal?.id) {
        const createRes = await fetch(`/api/leads/${leadId}/proposal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Propuesta', description: '', amount: 0, status: 'DRAFT' }),
        })
        if (!createRes.ok) {
          const err = await createRes.json().catch(() => ({}))
          alert(`Error creando propuesta: ${err.error ?? createRes.status}`)
          return
        }
        activeProposal = await createRes.json()
        onSave(activeProposal!)
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch(`/api/proposals/${activeProposal!.id}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, type: docType, url: dataUrl, replacesId }),
      })
      if (res.ok) {
        const newDoc = await res.json()
        setDocs(prev => {
          const updated = replacesId ? prev.map(d => d.id === replacesId ? { ...d, archived: true } : d) : prev
          return [newDoc, ...updated]
        })
      } else {
        const err = await res.json().catch(() => ({}))
        alert(`Error subiendo documento: ${err.error ?? res.status}`)
      }
    } finally {
      setUploadingDoc(false)
      setPendingUpload(null)
      if (docFileRef.current) docFileRef.current.value = ''
    }
  }

  const downloadDocument = (doc: ProposalDoc) => {
    const a = document.createElement('a')
    a.href = doc.url
    a.download = doc.name
    a.target = '_blank'
    a.click()
  }

  const getMimeType = (url: string) => url.startsWith('data:') ? url.slice(5, url.indexOf(';')) : ''

  const deleteDocument = async (docId: string) => {
    if (!proposal?.id) return
    setDeletingDoc(docId)
    try {
      await fetch(`/api/proposals/${proposal.id}/documents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId }),
      })
      setDocs(prev => prev.filter(d => d.id !== docId))
    } finally {
      setDeletingDoc(null)
    }
  }

  const boxStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '16px' }
  const inputStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '8px 10px', fontSize: '12px', color: '#f1f5f9', outline: 'none', width: '100%' }

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Documentos de la propuesta */}
      <div style={boxStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Documentos
            </p>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <select value={docType} onChange={e => setDocType(e.target.value)} style={{ ...inputStyle, width: 'auto', padding: '5px 8px' }}>
                {Object.entries(DOC_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <input ref={docFileRef} type="file" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f) }} />
              <button onClick={() => docFileRef.current?.click()} disabled={uploadingDoc}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: uploadingDoc ? 'not-allowed' : 'pointer', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', opacity: uploadingDoc ? 0.6 : 1 }}>
                {uploadingDoc ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                {uploadingDoc ? 'Subiendo...' : 'Adjuntar'}
              </button>
            </div>
          </div>

          {pendingUpload && (
            <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)' }}>
              <p style={{ fontSize: '11px', color: '#fdba74', marginBottom: '8px' }}>
                Ya existe <strong>{pendingUpload.existing.name}</strong> en la categoría {DOC_TYPE_LABELS[docType] ?? docType}. ¿Qué querés hacer con <strong>{pendingUpload.file.name}</strong>?
              </p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => uploadDocument(pendingUpload.file, pendingUpload.existing.id)}
                  style={{ padding: '5px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: 'none', background: '#f97316', color: '#fff' }}>
                  Reemplazar (nueva versión)
                </button>
                <button onClick={() => uploadDocument(pendingUpload.file)}
                  style={{ padding: '5px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#e2e8f0' }}>
                  Agregar como adicional
                </button>
                <button onClick={() => { setPendingUpload(null); if (docFileRef.current) docFileRef.current.value = '' }}
                  style={{ padding: '5px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: 'none', background: 'transparent', color: '#94a3b8' }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {activeDocs.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#475569', textAlign: 'center', padding: '12px 0' }}>
              Sin documentos. Adjunta presentación, propuesta técnica, cotización o requerimientos.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {activeDocs.map(d => {
                const history = getHistory(d)
                const expanded = expandedHistory.has(d.id)
                return (
                  <div key={d.id}>
                    <div
                      onMouseEnter={() => setHoveredDocId(d.id)}
                      onMouseLeave={() => setHoveredDocId(prev => prev === d.id ? null : prev)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '6px', background: hoveredDocId === d.id ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)', transition: 'background 150ms ease' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <FileText size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: '12px', color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</p>
                          <p style={{ fontSize: '10px', color: '#475569' }}>
                            {DOC_TYPE_LABELS[d.type] ?? d.type}
                            {d.version > 1 && <span style={{ color: '#fdba74' }}> · v{d.version}</span>}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
                        <button onClick={() => toggleHistory(d.id)} title="Historial de versiones"
                          style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 7px', borderRadius: '5px', border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '10px' }}>
                          <History size={12} /> {history.length}
                        </button>
                        <button onClick={() => setPreviewDoc(d)} title="Vista previa"
                          style={{ padding: '5px', borderRadius: '5px', border: 'none', background: 'transparent', color: '#a3e635', cursor: 'pointer' }}>
                          <Eye size={13} />
                        </button>
                        <button onClick={() => downloadDocument(d)} title="Descargar"
                          style={{ padding: '5px', borderRadius: '5px', border: 'none', background: 'transparent', color: '#60a5fa', cursor: 'pointer' }}>
                          <Download size={13} />
                        </button>
                        <button onClick={() => deleteDocument(d.id)} disabled={deletingDoc === d.id} title="Eliminar"
                          style={{ padding: '5px', borderRadius: '5px', border: 'none', background: 'transparent', color: '#f87171', cursor: deletingDoc === d.id ? 'not-allowed' : 'pointer' }}>
                          {deletingDoc === d.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </div>
                    {expanded && (
                      <div style={{ marginLeft: '22px', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px', borderLeft: '2px solid rgba(255,255,255,0.06)', paddingLeft: '10px' }}>
                        {history.length === 0 ? (
                          <p style={{ fontSize: '10px', color: '#475569', padding: '4px 8px' }}>
                            Versión original (v1) · sin versiones anteriores
                          </p>
                        ) : history.map(h => (
                          <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '5px', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name}</p>
                              <p style={{ fontSize: '9px', color: '#475569' }}>v{h.version} · archivado · {new Date(h.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '2px' }}>
                              <button onClick={() => setPreviewDoc(h)} title="Vista previa"
                                style={{ padding: '4px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#a3e635', cursor: 'pointer' }}>
                                <Eye size={11} />
                              </button>
                              <button onClick={() => downloadDocument(h)} title="Descargar"
                                style={{ padding: '4px', borderRadius: '4px', border: 'none', background: 'transparent', color: '#60a5fa', cursor: 'pointer' }}>
                                <Download size={11} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
      </div>

      {previewDoc && (
        <div onClick={() => setPreviewDoc(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '16px', maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <p style={{ color: '#e2e8f0', fontSize: '11px', fontWeight: 600 }}>{previewDoc.name}</p>
              <button onClick={() => setPreviewDoc(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                <X size={16} />
              </button>
            </div>
            {(() => {
              const mime = getMimeType(previewDoc.url)
              if (previewDoc.previewUrl) {
                return <iframe src={previewDoc.previewUrl} title={previewDoc.name} style={{ width: '80vw', height: '75vh', border: 'none', borderRadius: '6px', background: '#fff' }} />
              }
              if (mime.startsWith('image/')) {
                return <img src={previewDoc.url} alt={previewDoc.name} style={{ maxWidth: '80vw', maxHeight: '75vh', objectFit: 'contain', borderRadius: '6px' }} />
              }
              if (mime === 'application/pdf') {
                return <iframe src={previewDoc.url} title={previewDoc.name} style={{ width: '80vw', height: '75vh', border: 'none', borderRadius: '6px', background: '#fff' }} />
              }
              return (
                <div style={{ padding: '32px 48px', textAlign: 'center' }}>
                  <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '12px' }}>Vista previa no disponible para este tipo de archivo.</p>
                  <button onClick={() => downloadDocument(previewDoc)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: 'none', background: '#f97316', color: '#fff' }}>
                    <Download size={13} /> Descargar
                  </button>
                </div>
              )
            })()}
          </div>
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
  const [showEditLead, setShowEditLead] = useState(false)
  const [editFormData, setEditFormData] = useState(EMPTY_LEAD_FORM)
  const [editSaving, setEditSaving]     = useState(false)
  const [editError, setEditError]       = useState('')
  const [users, setUsers]               = useState<{ id: string; name: string }[]>([])

  const openEditLead = () => {
    if (!lead) return
    setEditFormData({
      companyName: lead.companyName, contactName: lead.contactName, email: lead.email,
      phone: lead.phone || '', status: lead.status, source: lead.source,
      solucionAsociada: lead.solucionAsociada || '', scope: lead.scope || '',
      estimatedValue: String(lead.estimatedValue), notes: lead.notes || '', userId: lead.user.id,
    })
    setEditError('')
    setShowEditLead(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setEditSaving(true)
    setEditError('')
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      })
      if (res.ok) {
        const updated = await res.json()
        setLead(updated)
        setShowEditLead(false)
      } else {
        const data = await res.json().catch(() => ({}))
        setEditError(data.error || `Error ${res.status}`)
      }
    } catch {
      setEditError('Error de conexión. Intenta de nuevo.')
    } finally {
      setEditSaving(false)
    }
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/leads/${id}`).then(r => r.json()),
      fetch(`/api/leads/hub-phase?leadId=${id}`).then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([l, p, u]) => {
      setLead(l)
      setPhases(Array.isArray(p) ? p : [])
      setUsers(Array.isArray(u) ? u : [])
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
        <div style={{ margin: '10px', marginBottom: '6px', padding: '16px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', flexShrink: 0 }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Info Lead</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {lead.cliente && (
              <div
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '3px 6px', margin: '-3px -6px', borderRadius: '6px', transition: 'background 150ms ease' }}>
                <span style={{ fontSize: '11px', color: '#475569' }}>Cliente</span>
                <a href={`/leads/clientes/${lead.cliente.id}`}
                  onMouseEnter={e => { e.stopPropagation(); (e.currentTarget as HTMLElement).style.color = '#f97316' }}
                  onMouseLeave={e => { e.stopPropagation(); (e.currentTarget as HTMLElement).style.color = '#94a3b8' }}
                  style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textDecoration: 'underline', transition: 'color 150ms ease' }}>
                  {lead.cliente.nombre}
                </a>
              </div>
            )}
            <div
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', padding: '3px 6px', margin: '-3px -6px', borderRadius: '6px', transition: 'background 150ms ease' }}>
              <span style={{ fontSize: '11px', color: '#475569', flexShrink: 0 }}>Contacto</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textAlign: 'right' }}>{lead.contactName}</span>
            </div>
            {lead.scope && (
              <div
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', padding: '3px 6px', margin: '-3px -6px', borderRadius: '6px', transition: 'background 150ms ease' }}>
                <span style={{ fontSize: '11px', color: '#475569', flexShrink: 0 }}>Alcance</span>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8', textAlign: 'right', maxWidth: '130px' }}>{lead.scope}</span>
              </div>
            )}
            <div
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '3px 6px', margin: '-3px -6px', borderRadius: '6px', transition: 'background 150ms ease' }}>
              <span style={{ fontSize: '11px', color: '#475569' }}>Fuente</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>{lead.source || '—'}</span>
            </div>
            <div
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '3px 6px', margin: '-3px -6px', borderRadius: '6px', transition: 'background 150ms ease' }}>
              <span style={{ fontSize: '11px', color: '#475569' }}>Valor</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>${lead.estimatedValue.toLocaleString()}</span>
            </div>
            <div
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '3px 6px', margin: '-3px -6px', borderRadius: '6px', transition: 'background 150ms ease' }}>
              <span style={{ fontSize: '11px', color: '#475569' }}>Responsable</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>{lead.user.name}</span>
            </div>
            <div
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '3px 6px', margin: '-3px -6px', borderRadius: '6px', transition: 'background 150ms ease' }}>
              <span style={{ fontSize: '11px', color: '#475569' }}>Creado</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>{new Date(lead.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            <button onClick={openEditLead}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '6px', padding: '8px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#94a3b8', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
              <Pencil size={12} /> Editar información
            </button>
          </div>
        </div>

        {/* Timeline — panel */}
        <div className="flex-1 overflow-y-auto px-2.5 pt-1.5 pb-3">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 pt-2 pb-1">Pipeline</p>
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
          {([ { key: 'fases' as const, label: 'Fases' }, { key: 'interacciones' as const, label: 'Interacciones' }, { key: 'tareas' as const, label: 'Tareas' }, { key: 'propuesta' as const, label: 'Propuesta' }, { key: 'arquitectura' as const, label: 'Arquitectura' }, { key: 'diagrama' as const, label: 'Diagrama' } ]).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-t-md border-0 border-b-2 transition-all duration-150 ${
                tab === key
                  ? 'border-b-orange-500 bg-orange-500/[0.07] text-orange-400'
                  : 'border-b-transparent bg-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className={`flex-1 ${tab === 'diagrama' || tab === 'fases' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>

          {/* FASES */}
          {tab === 'fases' && (active ? (
            <PhasePanel key={active} phase={PHASES.find(p => p.key === active)!} data={getPhaseData(active)} leadId={id} onSaved={updatePhase} />
          ) : (
            <div className="h-full overflow-y-auto p-6">
              <h2 className="text-base font-semibold text-white mb-1">Resumen de fases — {lead.companyName}</h2>
              <p className="text-xs text-gray-500 mb-5">Click en una fase para ver o editar su contenido y archivos.</p>
              <div className="grid grid-cols-2 gap-3">
                {PHASES.map(phase => {
                  const status = getPhaseStatus(phase.key)
                  const data = getPhaseData(phase.key)
                  const c = COLOR_MAP[phase.color]
                  const isDone = status === 'done'
                  const isActSt = status === 'active'
                  const preview = extractPhasePreview(data?.content)
                  return (
                    <button key={phase.key} onClick={() => { setActive(phase.key); setTab('fases') }}
                      className={`text-left rounded-xl border p-4 transition-all duration-150 hover:border-white/[0.15] hover:bg-white/[0.04] ${isActSt ? `${c.bg} ${c.border}` : 'border-white/[0.07] bg-white/[0.02]'}`}>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isDone  ? 'bg-orange-500/20 ring-2 ring-orange-500/40' :
                          isActSt ? `${c.bg} ring-2 ${c.ring}` :
                                    'bg-gray-900 ring-1 ring-gray-700/80'
                        }`}>
                          {isDone
                            ? <CheckCircle2 size={13} className="text-orange-400" />
                            : isActSt
                            ? <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                            : <Circle size={11} className="text-gray-700" />
                          }
                        </div>
                        <p className={`text-sm font-semibold ${isActSt ? c.text : isDone ? 'text-gray-200' : 'text-gray-500'}`}>{phase.label}</p>
                        {isActSt && <span className={`ml-auto text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>En curso</span>}
                      </div>
                      <p className="text-[11px] text-gray-500 leading-relaxed mb-2">{phase.desc}</p>
                      {preview ? (
                        <p className="text-xs text-gray-400 line-clamp-2">{preview}</p>
                      ) : (
                        <p className="text-xs text-gray-600 italic">Sin contenido</p>
                      )}
                      {data && data.files.length > 0 && (
                        <p className="text-[10px] text-orange-400/70 mt-2">{data.files.length} archivo{data.files.length !== 1 ? 's' : ''} adjunto{data.files.length !== 1 ? 's' : ''}</p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* INTERACCIONES */}
          {tab === 'interacciones' && (
            <HubInteracciones leadId={id} companyName={lead.companyName} items={interactions} onAdd={i => setInteractions(prev => [i, ...prev])} />
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

      {showEditLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(20px)' }}>
          <div style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '24px', backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', boxShadow: '0 8px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)', padding: '28px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06),rgba(255,255,255,0.03))', margin: '-28px -28px 24px -28px', padding: '20px 28px', borderRadius: '24px 24px 0 0', borderBottom: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.01em' }}>Editar Lead</h2>
              <button onClick={() => setShowEditLead(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '15px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                <div>
                  <label style={editLabelCls}>Empresa</label>
                  <input type="text" required value={editFormData.companyName} onChange={e => setEditFormData({ ...editFormData, companyName: e.target.value })} style={editInputCls} />
                </div>
                <div>
                  <label style={editLabelCls}>Alcance</label>
                  <input type="text" value={editFormData.scope} onChange={e => setEditFormData({ ...editFormData, scope: e.target.value })} style={editInputCls} />
                </div>
                <div>
                  <label style={editLabelCls}>Solución</label>
                  <select value={editFormData.solucionAsociada} onChange={e => setEditFormData({ ...editFormData, solucionAsociada: e.target.value })} style={editInputCls}>
                    <option value="" style={{ background: '#0f172a' }}>Seleccionar...</option>
                    {['Project', 'Demo', 'Partnership', 'Products', 'Intern', 'Presales'].map(v => <option key={v} value={v} style={{ background: '#0f172a' }}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                <div>
                  <label style={editLabelCls}>Contacto</label>
                  <input type="text" required value={editFormData.contactName} onChange={e => setEditFormData({ ...editFormData, contactName: e.target.value })} style={editInputCls} />
                </div>
                <div>
                  <label style={editLabelCls}>Email</label>
                  <input type="email" required value={editFormData.email} onChange={e => setEditFormData({ ...editFormData, email: e.target.value })} style={editInputCls} />
                </div>
                <div>
                  <label style={editLabelCls}>Teléfono</label>
                  <input type="text" value={editFormData.phone} onChange={e => setEditFormData({ ...editFormData, phone: e.target.value })} style={editInputCls} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                <div>
                  <label style={editLabelCls}>Estado</label>
                  <select value={editFormData.status} onChange={e => setEditFormData({ ...editFormData, status: e.target.value })} style={editInputCls}>
                    {PHASES.map(p => <option key={p.key} value={p.key} style={{ background: '#0f172a' }}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={editLabelCls}>Fuente</label>
                  <select required value={editFormData.source} onChange={e => setEditFormData({ ...editFormData, source: e.target.value })} style={editInputCls}>
                    <option value="" style={{ background: '#0f172a' }}>Seleccionar...</option>
                    {['Directo', 'Referido', 'Partnership'].map(v => <option key={v} value={v} style={{ background: '#0f172a' }}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={editLabelCls}>Responsable</label>
                  <select required value={editFormData.userId} onChange={e => setEditFormData({ ...editFormData, userId: e.target.value })} style={editInputCls}>
                    <option value="" style={{ background: '#0f172a' }}>Seleccionar...</option>
                    {users.map(u => <option key={u.id} value={u.id} style={{ background: '#0f172a' }}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={editLabelCls}>Valor Estimado</label>
                <input type="number" value={editFormData.estimatedValue} onChange={e => setEditFormData({ ...editFormData, estimatedValue: e.target.value })} style={editInputCls} />
              </div>
              <div>
                <label style={editLabelCls}>Notas</label>
                <textarea value={editFormData.notes} onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })} rows={3} style={{ ...editInputCls, resize: 'vertical' as const }} />
              </div>
              {editError && <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', color: '#f87171', fontSize: '11px' }}>{editError}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                <button type="button" onClick={() => setShowEditLead(false)} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}>Cancelar</button>
                <button type="submit" disabled={editSaving} style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: '9px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', opacity: editSaving ? 0.6 : 1 }}>
                  {editSaving && <Loader2 size={14} className="animate-spin" />}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

const editInputCls: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', outline: 'none', width: '100%', padding: '8px 12px', fontSize: '11px' }
const editLabelCls: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }
