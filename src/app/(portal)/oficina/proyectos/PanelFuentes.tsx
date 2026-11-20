'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, ChevronDown, ChevronRight, Sparkles, Check, X, Send, CalendarDays, Trash2 } from 'lucide-react'
import { api, post, hace } from './api'

// Fuentes y memoria del proyecto (MASD-0026-0002 y 0005): reuniones (grabadas o no), notas, actas, documentos, correos e
// investigaciones. La fuente es evidencia: no se edita, se PROCESA. La IA extrae decisiones, acciones, preguntas, riesgos y
// contradicciones, y cada ítem espera una decisión humana. Aquí también: traspaso entre personas, decisiones tomadas y preguntas
// al proyecto con citas.

interface Fuente { id: string; tipo: string; titulo: string; fecha: string | null; visibilidad: string; estado: string; resumen: string | null; creadoPor: string | null; createdAt: string; items: number; pendientes: number; meta: Record<string, string | null>; origen: string | null; purgada: boolean; vencida: boolean }
interface Item { id: string; tipo: string; texto: string; cita: string | null; minuto: string | null; destinoArtefacto: string | null; responsable: string | null; estado: string; resultado: string | null }
interface Detalle { fuente: Fuente & { contenido: string }; items: Item[] }
interface Reunion { id: string; titulo: string; fecha: string | null; tipo: string | null; conContenido: boolean }
interface Decision { origen: string; texto: string; cita: string | null; minuto: string | null; fuente: string | null; destino: string | null; por: string | null; fecha: string | null }
interface Respuesta { respuesta: string; citas: { n: number; tipo: string; titulo: string; id: string }[]; sinRespaldo: boolean }

const TIPOS = [
  { k: 'ACTA', txt: 'Acta' }, { k: 'NOTA', txt: 'Nota' }, { k: 'AUDIO', txt: 'Reunión grabada (transcripción)' },
  { k: 'DOCUMENTO', txt: 'Documento' }, { k: 'CORREO', txt: 'Correo' }, { k: 'INVESTIGACION', txt: 'Investigación' },
]
const COLOR_ITEM: Record<string, string> = { DECISION: '#818cf8', ACCION: '#34d399', PREGUNTA: '#fbbf24', RIESGO: '#f87171', CONTRADICCION: '#f472b6' }
const ROTULO_ITEM: Record<string, string> = { DECISION: 'Decisión', ACCION: 'Acción', PREGUNTA: 'Pregunta', RIESGO: 'Riesgo', CONTRADICCION: 'Contradicción' }
const campo = 'w-full bg-transparent rounded px-2 py-1.5 text-[12px] text-gray-100'
const borde = { border: '1px solid rgba(255,255,255,0.15)' }
const caja = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }

function Preguntar({ proyectoId }: { proyectoId: string }) {
  const [q, setQ] = useState('')
  const [r, setR] = useState<Respuesta | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function enviar() {
    setCargando(true); setError(null); setR(null)
    try { setR(await post<Respuesta>(`/api/proyectos/${proyectoId}/preguntar`, { pregunta: q })) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo responder') }
    finally { setCargando(false) }
  }
  return (
    <section aria-label="Preguntar al proyecto" className="rounded-lg p-3 space-y-2" style={caja}>
      <h3 className="text-[10px] uppercase tracking-wider font-semibold text-[#7f8a9c]">Pregúntale al proyecto</h3>
      <form onSubmit={e => { e.preventDefault(); if (q.trim()) void enviar() }} className="flex gap-1.5">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="¿Qué se decidió sobre los recordatorios?" aria-label="Pregunta" className={campo} style={borde} />
        <button type="submit" disabled={cargando || !q.trim()} aria-label="Preguntar" className="px-2.5 rounded text-indigo-100 disabled:opacity-50" style={{ background: 'rgba(99,102,241,0.3)' }}>{cargando ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}</button>
      </form>
      {error && <p role="alert" className="text-[11px] text-red-300">{error}</p>}
      {r && (
        <div className="space-y-1.5">
          <p className={`text-[11.5px] whitespace-pre-wrap ${r.sinRespaldo ? 'text-amber-200' : 'text-gray-200'}`}>{r.respuesta}</p>
          {r.citas.length > 0 && <ul className="text-[10.5px] text-[#7f8a9c] space-y-0.5">{r.citas.map(c => <li key={c.n}>[{c.n}] {c.tipo} · {c.titulo}</li>)}</ul>}
        </div>)}
    </section>
  )
}

function Traspaso({ proyectoId }: { proyectoId: string }) {
  const [mensaje, setMensaje] = useState('')
  const [para, setPara] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'listo'>('idle')
  const [error, setError] = useState<string | null>(null)
  async function enviar() {
    setEstado('enviando'); setError(null)
    try { await post(`/api/proyectos/${proyectoId}/traspaso`, { mensaje, para }); setMensaje(''); setPara(''); setEstado('listo') }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar'); setEstado('idle') }
  }
  return (
    <section aria-label="Nota de traspaso" className="rounded-lg p-3 space-y-2" style={caja}>
      <h3 className="text-[10px] uppercase tracking-wider font-semibold text-[#7f8a9c]">Nota de traspaso</h3>
      <p className="text-[10.5px] text-[#9aa6b8]">Al dejar el proyecto o cambiar de turno, deja aquí lo que la siguiente persona debe saber. Queda en la memoria, con tu nombre y la fecha.</p>
      <input value={para} onChange={e => { setPara(e.target.value); setEstado('idle') }} placeholder="Para quién (opcional)" aria-label="Para quién" className={campo} style={borde} />
      <textarea value={mensaje} onChange={e => { setMensaje(e.target.value); setEstado('idle') }} rows={3} placeholder="Qué quedó hecho, qué sigue y qué hay que tener cuidado." aria-label="Nota" className={campo + ' resize-y'} style={borde} />
      <div className="flex items-center gap-2">
        <button onClick={() => void enviar()} disabled={estado === 'enviando' || !mensaje.trim()} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] text-indigo-100 disabled:opacity-50" style={{ background: 'rgba(99,102,241,0.3)' }}>{estado === 'enviando' && <Loader2 size={12} className="animate-spin" />}Dejar la nota</button>
        {estado === 'listo' && <span role="status" className="text-[11px] text-emerald-300">Guardada en la memoria.</span>}
      </div>
      {error && <p role="alert" className="text-[11px] text-red-300">{error}</p>}
    </section>
  )
}

