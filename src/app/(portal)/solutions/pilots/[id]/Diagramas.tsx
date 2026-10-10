'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Plus, Sparkles, Trash2, Copy, AlertTriangle } from 'lucide-react'
import { apiJson } from './hubApi'

export type TipoDiagrama = 'er' | 'secuencia' | 'c4' | 'flujo'
export interface Diagrama { id: string; titulo: string; tipo: TipoDiagrama; codigo: string }

export const ETIQUETA_DIAGRAMA: Record<TipoDiagrama, string> = { er: 'Modelo de datos (ER)', secuencia: 'Secuencia', c4: 'Contexto / contenedores (C4)', flujo: 'Flujo de proceso' }

const MERMAID_URL: string = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs'
let mermaidP: Promise<{ initialize: (c: unknown) => void; render: (id: string, code: string) => Promise<{ svg: string }> }> | null = null
function cargarMermaid() {
  if (!mermaidP) {
    // Se carga bajo demanda desde el CDN (no entra en el paquete de la aplicación).
    mermaidP = import(/* webpackIgnore: true */ /* turbopackIgnore: true */ MERMAID_URL).then(m => {
      const mm = m.default ?? m
      mm.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict', fontFamily: 'inherit' })
      return mm
    })
    mermaidP.catch(() => { mermaidP = null })
  }
  return mermaidP
}

/** Dibuja código Mermaid. Si no se puede (sin red o sintaxis inválida) muestra el motivo y el código queda editable. */
export function MermaidView({ codigo }: { codigo: string }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const n = useRef(0)
  useEffect(() => {
    let vivo = true
    const t = setTimeout(async () => {
      if (!codigo.trim()) { setSvg(''); setError(''); return }
      try {
        const m = await cargarMermaid()
        const r = await m.render(`mmd-${Date.now()}-${n.current++}`, codigo)
        if (vivo) { setSvg(r.svg); setError('') }
      } catch (e) {
        if (vivo) { setSvg(''); setError(e instanceof Error ? e.message.split('\n')[0] : 'No se pudo dibujar el diagrama') }
      }
    }, 350)
    return () => { vivo = false; clearTimeout(t) }
  }, [codigo])
  if (error) return <p className="text-xs text-amber-400 flex items-start gap-1.5"><AlertTriangle size={13} className="mt-0.5 flex-shrink-0" /> No se pudo dibujar: {error}</p>
  if (!svg) return <p className="text-xs text-gray-600">{codigo.trim() ? 'Dibujando…' : 'Sin código todavía.'}</p>
  return <div className="overflow-auto rounded-lg bg-gray-950/60 border border-gray-800 p-3 [&_svg]:max-w-full [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: svg }} />
}

let contador = 0
const nuevoId = () => `dg${Date.now().toString(36)}${(contador++).toString(36)}`

export default function Diagramas({ solucionId, diagramas, onChange, guardarAntes, hayCambios }: {
  solucionId: string
  diagramas: Diagrama[]
  onChange: (d: Diagrama[]) => void
  /** La IA lee lo guardado: antes de generar se guardan los cambios pendientes. */
  guardarAntes: () => Promise<boolean>
  hayCambios: boolean
}) {
  const [generando, setGenerando] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [tipoNuevo, setTipoNuevo] = useState<TipoDiagrama>('er')
  const [instruccion, setInstruccion] = useState('')

  const actualizar = (id: string, p: Partial<Diagrama>) => onChange(diagramas.map(d => (d.id === id ? { ...d, ...p } : d)))

  const agregar = (d?: Partial<Diagrama>) => {
    const nuevo: Diagrama = { id: nuevoId(), titulo: d?.titulo ?? ETIQUETA_DIAGRAMA[tipoNuevo], tipo: d?.tipo ?? tipoNuevo, codigo: d?.codigo ?? '' }
    onChange([...diagramas, nuevo])
    return nuevo
  }

  async function generar() {
    setError('')
    setGenerando('nuevo')
    try {
      if (hayCambios && !(await guardarAntes())) { setError('No se pudo guardar antes de generar; revisa el aviso de guardado.'); return }
      const r = await apiJson<{ tipo: TipoDiagrama; codigo: string }>(`/api/soluciones/${solucionId}/diagramas-generate`, { method: 'POST', body: JSON.stringify({ tipo: tipoNuevo, instruccion: instruccion.trim() || undefined }) })
      agregar({ tipo: r.tipo, codigo: r.codigo, titulo: ETIQUETA_DIAGRAMA[r.tipo] })
      setInstruccion('')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo generar el diagrama') }
    finally { setGenerando(null) }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 leading-relaxed">
        Diagramas en texto (Mermaid): modelo de datos, secuencias, contexto del sistema y flujos. Son parte del diseño: los agentes que construyen el proyecto los reciben como referencia y salen en el paquete de entrega. Se guardan con «Guardar cambios».
      </p>
      <div className="flex flex-wrap items-end gap-2 bg-gray-950 border border-gray-800 rounded-xl p-3">
        <div>
          <label className="block text-[11px] text-gray-500 mb-1">Tipo</label>
          <select value={tipoNuevo} onChange={e => setTipoNuevo(e.target.value as TipoDiagrama)} className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500">
            {(Object.keys(ETIQUETA_DIAGRAMA) as TipoDiagrama[]).map(t => <option key={t} value={t}>{ETIQUETA_DIAGRAMA[t]}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] text-gray-500 mb-1">Instrucción para la IA (opcional; en secuencia y flujo, describe qué proceso)</label>
          <input value={instruccion} onChange={e => setInstruccion(e.target.value)} placeholder="Ej.: el flujo de cotización desde que el vendedor crea la oportunidad hasta que el cliente la aprueba"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-cyan-500" />
        </div>
        <button type="button" onClick={() => void generar()} disabled={generando !== null}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 text-xs font-semibold disabled:opacity-50">
          {generando ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {generando ? 'Generando…' : 'Generar con IA'}
        </button>
        <button type="button" onClick={() => agregar()} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-200 text-xs font-medium">
          <Plus size={12} /> En blanco
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {diagramas.length === 0 && <p className="text-gray-600 text-sm text-center py-6">Sin diagramas todavía.</p>}
      {diagramas.map(d => (
        <div key={d.id} className="bg-gray-950 border border-gray-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input value={d.titulo} onChange={e => actualizar(d.id, { titulo: e.target.value })} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm font-medium focus:outline-none focus:border-cyan-500" />
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-gray-700 text-gray-400">{ETIQUETA_DIAGRAMA[d.tipo] ?? d.tipo}</span>
            <button type="button" title="Copiar el código" onClick={() => { void navigator.clipboard?.writeText(d.codigo) }} className="w-7 h-7 rounded-lg bg-gray-900 text-gray-500 hover:text-cyan-300 flex items-center justify-center"><Copy size={13} /></button>
            <button type="button" title="Eliminar" onClick={() => { if (window.confirm('¿Eliminar este diagrama?')) onChange(diagramas.filter(x => x.id !== d.id)) }} className="w-7 h-7 rounded-lg bg-gray-900 text-gray-500 hover:text-red-400 flex items-center justify-center"><Trash2 size={13} /></button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <textarea value={d.codigo} onChange={e => actualizar(d.id, { codigo: e.target.value })} rows={12} spellCheck={false}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-200 text-xs font-mono focus:outline-none focus:border-cyan-500 resize-y" />
            <MermaidView codigo={d.codigo} />
          </div>
        </div>
      ))}
    </div>
  )
}
