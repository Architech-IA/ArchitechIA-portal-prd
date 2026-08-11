'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, ChevronDown, MessageSquare, Vote, ListChecks, Plus, RefreshCw, Send, Edit3, Trash2, CheckCircle, Upload, FileText, Settings, ToggleLeft, ToggleRight } from 'lucide-react'

interface Proposal {
  id: string
  title: string
  description: string | null
  status: string
  inputChannel: string
  items: any[]
  round: number
  epicId: string | null
  sprintId: string | null
  solucionId: string | null
  createdByAgentId: string | null
  createdByAgentName: string | null
  metadata: any
  createdAt: string
  updatedAt: string
}

interface DebateMsg {
  id: string
  proposalId: string
  agentId: string
  agentName: string
  agentSlug: string | null
  content: string
  round: number
  createdAt: string
}

interface AgentVote {
  id: string
  proposalId: string
  agentId: string
  agentName: string
  agentSlug: string | null
  weight: number
  vote: boolean
  argument: string | null
  round: number
  createdAt: string
}

interface VoteState {
  votes: AgentVote[]
  weightedScore: number
  threshold: number
  approved: boolean
}

interface ChatMsg { role: 'user' | 'assistant'; content: string }
interface ExtractedItem { type: string; title: string; description: string; areaSlug: string; priority: string }
interface ExtractedProposal { title: string; description: string; items: ExtractedItem[]; _sourceFile?: string }

const AGENT_COLOR: Record<string, string> = {
  orion: '#6366f1',
  ares: '#ef4444',
  atlas: '#3b82f6',
  iris: '#ec4899',
  vesta: '#10b981',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#6b7280',
  DEBATING: '#f59e0b',
  APPROVED: '#10b981',
  REJECTED: '#ef4444',
  ESCALATED: '#f97316',
  REVISED: '#8b5cf6',
}

const CHANNEL_LABEL: Record<string, string> = {
  CONVERSATION: '💬 Conversación',
  DOCUMENT: '📄 Documento',
  INTERNAL_TRIGGER: '⚡ Trigger interno',
}

const ITEM_TYPE_LABEL: Record<string, string> = {
  task: '📋 Task',
  sprint: '🏃 Sprint',
  epic: '🏔️ Épica',
}

function agentColor(slug: string | null, name: string): string {
  if (slug && AGENT_COLOR[slug.toLowerCase()]) return AGENT_COLOR[slug.toLowerCase()]
  const key = name.toLowerCase().replace(/[^a-z]/g, '')
  for (const [k, v] of Object.entries(AGENT_COLOR)) {
    if (key.includes(k)) return v
  }
  return '#6b7280'
}

function agentInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function formatTs(ts: string): string {
  return new Date(ts).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export default function CouncilView() {
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<DebateMsg[]>([])
  const [voteState, setVoteState] = useState<VoteState | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const [starting, setStarting] = useState(false)
  // Tab mode
  const [mode, setMode] = useState<'proposals' | 'chat' | 'document'>('proposals')
  // Chat mode
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedProposal | null>(null)
  const [sendingToCouncil, setSendingToCouncil] = useState(false)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  // Document mode
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docStatus, setDocStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [docError, setDocError] = useState<string>('')
  const [docExtracted, setDocExtracted] = useState<ExtractedProposal | null>(null)
  const [sendingDocToCouncil, setSendingDocToCouncil] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Trigger config
  const [showTriggerConfig, setShowTriggerConfig] = useState(false)
  const [triggerConfig, setTriggerConfig] = useState<Record<string, boolean>>({ PRODUCT: true, PROJECT: true, INTERN: false, PILOT: false, epicTriggerEnabled: true })
  const [savingConfig, setSavingConfig] = useState(false)

  const selectedProposal = proposals.find(p => p.id === selectedId) ?? null

  async function loadProposals() {
    const url = filterStatus ? `/api/council/proposals?status=${filterStatus}` : '/api/council/proposals'
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      setProposals(data)
      setLoading(false)
    }
  }

  async function loadTriggerConfig() {
    const res = await fetch("/api/council/trigger/config")
    if (res.ok) setTriggerConfig(await res.json())
  }

  async function saveTriggerConfigFn(cfg: Record<string, boolean>) {
    setSavingConfig(true)
    try {
      await fetch("/api/council/trigger/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) })
      setTriggerConfig(cfg)
    } finally { setSavingConfig(false) }
  }

  async function loadDetail(id: string) {
    setDetailLoading(true)
    const [msgRes, voteRes] = await Promise.all([
      fetch(`/api/council/proposals/${id}/messages`),
      fetch(`/api/council/proposals/${id}/votes`),
    ])
    if (msgRes.ok) setMessages(await msgRes.json())
    if (voteRes.ok) setVoteState(await voteRes.json())
    setDetailLoading(false)
  }

  useEffect(() => { loadTriggerConfig() }, [])

  useEffect(() => {
    setLoading(true)
    loadProposals()
  }, [filterStatus])

  useEffect(() => {
    if (!selectedId) return
    loadDetail(selectedId)
    if (pollRef.current) clearInterval(pollRef.current)
    const p = proposals.find(pr => pr.id === selectedId)
    if (p?.status === 'DEBATING') {
      pollRef.current = setInterval(() => loadDetail(selectedId), 5000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [selectedId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendChatMessage() {
    const content = chatInput.trim()
    if (!content || chatLoading) return
    const newMsg: ChatMsg = { role: 'user', content }
    const updated = [...chatMessages, newMsg]
    setChatMessages(updated)
    setChatInput('')
    setChatLoading(true)
    try {
      const res = await fetch('/api/council/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      })
      if (res.ok) {
        const { reply } = await res.json()
        setChatMessages(prev => [...prev, { role: 'assistant', content: reply }])
      }
    } finally {
      setChatLoading(false)
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  async function extractProposal() {
    if (chatMessages.length < 2) return
    setExtracting(true)
    try {
      const res = await fetch('/api/council/chat/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatMessages }),
      })
      if (res.ok) setExtracted(await res.json())
    } finally {
      setExtracting(false)
    }
  }

  async function sendToCouncil() {
    if (!extracted) return
    setSendingToCouncil(true)
    try {
      const res = await fetch('/api/council/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: extracted.title,
          description: extracted.description,
          inputChannel: 'CONVERSATION',
          items: extracted.items,
          createdByAgentId: 'agent_orion_001',
          createdByAgentName: 'Orión',
        }),
      })
      if (res.ok) {
        const proposal = await res.json()
        await loadProposals()
        setExtracted(null)
        setChatMessages([])
        setMode('proposals')
        setSelectedId(proposal.id)
      }
    } finally {
      setSendingToCouncil(false)
    }
  }

  async function processDocument() {
    if (!docFile) return
    setDocStatus('processing')
    setDocError('')
    setDocExtracted(null)
    try {
      const fd = new FormData()
      fd.append('file', docFile)
      const res = await fetch('/api/council/document/process', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        setDocError(data.error ?? 'Error procesando documento')
        setDocStatus('error')
        return
      }
      setDocExtracted(data)
      setDocStatus('done')
    } catch (err: any) {
      setDocError(err.message ?? 'Error inesperado')
      setDocStatus('error')
    }
  }

  async function sendDocToCouncil() {
    if (!docExtracted) return
    setSendingDocToCouncil(true)
    try {
      const res = await fetch('/api/council/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: docExtracted.title,
          description: docExtracted.description,
          inputChannel: 'DOCUMENT',
          items: docExtracted.items,
          createdByAgentId: 'agent_orion_001',
          createdByAgentName: 'Orión',
          metadata: { sourceFile: docFile?.name ?? docExtracted._sourceFile ?? '' },
        }),
      })
      if (res.ok) {
        const proposal = await res.json()
        await loadProposals()
        setDocExtracted(null)
        setDocFile(null)
        setDocStatus('idle')
        setMode('proposals')
        setSelectedId(proposal.id)
      }
    } finally {
      setSendingDocToCouncil(false)
    }
  }

  async function startDebate() {
    if (!selectedId) return
    setStarting(true)
    try {
      const res = await fetch(`/api/council/proposals/${selectedId}/debate/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round: selectedProposal?.round ?? 1 }),
      })
      if (res.ok) {
        setProposals(prev => prev.map(p => p.id === selectedId ? { ...p, status: 'DEBATING' } : p))
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = setInterval(() => loadDetail(selectedId), 5000)
        loadDetail(selectedId)
      }
    } finally {
      setStarting(false)
    }
  }

  const byRound = messages.reduce<Record<number, DebateMsg[]>>((acc, m) => {
    acc[m.round] = acc[m.round] ?? []
    acc[m.round].push(m)
    return acc
  }, {})

  // ── Shared extracted proposal preview panel ──
  function ExtractedPreview({
    data,
    onChangeData,
    onDiscard,
    onSend,
    sending,
  }: {
    data: ExtractedProposal
    onChangeData: (d: ExtractedProposal) => void
    onDiscard: () => void
    onSend: () => void
    sending: boolean
  }) {
    return (
      <div className="w-72 flex-shrink-0 border-l border-white/5 flex flex-col overflow-hidden"
           style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="px-3 pt-3 pb-2 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Propuesta extraída</span>
          <button onClick={onDiscard} className="text-gray-600 hover:text-gray-400 transition-colors">
            <Trash2 size={11} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {data._sourceFile && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <FileText size={10} style={{ color: '#3b82f6' }} />
              <span className="text-[9px] text-gray-500 truncate">{data._sourceFile}</span>
            </div>
          )}
          <div>
            <label className="text-[8px] font-bold uppercase tracking-widest text-gray-600 mb-1 block">Título</label>
            <input
              value={data.title}
              onChange={e => onChangeData({ ...data, title: e.target.value })}
              className="w-full rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-gray-200 border border-white/8 outline-none focus:border-indigo-500/40"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            />
          </div>
          <div>
            <label className="text-[8px] font-bold uppercase tracking-widest text-gray-600 mb-1 block">Descripción</label>
            <textarea
              value={data.description}
              onChange={e => onChangeData({ ...data, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg px-2.5 py-1.5 text-[11px] text-gray-300 border border-white/8 outline-none focus:border-indigo-500/40 resize-none"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            />
          </div>
          <div>
            <label className="text-[8px] font-bold uppercase tracking-widest text-gray-600 mb-2 block">
              Items · {data.items.length}
            </label>
            <div className="space-y-2">
              {data.items.map((item, idx) => (
                <div key={idx} className="rounded-lg p-2.5 border"
                     style={{ background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.15)' }}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase"
                          style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
                      {item.type}
                    </span>
                    <span className="text-[8px] text-gray-700 ml-auto">{item.priority}</span>
                    <button
                      onClick={() => onChangeData({ ...data, items: data.items.filter((_, i) => i !== idx) })}
                      className="text-gray-700 hover:text-red-400 transition-colors">
                      <Trash2 size={9} />
                    </button>
                  </div>
                  <input
                    value={item.title}
                    onChange={e => onChangeData({ ...data, items: data.items.map((it, i) => i === idx ? { ...it, title: e.target.value } : it) })}
                    className="w-full rounded px-2 py-1 text-[10px] font-semibold text-gray-200 border border-white/6 outline-none focus:border-indigo-500/30 mb-1"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  />
                  <div className="text-[9px] text-gray-600">{item.areaSlug}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="p-3 border-t border-white/5 flex-shrink-0">
          <button
            onClick={onSend}
            disabled={sending || !data.title}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[12px] font-bold transition-all"
            style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)', color: '#6366f1' }}>
            {sending ? <><Loader2 size={12} className="animate-spin" /> Enviando...</> : <>⚖️ Enviar al Consejo</>}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* ── Tab bar ── */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 flex-shrink-0"
           style={{ background: 'rgba(0,0,0,0.2)' }}>
        <button
          onClick={() => setMode('proposals')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
          style={mode === 'proposals'
            ? { background: 'rgba(99,102,241,0.15)', color: '#6366f1' }
            : { color: '#4b5563' }}>
          <Vote size={12} /> Propuestas
        </button>
        <button
          onClick={() => setMode('chat')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
          style={mode === 'chat'
            ? { background: 'rgba(99,102,241,0.15)', color: '#6366f1' }
            : { color: '#4b5563' }}>
          <MessageSquare size={12} /> Conversar con Orión
        </button>
        <button
          onClick={() => setMode('document')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
          style={mode === 'document'
            ? { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }
            : { color: '#4b5563' }}>
          <FileText size={12} /> Documento
        </button>
        <div className="ml-auto">
          <button onClick={() => setShowTriggerConfig(prev => !prev)} title="Configurar triggers" className="p-1.5 rounded-lg transition-colors" style={showTriggerConfig ? { background: "rgba(99,102,241,0.15)", color: "#6366f1" } : { color: "#4b5563" }}>
            <Settings size={12} />
          </button>
        </div>
      </div>
      {showTriggerConfig && (
        <div className="absolute z-50 right-3 top-12 w-72 rounded-xl shadow-2xl border border-white/10 p-4" style={{ background: "rgba(15,15,25,0.97)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Triggers automáticos</span>
            {savingConfig && <span className="text-[9px] text-gray-600">Guardando...</span>}
          </div>
          {([ ["PRODUCT", "Productos (siempre ON)"], ["PROJECT", "Proyectos"], ["INTERN", "Internas"], ["PILOT", "Pilotos"] ] as [string, string][]).map(([k, label]) => (
            <div key={k} className="flex items-center justify-between py-2 border-b border-white/5">
              <span className="text-[11px] text-gray-300">{label}</span>
              <button onClick={() => saveTriggerConfigFn({ ...triggerConfig, [k]: !triggerConfig[k] })} className="text-gray-400 hover:text-white transition-colors">
                {triggerConfig[k] ? <ToggleRight size={20} className="text-indigo-400" /> : <ToggleLeft size={20} /> }
              </button>
            </div>
          ))}
          <div className="flex items-center justify-between py-2">
            <span className="text-[11px] text-gray-300">Épicas</span>
            <button onClick={() => saveTriggerConfigFn({ ...triggerConfig, epicTriggerEnabled: !triggerConfig.epicTriggerEnabled })} className="text-gray-400 hover:text-white transition-colors">
              {triggerConfig.epicTriggerEnabled ? <ToggleRight size={20} className="text-indigo-400" /> : <ToggleLeft size={20} /> }
            </button>
          </div>
        </div>
      )}

      {mode === 'document' ? (
        /* ── DOCUMENT MODE ── */
        <div className="flex flex-1 overflow-hidden">
          {/* Upload / process panel */}
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">

              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 py-12 cursor-pointer transition-all hover:border-blue-500/40"
                style={{
                  borderColor: docFile ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)',
                  background: docFile ? 'rgba(59,130,246,0.05)' : 'rgba(255,255,255,0.02)',
                }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) { setDocFile(f); setDocStatus('idle'); setDocExtracted(null); setDocError('') }
                  }}
                />
                {docFile ? (
                  <>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                         style={{ background: 'rgba(59,130,246,0.15)' }}>
                      <FileText size={22} style={{ color: '#3b82f6' }} />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-bold text-gray-200">{docFile.name}</p>
                      <p className="text-[11px] text-gray-600 mt-0.5">{formatBytes(docFile.size)} · {docFile.type || 'archivo'}</p>
                    </div>
                    <p className="text-[10px] text-gray-700">Clic para cambiar archivo</p>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                         style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <Upload size={22} className="text-gray-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] font-semibold text-gray-400">Subí un documento</p>
                      <p className="text-[11px] text-gray-600 mt-1">PDF, DOCX o TXT · hasta 50 páginas</p>
                    </div>
                    <p className="text-[10px] text-gray-700">Orión extraerá una propuesta automáticamente</p>
                  </>
                )}
              </div>

              {/* Status / error */}
              {docStatus === 'processing' && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                     style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: '#3b82f6' }} />
                  <div>
                    <p className="text-[12px] font-bold" style={{ color: '#3b82f6' }}>Orión está analizando el documento...</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">Extrayendo texto y generando propuesta estructurada</p>
                  </div>
                </div>
              )}

              {docStatus === 'error' && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                     style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span className="text-base flex-shrink-0">❌</span>
                  <div>
                    <p className="text-[12px] font-bold" style={{ color: '#ef4444' }}>Error al procesar</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{docError}</p>
                  </div>
                </div>
              )}

              {docStatus === 'done' && !docExtracted && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                     style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <CheckCircle size={14} style={{ color: '#10b981' }} className="flex-shrink-0" />
                  <p className="text-[12px] font-bold" style={{ color: '#10b981' }}>Propuesta extraída — revisá el panel</p>
                </div>
              )}

              {/* Process button */}
              <button
                onClick={processDocument}
                disabled={!docFile || docStatus === 'processing'}
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all"
                style={docFile && docStatus !== 'processing'
                  ? { background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#3b82f6' }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#4b5563', cursor: 'not-allowed' }}>
                {docStatus === 'processing'
                  ? <><Loader2 size={14} className="animate-spin" /> Procesando...</>
                  : <><FileText size={14} /> Procesar con Orión</>}
              </button>

              {/* Helper text */}
              <div className="px-3 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2">Cómo funciona</p>
                <div className="space-y-1.5">
                  {[
                    '1. Subí un brief, propuesta o documento de iniciativa',
                    '2. Orión extrae automáticamente tareas y sprints',
                    '3. Revisá y editá la propuesta antes de enviar al consejo',
                    '4. Los 5 agentes debaten y votan para aprobar o revisar',
                  ].map((step, i) => (
                    <p key={i} className="text-[10px] text-gray-600">{step}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Extracted proposal preview */}
          {docExtracted && (
            <ExtractedPreview
              data={docExtracted}
              onChangeData={setDocExtracted}
              onDiscard={() => { setDocExtracted(null); setDocStatus('idle') }}
              onSend={sendDocToCouncil}
              sending={sendingDocToCouncil}
            />
          )}
        </div>
      ) : mode === 'chat' ? (
        /* ── CHAT MODE ── */
        <div className="flex flex-1 overflow-hidden">
          {/* Chat panel */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                       style={{ background: 'rgba(99,102,241,0.15)', border: '2px solid rgba(99,102,241,0.3)' }}>
                    OR
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-gray-300">Conversación con Orión</p>
                    <p className="text-[11px] text-gray-600 mt-1">Describí tu iniciativa en lenguaje natural.<br/>Orión te ayuda a estructurarla.</p>
                  </div>
                  <p className="text-[10px] text-gray-700 italic max-w-xs">"Orión, necesito implementar autenticación OAuth en el portal..."</p>
                </div>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black"
                       style={msg.role === 'assistant'
                         ? { background: 'rgba(99,102,241,0.25)', color: '#6366f1', border: '1.5px solid rgba(99,102,241,0.4)' }
                         : { background: 'rgba(255,255,255,0.08)', color: '#9ca3af', border: '1.5px solid rgba(255,255,255,0.1)' }}>
                    {msg.role === 'assistant' ? 'OR' : 'TÚ'}
                  </div>
                  <div className="max-w-[75%]">
                    <div className="rounded-xl px-3 py-2 text-[11px] leading-relaxed"
                         style={msg.role === 'assistant'
                           ? { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)', color: '#d1d5db' }
                           : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#e5e7eb' }}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-2.5">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black"
                       style={{ background: 'rgba(99,102,241,0.25)', color: '#6366f1', border: '1.5px solid rgba(99,102,241,0.4)' }}>OR</div>
                  <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
                    <Loader2 size={12} className="animate-spin text-indigo-400" />
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Actions row */}
            {chatMessages.length >= 2 && !extracted && (
              <div className="px-4 pb-2 flex-shrink-0">
                <button
                  onClick={extractProposal}
                  disabled={extracting}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[11px] font-bold transition-all"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}>
                  {extracting ? <><Loader2 size={11} className="animate-spin" /> Extrayendo propuesta...</> : <><CheckCircle size={11} /> Listo — extraer propuesta</>}
                </button>
              </div>
            )}

            {/* Input */}
            <div className="px-4 pb-4 flex-shrink-0 border-t border-white/5 pt-3">
              <div className="flex gap-2">
                <input
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                  placeholder="Describí tu iniciativa a Orión..."
                  disabled={chatLoading}
                  className="flex-1 rounded-xl px-3 py-2 text-[12px] text-gray-200 border border-white/8 outline-none focus:border-indigo-500/40 transition-colors placeholder-gray-600"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || chatLoading}
                  className="px-3 py-2 rounded-xl transition-all flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.2)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Extracted proposal preview */}
          {extracted && (
            <ExtractedPreview
              data={extracted}
              onChangeData={setExtracted}
              onDiscard={() => setExtracted(null)}
              onSend={sendToCouncil}
              sending={sendingToCouncil}
            />
          )}
        </div>
      ) : (
      <div className="flex flex-1 overflow-hidden">

      {/* ── LEFT: Proposal list ── */}
      <div className="w-64 flex-shrink-0 flex flex-col border-r border-white/5 overflow-hidden"
           style={{ background: 'rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div className="px-3 pt-4 pb-2 flex items-center justify-between border-b border-white/5 flex-shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Propuestas</span>
          <div className="flex items-center gap-1">
            <button onClick={loadProposals} title="Refrescar"
              className="p-1 rounded hover:bg-white/5 text-gray-600 hover:text-gray-400 transition-colors">
              <RefreshCw size={10} />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="px-2 py-2 flex-shrink-0 border-b border-white/5">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="w-full rounded-lg px-2 py-1.5 text-[10px] text-gray-300 border border-white/8 outline-none focus:border-indigo-500/40 transition-colors"
            style={{ background: 'rgba(20,20,35,0.95)' }}>
            <option value="">Todas</option>
            <option value="PENDING">Pendientes</option>
            <option value="DEBATING">En debate</option>
            <option value="APPROVED">Aprobadas</option>
            <option value="REJECTED">Rechazadas</option>
            <option value="ESCALATED">Escaladas</option>
          </select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-1">
          {loading ? (
            <div className="flex items-center gap-2 justify-center py-8 text-gray-600 text-xs">
              <Loader2 size={12} className="animate-spin" /> Cargando...
            </div>
          ) : proposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
              <span className="text-2xl opacity-20">⚖️</span>
              <p className="text-[11px] text-gray-700">Sin propuestas aún.<br/>El Consejo está en silencio.</p>
            </div>
          ) : proposals.map(pr => {
            const color = STATUS_COLOR[pr.status] ?? '#6b7280'
            const isSelected = pr.id === selectedId
            return (
              <button key={pr.id}
                onClick={() => setSelectedId(pr.id)}
                className="w-full text-left px-3 py-2.5 border-b border-white/[0.03] transition-all hover:bg-white/[0.04]"
                style={isSelected ? { background: 'rgba(99,102,241,0.08)', borderLeft: '2px solid #6366f1' } : { borderLeft: '2px solid transparent' }}>
                {/* Status badge + channel */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                        style={{ background: color + '20', color }}>
                    {pr.status}
                  </span>
                  {pr.round > 1 && (
                    <span className="text-[8px] font-mono px-1 rounded"
                          style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>R{pr.round}</span>
                  )}
                  <span className="text-[8px] text-gray-700 ml-auto">{timeAgo(pr.createdAt)}</span>
                </div>
                {/* Title */}
                <div className="text-[11px] font-semibold text-gray-300 leading-snug line-clamp-2">{pr.title}</div>
                {/* Channel + agent */}
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[9px] text-gray-700">{CHANNEL_LABEL[pr.inputChannel] ?? pr.inputChannel}</span>
                  {pr.createdByAgentName && (
                    <span className="text-[9px] text-gray-700 ml-auto">por {pr.createdByAgentName}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── CENTER: Debate ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedProposal ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <span className="text-5xl opacity-10">⚖️</span>
            <p className="text-[12px] text-gray-700">Seleccioná una propuesta<br/>para ver el debate del Consejo.</p>
          </div>
        ) : (
          <>
            {/* Proposal header */}
            <div className="px-4 py-3 border-b border-white/5 flex-shrink-0"
                 style={{ background: 'rgba(99,102,241,0.05)' }}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                          style={{ background: (STATUS_COLOR[selectedProposal.status] ?? '#6b7280') + '20', color: STATUS_COLOR[selectedProposal.status] ?? '#6b7280' }}>
                      {selectedProposal.status}
                    </span>
                    {selectedProposal.round > 1 && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded font-mono"
                            style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>Ronda {selectedProposal.round}</span>
                    )}
                    <span className="text-[9px] text-gray-600">{CHANNEL_LABEL[selectedProposal.inputChannel]}</span>
                    <span className="text-[9px] text-gray-700 ml-auto">{formatTs(selectedProposal.createdAt)}</span>
                  </div>
                  <h2 className="text-[13px] font-black text-gray-200 mt-1 leading-snug">{selectedProposal.title}</h2>
                  {selectedProposal.description && (
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">{selectedProposal.description}</p>
                  )}
                  {/* Source file badge */}
                  {selectedProposal.metadata?.sourceFile && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <FileText size={9} style={{ color: '#3b82f6' }} />
                      <span className="text-[9px] text-gray-600">{selectedProposal.metadata.sourceFile}</span>
                    </div>
                  )}
                </div>
                {/* Iniciar debate button for PENDING/REVISED */}
                {(selectedProposal.status === 'PENDING' || selectedProposal.status === 'REVISED') && (
                  <button
                    onClick={startDebate}
                    disabled={starting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)' }}>
                    {starting ? (
                      <><span className="animate-spin text-[12px]">⚙️</span> Iniciando...</>
                    ) : (
                      <><span className="text-[12px]">⚖️</span> Iniciar debate</>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Escalated banner */}
            {selectedProposal.status === 'ESCALATED' && (
              <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2.5 flex-shrink-0"
                   style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.25)' }}>
                <span className="text-base flex-shrink-0">🚨</span>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#f97316' }}>Escalada al socio</div>
                  <p className="text-[10px] text-gray-400 leading-snug mt-0.5">
                    La propuesta no alcanzó umbral en 2 rondas. Requiere decisión humana: aprobar, rechazar o pedir revisión con instrucciones.
                  </p>
                </div>
              </div>
            )}

            {/* Debate messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {detailLoading && messages.length === 0 ? (
                <div className="flex items-center gap-2 justify-center py-8 text-gray-600 text-xs">
                  <Loader2 size={12} className="animate-spin" /> Cargando debate...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <span className="text-3xl opacity-20">🔇</span>
                  <p className="text-[11px] text-gray-700">El debate no ha comenzado.</p>
                </div>
              ) : Object.entries(byRound).map(([round, msgs]) => (
                <div key={round}>
                  {/* Round divider */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1" style={{ background: 'rgba(139,92,246,0.2)' }} />
                    <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                          style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
                      Ronda {round}
                    </span>
                    <div className="h-px flex-1" style={{ background: 'rgba(139,92,246,0.2)' }} />
                  </div>

                  {/* Messages in this round */}
                  <div className="space-y-3">
                    {msgs.map(msg => {
                      const color = agentColor(msg.agentSlug, msg.agentName)
                      return (
                        <div key={msg.id} className="flex gap-2.5">
                          {/* Avatar */}
                          <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black"
                               style={{ background: color + '25', color, border: `1.5px solid ${color}40` }}>
                            {agentInitials(msg.agentName)}
                          </div>
                          {/* Bubble */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className="text-[11px] font-bold" style={{ color }}>{msg.agentName}</span>
                              <span className="text-[9px] text-gray-700">{formatTs(msg.createdAt)}</span>
                            </div>
                            <div className="rounded-xl px-3 py-2 text-[11px] text-gray-300 leading-relaxed"
                                 style={{ background: color + '0a', border: `1px solid ${color}18` }}>
                              {msg.content}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Proposed items section */}
            {selectedProposal.items && selectedProposal.items.length > 0 && (
              <div className="border-t border-white/5 px-4 py-3 flex-shrink-0"
                   style={{ background: 'rgba(0,0,0,0.15)' }}>
                <div className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2 flex items-center gap-1.5">
                  <ListChecks size={10} />
                  Items propuestos
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedProposal.items.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px]"
                         style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }}>
                      <span>{ITEM_TYPE_LABEL[item.type] ?? '📋 ' + (item.type ?? 'item')}</span>
                      {item.title && <span className="text-gray-300 font-semibold">{item.title}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── RIGHT: Vote widget ── */}
      <div className="w-56 flex-shrink-0 border-l border-white/5 flex flex-col overflow-y-auto"
           style={{ background: 'rgba(0,0,0,0.15)' }}>

        <div className="px-3 pt-4 pb-2 flex-shrink-0 border-b border-white/5">
          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Votación ponderada</span>
        </div>

        {!selectedProposal || !voteState ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[10px] text-gray-700 text-center px-3">Seleccioná una propuesta</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-3 gap-3">
            {/* Score bar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] text-gray-600 font-bold uppercase tracking-wider">Score ponderado</span>
                <span className="text-[10px] font-black" style={{
                  color: voteState.approved ? '#10b981' : voteState.weightedScore >= 3 ? '#f59e0b' : '#6b7280'
                }}>
                  {voteState.weightedScore}/{voteState.threshold}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                     style={{
                       width: `${Math.min((voteState.weightedScore / voteState.threshold) * 100, 100)}%`,
                       background: voteState.approved ? '#10b981' : voteState.weightedScore >= 3 ? '#f59e0b' : '#6366f1'
                     }} />
              </div>
              {voteState.approved && (
                <div className="mt-1.5 text-[9px] font-bold text-center py-1 rounded"
                     style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                  ✅ APROBADA
                </div>
              )}
            </div>

            {/* Individual votes */}
            <div className="space-y-2">
              {voteState.votes.length === 0 ? (
                <p className="text-[10px] text-gray-700">Sin votos aún.</p>
              ) : voteState.votes.map(v => {
                const color = agentColor(v.agentSlug, v.agentName)
                return (
                  <div key={v.id} className="rounded-lg px-2.5 py-2 border"
                       style={{ background: color + '08', borderColor: color + '20' }}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black flex-shrink-0"
                           style={{ background: color + '25', color }}>
                        {agentInitials(v.agentName)}
                      </div>
                      <span className="text-[10px] font-semibold flex-1 truncate" style={{ color }}>{v.agentName}</span>
                      <span className="text-[9px] font-mono" style={{ color: '#6b7280' }}>×{v.weight}</span>
                      <span className="text-[12px]">{v.vote ? '✅' : '❌'}</span>
                    </div>
                    {v.argument && (
                      <p className="text-[9px] text-gray-600 mt-1.5 leading-relaxed line-clamp-3">{v.argument}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Pending voters */}
            {(() => {
              const COUNCIL_AGENTS = [
                { slug: 'orion', name: 'Orión', weight: 3 },
                { slug: 'ares', name: 'Ares', weight: 1 },
                { slug: 'atlas', name: 'Atlas', weight: 2 },
                { slug: 'iris', name: 'Iris', weight: 1 },
                { slug: 'vesta', name: 'Vesta', weight: 1 },
              ]
              const votedSlugs = voteState.votes.map(v => v.agentSlug?.toLowerCase())
              const pending = COUNCIL_AGENTS.filter(a => !votedSlugs.includes(a.slug))
              if (pending.length === 0) return null
              return (
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-gray-700 mb-1.5">Pendientes</div>
                  <div className="space-y-1.5">
                    {pending.map(a => {
                      const color = AGENT_COLOR[a.slug]
                      return (
                        <div key={a.slug} className="flex items-center gap-1.5 opacity-40">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black flex-shrink-0"
                               style={{ background: color + '20', color }}>
                            {a.name[0]}
                          </div>
                          <span className="text-[10px] flex-1" style={{ color }}>{a.name}</span>
                          <span className="text-[9px] font-mono text-gray-700">×{a.weight}</span>
                          <span className="text-[11px]">⏳</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </div>
      )}
    </div>
  )
}
