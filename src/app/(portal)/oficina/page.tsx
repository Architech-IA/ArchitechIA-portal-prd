'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, ChevronRight, Settings, Bot, Save, Circle, Network, Users, Bell, Search, SlidersHorizontal } from 'lucide-react'
import DirectoryView from './DirectoryView'
import CouncilView from './CouncilView'

interface SubArea {
  id: string; name: string; slug: string; icon: string; color: string
  description: string | null; agentId: string | null; agentName: string | null
  agentSlug: string | null; agentStatus: string | null
  activeItems: number; inProgressItems: number
}
interface Area extends SubArea { subAreas: SubArea[] }
interface ActivityEvent {
  id: string; type: string; label: string; title: string; status: string
  priority: string; itemType: string; sprint: string | null; sprintName: string | null
  assigneeName: string | null; timestamp: string
}
interface OrionMsg {
  id: string; message: string; actionType: string
  backlogItemId: string | null; backlogItemTitle: string | null
  backlogItemCode: string | null; metadata: any; createdAt: string
}
interface Agent {
  id: string; slug: string; name: string; role: string; area: string
  personality: string; systemPrompt: string | null; taskTypes: string[]
  repos: string[]; discordUserId: string | null; vaultPath: string | null
  status: string; areaId: string | null
}

const STATUS_COLOR: Record<string,string> = {
  BACKLOG:'#6b7280', TODO:'#60a5fa', IN_PROGRESS:'#f97316',
  REVIEW:'#a78bfa', DONE:'#10b981', CANCELLED:'#ef4444',
}
const EVENT_ICON: Record<string,string> = {
  completed:'✅', started:'🔄', created:'✨', updated:'📝',
}
const PRIORITY_DOT: Record<string,string> = {
  CRITICAL:'#ef4444', HIGH:'#f97316', MEDIUM:'#eab308', LOW:'#6b7280',
}
const ACTION_ICON: Record<string,string> = {
  RECEIVED:'📥', STATUS_CHANGED:'🔄', COMPLETED:'✅', DISPATCHED:'🚀', INFO:'💬',
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  return `${d}d`
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleString('es', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
}

function renderMsg(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function OficinaPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [areas, setAreas]           = useState<Area[]>([])
  const [loading, setLoading]       = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activity, setActivity]     = useState<ActivityEvent[]>([])
  const [actLoading, setActLoading] = useState(false)
  const [messages, setMessages]     = useState<OrionMsg[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [areaMessages, setAreaMessages] = useState<OrionMsg[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [membersOpen, setMembersOpen] = useState(false)
  const [roomSearch, setRoomSearch] = useState("")
  const [roomsOpen, setRoomsOpen] = useState(true)
  const [configOpen, setConfigOpen] = useState(true)

  // Config / Agentes view
  const [sideView, setSideView] = useState<'rooms' | 'agentes' | 'directory'>('rooms')
  const [councilBadge, setCouncilBadge] = useState<{ debating: number; escalated: number; total: number }>({ debating: 0, escalated: 0, total: 0 })
  const [agents, setAgents]     = useState<Agent[]>([])
  const [selAgent, setSelAgent] = useState<Agent | null>(null)
  const [form, setForm]         = useState<Partial<Agent>>({})
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  useEffect(() => {
    fetch('/api/areas').then(r => r.json()).then((data: Area[]) => {
      setAreas(data)
      setLoading(false)
      const roomSlug = searchParams.get('room')
      if (roomSlug) {
        const all = [...data, ...data.flatMap(a => a.subAreas)]
        const match = all.find(a => a.slug === roomSlug)
        if (match) { setSelectedId(match.id); return }
      }
      if (data.length) setSelectedId(data[0].id)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    function fetchBadge() {
      fetch('/api/council/badge').then(r => r.json()).then(d => setCouncilBadge(d)).catch(() => {})
    }
    fetchBadge()
    const t = setInterval(fetchBadge, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (sideView === 'agentes' && agents.length === 0) {
      fetch('/api/agents').then(r => r.json()).then((data: Agent[]) => {
        setAgents(data)
        if (data.length) { setSelAgent(data[0]); setForm(data[0]) }
      })
    }
  }, [sideView])

  const selected = areas.find(a => a.id === selectedId)
    ?? areas.flatMap(a => a.subAreas).find(s => s.id === selectedId) as Area | undefined

  const isBacklogHub = selected?.slug === 'backlog-hub'
  const isConsejo = selected?.slug === 'consejo'

  useEffect(() => {
    if (!selected?.slug || sideView !== 'rooms') return
    if (isBacklogHub) {
      setMsgLoading(true)
      fetch('/api/orion/messages').then(r => r.json()).then((d: OrionMsg[]) => {
        setMessages(d.reverse()); setMsgLoading(false)
      }).catch(() => setMsgLoading(false))
    } else {
      setActLoading(true); setActivity([]); setAreaMessages([])
      fetch(`/api/areas/${selected.slug}/activity`)
        .then(r => r.json()).then(d => { setActivity(d.events ?? []); setActLoading(false) })
        .catch(() => setActLoading(false))
      fetch(`/api/orion/messages?areaId=${selected.id}`)
        .then(r => r.json()).then((d: OrionMsg[]) => setAreaMessages(d.reverse()))
        .catch(() => {})
    }
  }, [selected?.slug, sideView])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function selectAgent(a: Agent) { setSelAgent(a); setForm(a); setSaved(false) }

  async function saveAgent() {
    if (!selAgent) return
    setSaving(true)
    await fetch(`/api/agents/${selAgent.slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setAgents(prev => prev.map(a => a.slug === selAgent.slug ? { ...a, ...form } as Agent : a))
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full text-gray-500 gap-2">
      <Loader2 size={16} className="animate-spin" />
      <span className="text-sm">Cargando oficina virtual...</span>
    </div>
  )

  const selectedFull = areas.find(a => a.id === selectedId)
  const subAgents = selectedFull?.subAreas.filter(s => s.agentName) ?? []
  const activeTasks  = activity.filter(e => e.status === 'IN_PROGRESS')
  const backlogTasks = activity.filter(e => e.status === 'BACKLOG' || e.status === 'TODO')
  const doneTasks    = activity.filter(e => e.status === 'DONE').slice(0, 5)

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: Sidebar ── */}
      <div className="w-56 flex-shrink-0 flex flex-col border-r border-white/5 overflow-hidden overflow-x-hidden"
           style={{ background: 'rgba(0,0,0,0.25)' }}>

        {/* Rooms section */}
        <div className="overflow-y-auto overflow-x-hidden">
          <button onClick={() => setRoomsOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 pt-4 pb-2 group hover:opacity-80 transition-opacity">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Rooms</span>
            <ChevronRight size={10} className="text-gray-600 transition-transform flex-shrink-0"
              style={{ transform: roomsOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
          </button>
          {roomsOpen && areas.map(area => (
            <div key={area.id}>
              <button
                onClick={() => { setSelectedId(area.id); setSideView('rooms'); router.replace('/oficina?room=' + area.slug, { scroll: false }) }}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-left group hover:bg-white/5"
                style={sideView === 'rooms' && selectedId === area.id
                  ? { background: area.color+'22', color: area.color }
                  : { color: '#6b7280' }}>
                <span className="text-[12px] font-semibold flex-1 truncate group-hover:text-gray-300 transition-colors">{area.name}</span>
                {area.slug === 'consejo' ? (
                  councilBadge.total > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: councilBadge.escalated > 0 ? '#ef444430' : '#f59e0b30', color: councilBadge.escalated > 0 ? '#ef4444' : '#f59e0b' }}>{councilBadge.total}</span>
                  )
                ) : (
                  area.activeItems > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: area.color+'30', color: area.color }}>{area.activeItems}</span>
                  )
                )}
              </button>
              {area.subAreas.map(sub => (
                <button key={sub.id}
                  onClick={() => { setSelectedId(sub.id); setSideView('rooms'); router.replace('/oficina?room=' + sub.slug, { scroll: false }) }}
                  className="w-full flex items-center gap-2 pl-7 pr-3 py-1 rounded-lg transition-all text-left group hover:bg-white/5"
                  style={sideView === 'rooms' && selectedId === sub.id
                    ? { background: sub.color+'18', color: sub.color }
                    : { color: '#4b5563' }}>
                  <span className="text-[11px] flex-1 truncate group-hover:text-gray-400 transition-colors">{sub.name}</span>
                  {sub.activeItems > 0 && (
                    <span className="text-[9px] px-1 rounded-full flex-shrink-0"
                          style={{ background: sub.color+'25', color: sub.color }}>{sub.activeItems}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Config section */}
        <div className="flex-shrink-0 border-t border-white/5 pt-1 pb-2">
          <button onClick={() => setConfigOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 pt-2 pb-1 group hover:opacity-80 transition-opacity">
            <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Config</span>
            <ChevronRight size={10} className="text-gray-600 transition-transform flex-shrink-0"
              style={{ transform: configOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
          </button>
          {configOpen && <button
            onClick={() => setSideView('agentes')}
            className="w-full flex items-center gap-2 px-3 py-1.5 transition-all text-left group hover:bg-white/5"
            style={sideView === 'agentes' ? { color: '#a78bfa' } : { color: '#4b5563' }}>
            <Bot size={12} className="flex-shrink-0 group-hover:text-gray-400 transition-colors" />
            <span className="text-[11px] group-hover:text-gray-400 transition-colors">Agents</span>
          </button>}
          {configOpen && <button
            onClick={() => setSideView('directory')}
            className="w-full flex items-center gap-2 px-3 py-1.5 transition-all text-left group hover:bg-white/5"
            style={sideView === 'directory' ? { color: '#a78bfa' } : { color: '#4b5563' }}>
            <Network size={12} className="flex-shrink-0 group-hover:text-gray-400 transition-colors" />
            <span className="text-[11px] group-hover:text-gray-400 transition-colors">Directory</span>
          </button>}
        </div>
      </div>

      {/* ── Center: Content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── AGENTES VIEW ── */}
        {sideView === 'agentes' ? (
          <div className="flex h-full overflow-hidden">
            {/* Agent list */}
            <div className="w-48 flex-shrink-0 border-r border-white/5 overflow-y-auto"
                 style={{ background: 'rgba(0,0,0,0.15)' }}>
              <div className="px-3 pt-4 pb-2">
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">Agentes</span>
              </div>
              {agents.map(a => (
                <button key={a.id} onClick={() => selectAgent(a)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-all hover:bg-white/5 group"
                  style={selAgent?.id === a.id ? { background: 'rgba(167,139,250,0.1)', color: '#a78bfa' } : { color: '#6b7280' }}>
                  <Circle size={6} className="flex-shrink-0"
                    style={{ fill: a.status === 'ACTIVE' ? '#10b981' : '#374151', color: a.status === 'ACTIVE' ? '#10b981' : '#374151' }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold truncate group-hover:text-gray-300 transition-colors">{a.name}</div>
                    <div className="text-[9px] text-gray-700 truncate">{a.role}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Agent edit form */}
            {selAgent ? (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-[13px] font-black text-gray-200">{selAgent.name}</h2>
                      <p className="text-[10px] text-gray-600 font-mono">{selAgent.slug}</p>
                    </div>
                    <button onClick={saveAgent} disabled={saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                      style={saved
                        ? { background: 'rgba(16,185,129,0.15)', color: '#10b981' }
                        : { background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
                      {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                      {saved ? 'Guardado' : saving ? 'Guardando...' : 'Guardar'}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Name + Status row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Nombre</label>
                        <input value={form.name ?? ''}
                          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full rounded-lg px-3 py-2 text-[12px] text-gray-200 border border-white/8 outline-none focus:border-purple-500/40 transition-colors"
                          style={{ background: 'rgba(255,255,255,0.04)' }} />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Status</label>
                        <select value={form.status ?? 'ACTIVE'}
                          onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                          className="w-full rounded-lg px-3 py-2 text-[12px] text-gray-200 border border-white/8 outline-none focus:border-purple-500/40 transition-colors"
                          style={{ background: 'rgba(20,20,35,0.95)' }}>
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="INACTIVE">INACTIVE</option>
                          <option value="STANDBY">STANDBY</option>
                        </select>
                      </div>
                    </div>

                    {/* Role */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Rol</label>
                      <input value={form.role ?? ''}
                        onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2 text-[12px] text-gray-200 border border-white/8 outline-none focus:border-purple-500/40 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.04)' }} />
                    </div>

                    {/* Area */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Área</label>
                      <input value={form.area ?? ''}
                        onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                        className="w-full rounded-lg px-3 py-2 text-[12px] text-gray-200 border border-white/8 outline-none focus:border-purple-500/40 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.04)' }} />
                    </div>

                    {/* Personality */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Personalidad</label>
                      <textarea value={form.personality ?? ''}
                        onChange={e => setForm(f => ({ ...f, personality: e.target.value }))}
                        rows={3}
                        className="w-full rounded-lg px-3 py-2 text-[12px] text-gray-200 border border-white/8 outline-none focus:border-purple-500/40 transition-colors resize-none"
                        style={{ background: 'rgba(255,255,255,0.04)' }} />
                    </div>

                    {/* System Prompt */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">System Prompt</label>
                      <textarea value={form.systemPrompt ?? ''}
                        onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                        rows={6}
                        className="w-full rounded-lg px-3 py-2 text-[11px] text-gray-300 font-mono border border-white/8 outline-none focus:border-purple-500/40 transition-colors resize-none leading-relaxed"
                        style={{ background: 'rgba(255,255,255,0.03)' }} />
                    </div>

                    {/* Discord + Vault row */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Discord User ID</label>
                        <input value={form.discordUserId ?? ''}
                          onChange={e => setForm(f => ({ ...f, discordUserId: e.target.value || null }))}
                          className="w-full rounded-lg px-3 py-2 text-[12px] text-gray-200 border border-white/8 outline-none focus:border-purple-500/40 transition-colors"
                          style={{ background: 'rgba(255,255,255,0.04)' }} />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Vault Path</label>
                        <input value={form.vaultPath ?? ''}
                          onChange={e => setForm(f => ({ ...f, vaultPath: e.target.value || null }))}
                          className="w-full rounded-lg px-3 py-2 text-[12px] text-gray-200 font-mono border border-white/8 outline-none focus:border-purple-500/40 transition-colors"
                          style={{ background: 'rgba(255,255,255,0.04)' }} />
                      </div>
                    </div>

                    {/* Task Types */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-1">Task Types <span className="normal-case font-normal">(separados por coma)</span></label>
                      <input value={(form.taskTypes ?? []).join(', ')}
                        onChange={e => setForm(f => ({ ...f, taskTypes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                        className="w-full rounded-lg px-3 py-2 text-[12px] text-gray-200 border border-white/8 outline-none focus:border-purple-500/40 transition-colors"
                        style={{ background: 'rgba(255,255,255,0.04)' }} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-700 text-sm">
                Seleccioná un agente
              </div>
            )}
          </div>

        ) : sideView === 'directory' ? (
          /* ── DIRECTORY VIEW ── */
          <DirectoryView areas={areas} />

        ) : (
          /* ── ROOMS VIEW ── */
          <>
            {selected ? (
              <>
                {/* Room header */}
                <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 flex-shrink-0"
                     style={{ background: selected.color+'08' }}>
                  {/* Room name */}
                  <div className="flex-shrink-0">
                    <div className="text-[11px] font-black tracking-widest uppercase" style={{ color: selected.color }}>{selected.name}</div>
                  </div>

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Right: unified toolbar */}
                  <div className="flex items-center h-7 gap-0.5 flex-shrink-0 rounded-xl px-1"
                       style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>

                    {/* Metrics chips */}
                    {selected.activeItems > 0 && (
                      <div className="flex items-center gap-1 px-2 h-full border-r border-white/6">
                        <span className="text-[12px] font-black leading-none" style={{ color: selected.color }}>{selected.activeItems}</span>
                        <span className="text-[8px] text-gray-600 uppercase tracking-wide">act</span>
                      </div>
                    )}
                    {selected.inProgressItems > 0 && (
                      <div className="flex items-center gap-1 px-2 h-full border-r border-white/6">
                        <span className="text-[12px] font-black text-blue-400 leading-none">{selected.inProgressItems}</span>
                        <span className="text-[8px] text-gray-600 uppercase tracking-wide">wip</span>
                      </div>
                    )}

                    {/* Icon buttons */}
                    <button className="flex items-center justify-center w-7 h-full hover:bg-white/8 rounded-lg transition-colors group" title="Configuración">
                      <SlidersHorizontal size={13} className="text-gray-500 group-hover:text-gray-300 transition-colors" />
                    </button>
                    <button className="flex items-center justify-center w-7 h-full hover:bg-white/8 rounded-lg transition-colors group" title="Notificaciones">
                      <Bell size={13} className="text-gray-500 group-hover:text-gray-300 transition-colors" />
                    </button>
                    <button onClick={() => setMembersOpen(o => !o)}
                      className="flex items-center justify-center w-7 h-full hover:bg-white/8 rounded-lg transition-colors group"
                      title={membersOpen ? 'Ocultar members' : 'Mostrar members'}
                      style={membersOpen ? { background: 'rgba(255,255,255,0.1)' } : {}}>
                      <Users size={13} className="group-hover:text-gray-300 transition-colors"
                        style={{ color: membersOpen ? '#e5e7eb' : '#6b7280' }} />
                    </button>

                    {/* Search */}
                    <div className="flex items-center gap-1.5 pl-1.5 pr-2 h-full border-l border-white/6 w-40 focus-within:w-52 transition-all duration-200">
                      <Search size={11} className="text-gray-400 flex-shrink-0" />
                      <input
                        value={roomSearch}
                        onChange={e => setRoomSearch(e.target.value)}
                        placeholder={`Search...`}
                        className="bg-transparent outline-none text-[11px] text-gray-300 placeholder-gray-400 w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* ── CHAT MODE for backlog-hub / council ── */}
                {isConsejo ? (
                  <CouncilView />
                ) : isBacklogHub ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                      {msgLoading && (
                        <div className="flex items-center gap-2 text-gray-600 text-xs py-6 justify-center">
                          <Loader2 size={12} className="animate-spin" /> Cargando mensajes...
                        </div>
                      )}
                      {!msgLoading && messages.length === 0 && (
                        <div className="text-center text-gray-700 text-xs py-10">
                          <div className="text-3xl mb-2">📭</div>
                          Orión aún no ha registrado actividad.<br/>
                          Asigná una tarea a Orión para que comience a narrar.
                        </div>
                      )}
                      {messages.map((msg, i) => {
                        const prevMsg = messages[i - 1]
                        const sameDay = prevMsg && new Date(prevMsg.createdAt).toDateString() === new Date(msg.createdAt).toDateString()
                        const accent: Record<string,string> = {
                          RECEIVED:'#6b7280', SPRINT_ASSIGNED:'#6b7280', STATUS_CHANGED:'#60a5fa', COMPLETED:'#10b981',
                          DISPATCHED:'#f59e0b', INFO:'#6b7280',
                        }
                        const accentColor = accent[msg.actionType] ?? '#6b7280'
                        return (
                          <div key={msg.id}>
                            {!sameDay && (
                              <div className="flex items-center gap-2 my-2">
                                <div className="h-px flex-1 bg-white/10" />
                                <span className="text-[9px] text-gray-500 uppercase tracking-widest">
                                  {new Date(msg.createdAt).toLocaleDateString('es', { weekday:'long', day:'2-digit', month:'long' })}
                                </span>
                                <div className="h-px flex-1 bg-white/10" />
                              </div>
                            )}
                            <div className="mb-3 rounded-xl border overflow-hidden"
                                 style={{ borderColor: accentColor + '30', background: 'rgba(0,0,0,0.2)' }}>
                              <div className="flex items-center justify-between px-3 py-1.5 border-b"
                                   style={{ background: accentColor + '10', borderColor: accentColor + '20' }}>
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {(() => {
                                    const meta = msg.metadata as any
                                    const toArea = meta?.toArea ? String(meta.toArea).toUpperCase() : null
                                    const isAdminToOrion = msg.actionType === 'RECEIVED' || msg.actionType === 'SPRINT_ASSIGNED'
                                    const from = isAdminToOrion ? 'ADMIN' : 'ORIÓN'
                                    const to = isAdminToOrion ? 'ORIÓN'
                                      : msg.actionType === 'DISPATCHED' ? (toArea ?? 'AREA')
                                      : msg.actionType === 'COMPLETED' ? 'DONE'
                                      : msg.actionType === 'STATUS_CHANGED' ? 'STATUS'
                                      : 'LOG'
                                    return (
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <span className="text-[9px] font-black tracking-widest uppercase" style={{ color: accentColor, opacity: 0.6 }}>{from}</span>
                                        <span className="text-[10px] font-black mx-0.5" style={{ color: accentColor }}>→</span>
                                        <span className="text-[9px] font-black tracking-widest uppercase" style={{ color: accentColor }}>{to}</span>
                                      </div>
                                    )
                                  })()}
                                  {msg.backlogItemTitle && (
                                    <div className="flex items-center gap-1.5 min-w-0 border-l pl-1.5" style={{ borderColor: accentColor + '30' }}>
                                      <span className="text-[9px] font-black tracking-widest uppercase flex-shrink-0" style={{ color: accentColor, opacity: 0.5 }}>
                                        {msg.actionType === 'SPRINT_ASSIGNED' ? 'Sprint:' : 'Task:'}
                                      </span>
                                      <span className="text-[10px] font-semibold truncate" style={{ color: accentColor + 'cc' }}>{msg.backlogItemTitle}</span>
                                      {msg.backlogItemCode && (
                                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                                              style={{ background: accentColor + '15', color: accentColor }}>
                                          {msg.backlogItemCode}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <span className="text-[9px] text-gray-600 flex-shrink-0 ml-2">{formatDate(msg.createdAt)}</span>
                              </div>
                              <div className="px-3 py-2.5">
                                <p className="text-[11px] text-gray-300 leading-relaxed"
                                   dangerouslySetInnerHTML={{ __html: renderMsg(msg.message) }} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="px-4 py-3 border-t border-white/5 flex-shrink-0">
                      <div className="rounded-xl px-3 py-2 text-[12px] text-gray-600 border border-white/5"
                           style={{ background: 'rgba(255,255,255,0.03)' }}>
                        Los mensajes de Orión se generan automáticamente al asignar tareas...
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── REGULAR ROOM mode — two-column layout ── */
                  <div className="flex-1 flex overflow-hidden">
                    {/* ── LEFT: De Orión chat ── */}
                    <div className="flex-1 flex flex-col overflow-hidden border-r border-white/5">
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {areaMessages.length === 0 && !actLoading && (
                          <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-12">
                            <span className="text-2xl opacity-20">📭</span>
                            <p className="text-[11px] text-gray-700">Sin mensajes de Orión para este room.</p>
                          </div>
                        )}
                        {areaMessages.map(msg => (
                          <div key={msg.id} className="rounded-xl border px-3 py-2.5"
                               style={{ background: 'rgba(245,158,11,0.05)', borderColor: 'rgba(245,158,11,0.15)' }}>
                            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                              <span className="text-[9px] font-black tracking-widest uppercase" style={{ color: '#f59e0b', opacity: 0.6 }}>ORIÓN</span>
                              <span className="text-[10px] font-black mx-0.5" style={{ color: '#f59e0b' }}>→</span>
                              <span className="text-[9px] font-black tracking-widest uppercase" style={{ color: '#f59e0b' }}>{selected?.name?.toUpperCase()}</span>
                              {msg.backlogItemTitle && (
                                <div className="flex items-center gap-1.5 min-w-0 border-l pl-1.5 ml-0.5" style={{ borderColor: 'rgba(245,158,11,0.3)' }}>
                                  <span className="text-[9px] font-black tracking-widest uppercase flex-shrink-0" style={{ color: '#f59e0b', opacity: 0.5 }}>Task:</span>
                                  <span className="text-[10px] font-semibold truncate" style={{ color: 'rgba(245,158,11,0.8)' }}>{msg.backlogItemTitle}</span>
                                  {msg.backlogItemCode && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                                          style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                                      {msg.backlogItemCode}
                                    </span>
                                  )}
                                </div>
                              )}
                              <span className="text-[9px] text-gray-600 flex-shrink-0 ml-auto">{new Date(msg.createdAt).toLocaleString('es', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                            </div>
                            <p className="text-[11px] text-gray-300 leading-relaxed"
                               dangerouslySetInnerHTML={{ __html: msg.message.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── RIGHT: Widgets ── */}
                    <div className="w-56 flex-shrink-0 flex flex-col divide-y divide-white/5 overflow-y-auto">
                      {/* Widget 1: En Progreso */}
                      <div className="p-3">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2.5">
                          En progreso{activeTasks.length > 0 ? ` · ${activeTasks.length}` : ''}
                        </div>
                        {actLoading ? (
                          <div className="flex items-center gap-1.5 text-gray-700 text-[10px] py-2">
                            <Loader2 size={10} className="animate-spin" /> Cargando...
                          </div>
                        ) : activeTasks.length === 0 ? (
                          <p className="text-[10px] text-gray-700 py-1">Sin tareas activas.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {activeTasks.map(t => (
                              <div key={t.id} className="rounded-lg px-2.5 py-2 border"
                                   style={{ background: 'rgba(249,115,22,0.05)', borderColor: 'rgba(249,115,22,0.12)' }}>
                                <div className="flex items-start gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0"
                                       style={{ background: PRIORITY_DOT[t.priority] ?? '#6b7280' }} />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-semibold text-orange-300 leading-snug line-clamp-2">{t.title}</div>
                                    {t.assigneeName && (
                                      <div className="text-[9px] text-gray-500 mt-0.5 truncate">{t.assigneeName}</div>
                                    )}
                                    {t.sprint && (
                                      <div className="text-[9px] text-gray-700 mt-0.5 truncate">{t.sprint}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-[9px] text-gray-700 mt-1 text-right">{timeAgo(t.timestamp)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Widget 2: Actividad Reciente */}
                      <div className="p-3 flex-1">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-2.5">Actividad reciente</div>
                        {actLoading ? (
                          <div className="flex items-center gap-1.5 text-gray-700 text-[10px] py-2">
                            <Loader2 size={10} className="animate-spin" /> Cargando...
                          </div>
                        ) : activity.length === 0 ? (
                          <p className="text-[10px] text-gray-700 py-1">Sin actividad.</p>
                        ) : (
                          <div className="space-y-0.5">
                            {activity.slice(0, 15).map(e => (
                              <div key={e.id + e.timestamp} className="flex items-start gap-1.5 py-1.5 border-b border-white/[0.03]">
                                <span className="text-[11px] flex-shrink-0 mt-0.5 leading-none">{EVENT_ICON[e.type] ?? '📌'}</span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-[9px] font-semibold mr-1" style={{ color: STATUS_COLOR[e.status] ?? '#6b7280' }}>{e.label}</span>
                                  <span className="text-[10px] text-gray-400 leading-snug line-clamp-2">{e.title}</span>
                                </div>
                                <span className="text-[9px] text-gray-700 flex-shrink-0 mt-0.5">{timeAgo(e.timestamp)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-600 text-sm">Seleccioná un room</div>
            )}
          </>
        )}
      </div>

      {/* ── Right: Members panel ── */}
      <div className="flex-shrink-0 flex flex-col border-l border-white/5 overflow-y-auto transition-all duration-200"
           style={{ background: 'rgba(0,0,0,0.15)', width: membersOpen ? '12rem' : '0', overflow: 'hidden' }}>
        {membersOpen && (
          <div className="px-3 pt-3 pb-1 flex-shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Members</span>
          </div>
        )}
          <div className="px-3 pb-4">
            {selected?.agentName && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selected.agentStatus === 'ACTIVE' ? 'bg-green-400' : 'bg-gray-600'}`} />
                  <span className="text-[12px] font-bold text-gray-300">{selected.agentName}</span>
                </div>
                <div className="text-[10px] text-gray-600 ml-4">{selected.agentStatus === 'ACTIVE' ? '🟢 Activo' : '⚫ Idle'}</div>
                <div className="mt-2 ml-4 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-600">En progreso</span>
                    <span className="text-orange-400 font-bold">{selected.inProgressItems}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-600">Activas</span>
                    <span style={{ color: selected.color }} className="font-bold">{selected.activeItems}</span>
                  </div>
                </div>
              </div>
            )}
            {subAgents.length > 0 && (
              <>
                <div className="text-[10px] font-bold uppercase tracking-widest text-gray-700 mb-2 mt-1">Sub-agentes</div>
                <div className="space-y-2">
                  {subAgents.map(sub => (
                    <div key={sub.id} className="flex items-center gap-2">
                      <span className="text-sm">{sub.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold truncate" style={{ color: sub.color }}>{sub.agentName}</div>
                        <div className="text-[9px] text-gray-600">{sub.name}</div>
                      </div>
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sub.agentStatus === 'ACTIVE' ? 'bg-green-400' : 'bg-gray-700'}`} />
                    </div>
                  ))}
                </div>
              </>
            )}
            {!selected?.agentName && subAgents.length === 0 && (
              <div className="text-[11px] text-gray-700">Sin agente asignado</div>
            )}
          </div>
      </div>
    </div>
  )
}

export default function OficinePage() {
  return (
    <Suspense fallback={null}>
      <OficinaPageInner />
    </Suspense>
  )
}
