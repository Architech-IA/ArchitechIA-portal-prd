'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Loader2, Send, Paperclip, Lock, Unlock, ListPlus, CheckCircle2, RotateCcw, GitBranch, Copy, ChevronDown, ChevronRight,
  AlertTriangle, Archive, Trash2, X, Brain, User, Sparkles,
} from 'lucide-react'
import { ETIQUETA_TIPO, type TipoSesion } from '@/lib/proyectos/tipos'
import type { RolSesion } from './api'
import { api, post, put, patch, del, fechaHora, kb, pctCache, type Mensaje, type SesionFull, type SesionRes, type Adjunto } from './api'
import { Md, opcionesNumeradas } from './Md'
import PlanTareas from './PlanTareas'

const POLL_RAPIDO = 1500
const POLL_LENTO = 12000

export default function ChatSesion({ proyectoId, sesion, yo, onCambio, onAbrirSesion, onSesion, onAbrirPanel, rolInfo, acciones }: {
  acciones?: React.ReactNode
  rolInfo?: { fase: string; rol: RolSesion } | null
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
  // La franja del rol se puede plegar; se recuerda la elección.
  const [rolAbierto, setRolAbierto] = useState(true)
  useEffect(() => { try { if (localStorage.getItem('proyectos.rol') === '0') setRolAbierto(false) } catch { /* sin almacenamiento */ } }, [])
  const alternarRol = () => setRolAbierto(o => { const n = !o; try { localStorage.setItem('proyectos.rol', n ? '1' : '0') } catch { /* sin almacenamiento */ } return n })
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
  // Lo que la IA dejó pendiente de confirmación desde esta sesión (notas tras consultar la web, tareas de backlog)
  interface AccionIA { id: string; tipo: 'NOTA' | 'TAREAS' | 'PLAN' | 'EJECUCION_RED' | 'DESPLIEGUE'; titulo: string; payload: { comando?: string; nota?: string; migrar?: boolean; entorno?: string; rama?: string; revertir?: boolean; base?: string; semilla?: boolean; texto?: string; fase?: string; tareas?: { title: string; priority?: string }[]; epicas?: { nombre: string; inicio?: string | null; fin?: string | null }[]; sprints?: { nombre: string; epica?: string | null; tareas?: string[]; inicio?: string | null; fin?: string | null }[] }; motivo: string | null }
  const [accionesIA, setAccionesIA] = useState<AccionIA[]>([])
  const [accionOcupada, setAccionOcupada] = useState<string | null>(null)
  const cargarAcciones = useCallback(() => {
    api<AccionIA[]>(`/api/proyectos/${proyectoId}/acciones-ia?sesionId=${sesion.id}`).then(l => setAccionesIA(Array.isArray(l) ? l : [])).catch(() => setAccionesIA([]))
  }, [proyectoId, sesion.id])
  useEffect(() => { if (!generando) cargarAcciones() }, [generando, mensajes.length, cargarAcciones])
  async function decidirAccion(a: AccionIA, accion: 'aplicar' | 'rechazar') {
    setAccionOcupada(a.id); setError(null)
    try { await post(`/api/proyectos/${proyectoId}/acciones-ia/${a.id}/decidir`, { accion }); cargarAcciones(); onCambio() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo decidir') }
    finally { setAccionOcupada(null) }
  }
  // Sesión de DESARROLLO: lo que la IA cambió en su rama; subir o descartar la rama es decisión humana (administrador)
  interface EstadoDev { existe?: boolean; rama?: string; archivos?: string[]; stat?: string; commits?: string[]; capturas?: string[]; servicios?: string[]; tareas?: { taskCode: string | null; title: string; estado: string; sprintCode: string | null }[] }
  const [devAbierto, setDevAbierto] = useState(false)
  const [devEstado, setDevEstado] = useState<EstadoDev | null>(null)
  const [devDiff, setDevDiff] = useState('')
  const [varsPrueba, setVarsPrueba] = useState<string[] | null>(null)
  const [varNombre, setVarNombre] = useState('')
  const [varValor, setVarValor] = useState('')
  async function guardarVariable() {
    setDevOcupado(true); setDevMsg('')
    try { const r = await put<{ nombres: string[] }>(`/api/proyectos/${proyectoId}/variables-prueba`, { nombre: varNombre.trim(), valor: varValor }); setVarsPrueba(r.nombres); setVarNombre(''); setVarValor(''); setDevMsg('Variable guardada. Sus valores no se vuelven a mostrar.') }
    catch (e) { setDevMsg(e instanceof Error ? e.message : 'No se pudo guardar la variable') }
    finally { setDevOcupado(false) }
  }
  async function quitarVariable(n: string) {
    setDevOcupado(true); setDevMsg('')
    try { const r = await del<{ nombres: string[] }>(`/api/proyectos/${proyectoId}/variables-prueba?nombre=${encodeURIComponent(n)}`); setVarsPrueba(r.nombres) }
    catch (e) { setDevMsg(e instanceof Error ? e.message : 'No se pudo quitar la variable') }
    finally { setDevOcupado(false) }
  }
  const [devOcupado, setDevOcupado] = useState(false)
  const [devMsg, setDevMsg] = useState('')
  async function cargarDev() {
    setDevOcupado(true); setDevMsg('')
    try {
      setDevEstado(await post<EstadoDev>(`${base}/dev/estado`))
      const d = await post<{ texto?: string }>(`${base}/dev/diff`).catch(() => ({ texto: '' }))
      setDevDiff(d.texto ?? '')
      api<{ nombres: string[] }>(`/api/proyectos/${proyectoId}/variables-prueba`).then(r => setVarsPrueba(r.nombres)).catch(() => setVarsPrueba(null))
    } catch (e) { setDevMsg(e instanceof Error ? e.message : 'No se pudo leer el estado') }
    finally { setDevOcupado(false) }
  }
  async function subirRama() {
    if (!window.confirm('Se sube la rama de esta sesión a GitHub (no se fusiona nada). ¿Continuar?')) return
    setDevOcupado(true); setDevMsg('')
    try { const r = await post<{ urlPr?: string | null; rama?: string }>(`${base}/dev/subir`); setDevMsg(`Rama «${r.rama}» subida.${r.urlPr ? ' Abre el pull request aquí: ' + r.urlPr : ''}`) }
    catch (e) { setDevMsg(e instanceof Error ? e.message : 'No se pudo subir la rama') }
    finally { setDevOcupado(false) }
  }
  async function integrarSprint() {
    if (!window.confirm('Se une la rama de esta sesión a la rama de integración del sprint (la misma que usa el ejecutor); el pull request del sprint sigue su camino de siempre. Si hay conflictos se aborta y el sprint queda como estaba. ¿Continuar?')) return
    setDevOcupado(true); setDevMsg('')
    try { const r = await post<{ texto?: string }>(`${base}/dev/integrar`); setDevMsg(r.texto ?? 'Rama integrada en el sprint.') }
    catch (e) { setDevMsg(e instanceof Error ? e.message : 'No se pudo integrar en el sprint') }
    finally { setDevOcupado(false) }
  }
  async function descartarRama() {
    if (!window.confirm('Se borra el espacio de trabajo y la rama LOCAL de esta sesión (lo que no hayas subido se pierde). ¿Continuar?')) return
    setDevOcupado(true); setDevMsg('')
    try { await post(`${base}/dev/descartar`); setDevMsg('Espacio de trabajo descartado.'); await cargarDev() }
    catch (e) { setDevMsg(e instanceof Error ? e.message : 'No se pudo descartar') }
    finally { setDevOcupado(false) }
  }
  const [prdOcupado, setPrdOcupado] = useState(false)
  // Borrador de nota para las notas de la fase: la IA lo redacta, la persona lo revisa y recién ahí se agrega.
  const [notaBorrador, setNotaBorrador] = useState<{ fase: string; titulo: string; texto: string } | null>(null)
  const [notaOcupada, setNotaOcupada] = useState(false)
  async function proponerNota() {
    setNotaOcupada(true); setError(null); setAviso(null)
    try { setNotaBorrador(await post<{ fase: string; titulo: string; texto: string }>(`${base}/notas/proponer`)) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo redactar la nota') }
    finally { setNotaOcupada(false) }
  }
  async function guardarNota() {
    if (!notaBorrador || !notaBorrador.texto.trim()) return
    setNotaOcupada(true); setError(null)
    try {
      await post(`/api/proyectos/${proyectoId}/notas/${notaBorrador.fase}/agregar`, { titulo: notaBorrador.titulo, texto: notaBorrador.texto })
      setNotaBorrador(null); setAviso('Nota agregada a «Notas de la fase» como una pestaña nueva. Lo que ya estaba no se tocó.'); onCambio()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la nota') }
    finally { setNotaOcupada(false) }
  }
  // Genera el PRD con esta conversación y lo deja como propuesta en el artefacto: no se aplica hasta que alguien la acepta.
  async function proponerPrd() {
    if (!window.confirm('Se generará un borrador de PRD con esta conversación y el contexto del proyecto. Quedará como PROPUESTA en el artefacto PRD (no cambia nada hasta que alguien la acepte). Puede tardar 1–2 minutos. ¿Continuar?')) return
    setPrdOcupado(true); setError(null); setAviso(null)
    try {
      const r = await post<{ requisitos: number; avisos?: string[] }>(`${base}/prd/proponer`)
      setAviso(`PRD propuesto con ${r.requisitos} requisito(s). Ábrelo en Artefactos › PRD: ahí lo revisas y lo aceptas o lo rechazas.${r.avisos?.length ? ' ' + r.avisos.join(' ') : ''}`)
      onCambio()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo proponer el PRD') }
    finally { setPrdOcupado(false) }
  }
  async function cerrar() {
    const falta = (full?.cierre ?? sesion.cierre ?? []).filter(x => !x.ok).length
    if (!window.confirm((falta ? `Faltan ${falta} punto(s) de la lista de cierre. ` : '') + '¿Cerrar la sesión? Queda guardada completa; se generará un resumen y una propuesta de actualización de la memoria del proyecto.')) return
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
            className="min-w-0 text-left text-[13px] font-semibold text-gray-100 truncate hover:text-white">{full?.titulo ?? sesion.titulo}</button>
        )}
        {acciones}
        <span className="flex-1" />
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide flex-shrink-0" style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc' }}>{ETIQUETA_TIPO[tipo] ?? tipo}</span>
        {full && !esBitacora && (
          <button onClick={() => soyDuenio && void cambiar({ privada: !full.privada })} disabled={!soyDuenio}
            title={full.privada ? 'Privada: solo la ves tú. Clic para compartir con el equipo' : soyDuenio ? 'Compartida con el equipo. Clic para hacerla privada' : `Compartida · creada por ${full.creadaPorNombre}`}
            className="flex-shrink-0 text-[#7f8a9c] hover:text-gray-200 disabled:hover:text-[#7f8a9c]">{full.privada ? <Lock size={13} className="text-amber-400" /> : <Unlock size={13} />}</button>
        )}
        {!esBitacora && !cerrada && (
          <>
            <button onClick={() => setPlan(true)} disabled={mensajes.length < 2 || generando} title="El coordinador propone tareas de backlog a partir de esta conversación"
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-indigo-200 disabled:opacity-40 flex-shrink-0" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <ListPlus size={11} /> Convertir en tareas
            </button>
            {tipo === 'DESARROLLO' && (
              <button onClick={() => { setDevAbierto(true); void cargarDev() }} title="Qué cambió la IA en su rama: archivos, commits y diff; subir o descartar la rama"
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg disabled:opacity-40 flex-shrink-0" style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', color: '#fed7aa', fontWeight: 600 }}>
                <GitBranch size={11} /> Desarrollo
              </button>)}
            {sesion.faseClave && (
              <button onClick={() => void proponerNota()} disabled={mensajes.length < 2 || generando || notaOcupada} title="La IA redacta una nota con lo acordado en esta conversación; tú la revisas antes de agregarla a las notas de la fase"
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-gray-200 disabled:opacity-40 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}>
                {notaOcupada && !notaBorrador ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} Guardar en notas
              </button>)}
            <button onClick={() => void proponerPrd()} disabled={mensajes.length < 2 || generando || prdOcupado} title="Genera el PRD con esta conversación y lo deja como propuesta en el artefacto PRD (también puedes editarlo a mano desde Artefactos)"
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg disabled:opacity-40 flex-shrink-0" style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.35)', color: '#fed7aa' }}>
              {prdOcupado ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} {prdOcupado ? 'Generando PRD…' : 'Proponer PRD'}
            </button>
            <button onClick={() => void cerrar()} disabled={generando || mensajes.length === 0} title="Cerrar: resumen final y propuesta de memoria"
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-gray-300 border border-white/10 hover:bg-white/5 disabled:opacity-40 flex-shrink-0"><CheckCircle2 size={11} /> Cerrar sesión</button>
          </>
        )}
        {!esBitacora && soyDuenio && (
          <>
            <button onClick={() => { if (window.confirm('¿Archivar la sesión? Deja de aparecer en la lista (se conserva).')) void cambiar({ estado: 'ARCHIVADA' }).then(() => onAbrirSesion(null)) }} title="Archivar" className="text-[#7f8a9c] hover:text-gray-200 flex-shrink-0"><Archive size={13} /></button>
            <button onClick={() => void eliminar()} title="Eliminar" className="text-[#7f8a9c] hover:text-red-400 flex-shrink-0"><Trash2 size={13} /></button>
          </>
        )}
      </div>

      {/* Rol de la sesión en su fase: objetivo y lista de cierre */}
      {rolInfo && (() => {
        const cierre = full?.cierre ?? sesion.cierre ?? []
        const ok = cierre.filter(x => x.ok).length
        return (
          <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 space-y-1.5 text-[11px]" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <button onClick={alternarRol} aria-expanded={rolAbierto} title={rolAbierto ? 'Ocultar el rol y la lista de cierre' : 'Mostrar el rol y la lista de cierre'} className="w-full flex items-center gap-2 text-left">
              {rolAbierto ? <ChevronDown size={13} className="text-indigo-300 flex-shrink-0" /> : <ChevronRight size={13} className="text-indigo-300 flex-shrink-0" />}
              <span className="font-semibold text-indigo-200 flex-shrink-0">{rolInfo.fase} · {rolInfo.rol.titulo}</span>
              {rolAbierto && <span className="text-[#9ca3af] flex-1 truncate" title={rolInfo.rol.objetivo}>{rolInfo.rol.objetivo}</span>}
              {!rolAbierto && <span className="flex-1" />}
              <span className="text-[#9ca3af] flex-shrink-0" title="Puntos de la lista de cierre cumplidos">{ok}/{cierre.length}</span>
            </button>
            {rolAbierto && <div className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5">
              {cierre.map((x, i) => (
                <label key={i} className="flex items-start gap-1.5 text-gray-300 cursor-pointer">
                  <input type="checkbox" checked={x.ok} disabled={cerrada} onChange={e => void cambiar({ cierre: cierre.map((y, j) => (j === i ? e.target.checked : y.ok)) })} className="accent-indigo-500 mt-0.5" />
                  <span className={x.ok ? 'line-through opacity-60' : ''}>{x.texto}</span>
                </label>))}
            </div>}
          </div>)
      })()}

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
        {cargando && <div className="flex justify-center py-10 text-[#7f8a9c]"><Loader2 size={18} className="animate-spin" /></div>}
        {!cargando && mensajes.length === 0 && !error && (
          <div className="text-center text-[12px] text-[#7f8a9c] py-12 px-6 space-y-2">
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
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black"
                style={m.rol === 'assistant' ? { background: 'rgba(99,102,241,0.25)', color: '#818cf8', border: '1.5px solid rgba(99,102,241,0.4)' } : { background: 'rgba(255,255,255,0.08)', color: '#9ca3af', border: '1.5px solid rgba(255,255,255,0.1)' }}>
                {m.rol === 'assistant' ? (m.metadata?.origen === 'suscripcion' ? <Brain size={12} /> : 'IA') : <User size={12} />}
              </div>
              <div className={m.rol === 'user' ? 'max-w-[78%]' : 'flex-1 min-w-0 max-w-[92%]'}>
                {m.rol === 'user' && !propio && <p className="text-[10px] text-[#7f8a9c] text-right mb-0.5">{m.autorNombre}</p>}
                <div className="rounded-xl px-3 py-2" style={m.rol === 'assistant'
                  ? { background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }
                  : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {m.estado === 'GENERANDO' && <div className="flex items-center gap-2 text-[11px] text-indigo-300"><Loader2 size={12} className="animate-spin" /> {(m.metadata?.progreso?.length ?? 0) > 0 ? `Consultando el proyecto (${m.metadata!.progreso!.length} lectura${m.metadata!.progreso!.length === 1 ? '' : 's'}: ${m.metadata!.progreso![m.metadata!.progreso!.length - 1].nombre.replace(/_/g, ' ')})…` : 'Pensando con el contexto del proyecto…'}</div>}
                  {m.estado === 'LISTO' && m.rol === 'assistant' && m.metadata?.cortada && <div className="mb-1.5 text-[11px] text-amber-400 flex items-center gap-1"><AlertTriangle size={10} /> Respuesta cortada por límite de longitud. Pide que continúe o haz una pregunta más concreta.</div>}
                  {m.estado === 'ERROR' && (
                    <div className="text-[11px] text-red-400 flex items-start gap-1.5"><AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                      <span className="flex-1">{m.error || 'No se pudo generar la respuesta.'}</span>
                      {esUlt && !cerrada && <button onClick={() => void reintentar(m)} className="underline underline-offset-2 flex items-center gap-1"><RotateCcw size={10} /> Reintentar</button>}
                    </div>)}
                  {m.estado === 'LISTO' && (m.rol === 'assistant' ? <Md texto={parsed ? parsed.prosa : m.contenido} /> : <p className="text-[12px] text-gray-200 whitespace-pre-wrap break-words">{m.contenido}</p>)}
                  {m.rol === 'user' && (m.metadata?.adjuntos?.length ?? 0) > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">{m.metadata!.adjuntos!.map(a => <span key={a.id} className="text-[11px] px-1.5 py-0.5 rounded-md text-gray-400" style={{ background: 'rgba(255,255,255,0.06)' }}>📎 {a.nombre}</span>)}</div>)}
                </div>

                {parsed && (
                  <div className="mt-2 space-y-1.5">
                    {parsed.opciones.map((op, oi) => {
                      const otra = /otra respuesta/i.test(op)
                      return (
                        <button key={oi} disabled={bloqueado} onClick={() => (otra ? inputRef.current?.focus() : void enviar(`${oi + 1}. ${op}`))}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[11px] text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: otra ? 'rgba(251,191,36,0.15)' : 'rgba(99,102,241,0.2)', color: otra ? '#fbbf24' : '#818cf8' }}>{otra ? '✎' : oi + 1}</span>
                          {op}
                        </button>)
                    })}
                  </div>)}

                {/* Pie del mensaje */}
                <div className={`mt-1 flex items-center gap-2 text-[11px] text-[#7f8a9c] ${m.rol === 'user' ? 'justify-end' : ''}`}>
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
                  <div className="mt-1 rounded-lg px-2.5 py-2 text-[11px] text-gray-400 space-y-0.5" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {(m.metadata?.contexto ?? []).map(f => (
                      <div key={f.clave} className="flex items-center gap-2">
                        <span className={f.estado === 'incluida' ? 'text-emerald-400' : f.estado === 'recortada' ? 'text-amber-400' : 'text-[#7f8a9c]'}>●</span>
                        <span className="flex-1 truncate">{f.etiqueta}{f.nota ? <span className="text-[#7f8a9c]"> · {f.nota}</span> : null}</span>
                        <span className="text-[#7f8a9c]">{f.estado === 'incluida' || f.estado === 'recortada' ? `${f.chars.toLocaleString('es-CO')} car.` : f.estado}</span>
                      </div>))}
                    {(m.metadata?.herramientas?.length ?? 0) > 0 && (
                      <div className="pt-1 text-[#7f8a9c]">Lecturas extra: {m.metadata!.herramientas!.map((h, i) => <span key={i} className="mr-2" title={h.args}>{h.nombre.replace(/_/g, ' ')} ({h.chars.toLocaleString('es-CO')} car.)</span>)}</div>)}
                    <p className="pt-1 text-[#7f8a9c]">Total {(m.metadata?.totalChars ?? 0).toLocaleString('es-CO')} caracteres · {Math.round((m.metadata?.ms ?? 0) / 1000)} s</p>
                    {m.metadata?.uso && (
                      <p className="text-[#7f8a9c]">
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
        {accionesIA.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {accionesIA.map(a => (
              <div key={a.id} className="rounded-lg px-3 py-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px dashed rgba(217,119,6,0.55)' }}>
                <p className="text-[12px] text-amber-200 font-medium flex items-center gap-1.5"><Sparkles size={12} className="flex-shrink-0" />{a.tipo === 'NOTA' ? 'La IA quiere agregar una nota' : a.tipo === 'PLAN' ? 'La IA propone épicas y sprints' : a.tipo === 'EJECUCION_RED' ? 'La IA pide ejecutar un comando CON internet' : a.tipo === 'DESPLIEGUE' ? (a.payload.revertir ? 'La IA propone volver a la versión anterior de producción' : a.payload.entorno === 'pruebas' ? 'La IA propone levantar una copia de pruebas' : 'La IA propone desplegar a producción') : 'La IA propone tareas para el backlog'} · {a.titulo}</p>
                {a.motivo && <p className="text-[10px] text-[#9ca3af] mt-0.5">{a.motivo}</p>}
                {a.tipo === 'NOTA' && <p className="text-[11px] text-gray-300 mt-1 whitespace-pre-line line-clamp-5">{a.payload.texto}</p>}
                {a.tipo === 'EJECUCION_RED' && <p className="text-[11px] text-gray-300 mt-1 font-mono break-all rounded px-2 py-1 bg-black/30">{a.payload.comando}</p>}
                {a.tipo === 'DESPLIEGUE' && (<>
                  <p className="text-[11px] text-gray-300 mt-1 whitespace-pre-line">{a.payload.nota}</p>
                  <p className="text-[10px] text-amber-300 mt-1">{a.payload.revertir ? 'Se vuelve a la versión que había antes del último despliegue; si algo falla, la actual sigue en pie.' : a.payload.entorno === 'pruebas' ? `Copia aparte en otra URL, construida desde la rama «${a.payload.rama ?? 'main'}» (debe estar subida). Con su propia base de datos ${a.payload.base === 'conservar' ? '(se conserva la del entorno anterior)' : 'nueva y vacía'}${a.payload.semilla !== false && a.payload.base !== 'conservar' ? ', el seed del repositorio si existe' : ''} y solo las variables de prueba; se retira sola a las 72 h. Producción no se toca.` : 'Se despliega solo lo que ya está fusionado en main; si algo falla, la versión anterior sigue en pie.'}{a.payload.migrar ? ' INCLUYE migraciones de la base de datos del proyecto.' : ''}</p>
                </>)}
                {a.tipo === 'PLAN' && (
                  <ul className="text-[11px] text-gray-300 mt-1 list-disc pl-5">
                    {(a.payload.epicas ?? []).map((e, i) => <li key={'e' + i}>Épica: {e.nombre}{e.inicio ? ` (${e.inicio}${e.fin ? ' → ' + e.fin : ''})` : ''}</li>)}
                    {(a.payload.sprints ?? []).map((s, i) => <li key={'s' + i}>Sprint: {s.nombre}{s.epica ? ` · épica «${s.epica}»` : ''}{s.tareas?.length ? ` · ${s.tareas.length} tarea(s)` : ''}{s.inicio ? ` · ${s.inicio}${s.fin ? ' → ' + s.fin : ''}` : ''}</li>)}
                  </ul>)}
                {a.tipo === 'TAREAS' && <ul className="text-[11px] text-gray-300 mt-1 list-disc pl-5">{(a.payload.tareas ?? []).slice(0, 8).map((t, i) => <li key={i}>{t.title}</li>)}</ul>}
                <div className="flex items-center gap-2 mt-2">
                  <button disabled={accionOcupada === a.id} onClick={() => void decidirAccion(a, 'aplicar')} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg text-white disabled:opacity-40" style={{ background: 'rgba(16,185,129,0.7)' }}>{accionOcupada === a.id ? <Loader2 size={11} className="animate-spin" /> : null}{a.tipo === 'NOTA' ? 'Agregar nota' : a.tipo === 'PLAN' ? 'Crear el plan' : a.tipo === 'EJECUCION_RED' ? 'Ejecutar con internet' : a.tipo === 'DESPLIEGUE' ? (a.payload.revertir ? 'Volver a la anterior' : a.payload.entorno === 'pruebas' ? 'Levantar pruebas' : 'Desplegar') : 'Crear tareas'}</button>
                  <button disabled={accionOcupada === a.id} onClick={() => void decidirAccion(a, 'rechazar')} className="text-[11px] px-2.5 py-1 rounded-lg text-gray-300 border border-white/10 disabled:opacity-40">Rechazar</button>
                  <span className="text-[10px] text-[#7f8a9c]">{a.tipo === 'EJECUCION_RED' || a.tipo === 'DESPLIEGUE' ? 'Solo un administrador puede confirmar.' : 'Solo la persona asignada puede confirmar.'}</span>
                </div>
              </div>))}
          </div>)}
        {aviso && <p className="text-[11px] text-amber-300 mb-1.5 flex items-start gap-1.5"><span className="flex-1">{aviso}</span><button onClick={() => setAviso(null)}><X size={11} /></button></p>}
        {adjuntos.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {adjuntos.map(a => (
              <span key={a.id} className="text-[11px] px-2 py-1 rounded-lg flex items-center gap-1.5 text-gray-300" style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${a.legible ? 'rgba(255,255,255,0.1)' : 'rgba(245,158,11,0.4)'}` }}>
                📎 {a.nombre} <span className="text-[#7f8a9c]">{kb(a.size)}{a.legible ? '' : ' · ilegible'}</span>
                <button onClick={() => setAdjuntos(prev => prev.filter(x => x.id !== a.id))} className="text-[#7f8a9c] hover:text-gray-200"><X size={10} /></button>
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

      {devAbierto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, backdropFilter: 'blur(20px)', padding: 16 }} onClick={() => !devOcupado && setDevAbierto(false)}>
          <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, backdropFilter: 'blur(40px) saturate(180%)', boxShadow: '0 8px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)', width: '100%', maxWidth: 820, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06),rgba(255,255,255,0.03))', padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Desarrollo · {devEstado?.rama ?? 'rama de la sesión'}</h2>
              <button onClick={() => !devOcupado && setDevAbierto(false)} aria-label="Cerrar" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', width: 30, height: 30 }}>×</button>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto">
              {devOcupado && !devEstado && <div className="flex justify-center py-6 text-[#7f8a9c]"><Loader2 size={16} className="animate-spin" /></div>}
              {devEstado && devEstado.existe === false && <p className="text-[12px] text-[#9ca3af]">Esta sesión todavía no tiene espacio de trabajo: se crea cuando la IA usa su primera herramienta de código.</p>}
              {devEstado?.existe && (<>
                <p className="text-[11px] text-[#9ca3af] leading-snug">La IA solo escribe en esta rama. Nada llega a la rama principal hasta que alguien suba la rama y fusione el pull request.</p>
                <div><p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">Commits de la rama ({devEstado.commits?.length ?? 0})</p>
                  <pre className="text-[11px] text-gray-300 whitespace-pre-wrap rounded-lg p-2 bg-black/30 border border-white/10">{devEstado.commits?.length ? devEstado.commits.join('\n') : 'Todavía ninguno.'}</pre></div>
                <div><p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">Cambios sin commit ({devEstado.archivos?.length ?? 0})</p>
                  <pre className="text-[11px] text-gray-300 whitespace-pre-wrap rounded-lg p-2 bg-black/30 border border-white/10">{devEstado.archivos?.length ? devEstado.archivos.join('\n') : 'Ninguno.'}</pre></div>
                {!!devEstado.tareas?.length && (
                  <div><p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">Tareas del backlog de esta sesión ({devEstado.tareas.length})</p>
                    <ul className="text-[11px] text-gray-300 space-y-0.5 rounded-lg p-2 bg-black/30 border border-white/10">
                      {devEstado.tareas.map((t, i) => <li key={i}>{t.taskCode ?? ''} · {t.title} — <span className={t.estado === 'DONE' ? 'text-emerald-300' : t.estado === 'FAILED' ? 'text-red-300' : 'text-amber-300'}>{t.estado === 'EN_CURSO' ? 'en curso' : t.estado}</span>{t.sprintCode ? ` · sprint ${t.sprintCode}` : ''}</li>)}
                    </ul></div>)}
                {!!devEstado.capturas?.length && (
                  <div><p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">Capturas de la verificación de la interfaz ({devEstado.capturas.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {devEstado.capturas.map(n => (
                        <a key={n} href={`${base}/dev/captura/${n}`} target="_blank" rel="noreferrer" title={n}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`${base}/dev/captura/${n}`} alt={n} className="h-28 rounded-lg border border-white/10 hover:border-orange-400/60" />
                        </a>))}
                    </div></div>)}
                {!!devEstado.servicios?.length && (
                  <div><p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">Servicios en marcha ({devEstado.servicios.length})</p>
                    <p className="text-[11px] text-gray-300">{devEstado.servicios.join(' · ')} <span className="text-[#7f8a9c]">(red interna, sin internet; se retiran solos a las 3 horas)</span></p></div>)}
                {varsPrueba !== null && (
                  <div><p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">Variables de prueba ({varsPrueba.length}) · solo administradores</p>
                    <p className="text-[10px] text-[#7f8a9c] mb-1.5 leading-snug">Valores de PRUEBA (nunca de producción) que llegan como variables de entorno a los comandos y a la aplicación. La IA ve solo los nombres, y los valores se ocultan en la salida de sus comandos.</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">{varsPrueba.map(n => <span key={n} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-200">{n}<button onClick={() => void quitarVariable(n)} disabled={devOcupado} title="Quitar" aria-label={`Quitar ${n}`} className="text-[#7f8a9c] hover:text-red-300"><X size={10} /></button></span>)}</div>
                    <div className="flex items-center gap-2">
                      <input value={varNombre} onChange={e => setVarNombre(e.target.value.toUpperCase())} placeholder="NOMBRE_DE_LA_VARIABLE" maxLength={60} className="rounded-lg px-2 py-1 text-[11px] text-gray-100 bg-black/30 border border-white/10 outline-none w-52" />
                      <input type="password" value={varValor} onChange={e => setVarValor(e.target.value)} placeholder="valor de prueba" autoComplete="off" className="rounded-lg px-2 py-1 text-[11px] text-gray-100 bg-black/30 border border-white/10 outline-none flex-1 min-w-0" />
                      <button onClick={() => void guardarVariable()} disabled={devOcupado || !varNombre.trim() || !varValor} className="text-[11px] px-2.5 py-1 rounded-lg text-white disabled:opacity-40" style={{ background: 'rgba(16,185,129,0.7)' }}>Guardar</button>
                    </div></div>)}
                {devDiff && <details><summary className="text-[11px] text-indigo-300 cursor-pointer">Ver el diff completo</summary><pre className="text-[11px] text-gray-300 whitespace-pre-wrap rounded-lg p-2 mt-1 bg-black/30 border border-white/10 max-h-72 overflow-auto">{devDiff}</pre></details>}
              </>)}
              {devMsg && <p className="text-[12px] text-amber-300 break-words">{devMsg}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/10">
              <button onClick={() => void cargarDev()} disabled={devOcupado} className="text-[12px] px-3 py-1.5 rounded-lg text-gray-300 border border-white/10 disabled:opacity-40">Actualizar</button>
              <button onClick={() => void descartarRama()} disabled={devOcupado || !devEstado?.existe} className="text-[12px] px-3 py-1.5 rounded-lg text-red-300 border border-red-500/30 disabled:opacity-40">Descartar espacio</button>
              {!!devEstado?.tareas?.some(t => t.estado === 'DONE' && t.sprintCode) && (
                <button onClick={() => void integrarSprint()} disabled={devOcupado || !devEstado?.existe} title="Une la rama a la rama de integración del sprint; solo un administrador" className="text-[12px] px-3 py-1.5 rounded-lg text-orange-200 border border-orange-500/40 disabled:opacity-40">Integrar en el sprint</button>)}
              <button onClick={() => void subirRama()} disabled={devOcupado || !devEstado?.existe || !(devEstado?.commits?.length)} title="Sube la rama a GitHub; solo un administrador" className="flex items-center gap-1.5 text-[12px] px-4 py-1.5 rounded-lg text-white font-semibold disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
                {devOcupado ? <Loader2 size={12} className="animate-spin" /> : <GitBranch size={12} />} Subir rama</button>
            </div>
          </div>
        </div>)}
      {notaBorrador && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, backdropFilter: 'blur(20px)', padding: 16 }} onClick={() => !notaOcupada && setNotaBorrador(null)}>
          <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, backdropFilter: 'blur(40px) saturate(180%)', boxShadow: '0 8px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)', width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06),rgba(255,255,255,0.03))', padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', margin: 0 }}>Nota para las notas de la fase</h2>
              <button onClick={() => !notaOcupada && setNotaBorrador(null)} aria-label="Cerrar" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', width: 30, height: 30 }}>×</button>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto">
              <p className="text-[11px] text-[#9ca3af] leading-snug">La IA redactó esto con lo hablado en la sesión. Revísalo y corrígelo: se agrega como una pestaña nueva en las notas de la fase y no cambia lo que ya está escrito.</p>
              <input value={notaBorrador.titulo} onChange={e => setNotaBorrador({ ...notaBorrador, titulo: e.target.value })} maxLength={60} placeholder="Título de la pestaña" className="w-full rounded-lg px-3 py-2 text-[13px] text-gray-100 bg-black/30 border border-white/10 outline-none focus:border-orange-500/50" />
              <textarea value={notaBorrador.texto} onChange={e => setNotaBorrador({ ...notaBorrador, texto: e.target.value })} rows={14} className="w-full rounded-lg px-3 py-2 text-[12px] leading-relaxed text-gray-200 bg-black/30 border border-white/10 outline-none focus:border-orange-500/50 resize-y" />
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/10">
              <button onClick={() => setNotaBorrador(null)} disabled={notaOcupada} className="text-[12px] px-3 py-1.5 rounded-lg text-gray-300 border border-white/10 disabled:opacity-40">Descartar</button>
              <button onClick={() => void guardarNota()} disabled={notaOcupada || !notaBorrador.texto.trim()} className="flex items-center gap-1.5 text-[12px] px-4 py-1.5 rounded-lg text-white font-semibold disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
                {notaOcupada ? <Loader2 size={12} className="animate-spin" /> : null} Agregar a las notas</button>
            </div>
          </div>
        </div>)}
      {plan && <PlanTareas proyectoId={proyectoId} sesionId={sesion.id} onCerrar={() => setPlan(false)} onAplicado={() => { setPlan(false); void api<{ mensajes: Mensaje[] }>(`${base}?desde=${encodeURIComponent(new Date(Date.now() - 60_000).toISOString())}`).then(r => merge(r.mensajes)); onCambio() }} />}
    </div>
  )
}
