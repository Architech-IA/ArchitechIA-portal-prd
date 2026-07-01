'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ListChecks, X, Copy, Check, ChevronRight } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Seccion { title: string; body: string }
interface SesionCard { numero: string; titulo: string; body: string }

interface SesionFields {
  objetivo: string
  prerequisitos: string
  prompt: string      // clean text inside ``` for copy/display
  tareas: string
  validacion: string
  estado: string
}

const TABS = [
  { key: 'objetivo',      label: 'Objetivo'      },
  { key: 'prerequisitos', label: 'Prerequisitos' },
  { key: 'prompt',        label: 'Prompt'        },
  { key: 'tareas',        label: 'Tareas'        },
  { key: 'validacion',    label: 'Validación'    },
  { key: 'estado',        label: 'Estado'        },
] as const

type TabKey = typeof TABS[number]['key']

// ─── Plan parser ──────────────────────────────────────────────────────────────

function parsePlan(md: string): { titulo: string; secciones: Seccion[] } {
  const lines = md.split('\n')
  let titulo = '', sawH1 = false
  const secciones: Seccion[] = []
  let current: Seccion | null = null
  for (const raw of lines) {
    const h1 = raw.match(/^#\s+(.*)/)
    const h2 = raw.match(/^##\s+(.*)/)
    if (h1 && !sawH1) { titulo = h1[1].trim(); sawH1 = true; continue }
    if (h2) {
      if (current && !(current.title === 'Resumen' && !current.body.trim())) secciones.push(current)
      current = { title: h2[1].trim(), body: '' }; continue
    }
    if (!current) current = { title: 'Resumen', body: '' }
    current.body += raw + '\n'
  }
  if (current && !(current.title === 'Resumen' && !current.body.trim())) secciones.push(current)
  return { titulo, secciones }
}

// ─── Sesiones parsers ─────────────────────────────────────────────────────────

function parseSesionesSection(body: string): { intro: string; sesiones: SesionCard[] } {
  const lines = body.split('\n')
  let intro = '', inIntro = true
  let current: SesionCard | null = null
  const sesiones: SesionCard[] = []
  for (const line of lines) {
    const h3 = line.match(/^###\s+Sesión\s+(\d+)\s*[—\-]+\s*(.+)/)
    if (h3) {
      if (current) sesiones.push(current)
      current = { numero: h3[1], titulo: h3[2].trim(), body: '' }
      inIntro = false; continue
    }
    if (inIntro) intro += line + '\n'
    else if (current) current.body += line + '\n'
  }
  if (current) sesiones.push(current)
  return { intro, sesiones }
}

function parseSesionFields(body: string): SesionFields {
  const FIELDS = [
    { key: 'objetivo',      re: /^\*\*Objetivo\*\*\s*:/         },
    { key: 'prerequisitos', re: /^\*\*Prerequisitos\*\*\s*:/    },
    { key: 'prompt',        re: /^\*\*Prompt de inicio\*\*\s*:/ },
    { key: 'tareas',        re: /^\*\*Tareas\*\*\s*:/           },
    { key: 'validacion',    re: /^\*\*Validación\*\*\s*:/       },
    { key: 'estado',        re: /^\*\*Estado al finalizar\*\*\s*:/ },
  ]
  const result: Record<string, string> = {}
  let currentKey = '', buffer: string[] = []
  const flush = () => { if (currentKey) result[currentKey] = buffer.join('\n').trim() }

  for (const line of body.split('\n')) {
    let matched = false
    for (const { key, re } of FIELDS) {
      if (re.test(line)) {
        flush(); currentKey = key
        buffer = [line.replace(re, '').trim()]
        matched = true; break
      }
    }
    if (!matched && currentKey) buffer.push(line)
  }
  flush()

  // Strip ``` fences from prompt so we get clean text for copy & display
  const promptClean = (result['prompt'] || '')
    .replace(/^```[^\n]*\n?/, '').replace(/\n?```\s*$/, '').trim()

  return {
    objetivo:      result['objetivo']      || '',
    prerequisitos: result['prerequisitos'] || '',
    prompt:        promptClean,
    tareas:        result['tareas']        || '',
    validacion:    result['validacion']    || '',
    estado:        result['estado']        || '',
  }
}

function extractObjetivo(body: string): string {
  const m = body.match(/\*\*Objetivo\*\*\s*:\s*([^\n]+)/)
  return m ? m[1].trim() : ''
}

// ─── Body renderer ────────────────────────────────────────────────────────────

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

function renderBody(body: string, kp: string) {
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

// ─── Session popup with tabs ──────────────────────────────────────────────────

function SesionPopup({ sesion, onClose }: { sesion: SesionCard; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<TabKey>('objetivo')
  const [copied, setCopied]       = useState(false)
  const fields = useMemo(() => parseSesionFields(sesion.body), [sesion.body])

  function copyPrompt() {
    if (!fields.prompt) return
    navigator.clipboard.writeText(fields.prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function tabContent() {
    switch (activeTab) {
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
          {TABS.map(tab => (
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

// ─── Sesiones section ─────────────────────────────────────────────────────────

function SesionesView({ body, sectionIndex }: { body: string; sectionIndex: number }) {
  const { intro, sesiones } = useMemo(() => parseSesionesSection(body), [body])
  const [selected, setSelected] = useState<SesionCard | null>(null)

  return (
    <div>
      {intro.trim() && (
        <div className="mb-4">{renderBody(intro, `ses-intro-${sectionIndex}`)}</div>
      )}
      <div className="space-y-2">
        {sesiones.map((s) => {
          const objetivo = extractObjetivo(s.body)
          return (
            <button
              key={s.numero}
              type="button"
              onClick={() => setSelected(s)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-950 border border-gray-800 hover:border-cyan-700/50 hover:bg-gray-900/80 transition-all text-left group"
            >
              <span className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500/20 transition-colors">
                {s.numero}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-tight truncate">Sesión {s.numero} — {s.titulo}</p>
                {objetivo && <p className="text-xs text-gray-500 mt-0.5 truncate">{objetivo}</p>}
              </div>
              <ChevronRight size={14} className="text-gray-600 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
            </button>
          )
        })}
      </div>
      {selected && <SesionPopup sesion={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function PlanVisualView({ markdown }: { markdown: string }) {
  const { titulo, secciones } = useMemo(() => parsePlan(markdown), [markdown])
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true, 1: true })
  const toggle = (i: number) => setOpen(prev => ({ ...prev, [i]: !prev[i] }))

  if (!markdown.trim()) {
    return (
      <div className="text-center py-10">
        <ListChecks size={28} className="text-gray-700 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No hay plan de trabajo todavía.</p>
        <p className="text-gray-600 text-xs mt-1">Escribilo o importalo desde la vista Markdown.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {titulo && <h3 className="text-white font-bold text-base mb-1">{titulo}</h3>}
      {secciones.map((s, i) => {
        const isOpen     = !!open[i]
        const isSesiones = s.title.toLowerCase().includes('sesiones de trabajo')
        return (
          <div key={i} className="bg-gray-950 border border-gray-700 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-900/60 transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-md bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 text-[11px] font-bold flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-white">{s.title}</span>
              </span>
              <ChevronDown
                size={16}
                className="text-gray-500 flex-shrink-0 transition-transform"
                style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-0.5 border-t border-gray-800/60">
                {isSesiones
                  ? <SesionesView body={s.body} sectionIndex={i} />
                  : renderBody(s.body, `s${i}`)
                }
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
