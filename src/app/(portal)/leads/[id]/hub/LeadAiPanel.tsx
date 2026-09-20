'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Wand2, PenLine, MessageSquare, ClipboardCheck, X, ChevronLeft, Send, Loader2, Sparkles } from 'lucide-react'
import { textoAHtml } from '@/lib/textoAHtml'

// Asistente de IA del Hub de Lead: mismo formato que el panel de IA del PRD
// (popup lateral blanco, opciones, chat, Ocultar / Cerrar), pero orientado a
// TODO el proceso del lead. Trabaja sobre la pestaña de notas visible de la fase
// y usa el contexto completo del lead en el servidor (/api/leads/[id]/ai-chat).
//
// Colores en hex a proposito: el tema oscuro remapea la escala gray de Tailwind
// a tonos translucidos, que sobre este fondo blanco se ven lavados.

export interface TabInfo { id: string; name: string; content: string }
export interface ResultadoAplicar { tabId: string; previo: string; nueva: boolean }

type Modo = 'generar' | 'mejorar' | 'asesor'
type Msg = { role: 'user' | 'assistant'; content: string; opciones?: string[]; insertable?: boolean }
type Chat = { modo: Modo; titulo: string; mensajes: Msg[]; cargando: boolean; error: string | null; listo: boolean; previo?: ResultadoAplicar }

const SUGERENCIAS_MEJORA = [
  'No se entiende bien: hazlo más claro y directo',
  'Hay partes que sobran: omite lo que no aporta',
  'Le falta detalle y ejemplos concretos',
  'El tono no es profesional: mejora la redacción',
  'Es demasiado largo: resúmelo a lo esencial',
]
const SUGERENCIAS_ASESOR = [
  '¿Cuál es el siguiente paso con este cliente?',
  '¿Qué riesgos u objeciones ves en este lead?',
  'Redáctame un mensaje de seguimiento para el cliente',
  'Ayúdame a preparar la próxima reunión',
  '¿Qué información me falta para avanzar de fase?',
]

const vacio = (html: string) => !html || !html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()

