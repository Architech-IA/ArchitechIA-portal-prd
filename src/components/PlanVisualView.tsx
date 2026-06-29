'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ListChecks } from 'lucide-react'

interface Seccion {
  title: string
  body: string
}

function parsePlan(md: string): { titulo: string; secciones: Seccion[] } {
  const lines = md.split('\n')
  let titulo = ''
  let sawH1 = false
  const secciones: Seccion[] = []
  let current: Seccion | null = null

  for (const raw of lines) {
    const h1 = raw.match(/^#\s+(.*)/)
    const h2 = raw.match(/^##\s+(.*)/)
    if (h1 && !sawH1) {
      titulo = h1[1].trim()
      sawH1 = true
      continue
    }
    if (h2) {
      if (current) secciones.push(current)
      current = { title: h2[1].trim(), body: '' }
      continue
    }
    if (!current) current = { title: 'Resumen', body: '' }
    current.body += raw + '\n'
  }
  if (current) secciones.push(current)
  return { titulo, secciones }
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*([^*]+)\*\*|`([^`]+)`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0
  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    if (match[2] !== undefined) {
      parts.push(<strong key={`${keyPrefix}-${i++}`} className="text-white font-semibold">{match[2]}</strong>)
    } else if (match[3] !== undefined) {
      parts.push(<code key={`${keyPrefix}-${i++}`} className="bg-gray-800 text-cyan-300 px-1 py-0.5 rounded text-[11px]">{match[3]}</code>)
    }
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

interface Segment {
  type: 'code' | 'text'
  content: string
}

/** Separa bloques ```fenced``` (preservando indentación/saltos de línea) del resto del texto normal. */
function splitFences(body: string): Segment[] {
  const lines = body.split('\n')
  const segments: Segment[] = []
  let buffer: string[] = []
  let fenceBuffer: string[] = []
  let inFence = false

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (!inFence) {
        if (buffer.length) segments.push({ type: 'text', content: buffer.join('\n') })
        buffer = []
        fenceBuffer = []
        inFence = true
      } else {
        segments.push({ type: 'code', content: fenceBuffer.join('\n') })
        inFence = false
      }
      continue
    }
    if (inFence) fenceBuffer.push(line)
    else buffer.push(line)
  }
  if (inFence && fenceBuffer.length) segments.push({ type: 'code', content: fenceBuffer.join('\n') })
  if (buffer.length) segments.push({ type: 'text', content: buffer.join('\n') })
  return segments
}

function renderTextBlock(block: string, blockKey: string) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    const isList = lines.length > 0 && lines.every(l => /^[-*]\s+/.test(l))
    const isOrdered = lines.length > 0 && lines.every(l => /^\d+\.\s+/.test(l))

    if (isList) {
      return (
        <ul key={blockKey} className="space-y-1.5 my-2">
          {lines.map((l, li) => (
            <li key={li} className="flex gap-2 text-sm text-gray-300">
              <span className="mt-2 w-1 h-1 rounded-full bg-cyan-500 flex-shrink-0" />
              <span>{renderInline(l.replace(/^[-*]\s+/, ''), `${blockKey}-${li}`)}</span>
            </li>
          ))}
        </ul>
      )
    }
    if (isOrdered) {
      return (
        <ol key={blockKey} className="space-y-1.5 my-2">
          {lines.map((l, li) => (
            <li key={li} className="flex gap-2 text-sm text-gray-300">
              <span className="text-cyan-400 font-mono text-xs flex-shrink-0 mt-0.5">{li + 1}.</span>
              <span>{renderInline(l.replace(/^\d+\.\s+/, ''), `${blockKey}-${li}`)}</span>
            </li>
          ))}
        </ol>
      )
    }

    const subHeader = lines[0]?.match(/^###\s+(.*)/)
    if (subHeader) {
      const rest = lines.slice(1).join(' ')
      return (
        <div key={blockKey} className="my-2.5">
          <p className="text-cyan-300 text-[11px] font-semibold uppercase tracking-wide mb-1">{subHeader[1]}</p>
          {rest && <p className="text-sm text-gray-300 leading-relaxed">{renderInline(rest, `${blockKey}-r`)}</p>}
        </div>
      )
    }

    return (
      <p key={blockKey} className="text-sm text-gray-300 leading-relaxed my-2">
        {renderInline(lines.join(' '), blockKey)}
      </p>
    )
}

function renderBody(body: string, keyPrefix: string) {
  const segments = splitFences(body)
  const hasContent = segments.some(s => s.content.trim())
  if (!hasContent) {
    return <p className="text-gray-600 text-sm italic">Sin contenido en esta sección.</p>
  }
  return segments.map((seg, si) => {
    const segKey = `${keyPrefix}-seg${si}`
    if (seg.type === 'code') {
      if (!seg.content.trim()) return null
      return (
        <pre key={segKey} className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2.5 my-2.5 overflow-x-auto">
          <code className="text-[11px] text-cyan-200 font-mono whitespace-pre">{seg.content}</code>
        </pre>
      )
    }
    const blocks = seg.content.trim().split(/\n\s*\n/).filter(Boolean)
    return blocks.map((block, bi) => renderTextBlock(block, `${segKey}-b${bi}`))
  })
}

export default function PlanVisualView({ markdown }: { markdown: string }) {
  const { titulo, secciones } = useMemo(() => parsePlan(markdown), [markdown])
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true, 1: true })

  function toggle(i: number) {
    setOpen(prev => ({ ...prev, [i]: !prev[i] }))
  }

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
      {titulo && (
        <h3 className="text-white font-bold text-base mb-1">{titulo}</h3>
      )}
      {secciones.map((s, i) => {
        const isOpen = !!open[i]
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
                {renderBody(s.body, `s${i}`)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
