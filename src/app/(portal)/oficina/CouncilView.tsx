'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, ChevronDown, MessageSquare, Vote, ListChecks, Plus, RefreshCw, Send, Edit3, Trash2, CheckCircle, Upload, FileText, Settings, ToggleLeft, ToggleRight, Info } from 'lucide-react'

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
interface Session {
  id: string
  startedAt: string
  endedAt: string
  preview: string
  messages: ChatMsg[]
}
interface ExtractedTask { title: string; description: string; areaSlug: string; priority: string }
interface ExtractedSprint { name: string; goal: string; tasks: ExtractedTask[] }
interface ExtractedEpic { name: string; description: string }

function renderMd(text: string) {
  return text.split('\n').map((line, li, arr) => {
    const parts: React.ReactNode[] = []
    const re = /\*\*(.+?)\*\*/g
    let last = 0, m: RegExpExecArray | null
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index))
      parts.push(<strong key={m.index}>{m[1]}</strong>)
      last = m.index + m[0].length
    }
    if (last < line.length) parts.push(line.slice(last))
    return <span key={li}>{parts}{li < arr.length - 1 && <br />}</span>
  })
}

function parseOrionOptions(content: string): { prose: string; options: string[] } | null {
  const lines = content.split('\n')

  // Find all numbered list blocks
  const blocks: { start: number; end: number }[] = []
  let blockStart = -1
  for (let i = 0; i < lines.length; i++) {
    const isNum = /^\d+\.\s+\S/.test(lines[i])
    if (isNum && blockStart === -1) blockStart = i
    if (!isNum && blockStart !== -1) { blocks.push({ start: blockStart, end: i }); blockStart = -1 }
  }
  if (blockStart !== -1) blocks.push({ start: blockStart, end: lines.length })

  if (blocks.length === 0) return null

  // Use the LAST block — it's most likely the actual options after a question
  const last = blocks[blocks.length - 1]
  const options: string[] = []
  for (let i = last.start; i < last.end; i++) {
    const m = lines[i].match(/^\d+\.\s+(.+)$/)
    if (m) options.push(m[1].trim())
  }
  if (options.length < 2 || options.length > 6) return null

  // The prose is everything before this block
  const prose = lines.slice(0, last.start).join('\n').replace(/^-{3,}\s*$/m, '').trim()

  // Antes se exigia ademas un "?"/"¿" o una frase fija ("elegí", "cuál", etc.)
  // en el texto previo para recien ahi renderizar los botones — pero Orión
  // frecuentemente plantea la eleccion como una afirmacion ("necesito
  // entender cómo se va a presentar...") sin signo de pregunta literal, y
  // esos mensajes quedaban como texto plano pese a ser exactamente el mismo
  // patron de opciones (lista numerada de 2-6 items, terminando en "Otra
  // respuesta"). La estructura numerada ya es señal suficiente por si sola.
  return { prose, options }
}
interface ExtractedProposal { title: string; description: string; epic?: ExtractedEpic; sprints?: ExtractedSprint[]; items?: { type: string; title: string; description: string; areaSlug: string; priority: string }[]; _sourceFile?: string }

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
  ADJUSTING: '#f59e0b',
  ADJUST_READY: '#fb923c',
  ADJUST_QUESTIONS: '#fb923c',
  PLANNING: '#6366f1',
  PLAN_READY: '#10b981',
  PLAN_QUESTIONS: '#3b82f6',
  EXECUTING: '#059669',
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

