'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Sparkles, Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import { api, post } from './api'

// Pruebas de aceptación derivadas de los requisitos del PRD (MASD-0026-0004). La IA las propone; una persona las aprueba antes
// de construir. Las aprobadas entran en el contexto de la tarea que construye el requisito y se exportan a spec/pruebas/.

interface Prueba { id: string; reqCodigo: string; titulo: string; escenarios: string; estado: string; decididoPor: string | null }
interface Requisito { codigo: string; texto: string; criterio: string; prioridad: string }
interface Datos { pruebas: Prueba[]; requisitos: Requisito[]; cobertura: { requisitos: number; conPruebaAprobada: number } }

const COLOR: Record<string, { txt: string; color: string }> = {
  PROPUESTA: { txt: 'Por aprobar', color: '#fbbf24' }, APROBADA: { txt: 'Aprobada', color: '#34d399' }, DESCARTADA: { txt: 'Descartada', color: '#64748b' },
}

export default function SeccionPruebas({ proyectoId }: { proyectoId: string }) {
  const [d, setD] = useState<Datos | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generando, setGenerando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [decidiendo, setDecidiendo] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try { setD(await api<Datos>(`/api/proyectos/${proyectoId}/pruebas-aceptacion`)) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron leer las pruebas') }
  }, [proyectoId])
  useEffect(() => { void cargar() }, [cargar])

  async function generar() {
    setGenerando(true); setError(null); setMensaje(null)
    try {
      const r = await post<{ generadas: number; mensaje?: string }>(`/api/proyectos/${proyectoId}/pruebas-aceptacion/generar`, {})
      setMensaje(r.generadas ? `${r.generadas} propuesta(s) nuevas para revisar.` : (r.mensaje ?? 'Nada que generar.')); await cargar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron generar') }
    finally { setGenerando(false) }
  }

  async function decidir(p: Prueba, accion: 'aprobar' | 'descartar') {
    setDecidiendo(p.id); setError(null)
    try { await post(`/api/proyectos/${proyectoId}/pruebas-aceptacion/${p.id}/decidir`, { accion }); await cargar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo decidir') }
    finally { setDecidiendo(null) }
  }

  if (!d && !error) return <div className="py-3 flex justify-center text-[#7f8a9c]"><Loader2 className="animate-spin" size={14} /></div>
  const visibles = (d?.pruebas ?? []).filter(p => p.estado !== 'DESCARTADA')

  return (
    <section aria-label="Pruebas de aceptación" className="rounded-lg px-3 py-2 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <h3 className="text-[10px] uppercase tracking-wider font-semibold text-[#7f8a9c]">Pruebas de aceptación</h3>
      {error && <p role="alert" className="text-[11px] text-red-300">{error}</p>}
      {d && (
        <>
          <p className="text-[11px] text-[#9aa6b8]"><b className="text-gray-200">{d.cobertura.conPruebaAprobada}</b> de {d.cobertura.requisitos} requisitos con pruebas aprobadas.</p>
          <button onClick={() => void generar()} disabled={generando || d.cobertura.requisitos === 0} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] text-indigo-100 hover:bg-white/10 disabled:opacity-50" style={{ border: '1px solid rgba(99,102,241,0.45)' }}>
            {generando ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}Derivar pruebas con IA</button>
          {d.cobertura.requisitos === 0 && <p className="text-[10.5px] text-[#7f8a9c]">El PRD todavía no tiene requisitos.</p>}
          {mensaje && <p role="status" className="text-[11px] text-emerald-300">{mensaje}</p>}
          <ul className="space-y-1">
            {visibles.map(p => {
              const ab = abierto === p.id
              const c = COLOR[p.estado] ?? COLOR.PROPUESTA
              return (
                <li key={p.id} className="rounded-md" style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <button onClick={() => setAbierto(ab ? null : p.id)} aria-expanded={ab} className="w-full flex items-start gap-1.5 px-2 py-1.5 text-left">
                    {ab ? <ChevronDown size={12} className="mt-0.5 flex-shrink-0 text-[#7f8a9c]" /> : <ChevronRight size={12} className="mt-0.5 flex-shrink-0 text-[#7f8a9c]" />}
                    <span className="min-w-0 flex-1"><span className="block text-[11.5px] text-gray-100"><span className="font-mono text-[10.5px] text-indigo-300">{p.reqCodigo}</span> · {p.titulo}</span>
                      <span className="text-[10px]" style={{ color: c.color }}>● {c.txt}</span></span>
                  </button>
                  {ab && (
                    <div className="px-2.5 pb-2 space-y-1.5">
                      <pre className="whitespace-pre-wrap break-words text-[10.5px] text-gray-300 font-sans">{p.escenarios}</pre>
                      {p.estado === 'PROPUESTA' && (
                        <div className="flex gap-1.5">
                          <button onClick={() => void decidir(p, 'aprobar')} disabled={decidiendo === p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] text-emerald-200 disabled:opacity-50" style={{ border: '1px solid rgba(52,211,153,0.4)' }}><Check size={11} />Aprobar</button>
                          <button onClick={() => void decidir(p, 'descartar')} disabled={decidiendo === p.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] text-[#9aa6b8] disabled:opacity-50" style={{ border: '1px solid rgba(255,255,255,0.12)' }}><X size={11} />Descartar</button>
                        </div>)}
                      {p.estado === 'APROBADA' && p.decididoPor && <p className="text-[10px] text-[#7f8a9c]">Aprobada por {p.decididoPor}</p>}
                    </div>)}
                </li>)
            })}
          </ul>
        </>)}
    </section>
  )
}
