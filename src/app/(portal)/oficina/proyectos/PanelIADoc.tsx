'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, Wand2, PenLine, Loader2, Send, Check, MessageCircle, RefreshCw } from 'lucide-react'
import { post } from './api'
import Microfono from '@/components/Microfono'

// Asistente de IA de un documento de fase: por sección o del documento entero.
// «Generar» hace una entrevista corta; «Mejorar» aplica lo que la persona pida. La IA nunca guarda: devuelve el texto y la persona lo aplica a la hoja.

type Msg = { role: 'user' | 'assistant'; content: string; opciones?: string[]; propuestas?: string[]; doc?: boolean }
type Resp = { tipo: 'pregunta'; mensaje: string; opciones?: string[] } | { tipo: 'respuesta'; mensaje: string; propuestas?: string[] } | { tipo: 'contenido'; valor: string; cambios?: string }

const SUGERENCIAS = [
  'No se entiende bien: hazlo más claro y directo',
  'Hay partes que sobran: omite lo que no aporta',
  'Le falta detalle y ejemplos concretos',
  'El tono no es profesional: mejora la redacción',
  'Es demasiado largo: resúmelo a lo esencial',
]

/** Textos por bloque (títulos, párrafos, ítems, filas de tabla) de un HTML, para compararlo con otro. */
function bloques(html: string): string[] {
  if (typeof DOMParser === 'undefined' || !html) return []
  const d = new DOMParser().parseFromString(html, 'text/html')
  const out: string[] = []
  d.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,tr,blockquote').forEach(el => {
    const t = el.tagName
    if (t === 'P' && el.closest('li,td,th')) return
    if (t === 'BLOCKQUOTE') return
    let txt = ''
    if (t === 'TR') txt = Array.from(el.querySelectorAll('th,td')).map(c => (c.textContent || '').replace(/\s+/g, ' ').trim()).join(' | ')
    else if (t === 'LI') { const c = el.cloneNode(true) as HTMLElement; c.querySelectorAll('ul,ol').forEach(x => x.remove()); txt = c.textContent || '' }
    else txt = el.textContent || ''
    txt = txt.replace(/\s+/g, ' ').trim()
    if (txt) out.push(txt)
  })
  return out
}

function difBloques(a: string[], b: string[]): { t: '=' | '+' | '-'; x: string }[] {
  const n = a.length, m = b.length
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const out: { t: '=' | '+' | '-'; x: string }[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: '=', x: a[i] }); i++; j++ }
    else if (L[i + 1][j] >= L[i][j + 1]) { out.push({ t: '-', x: a[i] }); i++ }
    else { out.push({ t: '+', x: b[j] }); j++ }
  }
  while (i < n) out.push({ t: '-', x: a[i++] })
  while (j < m) out.push({ t: '+', x: b[j++] })
  return out
}

