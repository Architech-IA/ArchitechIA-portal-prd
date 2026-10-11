'use client'

import { useState } from 'react'
import { Loader2, Sparkles, Check, X, Bot } from 'lucide-react'
import { apiJson, fechaCorta } from './hubApi'
import { resumenOps, type Propuesta } from './espacio'

export interface TareaLigada { id: string; taskCode: string | null; title: string; status: string }
const COLOR_TAREA: Record<string, string> = { DONE: 'text-emerald-300', IN_PROGRESS: 'text-orange-300', FAILED: 'text-red-300', BLOCKED: 'text-amber-300', BACKLOG: 'text-gray-400' }
const ORIGEN: Record<string, string> = { TAREA: 'Una tarea del motor', REVISOR: 'El revisor del motor', PERSONA: 'Una persona' }

/** Lo que el motor quiere cambiar en este artefacto. Nada se aplica hasta que una persona lo acepta. */
export default function DockAgente({ propuestas, sucio, tareas, onDecidida }: {
  propuestas: Propuesta[]
  /** El artefacto tiene cambios sin guardar: aceptar ahora los chocaría con lo que cambia el servidor. */
  sucio: boolean
  tareas: TareaLigada[]
  onDecidida: (aceptada: boolean) => void
}) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [nota, setNota] = useState<Record<string, string>>({})

  async function decidir(p: Propuesta, accion: 'aceptar' | 'rechazar') {
    setOcupado(p.id + accion); setError('')
    try { await apiJson(`/api/propuestas-artefacto/${p.id}/decidir`, { method: 'POST', body: JSON.stringify({ accion, nota: nota[p.id]?.trim() || undefined }) }); onDecidida(accion === 'aceptar') }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo decidir') }
    finally { setOcupado(null) }
  }

  const recientes = tareas.slice(-3).reverse()
  return (
    <div className="rounded-xl border border-gray-700/70 bg-gray-950/50 p-3 space-y-2 print:hidden">
      <p className="text-xs font-semibold text-gray-300 flex items-center gap-1.5"><Sparkles size={13} className="text-orange-400" /> Agente del motor</p>
      {propuestas.length === 0 && <p className="text-xs text-gray-500">Sin propuestas pendientes para este artefacto. Cuando el motor detecte que lo construido se aparta de lo documentado, la propuesta aparece aquí con lo que cambiaría.</p>}
      {propuestas.map(p => (
        <div key={p.id} className="rounded-lg border border-dashed border-amber-600/50 bg-amber-900/10 p-2.5 space-y-1.5">
          <p className="text-xs text-amber-200 font-medium">{p.titulo}</p>
          <p className="text-[11px] text-gray-500">{ORIGEN[p.origen] ?? p.origen} · {fechaCorta(p.createdAt)}</p>
          {p.detalle && <p className="text-xs text-gray-300 whitespace-pre-line">{p.detalle}</p>}
          <div className="flex flex-wrap gap-1">
            {resumenOps(p).map((t, i) => <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-300">+ {t}</span>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input value={nota[p.id] ?? ''} onChange={e => setNota({ ...nota, [p.id]: e.target.value })} placeholder="Nota (opcional)"
              className="flex-1 min-w-[140px] bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-cyan-500" />
            <button type="button" onClick={() => void decidir(p, 'aceptar')} disabled={ocupado !== null || sucio} title={sucio ? 'Guarda primero los cambios de este artefacto' : 'Aplicar la propuesta'}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-800/60 hover:bg-emerald-700/60 text-emerald-100 text-xs disabled:opacity-40">
              {ocupado === p.id + 'aceptar' ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Aceptar
            </button>
            <button type="button" onClick={() => void decidir(p, 'rechazar')} disabled={ocupado !== null}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-700 text-gray-300 hover:bg-white/5 text-xs disabled:opacity-40"><X size={11} /> Rechazar</button>
          </div>
        </div>
      ))}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {recientes.length > 0 && (
        <div className="border-t border-white/5 pt-2">
          <p className="text-[11px] text-gray-500 mb-1 flex items-center gap-1"><Bot size={11} /> Últimas tareas del motor en este proyecto</p>
          <ul className="space-y-0.5">{recientes.map(t => <li key={t.id} className="text-[11px] text-gray-400 truncate"><span className={COLOR_TAREA[t.status] ?? 'text-gray-400'}>{t.status}</span> · {t.taskCode ? `${t.taskCode} — ` : ''}{t.title}</li>)}</ul>
        </div>
      )}
    </div>
  )
}