export default function CouncilView({ mode: modeProp, setMode: setModeProp }: { mode?: 'proposals' | 'chat' | 'document', setMode?: (m: 'proposals' | 'chat' | 'document') => void } = {}) {
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
  const [showDesc, setShowDesc] = useState(false)
  // Tab mode
  const [mode, setMode] = useState<'proposals' | 'chat' | 'document'>('chat')
  const activeMode = modeProp ?? mode
  const setActiveMode: (m: 'proposals' | 'chat' | 'document') => void = setModeProp ?? setMode
  // Chat mode
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [leadContextLoaded, setLeadContextLoaded] = useState<string | null>(null)
  const [history, setHistory] = useState<Session[]>([])
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [otraRespuestaOpen, setOtraRespuestaOpen] = useState(false)
  const [otraRespuestaText, setOtraRespuestaText] = useState('')
  const otraRespuestaRef = useRef<HTMLInputElement>(null)
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
  const [escalationInstructions, setEscalationInstructions] = useState('')
  const [escalationAction, setEscalationAction] = useState<string | null>(null)
  const [negotiating, setNegotiating] = useState(false)
  const [creatingBacklog, setCreatingBacklog] = useState(false)
  const [humanComment, setHumanComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [approvingPlan, setApprovingPlan] = useState(false)
  const [deletingProposal, setDeletingProposal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [planApproved, setPlanApproved] = useState(false)
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
    const [msgRes, voteRes, propRes] = await Promise.all([
      fetch(`/api/council/proposals/${id}/messages`),
      fetch(`/api/council/proposals/${id}/votes`),
      fetch(`/api/council/proposals/${id}`),
    ])
    if (msgRes.ok) setMessages(await msgRes.json())
    if (voteRes.ok) setVoteState(await voteRes.json())
    if (propRes.ok) {
      const updated = await propRes.json()
      setProposals(prev => prev.map(p => p.id === id ? { ...p, ...updated, messages: undefined, votes: undefined } : p))
    }
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
    if (['DEBATING','PLANNING','ADJUSTING'].includes(p?.status ?? '')) {
      pollRef.current = setInterval(() => loadDetail(selectedId), 5000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [selectedId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    fetch('/api/orion/chat')
      .then(r => r.json())
      .then(d => {
        setHistory(d.sessions ?? [])
        if ((d.messages ?? []).length > 0) setChatMessages(d.messages)
      })
      .catch(() => {})
  }, [])

  async function sendChatMessage(override?: string) {
    const content = (override ?? chatInput).trim()
    if (!content || chatLoading) return
    const newMsg: ChatMsg = { role: 'user', content }
    setChatMessages(prev => [...prev, newMsg])
    if (!override) setChatInput('')
    setOtraRespuestaOpen(false)
    setOtraRespuestaText('')
    setChatLoading(true)
    try {
      const res = await fetch('/api/agents/orion/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content }),
      })
      if (res.ok) {
        const data = await res.json()
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
        if (data.leadContextLoaded) setLeadContextLoaded(data.leadContextLoaded)
      }
    } finally {
      setChatLoading(false)
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }

  function selectOption(text: string) {
    sendChatMessage(text)
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

  async function closeConversation() {
    if (chatMessages.length === 0) return
    const res = await fetch('/api/orion/chat', { method: 'DELETE' })
    if (res.ok) {
      const data = await res.json()
      setHistory(data.sessions ?? [])
      setChatMessages([])
      setLeadContextLoaded(null)
      setExtracted(null)
      setExpandedSession(null)
    }
  }

  async function sendToCouncil() {
    if (!extracted) return
    setSendingToCouncil(true)
    try {
      // Flatten sprints→tasks into items for the proposals API
      const flatItems = extracted.sprints
        ? extracted.sprints.flatMap(s => s.tasks.map(t => ({
            type: 'TASK',
            title: t.title,
            description: `[${s.name}] ${t.description}`,
            areaSlug: t.areaSlug,
            priority: t.priority,
          })))
        : (extracted.items ?? [])
      const res = await fetch('/api/council/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: extracted.title,
          description: extracted.description,
          inputChannel: 'CONVERSATION',
          items: flatItems,
          createdByAgentId: 'agent_orion_001',
          createdByAgentName: 'Orión',
        }),
      })
      if (res.ok) {
        const proposal = await res.json()
        await loadProposals()
        setExtracted(null)
        setChatMessages([])
      setLeadContextLoaded(null)
        setActiveMode('proposals')
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
        setActiveMode('proposals')
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

  async function startDebateFor(proposalId: string, round: number) {
    setStarting(true)
    try {
      const res = await fetch(`/api/council/proposals/${proposalId}/debate/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round }),
      })
      if (res.ok) {
        setSelectedId(proposalId)
        setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'DEBATING' } : p))
        await loadDetail(proposalId)
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = setInterval(() => loadDetail(proposalId), 5000)
      }
    } finally {
      setStarting(false)
    }
  }

  async function handleEscalatedAction(proposalId: string, action: 'APPROVED' | 'REJECTED' | 'RETRY') {
    setEscalationAction(action)
    try {
      if (action === 'APPROVED' || action === 'REJECTED') {
        await fetch(`/api/council/proposals/${proposalId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: action }),
        })
        setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: action } : p))
        await loadDetail(proposalId)
      } else {
        // RETRY: create new round proposal with instructions in metadata
        const current = proposals.find(p => p.id === proposalId)
        if (!current) return
        const res = await fetch('/api/council/proposals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `[Revisada R3] ${current.title.replace(/^\[Revisada.*?\]\s*/, '')}`,
            description: current.description,
            inputChannel: current.inputChannel,
            items: current.items,
            createdByAgentId: current.createdByAgentId ?? 'agent_orion_001',
            createdByAgentName: current.createdByAgentName ?? 'Orión',
            metadata: {
              originalProposalId: proposalId,
              escalatedRound: true,
              humanInstructions: escalationInstructions || null,
            },
          }),
        })
        if (res.ok) {
          const newProposal = await res.json()
          await loadProposals()
          setEscalationInstructions('')
          await startDebateFor(newProposal.id, 3)
        }
      }
    } finally {
      setEscalationAction(null)
    }
  }

  async function negotiateProposal(proposalId: string) {
    setNegotiating(true)
    try {
      const res = await fetch(`/api/council/proposals/${proposalId}/negotiate`, { method: 'POST' })
      if (res.ok) {
        // 202 = negotiation started in background; update UI optimistically + start polling
        setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'DEBATING' } : p))
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = setInterval(() => loadDetail(proposalId), 5000)
        loadDetail(proposalId)
      }
    } finally { setNegotiating(false) }
  }

  async function submitHumanComment(proposalId: string, phase: 'plan' | 'adjust') {
    const comment = humanComment.trim()
    if (!comment) return
    setSubmittingComment(true)
    try {
      const endpoint = phase === 'plan'
        ? `/api/council/proposals/${proposalId}/plan/start`
        : `/api/council/proposals/${proposalId}/adjust/start`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ humanComment: comment }),
      })
      if (res.ok) {
        setHumanComment('')
        setProposals(prev => prev.map(p => p.id === proposalId
          ? { ...p, status: phase === 'plan' ? 'PLANNING' : 'ADJUSTING' } : p))
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = setInterval(() => loadDetail(proposalId), 5000)
      }
    } finally { setSubmittingComment(false) }
  }

  async function startPlanning(proposalId: string) {
    setStarting(true)
    try {
      const res = await fetch(`/api/council/proposals/${proposalId}/plan/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'PLANNING' } : p))
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = setInterval(() => loadDetail(proposalId), 5000)
      }
    } finally { setStarting(false) }
  }

  async function approvePlan(proposalId: string) {
    setApprovingPlan(true)
    try {
      const res = await fetch(`/api/council/proposals/${proposalId}/plan/approve`, { method: 'POST' })
      if (res.ok) {
        setPlanApproved(true)
        setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'EXECUTING' } : p))
        await loadDetail(proposalId)
      }
    } finally { setApprovingPlan(false) }
  }

  async function approveAdjustments(proposalId: string) {
    setStarting(true)
    try {
      // Apply adjustments then trigger planning
      const res = await fetch(`/api/council/proposals/${proposalId}/plan/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'PLANNING' } : p))
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = setInterval(() => loadDetail(proposalId), 5000)
      }
    } finally { setStarting(false) }
  }

  async function deleteProposal(proposalId: string) {
    setDeletingProposal(true)
    try {
      const res = await fetch(`/api/council/proposals/${proposalId}`, { method: 'DELETE' })
      if (res.ok) {
        setProposals(prev => prev.filter(p => p.id !== proposalId))
        setSelectedId(null)
        setMessages([])
        setVoteState(null)
        setShowDeleteConfirm(false)
      }
    } finally { setDeletingProposal(false) }
  }

  async function createBacklog(proposalId: string, plan: any) {
    setCreatingBacklog(true)
    try {
      const res = await fetch(`/api/council/proposals/${proposalId}/create-backlog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ epic: plan.epic, sprints: plan.sprints }),
      })
      if (res.ok) {
        setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'APPROVED' } : p))
        await loadDetail(proposalId)
      }
    } finally { setCreatingBacklog(false) }
  }

  const byRound = messages.reduce<Record<number, DebateMsg[]>>((acc, m) => {
    if (m.round < 10) {
      acc[m.round] = acc[m.round] ?? []
      acc[m.round].push(m)
    }
    return acc
  }, {})
  const planningMsgs = messages.filter(m => m.round >= 10 && m.round < 20)
  const adjustingMsgs = messages.filter(m => m.round >= 20)

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
    const PRIORITY_COLOR: Record<string, string> = {
      CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#6b7280',
    }
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
          {/* Title */}
          <div>
            <label className="text-[8px] font-bold uppercase tracking-widest text-gray-600 mb-1 block">Título</label>
            <input
              value={data.title}
              onChange={e => onChangeData({ ...data, title: e.target.value })}
              className="w-full rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-gray-200 border border-white/8 outline-none focus:border-indigo-500/40"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            />
          </div>
          {/* Description */}
          <div>
            <label className="text-[8px] font-bold uppercase tracking-widest text-gray-600 mb-1 block">Descripción</label>
            <textarea
              value={data.description}
              onChange={e => onChangeData({ ...data, description: e.target.value })}
              rows={2}
              className="w-full rounded-lg px-2.5 py-1.5 text-[11px] text-gray-300 border border-white/8 outline-none focus:border-indigo-500/40 resize-none"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            />
          </div>
          {/* Epic */}
          {data.epic && (
            <div className="rounded-lg p-2.5" style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>Épica</span>
              </div>
              <p className="text-[10px] font-semibold text-gray-200 mb-0.5">{data.epic.name}</p>
              <p className="text-[9px] text-gray-500 leading-snug">{data.epic.description}</p>
            </div>
          )}
          {/* Sprints + Tasks */}
          {data.sprints && data.sprints.length > 0 && (
            <div className="space-y-2">
              <label className="text-[8px] font-bold uppercase tracking-widest text-gray-600 block">
                Sprints · {data.sprints.length}
              </label>
              {data.sprints.map((sprint, si) => (
                <div key={si} className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div className="px-2.5 py-2" style={{ background: 'rgba(99,102,241,0.1)' }}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>Sprint {si + 1}</span>
                    </div>
                    <p className="text-[10px] font-semibold text-gray-200">{sprint.name}</p>
                    {sprint.goal && <p className="text-[9px] text-gray-500 mt-0.5 leading-snug">{sprint.goal}</p>}
                  </div>
                  <div className="px-2 pb-2 pt-1.5 space-y-1.5" style={{ background: 'rgba(0,0,0,0.15)' }}>
                    {sprint.tasks.map((task, ti) => (
                      <div key={ti} className="rounded px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-[7px] font-bold uppercase" style={{ color: PRIORITY_COLOR[task.priority] ?? '#6b7280' }}>{task.priority}</span>
                          <span className="text-[7px] text-gray-700 ml-auto">{task.areaSlug}</span>
                        </div>
                        <p className="text-[9px] text-gray-300 font-medium leading-snug">{task.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Fallback: legacy flat items */}
          {!data.sprints && data.items && data.items.length > 0 && (
            <div className="space-y-2">
              <label className="text-[8px] font-bold uppercase tracking-widest text-gray-600 block">Items · {data.items.length}</label>
              {data.items.map((item, idx) => (
                <div key={idx} className="rounded-lg p-2.5 border" style={{ background: 'rgba(99,102,241,0.05)', borderColor: 'rgba(99,102,241,0.15)' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>{item.type}</span>
                    <span className="text-[8px] text-gray-700 ml-auto">{item.priority}</span>
                  </div>
                  <p className="text-[10px] font-semibold text-gray-200">{item.title}</p>
                  <p className="text-[9px] text-gray-600 mt-0.5">{item.areaSlug}</p>
                </div>
              ))}
            </div>
          )}
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

      {activeMode === 'document' ? (
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
      ) : activeMode === 'chat' ? (
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
              {chatMessages.map((msg, i) => {
                const isLastAssistant = msg.role === 'assistant' && i === chatMessages.length - 1 && !chatLoading
                const parsed = isLastAssistant ? parseOrionOptions(msg.content) : null
                return (
                  <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black"
                         style={msg.role === 'assistant'
                           ? { background: 'rgba(99,102,241,0.25)', color: '#6366f1', border: '1.5px solid rgba(99,102,241,0.4)' }
                           : { background: 'rgba(255,255,255,0.08)', color: '#9ca3af', border: '1.5px solid rgba(255,255,255,0.1)' }}>
                      {msg.role === 'assistant' ? 'OR' : 'Tú'}
                    </div>
                    <div className={msg.role === 'user' ? 'max-w-[75%]' : 'flex-1 min-w-0'}>
                      {parsed ? (
                        <div className="rounded-xl px-3 py-2.5 text-[11px] leading-relaxed"
                             style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)', color: '#d1d5db' }}>
                          {parsed.prose && <div className="mb-3">{renderMd(parsed.prose)}</div>}
                          <div className="space-y-1.5">
                            {parsed.options.map((opt, oi) => {
                              const isOtra = /otra respuesta/i.test(opt)
                              if (isOtra && otraRespuestaOpen) {
                                return (
                                  <div key={oi} className="flex gap-2 mt-1">
                                    <input
                                      ref={otraRespuestaRef}
                                      autoFocus
                                      value={otraRespuestaText}
                                      onChange={e => setOtraRespuestaText(e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && otraRespuestaText.trim() && selectOption(otraRespuestaText.trim())}
                                      placeholder="Describí con tus palabras..."
                                      className="flex-1 rounded-lg px-3 py-1.5 text-[11px] text-gray-200 border border-white/10 outline-none focus:border-indigo-500/50 transition-colors placeholder-gray-600"
                                      style={{ background: 'rgba(255,255,255,0.06)' }}
                                    />
                                    <button
                                      onClick={() => otraRespuestaText.trim() && selectOption(otraRespuestaText.trim())}
                                      disabled={!otraRespuestaText.trim()}
                                      className="px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40"
                                      style={{ background: 'rgba(99,102,241,0.3)', color: '#818cf8' }}>
                                      <Send size={11} />
                                    </button>
                                  </div>
                                )
                              }
                              return (
                                <button
                                  key={oi}
                                  onClick={() => isOtra
                                    ? (setOtraRespuestaOpen(true), setTimeout(() => otraRespuestaRef.current?.focus(), 50))
                                    : selectOption(`${oi + 1}. ${opt}`)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all group"
                                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.3)' }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}>
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors"
                                        style={{ background: isOtra ? 'rgba(251,191,36,0.15)' : 'rgba(99,102,241,0.2)', color: isOtra ? '#fbbf24' : '#818cf8' }}>
                                    {isOtra ? '✎' : oi + 1}
                                  </span>
                                  <span className="text-[11px] text-gray-300 group-hover:text-white transition-colors">{opt}</span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl px-3 py-2 text-[11px] leading-relaxed"
                             style={msg.role === 'assistant'
                               ? { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)', color: '#d1d5db' }
                               : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#e5e7eb' }}>
                          {msg.role === 'assistant' ? renderMd(msg.content) : msg.content}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
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

            {/* Lead context indicator */}
            {leadContextLoaded && (
              <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <span style={{ fontSize: '11px', color: '#818cf8' }}>📂</span>
                <span style={{ fontSize: '11px', color: '#818cf8', flex: 1 }}>Contexto cargado: <strong>{leadContextLoaded}</strong></span>
                <button onClick={() => setLeadContextLoaded(null)} style={{ fontSize: '10px', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>✕</button>
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
                  onClick={() => sendChatMessage()}
                  disabled={!chatInput.trim() || chatLoading}
                  className="px-3 py-2 rounded-xl transition-all flex-shrink-0"
                  style={{ background: 'rgba(99,102,241,0.2)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <Send size={14} />
                </button>
              </div>
              {chatMessages.length > 0 && (
                <button
                  onClick={closeConversation}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-all hover:opacity-80"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#6b7280' }}>
                  <Trash2 size={10} /> Cerrar conversación — guardar en historial
                </button>
              )}
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
          {/* ── History sidebar ── */}
          <div className="w-56 flex-shrink-0 flex flex-col border-l border-white/5 overflow-hidden"
               style={{ background: 'rgba(0,0,0,0.15)' }}>
            <div className="px-3 pt-3 pb-2 border-b border-white/5 flex-shrink-0 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Historial</span>
              {chatMessages.length > 0 && (
                <button
                  onClick={closeConversation}
                  title="Cerrar conversación y guardar en historial"
                  className="text-[9px] px-2 py-0.5 rounded-full font-medium transition-all hover:opacity-80 flex items-center gap-1"
                  style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <Plus size={8} /> Nueva sesión
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
              {history.length === 0 && (
                <p className="text-[10px] text-gray-600 text-center pt-8 px-2 leading-relaxed">
                  Las conversaciones cerradas aparecen aquí
                </p>
              )}
              {[...history].reverse().map((session) => {
                const date = new Date(session.endedAt)
                const dateStr = date.toLocaleDateString('es', { day: '2-digit', month: 'short' })
                const timeStr = date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                const isExpanded = expandedSession === session.id
                return (
                  <div key={session.id}
                       className="rounded-lg overflow-hidden"
                       style={{ border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                    <button
                      onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                      className="w-full text-left px-2 py-2 transition-all hover:bg-white/[0.03]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[8px] text-gray-500">{dateStr} · {timeStr}</span>
                        <span className="text-[8px] text-gray-600">{session.messages.length} msgs</span>
                      </div>
                      <p className="text-[10px] text-gray-300 line-clamp-2 leading-snug">{session.preview}</p>
                    </button>
                    {isExpanded && (
                      <div className="px-2 pb-2 space-y-1.5 border-t border-white/5 pt-2 max-h-64 overflow-y-auto">
                        {session.messages.map((msg, mi) => (
                          <div key={mi} className="rounded px-1.5 py-1"
                               style={msg.role === 'assistant'
                                 ? { background: 'rgba(99,102,241,0.07)' }
                                 : { background: 'rgba(255,255,255,0.03)' }}>
                            <span className="text-[8px] font-bold"
                                  style={{ color: msg.role === 'assistant' ? '#818cf8' : '#9ca3af' }}>
                              {msg.role === 'assistant' ? 'Orión' : 'Tú'}
                            </span>
                            <p className="text-[9px] text-gray-400 leading-snug mt-0.5 line-clamp-4">{msg.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
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
            <option value="ADJUSTING">Ajustando</option>
            <option value="ADJUST_READY">Ajuste listo</option>
            <option value="PLANNING">Planificando</option>
            <option value="PLAN_READY">Plan listo</option>
            <option value="EXECUTING">Ejecutando</option>
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
                    {/* Link to original if this is a revisada proposal */}
                    {selectedProposal.metadata?.originalProposalId && (() => {
                      const orig = proposals.find(p => p.id === selectedProposal.metadata.originalProposalId)
                      if (!orig) return null
                      return (
                        <button onClick={() => setSelectedId(orig.id)}
                          className="text-[8px] px-1.5 py-0.5 rounded underline underline-offset-2 transition-opacity hover:opacity-80"
                          style={{ color: '#8b5cf6' }}>↩ Ver original</button>
                      )
                    })()}
                    <span className="text-[9px] text-gray-600">{CHANNEL_LABEL[selectedProposal.inputChannel]}</span>
                    <span className="text-[9px] text-gray-700 ml-auto">{formatTs(selectedProposal.createdAt)}</span>
                  </div>
                  <div className="flex items-start gap-1.5 mt-1">
                    <h2 className="text-[13px] font-black text-gray-200 leading-snug flex-1">{selectedProposal.title}</h2>
                    {selectedProposal.description && (
                      <div className="relative flex-shrink-0 mt-0.5">
                        <button onClick={() => setShowDesc(v => !v)} className="p-0.5 rounded hover:bg-white/8 transition-colors" title="Ver descripción">
                          <Info size={12} className="text-gray-500 hover:text-gray-300" />
                        </button>
                        {showDesc && (
                          <div className="absolute right-0 top-5 z-50 w-72 rounded-xl px-3 py-2.5 shadow-xl"
                               style={{ background: "rgba(18,18,30,0.97)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            <p className="text-[11px] text-gray-400 leading-relaxed">{selectedProposal.description}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Source file badge */}
                  {selectedProposal.metadata?.sourceFile && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <FileText size={9} style={{ color: '#3b82f6' }} />
                      <span className="text-[9px] text-gray-600">{selectedProposal.metadata.sourceFile}</span>
                    </div>
                  )}
                </div>
                {/* Iniciar debate button for PENDING/REVISED */}
                {selectedProposal.status === 'PENDING' && (
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
                {selectedProposal.status === 'APPROVED' && !selectedProposal.metadata?.councilPlan && (
                  <button
                    onClick={() => startPlanning(selectedProposal.id)}
                    disabled={starting}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex-shrink-0"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                    {starting ? <><Loader2 size={11} className="animate-spin" /> Planificando...</> : <>Planificar ejecucion</>}
                  </button>
                )}
              </div>
            </div>

            {/* ── Single scroll zone: banners + debate ── */}
            <div className="flex-1 overflow-y-auto">
            {/* Escalated banner — human decision required */}
            {selectedProposal.status === 'ESCALATED' && (
              <div className="mx-4 mt-3 space-y-2">
                {/* Main decision banner */}
                <div className="rounded-xl px-3 py-3" style={{ background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.25)' }}>
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#f97316' }}>🚨 Escalada — requiere decisión del socio</span>
                  <p className="text-[10px] text-gray-400 leading-snug mt-1 mb-3">
                    El consejo no alcanzó umbral en 2 rondas. Podés aprobar, rechazar, dar una nueva ronda, o pedir al consejo que sintetice el plan final.
                  </p>
                  <textarea
                    value={escalationInstructions}
                    onChange={e => setEscalationInstructions(e.target.value)}
                    placeholder="Instrucciones adicionales para nueva ronda (opcional)..."
                    rows={2}
                    className="w-full rounded-lg px-2.5 py-1.5 text-[10px] text-gray-300 border border-white/8 outline-none focus:border-orange-500/40 resize-none mb-2.5"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button onClick={() => handleEscalatedAction(selectedProposal.id, 'APPROVED')} disabled={!!escalationAction || negotiating}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                      {escalationAction === 'APPROVED' ? '...' : '✅ Aprobar'}
                    </button>
                    <button onClick={() => handleEscalatedAction(selectedProposal.id, 'REJECTED')} disabled={!!escalationAction || negotiating}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                      {escalationAction === 'REJECTED' ? '...' : '❌ Rechazar'}
                    </button>
                    <button onClick={() => handleEscalatedAction(selectedProposal.id, 'RETRY')} disabled={!!escalationAction || negotiating}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50"
                      style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.25)' }}>
                      {escalationAction === 'RETRY' ? '...' : '🔄 Nueva ronda'}
                    </button>
                    <button onClick={() => negotiateProposal(selectedProposal.id)} disabled={negotiating || !!escalationAction}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50 ml-auto"
                      style={{ background: 'rgba(139,92,246,0.18)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.35)' }}>
                      {negotiating ? <><span className="animate-spin text-[10px]">⚙️</span> Negociando...</> : '⚡ Negociación del Consejo'}
                    </button>
                  </div>
                </div>
                {/* Negotiated plan — extracted from metadata after council negotiation */}
                {(() => {
                  const plan = selectedProposal.metadata?.negotiatedPlan
                  if (!plan) return null
                  return (
                    <div className="rounded-xl px-3 py-3 space-y-3" style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.3)' }}>
                      <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#a78bfa' }}>📋 Plan negociado por el Consejo</span>
                      {/* Epic */}
                      <div className="rounded-lg p-2.5" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                        <div className="text-[8px] font-bold uppercase tracking-widest mb-1" style={{ color: '#10b981' }}>Épica</div>
                        <p className="text-[10px] font-semibold text-gray-200">{plan.epic?.name}</p>
                        <p className="text-[9px] text-gray-500 mt-0.5">{plan.epic?.description}</p>
                        {plan.epic?.startDate && <p className="text-[8px] text-gray-600 mt-1">{plan.epic.startDate} → {plan.epic.endDate}</p>}
                      </div>
                      {/* Sprints */}
                      <div className="space-y-2">
                        {(plan.sprints ?? []).map((sp: any, si: number) => (
                          <div key={si} className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
                            <div className="px-2.5 py-2" style={{ background: 'rgba(99,102,241,0.1)' }}>
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8' }}>Sprint {si+1}</span>
                                <span className="text-[8px] text-gray-600 ml-auto">{sp.areaSlug}</span>
                              </div>
                              <p className="text-[10px] font-semibold text-gray-200">{sp.name}</p>
                              {sp.goal && <p className="text-[9px] text-gray-500 mt-0.5">{sp.goal}</p>}
                              {sp.startDate && <p className="text-[8px] text-gray-600 mt-0.5">{sp.startDate} → {sp.endDate}</p>}
                            </div>
                            <div className="px-2 pb-2 pt-1.5 space-y-1" style={{ background: 'rgba(0,0,0,0.15)' }}>
                              {(sp.tasks ?? []).map((t: any, ti: number) => (
                                <div key={ti} className="rounded px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                                  <div className="flex items-center gap-1 mb-0.5">
                                    <span className="text-[7px] font-bold uppercase" style={{ color: t.priority === 'CRITICAL' ? '#ef4444' : t.priority === 'HIGH' ? '#f97316' : t.priority === 'MEDIUM' ? '#eab308' : '#6b7280' }}>{t.priority}</span>
                                    <span className="text-[7px] text-gray-700 ml-auto">{t.areaSlug}{t.assigneeName ? ' · ' + t.assigneeName : ''}</span>
                                  </div>
                                  <p className="text-[9px] text-gray-300 font-medium leading-snug">{t.title}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => createBacklog(selectedProposal.id, plan)}
                        disabled={creatingBacklog}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-black transition-all disabled:opacity-50"
                        style={{ background: 'rgba(139,92,246,0.25)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.5)' }}>
                        {creatingBacklog ? <><span className="animate-spin">⚙️</span> Creando...</> : '🚀 Crear Épica, Sprints y Tasks en Backlog'}
                      </button>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* REVISED banner — shows link + retry button for child round-2 proposal */}
            {selectedProposal.status === 'REVISED' && (() => {
              const child = proposals.find(p => p.metadata?.originalProposalId === selectedProposal.id)
              return (
                <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex-shrink-0"
                     style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#8b5cf6' }}>🔄 Ronda 1 completada — score insuficiente</span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-snug">
                    El consejo no alcanzó el umbral de aprobación. Se generó automáticamente una segunda ronda de debate.
                  </p>
                  {child && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => setSelectedId(child.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:opacity-80"
                        style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }}>
                        ↗ Ver Ronda 2
                      </button>
                      {child.status === 'PENDING' && (
                        <button
                          onClick={() => startDebateFor(child.id, 2)}
                          disabled={starting}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:opacity-80 disabled:opacity-50"
                          style={{ background: 'rgba(99,102,241,0.2)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.4)' }}>
                          {starting ? <><span className="animate-spin text-[10px]">⚙️</span> Iniciando...</> : <>⚖️ Reintentar debate</>}
                        </button>
                      )}
                      {child.status === 'DEBATING' && (
                        <span className="text-[9px] animate-pulse" style={{ color: '#6366f1' }}>⚙️ Debatiendo ronda 2...</span>
                      )}
                    </div>
                  )}
                  {!child && (
                    <p className="mt-1.5 text-[9px] text-gray-600">La propuesta de ronda 2 aún no fue creada.</p>
                  )}
                </div>
              )
            })()}

            {/* ADJUSTING banner */}
            {["ADJUSTING", "ADJUST_QUESTIONS"].includes(selectedProposal.status) && (
              <div className="mx-4 mt-3 rounded-xl px-3 py-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Loader2 size={12} className="animate-spin" style={{ color: "#f59e0b" }} />
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#f59e0b" }}>Consejo debatiendo ajustes...</span>
                </div>
                <p className="text-[10px] text-gray-400 leading-snug">Los agentes analizan las razones de rechazo y definen cambios para hacer la propuesta aprobable.</p>
                {selectedProposal.metadata?.adjustmentQuestions && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(245,158,11,0.7)" }}>El consejo necesita mas info:</p>
                    {(selectedProposal.metadata.adjustmentQuestions as string[]).map((q, qi) => (
                      <p key={qi} className="text-[9px] text-gray-400">• {q}</p>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <input value={humanComment} onChange={e => setHumanComment(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) submitHumanComment(selectedProposal.id, "adjust") }}
                    placeholder="Agregar contexto al debate de ajustes..."
                    className="flex-1 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-200 border border-white/8 outline-none"
                    style={{ background: "rgba(255,255,255,0.04)" }} />
                  <button onClick={() => submitHumanComment(selectedProposal.id, "adjust")} disabled={submittingComment || !humanComment.trim()}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40"
                    style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.35)" }}>
                    <Send size={11} />
                  </button>
                </div>
              </div>
            )}

            {/* ADJUST_READY banner */}
            {selectedProposal.status === "ADJUST_READY" && (() => {
              const adj = selectedProposal.metadata?.adjustmentProposal
              return (
                <div className="mx-4 mt-3 rounded-xl px-3 py-3 space-y-3" style={{ background: "rgba(251,146,60,0.07)", border: "1px solid rgba(251,146,60,0.3)" }}>
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#fb923c" }}>Ajustes propuestos por el Consejo</span>
                  {adj ? (
                    <>
                      {(adj.adjustmentRationale || adj.agentConsensus) && (
                        <p className="text-[10px] text-gray-400 leading-snug">{adj.adjustmentRationale ?? adj.agentConsensus}</p>
                      )}
                      {adj.keyChanges && (adj.keyChanges as any[]).length > 0 && (
                        <div className="space-y-2">
                          {(adj.keyChanges as any[]).map((change, ci) => (
                            <div key={ci} className="rounded-lg p-2.5" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c" }}>{change.aspect}</span>
                                {change.agentSupporting && <span className="text-[8px] text-gray-600 ml-auto">{change.agentSupporting}</span>}
                              </div>
                              {change.from && <p className="text-[9px] text-gray-500 mb-0.5">Antes: {change.from}</p>}
                              <p className="text-[9px] font-semibold text-gray-200">Propuesto: {change.to}</p>
                              {change.rationale && <p className="text-[9px] text-gray-600 mt-0.5">{change.rationale}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input value={humanComment} onChange={e => setHumanComment(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) submitHumanComment(selectedProposal.id, "adjust") }}
                            placeholder="Comentario antes de aprobar los ajustes..."
                            className="flex-1 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-200 border border-white/8 outline-none"
                            style={{ background: "rgba(255,255,255,0.04)" }} />
                          <button onClick={() => submitHumanComment(selectedProposal.id, "adjust")} disabled={submittingComment || !humanComment.trim()}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-40"
                            style={{ background: "rgba(251,146,60,0.2)", color: "#fb923c", border: "1px solid rgba(251,146,60,0.35)" }}>
                            <Send size={11} />
                          </button>
                        </div>
                        <button onClick={() => approveAdjustments(selectedProposal.id)} disabled={starting}
                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-black transition-all disabled:opacity-50"
                          style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                          {starting ? <><Loader2 size={11} className="animate-spin" /> Procesando...</> : <> Aprobar ajustes y pasar a planificacion</>}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="text-[10px] text-gray-600">Sin ajustes generados.</p>
                  )}
                </div>
              )
            })()}

            {/* PLANNING banner */}
            {["PLANNING", "PLAN_QUESTIONS"].includes(selectedProposal.status) && (
              <div className="mx-4 mt-3 rounded-xl px-3 py-3" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.3)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Loader2 size={12} className="animate-spin" style={{ color: "#818cf8" }} />
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#818cf8" }}>Consejo planificando la ejecucion...</span>
                </div>
                <p className="text-[10px] text-gray-400 leading-snug">Los agentes definen Epica, Sprints y Tasks con area/agente responsable obligatorio.</p>
                {selectedProposal.metadata?.councilQuestions && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(99,102,241,0.8)" }}>El consejo necesita mas info:</p>
                    {(selectedProposal.metadata.councilQuestions as string[]).map((q, qi) => (
                      <p key={qi} className="text-[9px] text-gray-400">• {q}</p>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <input value={humanComment} onChange={e => setHumanComment(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) submitHumanComment(selectedProposal.id, "plan") }}
                    placeholder="Agregar contexto al plan..."
                    className="flex-1 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-200 border border-white/8 outline-none"
                    style={{ background: "rgba(255,255,255,0.04)" }} />
                  <button onClick={() => submitHumanComment(selectedProposal.id, "plan")} disabled={submittingComment || !humanComment.trim()}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-40"
                    style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.35)" }}>
                    <Send size={11} />
                  </button>
                </div>
              </div>
            )}

            {/* PLAN_READY banner */}
            {selectedProposal.status === "PLAN_READY" && (() => {
              const plan = selectedProposal.metadata?.councilPlan
              const PC: Record<string, string> = { CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#6b7280" }
              return (
                <div className="mx-4 mt-3 rounded-xl px-3 py-3 space-y-3" style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.3)" }}>
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#10b981" }}>Plan listo para revision</span>
                  {plan ? (
                    <>
                      {plan.planRationale && <p className="text-[10px] text-gray-400 leading-snug italic">{plan.planRationale}</p>}
                      {(plan.solucionPropuesta || plan.solucionId) && (
                        <div className="rounded-lg p-2" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
                          <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "#10b981" }}>Solucion</p>
                          <p className="text-[10px] font-semibold text-gray-200 mt-0.5">{plan.solucionPropuesta?.name ?? ("Existente: " + plan.solucionId)}</p>
                          {plan.solucionPropuesta?.description && <p className="text-[9px] text-gray-500 mt-0.5">{plan.solucionPropuesta.description}</p>}
                        </div>
                      )}
                      {plan.epic && (
                        <div className="rounded-lg p-2" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.15)" }}>
                          <p className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "#10b981" }}>Epica</p>
                          <p className="text-[10px] font-semibold text-gray-200 mt-0.5">{plan.epic.name}</p>
                          {plan.epic.description && <p className="text-[9px] text-gray-500 mt-0.5">{plan.epic.description}</p>}
                          {plan.epic.estimatedWeeks && <p className="text-[8px] text-gray-600 mt-0.5">{plan.epic.estimatedWeeks} semanas estimadas</p>}
                        </div>
                      )}
                      {plan.sprints && (plan.sprints as any[]).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[8px] font-bold uppercase tracking-widest text-gray-500">Sprints · {(plan.sprints as any[]).length}</p>
                          {(plan.sprints as any[]).map((sp, si) => (
                            <div key={si} className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(99,102,241,0.2)" }}>
                              <div className="px-2.5 py-2" style={{ background: "rgba(99,102,241,0.1)" }}>
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase" style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8" }}>Sprint {si+1}</span>
                                  <span className="text-[8px] text-indigo-400/60 ml-auto">{sp.areaSlug}</span>
                                  {sp.estimatedWeeks && <span className="text-[8px] text-gray-600">{sp.estimatedWeeks}w</span>}
                                </div>
                                <p className="text-[10px] font-semibold text-gray-200">{sp.name}</p>
                                {sp.goal && <p className="text-[9px] text-gray-500 mt-0.5">{sp.goal}</p>}
                              </div>
                              <div className="px-2 pb-2 pt-1.5 space-y-1" style={{ background: "rgba(0,0,0,0.15)" }}>
                                {((sp.tasks ?? []) as any[]).map((t, ti) => (
                                  <div key={ti} className="rounded px-2 py-1.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                    <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                                      <span className="text-[7px] font-bold uppercase" style={{ color: PC[t.priority] ?? "#6b7280" }}>{t.priority}</span>
                                      <span className="text-[7px] text-indigo-400/70 ml-1">{t.areaSlug}</span>
                                      {t.agentSlug && <span className="text-[7px] text-gray-600">· {t.agentSlug}</span>}
                                      {t.estimatedHours && <span className="text-[7px] text-gray-700 ml-auto">{t.estimatedHours}h</span>}
                                    </div>
                                    <p className="text-[9px] text-gray-300 font-medium leading-snug">{t.title}</p>
                                    {t.rationaleArea && <p className="text-[8px] text-gray-600 mt-0.5 italic">{t.rationaleArea}</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input value={humanComment} onChange={e => setHumanComment(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) submitHumanComment(selectedProposal.id, "plan") }}
                            placeholder="Ajuste al plan antes de aprobar..."
                            className="flex-1 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-200 border border-white/8 outline-none"
                            style={{ background: "rgba(255,255,255,0.04)" }} />
                          <button onClick={() => submitHumanComment(selectedProposal.id, "plan")} disabled={submittingComment || !humanComment.trim()}
                            className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold disabled:opacity-40"
                            style={{ background: "rgba(16,185,129,0.2)", color: "#10b981", border: "1px solid rgba(16,185,129,0.35)" }}>
                            <Send size={11} />
                          </button>
                        </div>
                        {planApproved ? (
                          <div className="flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-bold"
                               style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
                            Plan aprobado — Backlog creado exitosamente
                          </div>
                        ) : (
                          <button onClick={() => approvePlan(selectedProposal.id)} disabled={approvingPlan}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black transition-all disabled:opacity-50"
                            style={{ background: "rgba(16,185,129,0.2)", color: "#10b981", border: "1px solid rgba(16,185,129,0.4)" }}>
                            {approvingPlan ? <><Loader2 size={11} className="animate-spin" /> Creando backlog...</> : <> Aprobar plan — crear Epica, Sprints y Tasks en Backlog</>}
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] text-gray-500">Sin plan generado. El consejo puede generarlo ahora.</p>
                      <button onClick={() => startPlanning(selectedProposal.id)} disabled={starting}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-bold disabled:opacity-50"
                        style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.3)" }}>
                        {starting ? <><Loader2 size={11} className="animate-spin" /> Iniciando...</> : <>Generar plan</>}
                      </button>
                    </div>
                  )}
                </div>
              )
            })()}

            {/* EXECUTING banner */}
            {selectedProposal.status === "EXECUTING" && (
              <div className="mx-4 mt-3 rounded-xl px-3 py-3" style={{ background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.35)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[14px]">🚀</span>
                  <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#059669" }}>Plan en ejecucion — Backlog creado</span>
                </div>
                {selectedProposal.metadata?.executionResult && (() => {
                  const r = selectedProposal.metadata.executionResult as any
                  return (
                    <p className="text-[10px] text-gray-400 mt-1">
                      {(r.epics?.length ?? 0)} epica · {(r.sprints?.length ?? 0)} sprints · {r.tasks ?? 0} tasks creados.
                    </p>
                  )
                })()}
              </div>
            )}

            {/* Debate messages */}
            <div className="px-4 py-4 space-y-4">
              {detailLoading && messages.length === 0 ? (
                <div className="flex items-center gap-2 justify-center py-8 text-gray-600 text-xs">
                  <Loader2 size={12} className="animate-spin" /> Cargando debate...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <span className="text-3xl opacity-20">🔇</span>
                  <p className="text-[11px] text-gray-700">El debate no ha comenzado.</p>
                </div>
              ) : (
                <>
                  {/* PLANNING phase messages */}
                  {planningMsgs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-px flex-1" style={{ background: 'rgba(99,102,241,0.25)' }} />
                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                              style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                          🧠 Debate · Planificación
                        </span>
                        <div className="h-px flex-1" style={{ background: 'rgba(99,102,241,0.25)' }} />
                      </div>
                      <div className="space-y-3">
                        {planningMsgs.map(msg => {
                          const color = agentColor(msg.agentSlug, msg.agentName)
                          return (
                            <div key={msg.id} className="flex gap-2.5">
                              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black"
                                   style={{ background: color + '25', color, border: `1.5px solid ${color}40` }}>
                                {agentInitials(msg.agentName)}
                              </div>
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
                  )}

                  {/* ADJUSTING phase messages */}
                  {adjustingMsgs.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-px flex-1" style={{ background: 'rgba(245,158,11,0.25)' }} />
                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                              style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
                          🔄 Debate · Ajustes
                        </span>
                        <div className="h-px flex-1" style={{ background: 'rgba(245,158,11,0.25)' }} />
                      </div>
                      <div className="space-y-3">
                        {adjustingMsgs.map(msg => {
                          const color = agentColor(msg.agentSlug, msg.agentName)
                          return (
                            <div key={msg.id} className="flex gap-2.5">
                              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black"
                                   style={{ background: color + '25', color, border: `1.5px solid ${color}40` }}>
                                {agentInitials(msg.agentName)}
                              </div>
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
                  )}

                  {/* VOTE DEBATE messages by round */}
                  {Object.entries(byRound).map(([round, msgs]) => (
                    <div key={round}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-px flex-1" style={{ background: 'rgba(139,92,246,0.2)' }} />
                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                              style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
                          Ronda {round}
                        </span>
                        <div className="h-px flex-1" style={{ background: 'rgba(139,92,246,0.2)' }} />
                      </div>
                      <div className="space-y-3">
                        {msgs.map(msg => {
                          const color = agentColor(msg.agentSlug, msg.agentName)
                          return (
                            <div key={msg.id} className="flex gap-2.5">
                              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black"
                                   style={{ background: color + '25', color, border: `1.5px solid ${color}40` }}>
                                {agentInitials(msg.agentName)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 mb-1">
                                  <span className="text-[11px] font-bold" style={{ color }}>{msg.agentName}</span>
                                  <span className="text-[9px] text-gray-700">{formatTs(msg.createdAt)}</span>
                                </div>
                                <div className="rounded-xl px-3 py-2 text-[11px] text-gray-300 leading-relaxed"
                                     style={{ background: color + '0a', border: `1px solid ${color}18` }}>
                                  {msg.agentSlug === 'orion' && msg.content.includes('{') ? msg.content.split('{')[0].trim() : msg.content}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}
              <div ref={chatEndRef} />
            </div>
            </div>{/* end scroll zone */}

            {/* Proposed items section */}

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
                      <p className="text-[9px] text-gray-400 mt-1.5 leading-relaxed line-clamp-3">{v.argument}</p>
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
                        <div key={a.slug} className="flex items-center gap-1.5 opacity-55">
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
            {/* Config / Sesion panel */}
            <div className="border-t border-white/[0.06] pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600">Sesion</span>
                <button
                  onClick={() => setShowDeleteConfirm(v => !v)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold transition-all hover:opacity-80"
                  style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <Trash2 size={9} /> Borrar
                </button>
              </div>
              {/* Delete confirm */}
              {showDeleteConfirm && (
                <div className="rounded-lg p-2.5 space-y-2" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.25)" }}>
                  <p className="text-[9px] text-gray-400 leading-snug">Borra la propuesta, sus votos y mensajes de debate. No se puede deshacer.</p>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => deleteProposal(selectedProposal!.id)}
                      disabled={deletingProposal}
                      className="flex-1 py-1.5 rounded text-[9px] font-bold transition-all disabled:opacity-50"
                      style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                      {deletingProposal ? "Borrando..." : "Si, borrar"}
                    </button>
                    <button onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-1.5 rounded text-[9px] font-bold transition-all"
                      style={{ background: "rgba(255,255,255,0.04)", color: "#6b7280", border: "1px solid rgba(255,255,255,0.08)" }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
              {/* Config fields */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-gray-700">Canal</span>
                  <span className="text-[8px] font-medium text-gray-500">{selectedProposal!.inputChannel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-gray-700">Ronda</span>
                  <span className="text-[8px] font-medium text-gray-500">{selectedProposal!.round}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-gray-700">Creado por</span>
                  <span className="text-[8px] font-medium text-gray-500 truncate max-w-[90px]">{selectedProposal!.createdByAgentName ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-gray-700">Estado</span>
                  <span className="text-[8px] font-bold" style={{ color: STATUS_COLOR[selectedProposal!.status] ?? "#6b7280" }}>{selectedProposal!.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[8px] text-gray-700">Mensajes</span>
                  <span className="text-[8px] font-medium text-gray-500">{messages.length}</span>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
      )}
    </div>
  )
}
