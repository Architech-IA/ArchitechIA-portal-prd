'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Copy, Check } from 'lucide-react'
import { type SesionCard, parseSesionFields } from '@/lib/sesionParser'

// ─── Tab definitions ─────────────────────────────────────────────────────────

const BASE_TABS = [
  { key: 'objetivo',      label: 'Objetivo'      },
  { key: 'prerequisitos', label: 'Prerequisitos' },
  { key: 'prompt',        label: 'Prompt'        },
  { key: 'tareas',        label: 'Tareas'        },
  { key: 'validacion',    label: 'Validación'    },
  { key: 'estado',        label: 'Estado'        },
] as const

type BaseTabKey = typeof BASE_TABS[number]['key']
type TabKey = BaseTabKey | string

export interface ExtraTab {
  key: string
  label: string
  content: React.ReactNode
}

// ─── Inline renderers ────────────────────────────────────────────────────────

function renderInline(text: string, kp: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g
  let last = 0, i = 0; let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2]) parts.push(<strong key={`${kp}-${i++}`} className="text-white font-semibold">{m[2]}</strong>)
    else if (m[3]) parts.push(<code key={`${kp}-${i++}`} className="bg-gray-800 text-cyan-300 px-1 py-0.5 rounded text-[11px]">{m[3]}</code>)
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

interface Segment { type: 'code' | 'text'; content: string }

function splitFences(body: string): Segment[] {
  const lines = body.split('\n')
  const segs: Segment[] = []
  let buf: string[] = [], fence: string[] = [], inFence = false
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (!inFence) { if (buf.length) segs.push({ type: 'text', content: buf.join('\n') }); buf = []; fence = []; inFence = true }
      else { segs.push({ type: 'code', content: fence.join('\n') }); inFence = false }
      continue
    }
    if (inFence) fence.push(line); else buf.push(line)
  }
  if (inFence && fence.length) segs.push({ type: 'code', content: fence.join('\n') })
  if (buf.length) segs.push({ type: 'text', content: buf.join('\n') })
  return segs
}

function renderTextBlock(block: string, bk: string) {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
  const isList    = lines.length > 0 && lines.every(l => /^[-*]\s+/.test(l))
  const isOrdered = lines.length > 0 && lines.every(l => /^\d+\.\s+/.test(l))
  if (isList) return (
    <ul key={bk} className="space-y-1.5 my-2">
      {lines.map((l, li) => (
        <li key={li} className="flex gap-2 text-sm text-gray-300">
          <span className="mt-2 w-1 h-1 rounded-full bg-cyan-500 flex-shrink-0" />
          <span>{renderInline(l.replace(/^[-*]\s+/, ''), `${bk}-${li}`)}</span>
        </li>
      ))}
    </ul>
  )
  if (isOrdered) return (
    <ol key={bk} className="space-y-1.5 my-2">
      {lines.map((l, li) => (
        <li key={li} className="flex gap-2 text-sm text-gray-300">
          <span className="text-cyan-400 font-mono text-xs flex-shrink-0 mt-0.5">{li + 1}.</span>
          <span>{renderInline(l.replace(/^\d+\.\s+/, ''), `${bk}-${li}`)}</span>
        </li>
      ))}
    </ol>
  )
  const sh = lines[0]?.match(/^###\s+(.*)/)
  if (sh) return (
    <div key={bk} className="my-2.5">
      <p className="text-cyan-300 text-[11px] font-semibold uppercase tracking-wide mb-1">{sh[1]}</p>
      {lines.slice(1).join(' ') && <p className="text-sm text-gray-300 leading-relaxed">{renderInline(lines.slice(1).join(' '), `${bk}-r`)}</p>}
    </div>
  )
  return (
    <p key={bk} className="text-sm text-gray-300 leading-relaxed my-2">
      {renderInline(lines.join(' '), bk)}
    </p>
  )
}

export function renderBody(body: string, kp: string) {
  const segs = splitFences(body)
  if (!segs.some(s => s.content.trim()))
    return <p className="text-gray-600 text-sm italic">Sin contenido.</p>
  return segs.map((seg, si) => {
    const sk = `${kp}-seg${si}`
    if (seg.type === 'code') {
      if (!seg.content.trim()) return null
      return (
        <pre key={sk} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 my-2.5 overflow-x-auto">
          <code className="text-[11px] text-cyan-200 font-mono whitespace-pre">{seg.content}</code>
        </pre>
      )
    }
    return seg.content.trim().split(/\n\s*\n/).filter(Boolean)
      .map((bl, bi) => renderTextBlock(bl, `${sk}-b${bi}`))
  })
}

// ─── SesionPopup ─────────────────────────────────────────────────────────────

interface SesionPopupProps {
  sesion: SesionCard
  onClose: () => void
  /** Optional extra tab rendered after the 6 base tabs (e.g. "Gestión" with dates/state/backlog) */
  extraTab?: ExtraTab
  /** Which tab to open by default */
  defaultTab?: TabKey
}

export default function SesionPopup({ sesion, onClose, extraTab, defaultTab }: SesionPopupProps) {
  const allTabs = extraTab
    ? [...BASE_TABS, { key: extraTab.key, label: extraTab.label }]
    : [...BASE_TABS]

  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab ?? 'objetivo')
  const [copied, setCopied]       = useState(false)
  const fields = useMemo(() => parseSesionFields(sesion.body), [sesion.body])

  function copyPrompt() {
    if (!fields.prompt) return
    navigator.clipboard.writeText(fields.prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function tabContent() {
    if (extraTab && activeTab === extraTab.key) return <div className="py-1">{extraTab.content}</div>
    switch (activeTab as BaseTabKey) {
      case 'objetivo':
        return <div className="py-1">{renderBody(fields.objetivo, 'tab-obj')}</div>
      case 'prerequisitos':
        return <div className="py-1">{renderBody(fields.prerequisitos, 'tab-pre')}</div>
      case 'prompt':
        return (
          <div className="py-1 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500">Copiá este prompt al iniciar la sesión en Claude Code.</p>
              <button
                onClick={copyPrompt}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/25 transition-colors flex-shrink-0"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <pre className="bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 overflow-x-auto max-h-72 overflow-y-auto">
              <code className="text-[11px] text-cyan-200 font-mono whitespace-pre leading-relaxed">{fields.prompt}</code>
            </pre>
          </div>
        )
      case 'tareas':
        return <div className="py-1">{renderBody(fields.tareas, 'tab-tar')}</div>
      case 'validacion':
        return <div className="py-1">{renderBody(fields.validacion, 'tab-val')}</div>
      case 'estado':
        return <div className="py-1">{renderBody(fields.estado, 'tab-est')}</div>
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800 flex-shrink-0">
          <span className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 text-sm font-bold flex items-center justify-center flex-shrink-0">
            {sesion.numero}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Sesión {sesion.numero}</p>
            <h3 className="text-white font-semibold text-sm leading-tight">{sesion.titulo}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-800 overflow-x-auto flex-shrink-0 px-1 scrollbar-none">
          {allTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={[
                'px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                activeTab === tab.key
                  ? 'text-cyan-300 border-cyan-400 bg-cyan-500/5'
                  : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-gray-700',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tabContent()}
        </div>
      </div>
    </div>,
    document.body
  )
}
