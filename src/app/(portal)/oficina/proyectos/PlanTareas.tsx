'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X, ListPlus, AlertTriangle } from 'lucide-react'
import { post, ErrorApi } from './api'

interface Tarea { title: string; description: string; priority: string; areaSlug: string; duplicada: boolean }

const PRIORIDADES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const ETIQ_PRIO: Record<string, string> = { LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Crítica' }

// Coordinador: la IA propone las tareas que salen de la conversación; la persona revisa, edita y
// aprueba. Recién al aprobar se crean en el backlog del proyecto.
export default function PlanTareas({ proyectoId, sesionId, onCerrar, onAplicado }: {
  proyectoId: string; sesionId: string; onCerrar: () => void; onAplicado: (n: number) => void
}) {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [sel, setSel] = useState<boolean[]>([])
  const [notas, setNotas] = useState('')
  const [aplicando, setAplicando] = useState(false)

  useEffect(() => {
    let vivo = true
    post<{ tareas: Tarea[]; notas: string }>(`/api/proyectos/${proyectoId}/sesiones/${sesionId}/plan`)
      .then(r => { if (!vivo) return; setTareas(r.tareas); setSel(r.tareas.map(t => !t.duplicada)); setNotas(r.notas) })
      .catch((e: Error) => { if (vivo) setError(e.message) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [proyectoId, sesionId])

  const elegidas = tareas.filter((_, i) => sel[i])
  const editar = (i: number, patch: Partial<Tarea>) => setTareas(prev => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)))

  async function aplicar() {
    if (elegidas.length === 0 || aplicando) return
    setAplicando(true); setError(null)
    try {
      await post(`/api/proyectos/${proyectoId}/sesiones/${sesionId}/plan/aplicar`, { tareas: elegidas })
      onAplicado(elegidas.length)
    } catch (e) { setError(e instanceof ErrorApi ? e.message : 'No se pudieron crear las tareas'); setAplicando(false) }
  }

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70" onClick={onCerrar}>
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-white/10 shadow-2xl" style={{ background: 'linear-gradient(135deg, rgba(30,27,60,0.98), rgba(12,10,28,0.99))' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ListPlus size={16} className="text-indigo-300" />
            <h3 className="text-sm font-semibold text-gray-100">Convertir el plan en tareas de backlog</h3>
          </div>
          <button onClick={onCerrar} className="text-gray-500 hover:text-gray-200"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
          {cargando && <div className="flex items-center gap-2 text-xs text-gray-400 py-8 justify-center"><Loader2 size={14} className="animate-spin" /> El coordinador está armando el plan con el contexto del proyecto… (puede tardar hasta un minuto)</div>}
          {error && <p className="text-xs text-red-400 flex items-start gap-1.5"><AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />{error}</p>}
          {!cargando && tareas.length > 0 && (
            <>
              <p className="text-[11px] text-gray-500">Revisa y edita. Solo se crean las marcadas, en estado <b className="text-gray-300">BACKLOG</b> y sin asignar (listas para el despachador). Las marcadas como «ya existe» coinciden con una tarea del backlog.</p>
              {notas && <p className="text-[11px] text-indigo-200/80 rounded-lg px-3 py-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>{notas}</p>}
              {tareas.map((t, i) => (
                <div key={i} className="rounded-xl p-3 space-y-1.5" style={{ background: sel[i] ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${sel[i] ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.07)'}` }}>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={!!sel[i]} onChange={e => setSel(prev => prev.map((v, j) => (j === i ? e.target.checked : v)))} className="mt-1 accent-indigo-500" />
                    <input value={t.title} onChange={e => editar(i, { title: e.target.value })} maxLength={140}
                      className="flex-1 bg-transparent text-[12px] font-medium text-gray-100 outline-none border-b border-transparent focus:border-indigo-500/50" />
                    <select value={t.priority} onChange={e => editar(i, { priority: e.target.value })} className="text-[10px] rounded-md px-1.5 py-1 text-gray-300 outline-none" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      {PRIORIDADES.map(p => <option key={p} value={p}>{ETIQ_PRIO[p]}</option>)}
                    </select>
                  </div>
                  {t.duplicada && <p className="ml-6 text-[10px] text-amber-400">Ya existe una tarea con este nombre en el backlog.</p>}
                  <textarea value={t.description} onChange={e => editar(i, { description: e.target.value })} rows={2}
                    className="ml-6 w-[calc(100%-1.5rem)] bg-transparent text-[11px] text-gray-400 outline-none resize-y rounded-md px-2 py-1 border border-white/5 focus:border-indigo-500/40" />
                </div>
              ))}
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-white/10">
          <span className="text-[11px] text-gray-500">{elegidas.length} de {tareas.length} seleccionadas</span>
          <div className="flex gap-2">
            <button onClick={onCerrar} className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-200 border border-white/10">Cancelar</button>
            <button onClick={aplicar} disabled={elegidas.length === 0 || aplicando || cargando}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 flex items-center gap-1.5" style={{ background: 'rgba(99,102,241,0.85)' }}>
              {aplicando && <Loader2 size={12} className="animate-spin" />} Crear {elegidas.length} tarea{elegidas.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