function Decisiones({ proyectoId }: { proyectoId: string }) {
  const [abierto, setAbierto] = useState(false)
  const [lista, setLista] = useState<Decision[] | null>(null)
  async function alternar() {
    setAbierto(a => !a)
    if (!lista) { try { setLista((await api<{ decisiones: Decision[] }>(`/api/proyectos/${proyectoId}/decisiones`)).decisiones) } catch { setLista([]) } }
  }
  return (
    <section aria-label="Decisiones tomadas" className="rounded-lg px-3 py-2" style={caja}>
      <button onClick={() => void alternar()} aria-expanded={abierto} className="w-full flex items-center gap-1.5 text-left text-[10px] uppercase tracking-wider font-semibold text-[#7f8a9c]">
        {abierto ? <ChevronDown size={12} /> : <ChevronRight size={12} />}Decisiones tomadas{lista ? ` (${lista.length})` : ''}</button>
      {abierto && (
        <ul className="mt-2 space-y-1.5">
          {lista === null && <Loader2 size={13} className="animate-spin text-[#7f8a9c]" />}
          {lista?.length === 0 && <li className="text-[11px] text-[#7f8a9c]">Todavía no hay decisiones aceptadas.</li>}
          {lista?.map((d, i) => (
            <li key={i} className="rounded px-2 py-1.5" style={{ background: 'rgba(0,0,0,0.2)' }}>
              <p className="text-[11.5px] text-gray-200">{d.texto}</p>
              <p className="text-[10.5px] text-[#7f8a9c]">{d.por ?? '—'}{d.fecha ? ` · ${hace(d.fecha)}` : ''}{d.fuente ? ` · ${d.fuente}` : ''}{d.minuto ? ` · min ${d.minuto}` : ''}{d.destino ? ` · ${d.destino}` : ''}</p>
              {d.cita && <p className="text-[10.5px] text-[#7f8a9c] italic">«{d.cita}»</p>}
            </li>))}
        </ul>)}
    </section>
  )
}

