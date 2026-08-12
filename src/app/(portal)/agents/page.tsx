'use client'

import { useEffect, useState } from 'react'
import { Bot, Plus, X, Circle, Pencil, Power, Cpu } from 'lucide-react'

interface Agent {
  id: string; slug: string; name: string; role: string; area: string
  personality: string; systemPrompt?: string; llmModel?: string; taskTypes: string[]
  repos: string[]; discordUserId?: string; vaultPath?: string; status: string
}

const ROLE_COLOR: Record<string, string> = {
  Sales: 'text-orange-400', Operations: 'text-blue-400', Marketing: 'text-pink-400',
  Admin: 'text-violet-400', Finance: 'text-emerald-400',
}

const LLM_MODELS = [
  { value: '', label: 'Default (claude CLI)' },
  { value: 'claude-opus-5', label: 'Claude Opus 5 — máxima capacidad' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 — balanceado' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — rápido' },
  { value: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
]

const emptyForm = (): Partial<Agent> => ({
  slug: '', name: '', role: 'Sales', area: '', personality: '',
  systemPrompt: '', llmModel: '', taskTypes: [], repos: [], status: 'ACTIVE',
})

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Agent | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<Partial<Agent>>(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = () => {
    fetch('/api/agents').then(r => r.json()).then(d => { setAgents(d); setLoading(false) })
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(emptyForm()); setShowModal(true) }
  const openEdit = (a: Agent) => { setForm({ ...a }); setShowModal(true) }

  const save = async () => {
    setSaving(true)
    const isEdit = !!form.id
    await fetch(isEdit ? `/api/agents/${form.slug}` : '/api/agents', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, taskTypes: form.taskTypes ?? [], repos: form.repos ?? [] }),
    })
    setSaving(false); setShowModal(false); load()
  }

  const toggleStatus = async (a: Agent) => {
    const newStatus = a.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    await fetch(`/api/agents/${a.slug}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
    load(); if (selected?.slug === a.slug) setSelected({ ...selected, status: newStatus })
  }

  const modelLabel = (m?: string) => LLM_MODELS.find(o => o.value === m)?.label ?? m ?? 'Default'

  return (
    <div className="flex h-full min-h-screen bg-[#0a0a0f]">
      {/* Lista */}
      <div className="w-80 flex-shrink-0 border-r border-white/5 flex flex-col">
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-violet-400" />
            <span className="text-sm font-semibold text-white">Agentes SAGE</span>
            <span className="text-xs text-gray-500 bg-white/5 rounded-full px-2 py-0.5">{agents.length}</span>
          </div>
          <button onClick={openCreate} className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors px-2 py-1 rounded-lg hover:bg-violet-500/10">
            <Plus size={13} /> Nuevo
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {loading ? <p className="text-xs text-gray-600 text-center py-8">Cargando...</p> : agents.map(a => (
            <button key={a.slug} onClick={() => setSelected(a)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${selected?.slug === a.slug ? 'bg-white/5' : 'hover:bg-white/[0.03]'}`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}>
                {a.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{a.name}</p>
                <p className={`text-xs ${ROLE_COLOR[a.role] ?? 'text-gray-400'}`}>{a.role}</p>
              </div>
              <Circle size={7} className={a.status === 'ACTIVE' ? 'fill-emerald-400 text-emerald-400' : 'fill-gray-600 text-gray-600'} />
            </button>
          ))}
        </div>
      </div>

      {/* Detalle */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="max-w-2xl mx-auto py-8 px-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
                  style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}>
                  {selected.name[0]}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">{selected.name}</h1>
                  <p className={`text-sm font-medium ${ROLE_COLOR[selected.role] ?? 'text-gray-400'}`}>{selected.role} · {selected.area}</p>
                  {selected.llmModel && (
                    <div className="flex items-center gap-1 mt-1">
                      <Cpu size={10} className="text-violet-400" />
                      <span className="text-xs text-violet-400 font-mono">{selected.llmModel}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(selected)} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"><Pencil size={14} /></button>
                <button onClick={() => toggleStatus(selected)} className={`p-2 rounded-lg transition-colors ${selected.status === 'ACTIVE' ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-500 hover:bg-white/5'}`}><Power size={14} /></button>
              </div>
            </div>

            <div className="space-y-4">
              <Section title="Personalidad">
                <p className="text-sm text-gray-300 leading-relaxed">{selected.personality}</p>
              </Section>
              <Section title="Modelo LLM (Council)">
                <div className="flex items-center gap-2">
                  <Cpu size={12} className="text-violet-400 flex-shrink-0" />
                  <span className="text-sm text-gray-300 font-mono">{modelLabel(selected.llmModel)}</span>
                </div>
                {!selected.llmModel && <p className="text-xs text-gray-600 mt-1">Usa el modelo por defecto del claude CLI</p>}
              </Section>
              {selected.systemPrompt && (
                <Section title="System Prompt">
                  <pre className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap font-mono bg-black/20 rounded-xl p-4">{selected.systemPrompt}</pre>
                </Section>
              )}
              <Section title="Tipos de tarea">
                <div className="flex flex-wrap gap-2">
                  {selected.taskTypes.map(t => <span key={t} className="text-xs px-2 py-1 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/20">{t}</span>)}
                </div>
              </Section>
              <Section title="Repositorios asignados">
                {selected.repos.length === 0
                  ? <p className="text-xs text-gray-600">Sin repos asignados aún</p>
                  : selected.repos.map(r => <p key={r} className="text-xs text-blue-400 font-mono">{r}</p>)}
              </Section>
              <div className="grid grid-cols-2 gap-4">
                <Section title="Vault Obsidian"><p className="text-xs text-gray-400 font-mono">{selected.vaultPath ?? '—'}</p></Section>
                <Section title="Discord ID"><p className="text-xs text-gray-400 font-mono">{selected.discordUserId ?? '—'}</p></Section>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <Bot size={32} className="text-gray-700 mb-3" />
            <p className="text-sm text-gray-600">Seleccioná un agente para ver su perfil</p>
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-lg rounded-3xl border border-white/8 overflow-hidden" style={{ background: 'rgba(15,15,25,0.95)' }}>
            <div className="flex items-center justify-between px-6 py-4 rounded-t-3xl"
              style={{ background: 'linear-gradient(90deg,rgba(139,92,246,0.18) 0%,rgba(168,85,247,0.12) 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.3)' }}>
                  <Bot size={14} className="text-violet-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-wide">{form.id ? 'EDITAR AGENTE' : 'NUEVO AGENTE'}</h2>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Configura el perfil del agente SAGE</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Slug" value={form.slug ?? ''} onChange={v => setForm(f => ({ ...f, slug: v }))} placeholder="ares" disabled={!!form.id} />
                <Field label="Nombre" value={form.name ?? ''} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Ares" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Rol</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-white focus:outline-none">
                    {['Sales','Operations','Marketing','Admin','Finance'].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <Field label="Área" value={form.area ?? ''} onChange={v => setForm(f => ({ ...f, area: v }))} placeholder="Comercial" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Personalidad</label>
                <textarea rows={3} value={form.personality ?? ''} onChange={e => setForm(f => ({ ...f, personality: e.target.value }))}
                  placeholder="Descripción de personalidad y comportamiento..."
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-white resize-none placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50" />
              </div>
              {/* Modelo LLM */}
              <div>
                <label className="text-xs text-gray-400 mb-1 flex items-center gap-1"><Cpu size={10} /> Modelo LLM (Council)</label>
                <select value={form.llmModel ?? ''} onChange={e => setForm(f => ({ ...f, llmModel: e.target.value }))}
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50">
                  {LLM_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <p className="text-[10px] text-gray-600 mt-1">Se usa al llamar claude CLI en el motor de debate del Council</p>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">System Prompt</label>
                <textarea rows={4} value={form.systemPrompt ?? ''} onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))}
                  placeholder="Prompt completo de sistema para Claude Code headless..."
                  className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-white font-mono text-xs resize-none placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50" />
              </div>
              <Field label="Vault Path" value={form.vaultPath ?? ''} onChange={v => setForm(f => ({ ...f, vaultPath: v }))} placeholder="/agents/ares/" />
              <Field label="Discord User ID" value={form.discordUserId ?? ''} onChange={v => setForm(f => ({ ...f, discordUserId: v }))} placeholder="123456789" />
            </div>
            <div className="px-6 py-4 border-t border-white/5 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors">Cancelar</button>
              <button onClick={save} disabled={saving}
                className="px-5 py-2 text-sm font-semibold text-white rounded-xl transition-colors"
                style={{ background: 'rgba(139,92,246,0.25)', border: '1px solid rgba(139,92,246,0.4)' }}>
                {saving ? 'Guardando...' : form.id ? 'Guardar cambios' : 'Crear agente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, disabled }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean }) {
  return (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
        className="w-full bg-white/5 border border-white/8 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/50 disabled:opacity-40" />
    </div>
  )
}
