'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, ChevronDown, ChevronRight, Sparkles, Check, X } from 'lucide-react'
import { api, post, hace } from './api'

// Fuentes del proyecto (MASD-0026-0005): reuniones (grabadas o no), notas, actas, documentos, correos e investigaciones.
// La fuente es evidencia: no se edita, se PROCESA. La IA extrae decisiones, acciones, preguntas, riesgos y contradicciones, y
// cada ítem espera una decisión humana. Aceptar una acción crea una tarea; aceptar una decisión crea una propuesta de cambio.

interface Fuente { id: string; tipo: string; titulo: string; fecha: string | null; visibilidad: string; estado: string; resumen: string | null; creadoPor: string | null; createdAt: string; items: number; pendientes: number }
interface Item { id: string; tipo: string; texto: string; cita: string | null; destinoArtefacto: string | null; responsable: string | null; estado: string; resultado: string | null }
interface Detalle { fuente: Fuente & { contenido: string }; items: Item[] }

const TIPOS = [
  { k: 'ACTA', txt: 'Acta' }, { k: 'NOTA', txt: 'Nota' }, { k: 'AUDIO', txt: 'Reunión grabada (transcripción)' },
  { k: 'DOCUMENTO', txt: 'Documento' }, { k: 'CORREO', txt: 'Correo' }, { k: 'INVESTIGACION', txt: 'Investigación' },
]
const COLOR_ITEM: Record<string, string> = { DECISION: '#818cf8', ACCION: '#34d399', PREGUNTA: '#fbbf24', RIESGO: '#f87171', CONTRADICCION: '#f472b6' }
const ROTULO_ITEM: Record<string, string> = { DECISION: 'Decisión', ACCION: 'Acción', PREGUNTA: 'Pregunta', RIESGO: 'Riesgo', CONTRADICCION: 'Contradicción' }