export default function PanelFuentes({ proyectoId }: { proyectoId: string }) {
  const [fuentes, setFuentes] = useState<Fuente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nueva, setNueva] = useState(false)
  const [form, setForm] = useState({ tipo: 'ACTA', titulo: '', fecha: '', contenido: '', pregunta: '', confianza: 'MEDIA', caduca: '' })
  const [enviando, setEnviando] = useState(false)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<Detalle | null>(null)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [decidiendo, setDecidiendo] = useState<string | null>(null)
  const [reuniones, setReuniones] = useState<Reunion[] | null>(null)
  const [trayendo, setTrayendo] = useState<string | null>(null)

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
      setForm({ tipo: 'ACTA', titulo: '', fecha: '', contenido: '', pregunta: '', confianza: 'MEDIA', caduca: '' }); setNueva(false); await cargar()
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

  async function verReuniones() {
    setError(null)
    try { setReuniones((await api<{ reuniones: Reunion[] }>(`/api/proyectos/${proyectoId}/reuniones-disponibles`)).reuniones) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron leer las reuniones') }
  }

  async function traer(r: Reunion) {
    setTrayendo(r.id); setError(null)
    try { await post(`/api/proyectos/${proyectoId}/fuentes/desde-reunion`, { meetingId: r.id }); setReuniones(null); await cargar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo traer la reunión') }
    finally { setTrayendo(null) }
  }

  async function purgar(f: Fuente) {
    if (!window.confirm('Se borrará el texto de esta fuente (por ejemplo una transcripción que ya cumplió su plazo). Lo que se extrajo de ella se conserva. ¿Continuar?')) return
    setError(null)
    try { await post(`/api/proyectos/${proyectoId}/fuentes/${f.id}/purgar`); await cargar(); setAbierta(null); setDetalle(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo borrar el texto') }
  }

  if (cargando) return <div className="p-6 flex justify-center text-[#7f8a9c]"><Loader2 className="animate-spin" size={18} /></div>
  const esInv = form.tipo === 'INVESTIGACION'
  const puedeGuardar = form.titulo.trim() && form.contenido.trim() && (!esInv || form.pregunta.trim())

  return (
    <div className="p-3 space-y-3">
      {error && <p role="alert" className="text-[11px] text-red-300 rounded-lg px-3 py-2" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>{error}</p>}

      <Preguntar proyectoId={proyectoId} />

      <div className="flex flex-wrap gap-1.5">
        {!nueva && <button onClick={() => setNueva(true)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-indigo-100 hover:bg-white/10" style={{ border: '1px solid rgba(99,102,241,0.45)' }}><Plus size={12} />Agregar fuente</button>}
        <button onClick={() => void verReuniones()} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-gray-200 hover:bg-white/10" style={borde}><CalendarDays size={12} />Traer una reunión del calendario</button>
      </div>

      {reuniones && (
        <div className="rounded-lg p-2 space-y-1" style={caja}>
          <p className="text-[10.5px] text-[#9aa6b8]">Tus reuniones recientes. Se importan sus notas, el hub y las acciones como un acta.</p>
          {reuniones.length === 0 && <p className="text-[11px] text-[#7f8a9c]">No hay reuniones disponibles.</p>}
          <ul className="space-y-1 max-h-[220px] overflow-auto">
            {reuniones.map(r => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-[11.5px]">
                <span className="min-w-0 truncate text-gray-200">{r.titulo}<span className="text-[#7f8a9c]"> · {r.fecha ? hace(r.fecha) : ''}</span></span>
                <button onClick={() => void traer(r)} disabled={!r.conContenido || trayendo === r.id} title={r.conContenido ? '' : 'Sin notas ni acciones registradas'} className="flex-shrink-0 px-2 py-0.5 rounded text-[10.5px] text-indigo-100 disabled:opacity-40" style={{ border: '1px solid rgba(99,102,241,0.45)' }}>{trayendo === r.id ? '…' : 'Traer'}</button>
              </li>))}
          </ul>
          <button onClick={() => setReuniones(null)} className="text-[10.5px] text-[#7f8a9c] hover:text-gray-300">Cerrar</button>
        </div>)}

      {nueva && (
        <div className="rounded-lg p-3 space-y-2" style={caja}>
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
          {esInv && (
            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2 text-[11px] text-gray-300">¿Qué se quiere saber?
                <input value={form.pregunta} onChange={e => setForm({ ...form, pregunta: e.target.value })} className={campo + ' mt-1'} style={borde} /></label>
              <label className="text-[11px] text-gray-300">Confianza en la conclusión
                <select value={form.confianza} onChange={e => setForm({ ...form, confianza: e.target.value })} className={campo + ' mt-1'} style={borde}>
                  {['ALTA', 'MEDIA', 'BAJA'].map(c => <option key={c} value={c} style={{ color: '#111' }}>{c.charAt(0) + c.slice(1).toLowerCase()}</option>)}</select></label>
              <label className="text-[11px] text-gray-300">Revisar a partir de
                <input type="date" value={form.caduca} onChange={e => setForm({ ...form, caduca: e.target.value })} className={campo + ' mt-1'} style={borde} /></label>
            </div>)}
          <label className="block text-[11px] text-gray-300">{esInv ? 'Hallazgos, fuentes consultadas y conclusión' : 'Texto (pega el acta, la nota o la transcripción; si trae marcas como [12:34], se guardan como minuto)'}
            <textarea value={form.contenido} onChange={e => setForm({ ...form, contenido: e.target.value })} rows={8} className={campo + ' mt-1 resize-y'} style={borde} /></label>
          <div className="flex gap-2">
            <button onClick={() => void guardar()} disabled={enviando || !puedeGuardar} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] text-indigo-100 disabled:opacity-50" style={{ background: 'rgba(99,102,241,0.3)' }}>{enviando && <Loader2 size={12} className="animate-spin" />}Guardar</button>
            <button onClick={() => setNueva(false)} className="px-2.5 py-1.5 rounded text-[11px] text-[#9aa6b8] hover:bg-white/5">Cancelar</button>
          </div>
          <p className="text-[10.5px] text-[#7f8a9c]">El audio no se transcribe aquí: pega su transcripción.</p>
        </div>)}

      {fuentes.length === 0 && !nueva && <p className="text-[11px] text-[#7f8a9c] text-center py-2">Aún no hay fuentes. Agrega la primera acta o nota.</p>}

      <ul className="space-y-1.5">
        {fuentes.map(f => {
          const ab = abierta === f.id
          return (
            <li key={f.id} className="rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${f.vencida ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.06)'}` }}>
              <button onClick={() => void abrir(f.id)} aria-expanded={ab} className="w-full flex items-start gap-2 px-2.5 py-2 text-left">
                {ab ? <ChevronDown size={13} className="mt-0.5 text-[#7f8a9c] flex-shrink-0" /> : <ChevronRight size={13} className="mt-0.5 text-[#7f8a9c] flex-shrink-0" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] text-gray-100 leading-snug">{f.titulo}</span>
                  <span className="flex flex-wrap gap-x-2 text-[10.5px] text-[#9aa6b8]">
                    <span>{TIPOS.find(t => t.k === f.tipo)?.txt ?? f.tipo}</span><span>{hace(f.createdAt)}</span>
                    {f.vencida && <b className="text-amber-300">revisar: caducó</b>}
                    {f.purgada && <span>texto borrado</span>}
                    {f.estado === 'SIN_PROCESAR' ? <span className="text-amber-300">sin procesar</span> : <span>{f.items} ítems{f.pendientes > 0 && <b className="text-amber-300"> · {f.pendientes} por decidir</b>}</span>}
                  </span>
                </span>
              </button>
              {ab && detalle && detalle.fuente.id === f.id && (
                <div className="px-3 pb-3 space-y-2">
                  {f.tipo === 'INVESTIGACION' && (
                    <p className="text-[11px] text-gray-300"><b>Pregunta:</b> {f.meta?.pregunta} · <b>Confianza:</b> {f.meta?.confianza}{f.meta?.caduca ? ` · revisar desde ${f.meta.caduca}` : ''}</p>)}
                  {detalle.fuente.resumen && <p className="text-[11px] text-gray-300">{detalle.fuente.resumen}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => void procesar(f.id)} disabled={procesando === f.id || f.purgada} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] text-indigo-100 hover:bg-white/10 disabled:opacity-50" style={{ border: '1px solid rgba(99,102,241,0.45)' }}>
                      {procesando === f.id ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}{f.estado === 'SIN_PROCESAR' ? 'Extraer decisiones, acciones y riesgos' : 'Volver a procesar (reemplaza los ítems sin decidir)'}</button>
                    {!f.purgada && <button onClick={() => void purgar(f)} className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10.5px] text-[#9aa6b8] hover:bg-white/5" style={borde}><Trash2 size={11} />Borrar el texto</button>}
                  </div>
                  <ul className="space-y-1.5">
                    {detalle.items.map(it => (
                      <li key={it.id} className="rounded-md px-2 py-1.5" style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${it.estado === 'PENDIENTE' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'}`, opacity: it.estado === 'DESCARTADO' ? 0.55 : 1 }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: COLOR_ITEM[it.tipo] }}>{ROTULO_ITEM[it.tipo] ?? it.tipo}{it.responsable ? ` · ${it.responsable}` : ''}{it.destinoArtefacto ? ` · ${it.destinoArtefacto}` : ''}{it.minuto ? ` · min ${it.minuto}` : ''}</p>
                        <p className="text-[11.5px] text-gray-200">{it.texto}</p>
                        {it.cita && <p className="text-[10.5px] text-[#7f8a9c] italic">«{it.cita}»</p>}
                        {it.estado === 'PENDIENTE'
                          ? (
                            <div className="mt-1.5 flex gap-1.5">
                              <button onClick={() => void decidir(it, 'aceptar')} disabled={decidiendo === it.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] text-emerald-200 disabled:opacity-50" style={{ border: '1px solid rgba(52,211,153,0.4)' }}><Check size={11} />Aceptar</button>
                              <button onClick={() => void decidir(it, 'descartar')} disabled={decidiendo === it.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] text-[#9aa6b8] disabled:opacity-50" style={borde}><X size={11} />Descartar</button>
                            </div>)
                          : <p className="mt-1 text-[10.5px] text-[#9aa6b8]">{it.estado === 'ACEPTADO' ? `✓ ${it.resultado ?? 'Aceptado'}` : 'Descartado'}</p>}
                      </li>))}
                  </ul>
                </div>)}
            </li>)
        })}
      </ul>

      <Decisiones proyectoId={proyectoId} />
      <Traspaso proyectoId={proyectoId} />
    </div>
  )
}