export default function LeadAiPanel({
  abierto, oculto, onOcultar, onMostrar, onCerrar, leadId, fase, tab, canEdit, aplicar, deshacer,
}: {
  abierto: boolean; oculto: boolean
  onOcultar: () => void; onMostrar: () => void; onCerrar: () => void
  leadId: string
  fase: { key: string; label: string }
  tab: TabInfo | null
  canEdit: boolean
  aplicar: (html: string, como: 'reemplazar' | 'nueva' | 'agregar', nombre?: string) => ResultadoAplicar
  deshacer: (r: ResultadoAplicar) => void
}) {
  const [chat, setChat] = useState<Chat | null>(null)
  const [input, setInput] = useState('')
  const finRef = useRef<HTMLDivElement>(null)

  // Cambiar de fase = otro contexto de trabajo: la conversación se reinicia
  useEffect(() => { setChat(null); setInput('') }, [fase.key])
  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [chat?.mensajes.length, chat?.cargando])

  const tabNombre = tab?.name || 'Nota'

  async function turno(modo: Modo, previos: Msg[], mensaje?: string) {
    const historial: Msg[] = mensaje ? [...previos, { role: 'user', content: mensaje }] : previos
    setChat(prev => prev && prev.modo === modo ? { ...prev, mensajes: historial, cargando: true, error: null } : prev)
    try {
      const res = await fetch(`/api/leads/${leadId}/ai-chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo, phaseKey: fase.key,
          tab: tab ? { name: tab.name, html: tab.content } : undefined,
          historial: historial.map(({ role, content }) => ({ role, content })),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'No se pudo continuar la conversación.')

      if (d.tipo === 'pregunta') {
        setChat(prev => prev && prev.modo === modo
          ? { ...prev, cargando: false, mensajes: [...historial, { role: 'assistant', content: String(d.mensaje ?? ''), opciones: Array.isArray(d.opciones) ? d.opciones : [] }] }
          : prev)
      } else if (d.tipo === 'respuesta') {
        setChat(prev => prev && prev.modo === modo
          ? { ...prev, cargando: false, mensajes: [...historial, { role: 'assistant', content: String(d.mensaje ?? ''), opciones: Array.isArray(d.opciones) ? d.opciones : [], insertable: true }] }
          : prev)
      } else if (d.tipo === 'contenido') {
        if (modo === 'mejorar') {
          const r = aplicar(String(d.valor), 'reemplazar')
          const cambios = typeof d.cambios === 'string' && d.cambios.trim() ? d.cambios.trim() + ' ' : ''
          setChat(prev => prev && prev.modo === modo
            ? { ...prev, cargando: false, previo: r, mensajes: [...historial, { role: 'assistant', content: `Listo, apliqué los cambios en «${tabNombre}». ${cambios}Recuerda pulsar Guardar para conservarlos. ¿Algo más que ajustar?`, opciones: SUGERENCIAS_MEJORA }] }
            : prev)
        } else {
          // Generar: si la pestaña visible está vacía se llena; si ya tiene texto se crea una nueva
          // para no pisar lo que escribió la persona.
          const como = tab && vacio(tab.content) ? 'reemplazar' : 'nueva'
          const r = aplicar(String(d.valor), como, `Borrador IA · ${fase.label}`.slice(0, 40))
          // La conversación NO se cierra: pasa a modo "mejorar" para que la persona pueda
          // retroalimentar o pedir ajustes sobre lo recién generado (la pestaña generada queda activa).
          const donde = como === 'reemplazar' ? `escribí el contenido en «${tabNombre}»` : 'dejé el contenido en una pestaña nueva («Borrador IA») para no pisar tu texto'
          setChat(prev => prev && prev.modo === modo
            ? { ...prev, modo: 'mejorar', cargando: false, listo: false, previo: r, mensajes: [...historial, { role: 'assistant', content: `Listo: ${donde}. Recuerda pulsar Guardar. ¿Quieres que ajuste algo? Dime qué cambiar (más corto, más detalle, otro enfoque, corregir un dato…) o elige un atajo.`, opciones: SUGERENCIAS_MEJORA }] }
            : prev)
        }
      } else {
        throw new Error('Respuesta inesperada del asistente.')
      }
    } catch (e) {
      setChat(prev => prev && prev.modo === modo ? { ...prev, cargando: false, error: e instanceof Error ? e.message : 'Error inesperado.' } : prev)
    }
  }

  function abrirModo(modo: Modo, titulo: string, auto?: string) {
    if (modo === 'mejorar' && (!tab || vacio(tab.content))) {
      setChat({ modo, titulo, mensajes: [], cargando: false, listo: true, error: `La pestaña «${tabNombre}» está vacía. Escribe algo o genérala con IA primero, y después puedo mejorarla.` })
      return
    }
    const nuevo: Chat = { modo, titulo, mensajes: [], cargando: modo === 'generar' || !!auto, error: null, listo: false }
    setChat(nuevo)
    if (modo === 'generar') void turno('generar', [])
    else if (auto) void turno(modo, [], auto)
  }

  function enviar(texto: string) {
    const t = texto.trim()
    if (!t || !chat || chat.cargando) return
    setInput('')
    void turno(chat.modo, chat.mensajes, t)
  }

  function insertar(i: number) {
    const m = chat?.mensajes[i]
    if (!m) return
    const r = aplicar(textoAHtml(m.content), 'agregar')
    setChat(prev => prev ? { ...prev, previo: r, mensajes: [...prev.mensajes, { role: 'assistant', content: `Agregué esa respuesta al final de «${tabNombre}». Recuerda pulsar Guardar.` }] } : prev)
  }

  if (typeof document === 'undefined' || !abierto) return null

  const OPCIONES: { modo: Modo; titulo: string; desc: string; icon: typeof Wand2; auto?: string; requiereEditar?: boolean }[] = [
    { modo: 'generar', titulo: 'Generar contenido con IA', desc: `Te hace preguntas si hace falta y redacta el contenido de la pestaña «${tabNombre}» de esta fase.`, icon: Wand2, requiereEditar: true },
    { modo: 'mejorar', titulo: 'Mejorar contenido', desc: `Dile qué está mal, qué no se entiende o qué omitir, y ajusto el texto de «${tabNombre}».`, icon: PenLine, requiereEditar: true },
    { modo: 'asesor', titulo: 'Asesor del lead', desc: 'Conversa sobre todo el proceso: próximos pasos, riesgos, objeciones, reuniones y mensajes al cliente.', icon: MessageSquare },
    {
      modo: 'asesor', titulo: `Revisar «${tabNombre}»`, desc: `Qué falta, qué riesgos hay y cuál es el siguiente paso a partir de esta pestaña (fase ${fase.label}) y todo el contexto del lead.`, icon: ClipboardCheck,
      auto: `Revisa el contenido de la pestaña «${tabNombre}» (fase ${fase.label}) con todo el contexto del lead y dime: 1) qué información falta o está floja en esa pestaña, 2) qué riesgos u objeciones ves, 3) cuál es el siguiente paso concreto que recomiendas.`,
    },
  ]

  const ultimo = chat ? chat.mensajes[chat.mensajes.length - 1] : undefined

  return createPortal(
    <>
      <div onClick={onOcultar}
        className={`fixed inset-0 bg-black/60 z-40 print:hidden transition-opacity duration-200 ${oculto ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} />
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white shadow-2xl z-50 flex flex-col print:hidden transition-transform duration-300 ease-out ${oculto ? 'translate-x-full' : 'translate-x-0'}`}>
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-cyan-600 font-semibold">Asistente IA · Fase {fase.label}</p>
            <h3 className="text-base font-bold text-[#111827] truncate">{chat ? chat.titulo : 'Asistente del lead'}</h3>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button type="button" onClick={onOcultar} title="Ocultar (la conversación se conserva)" aria-label="Ocultar panel"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#374151] hover:bg-gray-100 transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 17 5-5-5-5" /><path d="m13 17 5-5-5-5" /></svg>
            </button>
            <button type="button" onClick={() => { setChat(null); setInput(''); onCerrar() }} title="Cerrar (termina la conversación)" aria-label="Cerrar panel"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-[#374151] hover:bg-gray-100 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {!chat ? (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="w-full space-y-2">
              <p className="text-xs text-[#6b7280] mb-2">Elige cómo quieres que la IA te ayude. Usa todo el contexto del lead: notas de las fases, interacciones, propuestas y reuniones.</p>
              {OPCIONES.map(op => {
                const bloqueada = !!op.requiereEditar && !canEdit
                return (
                  <button key={op.titulo} type="button" disabled={bloqueada}
                    title={bloqueada ? 'Esta fase todavía no está activa: no se puede editar' : undefined}
                    onClick={() => abrirModo(op.modo, op.titulo, op.auto)}
                    className="w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-xl border border-gray-100 hover:border-cyan-200 hover:bg-cyan-50/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <span className="w-8 h-8 flex-shrink-0 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center"><op.icon size={15} /></span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-[#1f2937]">{op.titulo}</span>
                      <span className="block text-[11px] text-[#6b7280] mt-0.5">{op.desc}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="w-full space-y-2.5">
                <button type="button" onClick={() => setChat(null)} className="text-[11px] text-[#6b7280] hover:text-cyan-600 flex items-center gap-0.5 mb-1 transition-colors">
                  <ChevronLeft size={12} /> Volver a opciones
                </button>

                {chat.mensajes.length === 0 && !chat.cargando && !chat.listo && chat.modo === 'mejorar' && (
                  <div className="space-y-2">
                    <div className="text-xs leading-relaxed rounded-xl px-3 py-2 max-w-[92%] bg-cyan-50 text-[#1f2937] rounded-tl-sm">
                      Cuéntame qué está mal en «{tabNombre}»: que no se entiende, que algo se puede omitir, que falta detalle, que el tono no sirve… Escribe lo que necesites o elige un atajo.
                    </div>
                    <div className="flex flex-col items-start gap-1.5">
                      {SUGERENCIAS_MEJORA.map(t => (
                        <button key={t} type="button" onClick={() => enviar(t)}
                          className="text-left text-xs text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg px-3 py-1.5 max-w-[92%] transition-colors">{t}</button>
                      ))}
                    </div>
                  </div>
                )}
                {chat.mensajes.length === 0 && !chat.cargando && !chat.listo && chat.modo === 'asesor' && (
                  <div className="space-y-2">
                    <div className="text-xs leading-relaxed rounded-xl px-3 py-2 max-w-[92%] bg-cyan-50 text-[#1f2937] rounded-tl-sm">
                      Conozco las notas de todas las fases, las interacciones, las propuestas y las reuniones de este lead. Pregúntame lo que necesites o elige un atajo.
                    </div>
                    <div className="flex flex-col items-start gap-1.5">
                      {SUGERENCIAS_ASESOR.map(t => (
                        <button key={t} type="button" onClick={() => enviar(t)}
                          className="text-left text-xs text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg px-3 py-1.5 max-w-[92%] transition-colors">{t}</button>
                      ))}
                    </div>
                  </div>
                )}
                {chat.mensajes.length === 0 && chat.cargando && (
                  <p className="text-xs text-[#9ca3af] italic">{chat.modo === 'generar' ? 'Pensando en la primera pregunta…' : 'Analizando el lead…'}</p>
                )}

                {chat.mensajes.map((m, i) => (
                  <div key={i}>
                    <div className={`text-xs leading-relaxed rounded-xl px-3 py-2 max-w-[92%] whitespace-pre-wrap ${m.role === 'assistant' ? 'bg-cyan-50 text-[#1f2937] mr-auto rounded-tl-sm' : 'bg-[#111827] text-white ml-auto rounded-tr-sm'}`}>
                      {m.content}
                    </div>
                    {m.role === 'assistant' && m.insertable && canEdit && tab && (
                      <button type="button" onClick={() => insertar(i)}
                        className="mt-1 text-[11px] text-cyan-700 hover:text-cyan-900 underline underline-offset-2">Insertar en la nota «{tabNombre}»</button>
                    )}
                    {m.role === 'assistant' && i === chat.mensajes.length - 1 && !chat.listo && !chat.cargando && m.opciones && m.opciones.length > 0 && (
                      <div className="mt-2 flex flex-col items-start gap-1.5">
                        {m.opciones.map((op, oi) => (
                          <button key={oi} type="button" onClick={() => enviar(op)}
                            className="text-left text-xs text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded-lg px-3 py-1.5 max-w-[92%] transition-colors">{op}</button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {chat.cargando && chat.mensajes.length > 0 && <p className="text-xs text-[#9ca3af] italic">Escribiendo…</p>}
                {chat.error && <p className="text-xs text-red-500">{chat.error}</p>}
                <div ref={finRef} />
              </div>
            </div>

            {!chat.listo ? (
              <div className="border-t border-gray-100">
                {chat.previo && !chat.cargando && (
                  <div className="px-6 pt-3 flex items-center gap-2">
                    <button type="button"
                      onClick={() => { deshacer(chat.previo!); setChat(prev => prev ? { ...prev, previo: undefined, mensajes: [...prev.mensajes, { role: 'assistant', content: 'Deshice el último cambio.' }] } : prev) }}
                      className="flex-1 text-[11px] text-[#6b7280] hover:text-cyan-600 border border-dashed border-gray-200 hover:border-cyan-300 rounded-lg py-1.5 transition-colors">
                      Deshacer último cambio
                    </button>
                    <button type="button" onClick={onCerrar}
                      className="flex-1 text-[11px] text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg py-1.5 transition-colors">
                      Listo, cerrar
                    </button>
                  </div>
                )}
                {chat.modo === 'generar' && chat.mensajes.length > 0 && !chat.cargando && (
                  <div className="px-6 pt-3">
                    <button type="button" onClick={() => enviar('Genera el contenido ya con la información disponible, no preguntes más.')}
                      className="w-full text-[11px] text-[#6b7280] hover:text-cyan-600 border border-dashed border-gray-200 hover:border-cyan-300 rounded-lg py-1.5 transition-colors">
                      Generar ya con lo que tengo
                    </button>
                  </div>
                )}
                {ultimo?.role === 'assistant' && ultimo.opciones && ultimo.opciones.length > 0 && !chat.cargando
                  ? <p className="px-6 pt-2 text-[10px] text-[#9ca3af]">O escribe tu propia respuesta:</p> : null}
                <div className="px-6 py-3 flex items-center gap-2">
                  <input type="text" value={input} onChange={e => setInput(e.target.value)} disabled={chat.cargando}
                    onKeyDown={e => { if (e.key === 'Enter') enviar(input) }}
                    placeholder={chat.modo === 'mejorar' ? 'Dile a la IA qué está mal o qué cambiar…' : chat.modo === 'asesor' ? 'Pregunta lo que necesites sobre el lead…' : 'Escribe tu respuesta…'}
                    className="flex-1 text-xs text-[#111827] bg-white placeholder:text-[#9ca3af] border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-400 disabled:opacity-50 disabled:bg-gray-50" />
                  <button type="button" disabled={chat.cargando || !input.trim()} onClick={() => enviar(input)}
                    className="w-8 h-8 flex-shrink-0 rounded-lg bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white flex items-center justify-center transition-colors"><Send size={14} /></button>
                </div>
              </div>
            ) : (
              <div className="px-6 py-3 border-t border-gray-100 space-y-2">
                {chat.previo && (
                  <button type="button"
                    onClick={() => { deshacer(chat.previo!); setChat(prev => prev ? { ...prev, previo: undefined, mensajes: [...prev.mensajes, { role: 'assistant', content: 'Deshice el cambio: la nota quedó como estaba.' }] } : prev) }}
                    className="w-full text-[11px] text-[#6b7280] hover:text-cyan-600 border border-dashed border-gray-200 hover:border-cyan-300 rounded-lg py-1.5 transition-colors">
                    Deshacer en la nota
                  </button>
                )}
                <button type="button" onClick={onCerrar} className="w-full text-xs font-medium text-white bg-cyan-600 hover:bg-cyan-700 rounded-lg py-2 transition-colors">Listo, cerrar</button>
              </div>
            )}
          </div>
        )}
      </div>

      {oculto && (
        <button type="button" onClick={onMostrar} title="Mostrar el asistente de IA"
          className="fixed right-4 bottom-4 z-50 inline-flex items-center gap-2 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold pl-3 pr-4 py-2.5 shadow-lg print:hidden transition-colors">
          {chat?.cargando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          Asistente IA · {fase.label}
          <span className="opacity-80 font-normal">— Mostrar</span>
        </button>
      )}
    </>,
    document.body
  )
}
