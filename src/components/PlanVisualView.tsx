'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ListChecks, ChevronRight } from 'lucide-react'
import SesionPopup, { renderBody } from '@/components/SesionPopup'
import {
  parseSesionesSection,
  extractObjetivo,
  type SesionCard,
} from '@/lib/sesionParser'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Seccion { title: string; body: string }

// ─── Plan parser ──────────────────────────────────────────────────────────────

function parsePlan(md: string): { titulo: string; secciones: Seccion[] } {
  const lines = md.split('\n')
  let titulo = '', sawH1 = false, inFence = false
  const secciones: Seccion[] = []
  let current: Seccion | null = null
  for (const raw of lines) {
    if (/^\s*```/.test(raw)) inFence = !inFence
    if (inFence) { if (current) current.body += raw + '\n'; continue }
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
