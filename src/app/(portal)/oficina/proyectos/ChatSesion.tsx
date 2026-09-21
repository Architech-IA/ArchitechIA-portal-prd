'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2, Send, Paperclip, Lock, Unlock, ListPlus, CheckCircle2, RotateCcw, GitBranch, Copy, ChevronDown, ChevronRight,
  AlertTriangle, Archive, Trash2, X, Brain, User, Sparkles,
} from 'lucide-react'
import { ETIQUETA_TIPO, type TipoSesion } from '@/lib/proyectos/tipos'
import { api, post, patch, del, fechaHora, kb, pctCache, type Mensaje, type SesionFull, type SesionRes, type Adjunto } from './api'
import { Md, opcionesNumeradas } from './Md'
import PlanTareas from './PlanTareas'

const POLL_RAPIDO = 1500
const POLL_LENTO = 12000

export default function ChatSesion({ proyectoId, sesion, yo, onCambio, onAbrirSesion, onSesion, onAbrirPanel }: {
  proyectoId: string
  sesion: SesionRes
  yo: { id: string; nombre: string }
  onCambio: () => void
  onAbrirSesion: (id: string | null) => void
  onSesion: (s: SesionFull) => void
  onAbrirPanel: (p: 'contexto' | 'memoria' | 'adjuntos') => void
}) {
  const base = `/api/proyectos/${proyectoId}/sesiones/${sesion.id}`
  const [full, setFull] = useState<SesionFull | null>(null)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([])
  const [subiendo, setSubiendo] = useState(false)
  const [plan, setPlan] = useState(false)
  const [editTitulo, setEditTitulo] = useState<string | null>(null)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const [aviso, setAviso] = useState<string | null>(null)
  const sync = useRef<string>('')
  const ocupado = useRef(false)
  const finRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const prevN = useRef(0)

  const merge = useCallback((nuevos: Mensaje[]) => {
    if (nuevos.length === 0) return
    setMensajes(prev => {
      const mapa = new Map(prev.map(m => [m.id, m]))
      nuevos.forEach(m => mapa.set(m.id, m))
      return [...mapa.values()].sort((a, b) => a.orden - b.orden)
    })
  }, [])

  // Carga inicial al cambiar de sesión
  useEffect(() => {
    let vivo = true
    setCargando(true); setError(null); setMensajes([]); setFull(null); setAdjuntos([]); setInput(''); setAviso(null); prevN.current = 0
    api<{ sesion: SesionFull; mensajes: Mensaje[]; ahora: string }>(base)
      .then(r => { if (!vivo) return; setFull(r.sesion); onSesion(r.sesion); setMensajes(r.mensajes); sync.current = r.ahora })
      .catch((e: Error) => { if (vivo) setError(e.message) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base])

  const generando = mensajes.some(m => m.estado === 'GENERANDO')
  const cerrando = full?.cierreEstado === 'PROCESANDO'

  // Sondeo: rápido mientras la IA responde o se procesa un cierre; lento para ver novedades (Bitácora, otras personas)
  useEffect(() => {
    if (cargando || error) return
    const ms = generando || cerrando ? POLL_RAPIDO : POLL_LENTO
    const t = setInterval(async () => {
      if (ocupado.current || document.hidden) return
      ocupado.current = true
      try {
        const desde = new Date(new Date(sync.current || Date.now()).getTime() - 3000).toISOString()
        const r = await api<{ sesion: SesionFull; mensajes: Mensaje[]; ahora: string }>(`${base}?desde=${encodeURIComponent(desde)}`)
        const habiaGenerando = generando
        merge(r.mensajes); setFull(r.sesion); onSesion(r.sesion); sync.current = r.ahora
        if (habiaGenerando && r.mensajes.some(m => m.estado !== 'GENERANDO')) onCambio() // título automático, conteos
      } catch { /* siguiente intento */ } finally { ocupado.current = false }
    }, ms)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, cargando, error, generando, cerrando, merge])

  // Scroll al final cuando llegan mensajes nuevos o cambia el último
  const ultimo = mensajes[mensajes.length - 1]
  useEffect(() => {
    const el = scrollRef.current
    const cerca = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 160
    if (mensajes.length !== prevN.current || cerca) finRef.current?.scrollIntoView({ behavior: mensajes.length > prevN.current ? 'smooth' : 'auto', block: 'end' })
    prevN.current = mensajes.length
  }, [mensajes.length, ultimo?.estado, ultimo?.contenido.length])

  const cerrada = (full?.estado ?? sesion.estado) !== 'ACTIVA'
  const soyDuenio = full ? full.creadaPorId === yo.id : sesion.mia
  const esBitacora = (full?.tipo ?? sesion.tipo) === 'BITACORA'
  const bloqueado = cerrada || enviando || generando

  async function enviar(texto?: string) {
    const contenido = (texto ?? input).trim()
    if (!contenido || bloqueado) return
    setEnviando(true); setError(null); setAviso(null)
    try {
      const r = await post<{ mensajes: Mensaje[] }>(`${base}/mensajes`, { contenido, adjuntoIds: adjuntos.map(a => a.id) })
      merge(r.mensajes); setInput(''); setAdjuntos([]); onCambio()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo enviar') } finally { setEnviando(false); inputRef.current?.focus() }
  }

  async function subir(file: File) {
    setSubiendo(true); setError(null)
    try {
      const fd = new FormData(); fd.append('file', file); fd.append('sesionId', sesion.id)
      const a = await api<Adjunto & { truncado?: boolean }>(`/api/proyectos/${proyectoId}/adjuntos`, { method: 'POST', body: fd })
      setAdjuntos(prev => [...prev, a])
      if (!a.legible) setAviso(`«${a.nombre}» se guardó, pero su texto no se pudo leer (formato no soportado, vacío o muy pesado): la IA no lo verá.`)
      else if (a.truncado) setAviso(`«${a.nombre}» es muy largo: se guardaron los primeros 60.000 caracteres.`)
      onCambio()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo subir el archivo') } finally { setSubiendo(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function reintentar(m: Mensaje) {
    try { merge([await post<Mensaje>(`${base}/mensajes/${m.id}/reintentar`)]) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo reintentar') }
  }
  async function bifurcar(m: Mensaje) {
    try { const n = await post<{ id: string }>(`${base}/bifurcar`, { desdeOrden: m.orden }); onCambio(); onAbrirSesion(n.id) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo bifurcar') }
  }
  async function cambiar(data: Record<string, unknown>) {
    try { const s = await patch<SesionFull>(base, data); setFull(prev => (prev ? { ...prev, ...s } : prev)); onSesion({ ...(full as SesionFull), ...s }); onCambio() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar') }
  }
  async function cerrar() {
    if (!window.confirm('¿Cerrar la sesión? Queda guardada completa; se generará un resumen y una propuesta de actualización de la memoria del proyecto.')) return
    try { const s = await post<SesionFull>(`${base}/cerrar`); setFull(prev => (prev ? { ...prev, ...s } : prev)); onCambio() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cerrar') }
  }
  async function eliminar() {
    if (!window.confirm('¿Eliminar esta sesión y todos sus mensajes? No se puede deshacer.')) return
    try { await del(base); onCambio(); onAbrirSesion(null) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar') }
  }

  const fuentesDe = (m: Mensaje) => (m.metadata?.contexto ?? []).filter(f => f.estado === 'incluida' || f.estado === 'recortada')
  const alternar = (id: string) => setAbiertos(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const tipo = (full?.tipo ?? sesion.tipo) as TipoSesion
  const opciones = tipo === 'KICKOFF' && !cerrada && !generando && ultimo?.rol === 'assistant' && ultimo.estado === 'LISTO' ? opcionesNumeradas(ultimo.contenido) : null

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Barra de la sesión */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 flex-shrink-0">
        {editTitulo !== null ? (
          <input autoFocus value={editTitulo} onChange={e => setEditTitulo(e.target.value)} maxLength={80}
            onBlur={() => { const t = editTitulo.trim(); setEditTitulo(null); if (t && t !== full?.titulo) void cambiar({ titulo: t }) }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditTitulo(null) }}
            className="flex-1 min-w-0 bg-transparent text-[13px] font-semibold text-gray-100 outline-none border-b border-indigo-500/60" />
        ) : (
          <button onClick={() => !esBitacora && setEditTitulo(full?.titulo ?? sesion.titulo)} title={esBitacora ? undefined : 'Clic para renombrar'}
            className="flex-1 min-w-0 text-left text-[13px] font-semibold text-gray-100 truncate hover:text-white">{full?.titulo ?? sesion.titulo}</button>
        )}
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0" style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc' }}>{ETIQUETA_TIPO[tipo] ?? tipo}</span>
        {full && !esBitacora && (
          <button onClick={() => soyDuenio && void cambiar({ privada: !full.privada })} disabled={!soyDuenio}
            title={full.privada ? 'Privada: solo la ves tú. Clic para compartir con el equipo' : soyDuenio ? 'Compartida con el equipo. Clic para hacerla privada' : `Compartida · creada por ${full.creadaPorNombre}`}
            className="flex-shrink-0 text-gray-500 hover:text-gray-200 disabled:hover:text-gray-500">{full.privada ? <Lock size={13} className="text-amber-400" /> : <Unlock size={13} />}</button>
        )}
        {!esBitacora && !cerrada && (
          <>
            <button onClick={() => setPlan(true)} disabled={mensajes.length < 2 || generando} title="El coordinador propone tareas de backlog a partir de esta conversación"
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-indigo-200 disabled:opacity-40 flex-shrink-0" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <ListPlus size={11} /> Convertir en tareas
            </button>
            <button onClick={() => void cerrar()} disabled={generando || mensajes.length === 0} title="Cerrar: resumen final y propuesta de memoria"
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-gray-300 border border-white/10 hover:bg-white/5 disabled:opacity-40 flex-shrink-0"><CheckCircle2 size={11} /> Cerrar sesión</button>
          </>
        )}
        {!esBitacora && soyDuenio && (
          <>
            <button onClick={() => { if (window.confirm('¿Archivar la sesión? Deja de aparecer en la lista (se conserva).')) void cambiar({ estado: 'ARCHIVADA' }).then(() => onAbrirSesion(null)) }} title="Archivar" className="text-gray-500 hover:text-gray-200 flex-shrink-0"><Archive size={13} /></button>
            <button onClick={() => void eliminar()} title="Eliminar" className="text-gray-500 hover:text-red-400 flex-shrink-0"><Trash2 size={13} /></button>
          </>
        )}
      </div>

      {/* Sesión cerrada */}
      {cerrada && (
        <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-center gap-3 text-[11px]" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#6ee7b7' }}>
          <CheckCircle2 size={14} className="flex-shrink-0" />
          <span className="flex-1">
            Sesión {full?.estado === 'ARCHIVADA' ? 'archivada' : 'cerrada'}.{' '}
            {cerrando ? 'Generando el resumen y la propuesta de memoria…' : full?.cierreEstado === 'LISTO' ? 'Resumen guardado. Si la IA propuso cambios a la memoria, revísalos en el panel Memoria.' : full?.cierreEstado === 'ERROR' ? 'No se pudo generar el resumen del cierre.' : ''}
          </span>
          {cerrando && <Loader2 size={12} className="animate-spin" />}
          {full?.cierreEstado === 'LISTO' && <button onClick={() => onAbrirPanel('memoria')} className="underline underline-offset-2">Ver memoria</button>}
          <button onClick={() => void cambiar({ estado: 'ACTIVA' })} className="px-2 py-0.5 rounded-md border border-emerald-500/30 hover:bg-emerald-500/10">Reabrir</button>
        </div>
      )}

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {cargando && <div className="flex justify-center py-10 text-gray-500"><Loader2 size={18} className="animate-spin" /></div>}
        {!cargando && mensajes.length === 0 && !error && (
          <div className="text-center text-[12px] text-gray-500 py-12 px-6 space-y-2">
            <Sparkles size={22} className="mx-auto text-indigo-400/70" />
            <p className="text-gray-300 font-medium">Sesión nueva</p>
            <p>Todo lo que escribas aquí queda guardado. La IA responde con el contexto vivo del proyecto (PRD, diseño, backlog, memoria, adjuntos…): revisa qué ve exactamente en el panel <b className="text-gray-300">Contexto</b>.</p>
            {tipo === 'KICKOFF' && <p className="text-indigo-300">Kickoff: cuéntame la iniciativa y te iré haciendo preguntas guiadas.</p>}
          </div>
        )}

        {mensajes.map((m, idx) => {
          const propio = m.rol === 'user' && m.autorId === yo.id
          const esUlt = idx === mensajes.length - 1
          const parsed = opciones && esUlt ? opcionesNumeradas(m.contenido) : null
          const fuentes = m.rol === 'assistant' ? fuentesDe(m) : []
          return (
            <div key={m.id} className={`flex gap-2.5 ${m.rol === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black"
                style={m.rol === 'assistant' ? { background: 'rgba(99,102,241,0.25)', color: '#818cf8', border: '1.5px solid rgba(99,102,241,0.4)' } : { background: 'rgba(255,255,255,0.08)', color: '#9ca3af', border: '1.5px solid rgba(255,255,255,0.1)' }}>
                {m.rol === 'assistant' ? (m.metadata?.origen === 'suscripcion' ? <Brain size={12} /> : 'IA') : <User size={12} />}
              </div>
              <div className={m.rol === 'user' ? 'max-w-[78%]' : 'flex-1 min-w-0 max-w-[92%]'}>
                {m.rol === 'user' && !propio && <p className="text-[9px] text-gray-500 text-right mb-0.5">{m.autorNombre}</p>}
                <div className="rounded-xl px-3 py-2" style={m.rol === 'assistant'
                  ? { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }
                  : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {m.estado === 'GENERANDO' && <div className="flex items-center gap-2 text-[11px] text-indigo-300"><Loader2 size={12} className="animate-spin" /> Pensando con el contexto del proyecto…</div>}
                  {m.estado === 'ERROR' && (
                    <div className="text-[11px] text-red-400 flex items-start gap-1.5"><AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                      <span className="flex-1">{m.error || 'No se pudo generar la respuesta.'}</span>
                      {esUlt && !cerrada && <button onClick={() => void reintentar(m)} className="underline underline-offset-2 flex items-center gap-1"><RotateCcw size={10} /> Reintentar</button>}
                    </div>)}
                  {m.estado === 'LISTO' && (m.rol === 'assistant' ? <Md texto={parsed ? parsed.prosa : m.contenido} /> : <p className="text-[12px] text-gray-200 whitespace-pre-wrap break-words">{m.contenido}</p>)}
                  {m.rol === 'user' && (m.metadata?.adjuntos?.length ?? 0) > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">{m.metadata!.adjuntos!.map(a => <span key={a.id} className="text-[10px] px-1.5 py-0.5 rounded-md text-gray-400" style={{ background: 'rgba(255,255,255,0.06)' }}>📎 {a.nombre}</span>)}</div>)}
                </div>

                {parsed && (
                  <div className="mt-2 space-y-1.5">
                    {parsed.opciones.map((op, oi) => {
                      const otra = /otra respuesta/i.test(op)
                      return (
                        <button key={oi} disabled={bloqueado} onClick={() => (otra ? inputRef.current?.focus() : void enviar(`${oi + 1}. ${op}`))}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[11px] text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: otra ? 'rgba(251,191,36,0.15)' : 'rgba(99,102,241,0.2)', color: otra ? '#fbbf24' : '#818cf8' }}>{otra ? '✎' : oi + 1}</span>
                          {op}
                        </button>)
                    })}
                  </div>)}

                {/* Pie del mensaje */}
                <div className={`mt-1 flex items-center gap-2 text-[10px] text-gray-600 ${m.rol === 'user' ? 'justify-end' : ''}`}>
                  <span>{fechaHora(m.createdAt)}</span>
                  {m.rol === 'assistant' && m.estado === 'LISTO' && m.metadata?.uso && (
                    <span title={`Entrada: ${m.metadata.uso.promptTokens.toLocaleString('es-CO')} tokens (${m.metadata.uso.cachedTokens.toLocaleString('es-CO')} reutilizados de la caché) · Salida: ${m.metadata.uso.completionTokens.toLocaleString('es-CO')} (${m.metadata.uso.reasoningTokens.toLocaleString('es-CO')} razonando)`}
                      className={pctCache(m.metadata.uso) >= 50 ? 'text-emerald-500/80' : ''}>caché {pctCache(m.metadata.uso)} %</span>
                  )}
                  {m.rol === 'assistant' && m.estado === 'LISTO' && (
                    <>
                      {fuentes.length > 0 && (
                        <button onClick={() => alternar(m.id)} className="flex items-center gap-0.5 hover:text-gray-300">
                          {abiertos.has(m.id) ? <ChevronDown size={10} /> : <ChevronRight size={10} />} Fuentes usadas ({fuentes.length})
                        </button>)}
                      <button onClick={() => void navigator.clipboard?.writeText(m.contenido)} title="Copiar" className="hover:text-gray-300"><Copy size={10} /></button>
                      {!cerrada && !esBitacora && <button onClick={() => void bifurcar(m)} title="Bifurcar la conversación desde aquí" className="hover:text-gray-300 flex items-center gap-0.5"><GitBranch size={10} /> Bifurcar</button>}
                      {esUlt && !cerrada && !esBitacora && <button onClick={() => void reintentar(m)} title="Regenerar respuesta" className="hover:text-gray-300 flex items-center gap-0.5"><RotateCcw size={10} /> Regenerar</button>}
                    </>)}
                </div>
                {abiertos.has(m.id) && (
                  <div className="mt-1 rounded-lg px-2.5 py-2 text-[10px] text-gray-400 space-y-0.5" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {(m.metadata?.contexto ?? []).map(f => (
                      <div key={f.clave} className="flex items-center gap-2">
                        <span className={f.estado === 'incluida' ? 'text-emerald-400' : f.estado === 'recortada' ? 'text-amber-400' : 'text-gray-600'}>●</span>
                        <span className="flex-1 truncate">{f.etiqueta}{f.nota ? <span className="text-gray-600"> · {f.nota}</span> : null}</span>
                        <span className="text-gray-600">{f.estado === 'incluida' || f.estado === 'recortada' ? `${f.chars.toLocaleString('es-CO')} car.` : f.estado}</span>
                      </div>))}
                    <p className="pt-1 text-gray-600">Total {(m.metadata?.totalChars ?? 0).toLocaleString('es-CO')} caracteres · {Math.round((m.metadata?.ms ?? 0) / 1000)} s</p>
                    {m.metadata?.uso && (
                      <p className="text-gray-600">
                        Tokens: entrada {m.metadata.uso.promptTokens.toLocaleString('es-CO')} ({m.metadata.uso.cachedTokens.toLocaleString('es-CO')} de caché, {pctCache(m.metadata.uso)} %) · salida {m.metadata.uso.completionTokens.toLocaleString('es-CO')} ({m.metadata.uso.reasoningTokens.toLocaleString('es-CO')} razonando)
                      </p>)}
                  </div>)}
              </div>
            </div>
          )
        })}
        <div ref={finRef} />
      </div>

      {/* Compositor */}
      <div className="px-4 pb-3 pt-2 border-t border-white/5 flex-shrink-0">
        {error && <p className="text-[11px] text-red-400 mb-1.5 flex items-start gap-1.5"><AlertTriangle size={12} className="flex-shrink-0 mt-0.5" /><span className="flex-1">{error}</span><button onClick={() => setError(null)}><X size={11} /></button></p>}
        {aviso && <p className="text-[11px] text-amber-300 mb-1.5 flex items-start gap-1.5"><span className="flex-1">{aviso}</span><button onClick={() => setAviso(null)}><X size={11} /></button></p>}
        {adjuntos.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {adjuntos.map(a => (
              <span key={a.id} className="text-[10px] px-2 py-1 rounded-lg flex items-center gap-1.5 text-gray-300" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${a.legible ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.4)'}` }}>
                📎 {a.nombre} <span className="text-gray-500">{kb(a.size)}{a.legible ? '' : ' · ilegible'}</span>
                <button onClick={() => setAdjuntos(prev => prev.filter(x => x.id !== a.id))} className="text-gray-500 hover:text-gray-200"><X size={10} /></button>
              </span>))}
          </div>)}
        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.json,.html,.xml" onChange={e => { const f = e.target.files?.[0]; if (f) void subir(f) }} />
          <button onClick={() => fileRef.current?.click()} disabled={cerrada || subiendo} title="Adjuntar documento al proyecto (PDF, Word, PowerPoint, Excel, texto)"
            className="px-2.5 py-2 rounded-xl flex-shrink-0 disabled:opacity-40 text-gray-400 hover:text-gray-200" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {subiendo ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
          </button>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} rows={Math.min(6, Math.max(1, input.split('\n').length))}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar() } }}
            disabled={cerrada}
            placeholder={cerrada ? 'Sesión cerrada: reábrela para seguir' : generando ? 'La IA está respondiendo…' : esBitacora ? 'Pregunta sobre las novedades del proyecto…' : 'Escribe aquí (Enter envía, Shift+Enter salto de línea)'}
            className="flex-1 rounded-xl px-3 py-2 text-[12px] text-gray-100 outline-none resize-none border border-white/10 focus:border-indigo-500/50 placeholder-gray-600 disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.05)' }} />
          <button onClick={() => void enviar()} disabled={!input.trim() || bloqueado} className="px-3 py-2.5 rounded-xl flex-shrink-0 disabled:opacity-40 text-white" style={{ background: 'rgba(99,102,241,0.8)' }}>
            {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </div>

      {plan && <PlanTareas proyectoId={proyectoId} sesionId={sesion.id} onCerrar={() => setPlan(false)} onAplicado={() => { setPlan(false); void api<{ mensajes: Mensaje[] }>(`${base}?desde=${encodeURIComponent(new Date(Date.now() - 60_000).toISOString())}`).then(r => merge(r.mensajes)); onCambio() }} />}
    </div>
  )
}