/** Qué cambia entre el texto actual y la propuesta: lo añadido en verde, lo quitado tachado, y lo igual resumido. */
function VistaCambios({ base, nuevo }: { base: string; nuevo: string }) {
  const filas = useMemo(() => { const a = bloques(base), b = bloques(nuevo); return a.length * b.length > 250000 ? null : difBloques(a, b) }, [base, nuevo])
  if (!filas) return <p className="text-xs text-gray-500">El texto es demasiado grande para compararlo bloque a bloque: usa «Ver texto completo».</p>
  const mas = filas.filter(f => f.t === '+').length
  const menos = filas.filter(f => f.t === '-').length
  if (!mas && !menos) return <p className="text-xs text-gray-500">Sin diferencias de texto respecto a lo actual.</p>
  const out: ReactNode[] = []
  let igual = 0
  const vaciar = (k: number) => { if (igual > 0) { out.push(<p key={'i' + k} className="text-[11px] text-gray-400 italic px-1">… {igual} bloque{igual === 1 ? '' : 's'} sin cambios</p>); igual = 0 } }
  filas.forEach((f, k) => {
    if (f.t === '=') { igual++; return }
    vaciar(k)
    out.push(<p key={k} className={'rounded px-2 py-1 text-sm ' + (f.t === '+' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700 line-through')}>{f.t === '+' ? '+ ' : '− '}{f.x}</p>)
  })
  vaciar(filas.length)
  return (
    <div className="rounded-xl border border-gray-200 p-3 max-h-[45vh] overflow-y-auto space-y-1.5">
      <p className="text-[11px] text-gray-500">{mas} añadido{mas === 1 ? '' : 's'} · {menos} quitado{menos === 1 ? '' : 's'}</p>
      {out}
    </div>)
}

export default function PanelIADoc({ proyectoId, fase, clave, alcance, obtener, aHtml, onAplicar, onCerrar, secciones, onElegirSeccion }: {
  proyectoId: string; fase: string; clave: string
  alcance: { tipo: 'seccion' | 'documento'; titulo: string; n?: number }
  obtener: () => { documento: string; seccion?: string }
  aHtml: (md: string) => string
  onAplicar: (md: string) => void
  onCerrar: () => void
  secciones?: { i: number; titulo: string; nivel: number }[]
  onElegirSeccion?: (i: number, titulo: string) => void
}) {
  const [modo, setModo] = useState<'generar' | 'mejorar' | 'preguntar' | 'regenerar' | null>(null)
  const [hist, setHist] = useState<Msg[]>([])
  const [resultado, setResultado] = useState<{ valor: string; cambios?: string } | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [entrada, setEntrada] = useState('')
  const fin = useRef<HTMLDivElement>(null)
  const [base, setBase] = useState('')
  const [vista, setVista] = useState<'cambios' | 'texto'>('cambios')
  const [todo, setTodo] = useState(false)
  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [hist, resultado, cargando])

  // Un documento largo se mejora mejor por secciones: es más rápido y solo toca lo que se elige.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const largoDoc = useMemo(() => modo === 'mejorar' && alcance.tipo === 'documento' && new DOMParser().parseFromString(obtener().documento, 'text/html').body.textContent!.length > 12000, [modo, alcance.tipo])
  const largo = largoDoc && !todo
  const ambito = alcance.tipo === 'seccion' ? 'esta sección' : 'el documento'
  const de = alcance.tipo === 'seccion' ? 'de esta sección' : 'del documento'

  async function pedir(m: 'generar' | 'mejorar' | 'preguntar' | 'regenerar', h: Msg[]) {
    setCargando(true); setError('')
    try {
      const o = obtener()
      setBase(alcance.tipo === 'seccion' ? (o.seccion ?? '') : o.documento)
      const r = await post<Resp>(`/api/proyectos/${proyectoId}/documentos/${fase}/${clave}/seccion-ia`, {
        modo: m, documento: o.documento, seccion: alcance.tipo === 'seccion' ? { titulo: alcance.titulo, contenido: o.seccion ?? '' } : null,
        historial: h.map(x => ({ role: x.role, content: x.content })),
      })
      if (r.tipo === 'pregunta') setHist([...h, { role: 'assistant', content: r.mensaje, opciones: r.opciones }])
      else if (r.tipo === 'respuesta') setHist([...h, { role: 'assistant', content: r.mensaje, propuestas: r.propuestas }])
      else setResultado({ valor: r.valor, cambios: r.cambios })
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo consultar al Agente Documentador') } finally { setCargando(false) }
  }

  function elegir(m: 'generar' | 'mejorar' | 'preguntar' | 'regenerar') { setModo(m); setHist([]); setResultado(null); setTodo(false); setVista('cambios'); if (m === 'generar' || m === 'regenerar') void pedir(m, []) }

  function enviar(texto: string) {
    const t = texto.trim()
    if (!t || !modo || cargando) return
    const previo = resultado ? [...hist, { role: 'assistant' as const, content: resultado.valor, doc: true }] : hist
    const h = [...previo.map(x => ({ ...x, opciones: undefined })), { role: 'user' as const, content: t }]
    setHist(h); setEntrada(''); setResultado(null); void pedir(modo === 'regenerar' ? 'mejorar' : modo, h) // tras regenerar, los ajustes se piden como «mejorar»
  }

  // De una aclaración a un ajuste: pasa a «Mejorar» conservando lo hablado como contexto.
  function ajustarConEsto() {
    if (cargando) return
    const h: Msg[] = [...hist.map(x => ({ ...x, opciones: undefined })), { role: 'user', content: 'Con lo que acabamos de aclarar, ajusta ' + ambito + ' si hace falta. Aplica solo lo necesario y dime qué cambias; si no hace falta ningún cambio, dímelo.' }]
    setModo('mejorar'); setHist(h); setResultado(null); void pedir('mejorar', h)
  }

  // Aplica una propuesta concreta de las que ofreció el Agente Documentador (pasa a «Mejorar» con lo hablado como contexto).
  function aplicarPropuesta(p: string) {
    if (cargando) return
    const h: Msg[] = [...hist.map(x => ({ ...x, opciones: undefined, propuestas: undefined })), { role: 'user', content: 'Aplica esta propuesta a ' + ambito + ': «' + p + '». Haz solo lo necesario y dime qué cambias.' }]
    setModo('mejorar'); setHist(h); setResultado(null); void pedir('mejorar', h)
  }

  function otroCambio() {
    if (!resultado) return
    setHist(h => [...h, { role: 'assistant', content: resultado.valor, doc: true }]); setResultado(null)
  }

  const ultimo = hist[hist.length - 1]
  const esperaRespuesta = !!modo && !resultado && !cargando && (modo !== 'generar' ? true : ultimo?.role === 'assistant')
  const opcion = 'w-full text-left rounded-xl border border-gray-200 hover:border-cyan-400 hover:bg-cyan-50/50 p-3 transition-colors disabled:opacity-50'

  return createPortal(
    <>
      <div onClick={onCerrar} className="fixed inset-0 bg-black/50 z-40 print:hidden" />
      <div className="fixed top-0 right-0 h-full w-full sm:w-[440px] bg-white shadow-2xl z-50 flex flex-col print:hidden" role="dialog" aria-label="Agente Documentador">
        <div className="flex items-start gap-2 px-5 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-600">Agente Documentador · {alcance.tipo === 'seccion' ? `Sección${alcance.n ? ' ' + alcance.n : ''}` : 'Documento'}</p>
            <h3 className="text-base font-bold text-[#111827] truncate">{alcance.titulo}</h3>
          </div>
          <button type="button" onClick={onCerrar} title="Cerrar" aria-label="Cerrar panel" className="text-gray-400 hover:text-gray-700 p-1"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3 text-gray-800">
          {!modo && (
            <>
              <p className="text-sm text-gray-500">Elige qué quieres que el Agente Documentador haga con {ambito}.</p>
              <button type="button" onClick={() => elegir('generar')} className={opcion}>
                <span className="flex items-center gap-2 text-sm font-semibold"><Wand2 size={15} className="text-cyan-600" /> {alcance.tipo === 'seccion' ? 'Generar sección' : 'Generar documento'}</span>
                <span className="block text-xs text-gray-500 mt-1">Te hace preguntas si hace falta información y genera el contenido final {de}.</span>
              </button>
              <button type="button" onClick={() => elegir('mejorar')} className={opcion}>
                <span className="flex items-center gap-2 text-sm font-semibold"><PenLine size={15} className="text-cyan-600" /> {alcance.tipo === 'seccion' ? 'Mejorar sección' : 'Mejorar documento'}</span>
                <span className="block text-xs text-gray-500 mt-1">Dile al Agente Documentador qué está mal, qué no se entiende o qué se puede omitir, y ajusta el texto {de}.</span>
              </button>
              <button type="button" onClick={() => elegir('regenerar')} className={opcion}>
                <span className="flex items-center gap-2 text-sm font-semibold"><RefreshCw size={15} className="text-cyan-600" /> {alcance.tipo === 'seccion' ? 'Regenerar sección' : 'Regenerar documento'}</span>
                <span className="block text-xs text-gray-500 mt-1">Lo reescribe de una vez, sin preguntas, con la información más reciente del proyecto. Tú decides si lo aplicas.</span>
              </button>
              <button type="button" onClick={() => elegir('preguntar')} className={opcion}>
                <span className="flex items-center gap-2 text-sm font-semibold"><MessageCircle size={15} className="text-cyan-600" /> {alcance.tipo === 'seccion' ? 'Preguntar sobre la sección' : 'Preguntar sobre el documento'}</span>
                <span className="block text-xs text-gray-500 mt-1">Resuelve una duda con lo que consta en el documento y en el proyecto. No cambia nada.</span>
              </button>
              <p className="text-[11px] text-gray-400">El Agente Documentador no guarda nada: el resultado lo revisas y lo aplicas a la hoja, y luego decides si guardas.</p>
            </>)}

          {modo === 'preguntar' && hist.length === 0 && !cargando && <p className="text-sm text-gray-500">Pregunta lo que quieras {de} o del proyecto: el Agente Documentador responde con lo que consta y no cambia nada.</p>}

          {largo && hist.length === 0 && !cargando && !resultado && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">Este documento es largo: mejorarlo entero es lento y puede tocar partes que no quieres. Elige una sección para cambiar solo esa.</p>
              {(secciones ?? []).filter(x => x.nivel === 2).map(x => <button key={x.i} type="button" onClick={() => onElegirSeccion?.(x.i, x.titulo)} className={opcion + ' text-sm'}>{x.titulo}</button>)}
              <button type="button" onClick={() => setTodo(true)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50">Mejorar todo el documento de todos modos</button>
            </div>)}

          {modo === 'mejorar' && !largo && hist.length === 0 && !cargando && (
            <div className="space-y-2">
              <p className="text-sm text-gray-500">¿Qué quieres cambiar {de}? Escríbelo o elige un atajo. También puedes hacer una pregunta sobre el documento: el Agente Documentador responde sin cambiar nada.</p>
              {SUGERENCIAS.map(s => <button key={s} type="button" onClick={() => enviar(s)} className={opcion + ' text-sm'}>{s}</button>)}
            </div>)}

          {hist.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
              <div className={m.role === 'user' ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-cyan-600 text-white text-sm px-3 py-2' : 'max-w-full rounded-2xl rounded-bl-sm bg-gray-100 text-sm px-3 py-2 whitespace-pre-wrap'}>
                {m.doc ? 'Propuse un texto (lo viste arriba). ¿Qué más cambiamos?' : m.content}
              </div>
              {modo === 'preguntar' && m.role === 'assistant' && i === hist.length - 1 && !cargando && (
                <button type="button" onClick={ajustarConEsto} className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-300 text-cyan-700 text-xs font-semibold hover:bg-cyan-50"><PenLine size={13} /> Ajustar {ambito} con esto</button>)}
              {m.role === 'assistant' && i === hist.length - 1 && m.propuestas && m.propuestas.length > 0 && !cargando && !resultado && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[11px] text-gray-500">Elige una propuesta para aplicarla {de}:</p>
                  {m.propuestas.map((p, k) => <button key={k} type="button" onClick={() => aplicarPropuesta(p)} className={opcion + ' text-sm'}><span className="font-semibold text-cyan-700">{k + 1}.</span> {p}</button>)}
                </div>)}
              {m.role === 'assistant' && i === hist.length - 1 && m.opciones && m.opciones.length > 0 && !cargando && !resultado && (
                <div className="mt-2 space-y-1.5">
                  {m.opciones.map(o => <button key={o} type="button" onClick={() => enviar(o)} className={opcion + ' text-sm'}>{o}</button>)}
                </div>)}
            </div>))}

          {cargando && <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 size={14} className="animate-spin" /> El Agente Documentador está trabajando…</div>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {resultado && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500">Así quedaría {ambito}:</p>
              <div className="flex gap-1.5 text-xs">
                <button type="button" onClick={() => setVista('cambios')} className={'px-2.5 py-1 rounded-md border ' + (vista === 'cambios' ? 'border-cyan-400 bg-cyan-50 text-cyan-700 font-semibold' : 'border-gray-200 text-gray-500')}>Ver cambios</button>
                <button type="button" onClick={() => setVista('texto')} className={'px-2.5 py-1 rounded-md border ' + (vista === 'texto' ? 'border-cyan-400 bg-cyan-50 text-cyan-700 font-semibold' : 'border-gray-200 text-gray-500')}>Ver texto completo</button>
              </div>
              {vista === 'cambios'
                ? <VistaCambios base={base} nuevo={aHtml(resultado.valor)} />
                : <div className="rounded-xl border border-gray-200 p-3 text-sm max-h-[45vh] overflow-y-auto doc-rico text-gray-700" dangerouslySetInnerHTML={{ __html: aHtml(resultado.valor) }} />}
              {resultado.cambios && <p className="text-xs text-gray-500"><span className="font-semibold">Qué cambió:</span> {resultado.cambios}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" onClick={() => onAplicar(resultado.valor)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"><Check size={13} /> Aplicar a la hoja</button>
                <button type="button" onClick={otroCambio} className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50">Pedir otro cambio</button>
                <button type="button" onClick={() => { setResultado(null); setModo(null); setHist([]) }} className="px-3 py-1.5 rounded-lg text-gray-500 text-xs hover:bg-gray-50">Descartar</button>
              </div>
            </div>)}
          <div ref={fin} />
        </div>

        {modo && (
          <div className="border-t border-gray-100 p-3 flex-shrink-0">
            <form onSubmit={e => { e.preventDefault(); enviar(entrada) }} className="flex items-center gap-2">
              <input value={entrada} onChange={e => setEntrada(e.target.value)} disabled={!esperaRespuesta && !resultado} placeholder={resultado ? 'O pide un ajuste y el Agente Documentador lo rehace…' : modo === 'mejorar' ? 'Qué quieres cambiar…' : modo === 'preguntar' ? 'Escribe tu pregunta…' : 'Escribe tu respuesta…'}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-cyan-500 disabled:bg-gray-50" />
              <Microfono claro onTexto={x => setEntrada(v => (v.trim() ? v.trim() + ' ' : '') + x)} onError={setError} />
              <button type="submit" disabled={!entrada.trim() || cargando} className="w-9 h-9 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white flex items-center justify-center" aria-label="Enviar"><Send size={14} /></button>
            </form>
          </div>)}
      </div>
    </>,
    document.body
  )
}