export default function PanelFuentes({ proyectoId }: { proyectoId: string }) {
  const [fuentes, setFuentes] = useState<Fuente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nueva, setNueva] = useState(false)
  const [form, setForm] = useState({ tipo: 'ACTA', titulo: '', fecha: '', contenido: '' })
  const [enviando, setEnviando] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [decidiendo, setDecidiendo] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    try { setFuentes((await api<{ fuentes: Fuente[] }>(`/api/proyectos/${proyectoId}/fuentes`)).fuentes) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron leer las fuentes') }
    finally { setCargando(false) }
  }, [proyectoId])
  useEffect(() => { void cargar() }, [cargar])

  async function abrir(id: string) {
    if (abierta === id) { setAbierta(null); setDetalle(null); return }
    setAbierta(id)
    try { setDetalle(await api<Detalle>(`/api/proyectos/${proyectoId}/fuentes/${id}`)) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir la fuente') }
  }

  async function guardar() {
    setEnviando(true); setError(null)
    try {
      await post(`/api/proyectos/${proyectoId}/fuentes`, form)
      setForm({ tipo: 'ACTA', titulo: '', fecha: '', contenido: '' }); setNueva(false); await cargar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') }
    finally { setEnviando(false) }
  }

  async function procesar(id: string) {
    setProcesando(id); setError(null)
    try { await post(`/api/proyectos/${proyectoId}/fuentes/${id}/procesar`); await cargar(); setDetalle(await api<Detalle>(`/api/proyectos/${proyectoId}/fuentes/${id}`)) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo procesar') }
    finally { setProcesando(null) }
  }

  async function decidir(item: Item, accion: 'aceptar' | 'descartar') {
    setDecidiendo(item.id); setError(null)
    try {
      await post(`/api/proyectos/${proyectoId}/acta-items/${item.id}/decidir`, { accion })
      if (abierta) setDetalle(await api<Detalle>(`/api/proyectos/${proyectoId}/fuentes/${abierta}`))
      await cargar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo decidir') }
    finally { setDecidiendo(null) }
  }

  if (cargando) return <div className="p-6 flex justify-center text-[#7f8a9c]"><Loader2 className="animate-spin" size={18} /></div>
  const campo = 'w-full bg-transparent rounded px-2 py-1.5 text-[12px] text-gray-100'
  const borde = { border: '1px solid rgba(255,255,255,0.15)' }

  return (
    <div className="p-3 space-y-3">
      {error && <p role="alert" className="text-[11px] text-red-300 rounded-lg px-3 py-2" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>{error}</p>}
      <p className="text-[11px] text-[#9aa6b8]">Actas, notas, transcripciones y documentos del proyecto. La IA extrae decisiones, acciones, preguntas y riesgos; tú decides cada uno.</p>

      {!nueva
        ? <button onClick={() => setNueva(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-indigo-100 hover:bg-white/10" style={{ border: '1px solid rgba(99,102,241,0.45)' }}><Plus size={12} />Agregar fuente</button>
        : (
          <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-gray-300">Tipo
                <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className={campo + ' mt-1'} style={borde}>
                  {TIPOS.map(t => <option key={t.k} value={t.k} style={{ color: '#111' }}>{t.txt}</option>)}
                </select></label>
              <label className="text-[11px] text-gray-300">Fecha
                <input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className={campo + ' mt-1'} style={borde} /></label>
            </div>
            <label className="block text-[11px] text-gray-300">Título
              <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Reunión de alcance con el cliente" className={campo + ' mt-1'} style={borde} /></label>
            <label className="block text-[11px] text-gray-300">Texto (pega el acta, la nota o la transcripción)
              <textarea value={form.contenido} onChange={e => setForm({ ...form, contenido: e.target.value })} rows={8} className={campo + ' mt-1 resize-y'} style={borde} /></label>
            <div className="flex gap-2">
              <button onClick={() => void guardar()} disabled={enviando || !form.titulo.trim() || !form.contenido.trim()} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-indigo-100 disabled:opacity-50" style={{ background: 'rgba(99,102,241,0.3)' }}>
                {enviando && <Loader2 size={12} className="animate-spin" />}Guardar</button>
              <button onClick={() => setNueva(false)} className="px-2.5 py-1.5 rounded text-[11px] text-[#9aa6b8] hover:bg-white/5">Cancelar</button>
            </div>
            <p className="text-[10.5px] text-[#7f8a9c]">Las reuniones grabadas se agregan con su transcripción (el audio no se transcribe aquí).</p>
          </div>)}

      {fuentes.length === 0 && !nueva && <p className="text-[11px] text-[#7f8a9c] text-center py-4">Aún no hay fuentes. Agrega la primera acta o nota.</p>}

      <ul className="space-y-1.5">
        {fuentes.map(f => {
          const ab = abierta === f.id
          return (
            <li key={f.id} className="rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <button onClick={() => void abrir(f.id)} aria-expanded={ab} className="w-full flex items-start gap-2 px-2.5 py-2 text-left">
                {ab ? <ChevronDown size={13} className="mt-0.5 text-[#7f8a9c] flex-shrink-0" /> : <ChevronRight size={13} className="mt-0.5 text-[#7f8a9c] flex-shrink-0" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] text-gray-100 leading-snug">{f.titulo}</span>
                  <span className="flex flex-wrap gap-x-2 text-[10.5px] text-[#9aa6b8]">
                    <span>{TIPOS.find(t => t.k === f.tipo)?.txt ?? f.tipo}</span><span>{hace(f.createdAt)}</span>
                    {f.estado === 'SIN_PROCESAR' ? <span className="text-amber-300">sin procesar</span> : <span>{f.items} ítems{f.pendientes > 0 && <b className="text-amber-300"> · {f.pendientes} por decidir</b>}</span>}
                  </span>
                </span>
              </button>
              {ab && detalle && detalle.fuente.id === f.id && (
                <div className="px-3 pb-3 space-y-2">
                  {detalle.fuente.resumen && <p className="text-[11px] text-gray-300">{detalle.fuente.resumen}</p>}
                  <button onClick={() => void procesar(f.id)} disabled={procesando === f.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] text-indigo-100 hover:bg-white/10 disabled:opacity-50" style={{ border: '1px solid rgba(99,102,241,0.45)' }}>
                    {procesando === f.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}{f.estado === 'SIN_PROCESAR' ? 'Extraer decisiones, acciones y riesgos' : 'Volver a procesar (reemplaza los ítems sin decidir)'}
                  </button>
                  <ul className="space-y-1.5">
                    {detalle.items.map(it => (
                      <li key={it.id} className="rounded-md px-2 py-1.5" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${it.estado === 'PENDIENTE' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'}`, opacity: it.estado === 'DESCARTADO' ? 0.55 : 1 }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLOR_ITEM[it.tipo] }}>{ROTULO_ITEM[it.tipo] ?? it.tipo}{it.responsable ? ` · ${it.responsable}` : ''}{it.destinoArtefacto ? ` · ${it.destinoArtefacto}` : ''}</p>
                        <p className="text-[11.5px] text-gray-200">{it.texto}</p>
                        {it.cita && <p className="text-[10.5px] text-[#7f8a9c] italic">«{it.cita}»</p>}
                        {it.estado === 'PENDIENTE'
                          ? (
                            <div className="mt-1.5 flex gap-1.5">
                              <button onClick={() => void decidir(it, 'aceptar')} disabled={decidiendo === it.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] text-emerald-200 disabled:opacity-50" style={{ border: '1px solid rgba(52,211,153,0.4)' }}><Check size={11} />Aceptar</button>
                              <button onClick={() => void decidir(it, 'descartar')} disabled={decidiendo === it.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] text-[#9aa6b8] disabled:opacity-50" style={{ border: '1px solid rgba(255,255,255,0.12)' }}><X size={11} />Descartar</button>
                            </div>)
                          : <p className="mt-1 text-[10.5px] text-[#9aa6b8]">{it.estado === 'ACEPTADO' ? `✓ ${it.resultado ?? 'Aceptado'}` : 'Descartado'}</p>}
                      </li>))}
                  </ul>
                </div>)}
            </li>)
        })}
      </ul>
    </div>
  )
}
