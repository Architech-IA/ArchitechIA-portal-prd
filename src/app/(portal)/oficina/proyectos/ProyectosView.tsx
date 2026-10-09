'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Loader2, Search, Plus, Lock, FolderKanban, Layers, Brain, Flag, Paperclip, Radio, Rocket, PanelRightClose, PanelRightOpen, X, ExternalLink, MessageSquare,
} from 'lucide-react'
import { ETIQUETA_TIPO, DESCRIPCION_TIPO, type TipoSesion } from '@/lib/proyectos/tipos'
import Link from '@/lib/BacklogLink'
import { api, post, hace, type FaseLista, type ProyectoLista, type DetalleProyecto, type SesionFull, type SesionRes } from './api'
import ChatSesion from './ChatSesion'
import PanelContexto from './PanelContexto'
import PanelMemoria from './PanelMemoria'
import PanelAdjuntos from './PanelAdjuntos'
import PanelBuscar from './PanelBuscar'
import PanelAuto from './PanelAuto'
import PanelEjecucion from './PanelEjecucion'
import PanelFases from './PanelFases'

type Panel = 'fases' | 'contexto' | 'memoria' | 'adjuntos' | 'buscar' | 'auto' | 'ejecucion'
type FiltroFase = 'todos' | 'preventa' | 'ejecucion' | 'aprobar' | 'sin'
type Orden = 'actividad' | 'fase' | 'nombre'
const FILTROS: { k: FiltroFase; txt: string }[] = [
  { k: 'todos', txt: 'Todos' }, { k: 'preventa', txt: 'Preventa' }, { k: 'ejecucion', txt: 'Ejecución' }, { k: 'aprobar', txt: 'Por aprobar' }, { k: 'sin', txt: 'Sin motor' },
]
const ORDENES: { k: Orden; txt: string }[] = [{ k: 'actividad', txt: 'Actividad' }, { k: 'fase', txt: 'Fase' }, { k: 'nombre', txt: 'Nombre' }]
const esperaAprobacion = (f: FaseLista | null) => !!f && f.estadoMotor === 'EN_CURSO' && f.puerta.total > 0 && f.puerta.lista
const colorFase = (f: FaseLista) => (f.estadoMotor === 'CERRADO_PERDIDO' ? '#fca5a5' : f.estadoMotor === 'COMPLETADO' ? '#6ee7b7' : f.bloque === 'PREVENTA' ? '#a5b4fc' : '#5eead4')
const textoFase = (f: FaseLista) => (f.estadoMotor === 'COMPLETADO' ? 'Completado' : f.estadoMotor === 'CERRADO_PERDIDO' ? `Perdido · ${f.nombre}` : `${f.numero}·${f.nombre}`)
const TIPOS_NUEVOS: TipoSesion[] = ['KICKOFF', 'PLANIFICACION', 'REVISION', 'LIBRE']
const COLOR_TIPO: Record<string, string> = { KICKOFF: '#f59e0b', PLANIFICACION: '#6366f1', REVISION: '#10b981', LIBRE: '#94a3b8', BITACORA: '#06b6d4' }

// Oficina Virtual > Proyectos. Proyecto = Solución. Cada proyecto tiene sesiones (conversaciones con
// la IA) TODAS persistentes, con contexto vivo y exacto, memoria propia, adjuntos y automatizaciones.
export default function ProyectosView({ initialProyectoId }: { initialProyectoId?: string | null }) {
  const [lista, setLista] = useState<ProyectoLista[]>([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [filtroFase, setFiltroFase] = useState<FiltroFase>('todos')
  const [orden, setOrden] = useState<Orden>('actividad')
  const [pid, setPid] = useState<string | null>(null)
  const [det, setDet] = useState<DetalleProyecto | null>(null)
  const [cargandoDet, setCargandoDet] = useState(false)
  const [sid, setSid] = useState<string | null>(null)
  const [sesionFull, setSesionFull] = useState<SesionFull | null>(null)
  const [panel, setPanel] = useState<Panel>('fases')
  const [panelAbierto, setPanelAbierto] = useState(true)
  const [nueva, setNueva] = useState(false)
  const [tipoNueva, setTipoNueva] = useState<TipoSesion>('LIBRE')
  const [privadaNueva, setPrivadaNueva] = useState(false)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pidRef = useRef<string | null>(null)
  pidRef.current = pid

  const cargarLista = useCallback(async () => {
    try { setLista(await api<ProyectoLista[]>('/api/proyectos')) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar los proyectos') } finally { setCargandoLista(false) }
  }, [])

  const cargarDetalle = useCallback(async (id: string, elegir?: string | null) => {
    try {
      const d = await api<DetalleProyecto>(`/api/proyectos/${id}`)
      if (pidRef.current !== id) return
      setDet(d)
      setSid(actual => {
        if (elegir !== undefined) return elegir
        if (actual && d.sesiones.some(s => s.id === actual)) return actual
        return d.sesiones.find(s => s.tipo !== 'BITACORA')?.id ?? d.sesiones[0]?.id ?? null
      })
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el proyecto') } finally { setCargandoDet(false) }
  }, [])

  useEffect(() => { void cargarLista() }, [cargarLista])

  function elegirProyecto(id: string) {
    if (id === pid) return
    setPid(id); pidRef.current = id; setDet(null); setSid(null); setSesionFull(null); setNueva(false); setError(null); setCargandoDet(true)
    void cargarDetalle(id)
  }
  // Proyecto recibido por URL (?p=…)
  useEffect(() => { if (initialProyectoId && !pid) elegirProyecto(initialProyectoId) }, [initialProyectoId]) // eslint-disable-line react-hooks/exhaustive-deps

  const refrescar = useCallback(() => { if (pidRef.current) void cargarDetalle(pidRef.current); void cargarLista() }, [cargarDetalle, cargarLista])

  async function crearSesion(tipo: TipoSesion) {
    if (!pid || creando) return
    setCreando(true); setError(null)
    try {
      const s = await post<SesionRes>(`/api/proyectos/${pid}/sesiones`, { tipo, privada: privadaNueva })
      setNueva(false); setPrivadaNueva(false)
      await cargarDetalle(pid, s.id); void cargarLista()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear la sesión') } finally { setCreando(false) }
  }

  const conteo = useMemo(() => ({
    todos: lista.length,
    preventa: lista.filter(p => p.fase?.bloque === 'PREVENTA' && p.fase.estadoMotor === 'EN_CURSO').length,
    ejecucion: lista.filter(p => p.fase?.bloque === 'EJECUCION' && p.fase.estadoMotor === 'EN_CURSO').length,
    aprobar: lista.filter(p => esperaAprobacion(p.fase)).length,
    sin: lista.filter(p => !p.fase).length,
  }), [lista])

  const filtrada = useMemo(() => {
    const t = filtro.trim().toLowerCase()
    let r = t ? lista.filter(p => p.nombre.toLowerCase().includes(t) || (p.codigo ?? '').toLowerCase().includes(t)) : lista
    if (filtroFase === 'preventa') r = r.filter(p => p.fase?.bloque === 'PREVENTA' && p.fase.estadoMotor === 'EN_CURSO')
    else if (filtroFase === 'ejecucion') r = r.filter(p => p.fase?.bloque === 'EJECUCION' && p.fase.estadoMotor === 'EN_CURSO')
    else if (filtroFase === 'aprobar') r = r.filter(p => esperaAprobacion(p.fase))
    else if (filtroFase === 'sin') r = r.filter(p => !p.fase)
    if (orden === 'nombre') r = [...r].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    else if (orden === 'fase') r = [...r].sort((a, b) => (a.fase ? a.fase.numero : 99) - (b.fase ? b.fase.numero : 99) || a.nombre.localeCompare(b.nombre, 'es'))
    return r
  }, [lista, filtro, filtroFase, orden])

  const sesion = det?.sesiones.find(s => s.id === sid) ?? null
  const bitacora = det?.sesiones.find(s => s.tipo === 'BITACORA') ?? null
  const proyecto = lista.find(p => p.id === pid)

  const TABS: { k: Panel; icono: typeof Layers; txt: string; badge?: number }[] = [
    { k: 'fases', icono: Flag, txt: 'Fases' },
    { k: 'contexto', icono: Layers, txt: 'Contexto' },
    { k: 'memoria', icono: Brain, txt: 'Memoria', badge: det?.propuestasPendientes },
    { k: 'adjuntos', icono: Paperclip, txt: 'Adjuntos', badge: det?.adjuntos },
    { k: 'buscar', icono: Search, txt: 'Buscar' },
    { k: 'auto', icono: Radio, txt: 'Auto' },
    { k: 'ejecucion', icono: Rocket, txt: 'Ejecución' },
  ]

  return (
    <div className="flex h-full min-h-0 w-full">
      {/* ── Columna A: proyectos ── */}
      <div className="w-60 flex-shrink-0 flex flex-col border-r border-white/5" style={{ background: 'rgba(0,0,0,0.15)' }}>
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2"><FolderKanban size={14} className="text-indigo-300" /><span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Proyectos</span><span className="text-[11px] text-[#7f8a9c]">{lista.length}</span></div>
          <div className="relative">
            <Search size={11} className="absolute left-2 top-2 text-[#7f8a9c]" />
            <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Filtrar…" className="w-full rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-gray-300 outline-none border border-white/10 focus:border-indigo-500/40 placeholder-gray-600" style={{ background: 'rgba(255,255,255,0.04)' }} />
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {FILTROS.map(f => (
              <button key={f.k} onClick={() => setFiltroFase(f.k)} className="px-2 py-0.5 rounded-full text-[10px] transition-colors"
                style={filtroFase === f.k ? { background: 'rgba(99,102,241,0.28)', color: '#e0e7ff', border: '1px solid rgba(99,102,241,0.5)' } : { background: 'rgba(255,255,255,0.04)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.07)' }}>
                {f.txt}{conteo[f.k] > 0 || f.k === 'todos' ? ` ${conteo[f.k]}` : ''}</button>))}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-[#7f8a9c]">
            <span>Orden</span>
            <select value={orden} onChange={e => setOrden(e.target.value as Orden)} className="rounded px-1 py-0.5 text-[10px] text-gray-300 bg-black/30 border border-white/10 outline-none">
              {ORDENES.map(o => <option key={o.k} value={o.k}>{o.txt}</option>)}</select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-1">
          {cargandoLista && <div className="flex justify-center py-6 text-[#7f8a9c]"><Loader2 size={14} className="animate-spin" /></div>}
          {filtrada.map(p => (
            <button key={p.id} onClick={() => elegirProyecto(p.id)} className="w-full text-left rounded-lg px-2.5 py-2 transition-colors"
              style={p.id === pid ? { background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)' } : { background: 'rgba(255,255,255,0.02)', border: '1px solid transparent' }}>
              <div className="flex items-center gap-1.5">
                <span className={`text-[11px] font-medium truncate flex-1 ${p.id === pid ? 'text-white' : 'text-gray-300'}`}>{p.nombre}</span>
                {esperaAprobacion(p.fase) && <span title="La puerta de la fase está completa: espera aprobación" className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
                {p.propuestasPendientes > 0 && <span title="Propuestas de memoria pendientes" className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
              </div>
              {p.fase
                ? <p className="text-[10px] mt-0.5 truncate font-medium" style={{ color: colorFase(p.fase) }}>{textoFase(p.fase)}<span className="font-normal text-[#7f8a9c]"> · {p.fase.bloque === 'PREVENTA' ? 'preventa' : 'ejecución'}{p.fase.estadoMotor === 'EN_CURSO' && p.fase.puerta.total > 0 ? ` · puerta ${p.fase.puerta.ok}/${p.fase.puerta.total}` : ''}</span></p>
                : <p className="text-[10px] mt-0.5 text-[#6b7280]">Sin motor de fases</p>}
              <p className="text-[10px] text-[#7f8a9c] mt-0.5 truncate">
                {p.codigo ? `${p.codigo} · ` : ''}{p.sesiones} sesión{p.sesiones === 1 ? '' : 'es'}{p.ultimaActividad ? ` · ${hace(p.ultimaActividad)}` : ''}
              </p>
            </button>))}
          {!cargandoLista && filtrada.length === 0 && <p className="text-[11px] text-[#7f8a9c] text-center py-4">Sin resultados.</p>}
        </div>
      </div>

      {/* ── Columna B: sesiones + chat ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {!pid && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-2">
            <FolderKanban size={30} className="text-indigo-400/60" />
            <p className="text-sm text-gray-200 font-medium">Elige un proyecto</p>
            <p className="text-[12px] text-[#7f8a9c] max-w-md">Cada proyecto es una Solución. Aquí tiene sus conversaciones con la IA — todas guardadas, con el contexto vivo del proyecto, su memoria, sus adjuntos y automatizaciones.</p>
          </div>)}

        {pid && (
          <>
            {/* Cabecera + sesiones */}
            <div className="flex-shrink-0 border-b border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-2 px-4 pt-2.5">
                <h2 className="text-[13px] font-bold text-gray-100 truncate">{proyecto?.nombre ?? det?.proyecto.nombre ?? '…'}</h2>
                {det && <span className="text-[10px] px-1.5 py-0.5 rounded-full text-gray-400" style={{ background: 'rgba(255,255,255,0.07)' }}>{det.proyecto.estado}</span>}
                <span className="flex-1" />
                <Link href={`/solutions/pilots/${pid}`} className="flex items-center gap-1 text-[11px] text-[#7f8a9c] hover:text-gray-200" title="Abrir el hub de la solución"><ExternalLink size={11} /> Hub de la solución</Link>
                <button onClick={() => setPanelAbierto(o => !o)} className="text-[#7f8a9c] hover:text-gray-200" title={panelAbierto ? 'Ocultar panel' : 'Mostrar panel'}>{panelAbierto ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}</button>
              </div>
              {proyecto?.fase && (
                <button onClick={() => { setPanel('fases'); setPanelAbierto(true) }} title="Abrir las fases del proyecto" className="w-full flex items-center gap-3 px-4 pb-1.5 pt-0.5 text-left">
                  <span className="flex gap-0.5 w-[220px] flex-shrink-0">{Array.from({ length: proyecto.fase.totalFases }, (_, i) => {
                    const num = i + 1
                    const f = proyecto.fase as FaseLista
                    const hecha = f.estadoMotor === 'COMPLETADO' || num < f.numero
                    const actual = num === f.numero && f.estadoMotor !== 'COMPLETADO'
                    return <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: hecha ? '#10b981' : actual ? (f.estadoMotor === 'CERRADO_PERDIDO' ? '#ef4444' : '#6366f1') : 'rgba(255,255,255,0.12)' }} />
                  })}</span>
                  <span className="text-[10px] truncate" style={{ color: colorFase(proyecto.fase) }}>{textoFase(proyecto.fase)}
                    <span className="text-[#7f8a9c]"> · {proyecto.fase.estadoMotor === 'EN_CURSO' && proyecto.fase.puerta.total > 0 ? `puerta ${proyecto.fase.puerta.ok}/${proyecto.fase.puerta.total}${proyecto.fase.puerta.lista ? ' · lista para aprobar' : ''}` : proyecto.fase.bloque === 'PREVENTA' ? 'preventa' : 'ejecución'}</span></span>
                </button>)}
              {!proyecto?.fase && det && <p className="px-4 pb-1 text-[10px] text-[#6b7280]">Sin motor de fases. Se inicia desde la pestaña Fases.</p>}
              <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto">
                {cargandoDet && !det && <Loader2 size={13} className="animate-spin text-[#7f8a9c]" />}
                {det?.sesiones.map(s => (
                  <button key={s.id} onClick={() => { setSid(s.id); setNueva(false) }} title={`${ETIQUETA_TIPO[s.tipo as TipoSesion] ?? s.tipo} · ${s.creadaPorNombre} · ${s.mensajes} mensajes`}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] flex-shrink-0 max-w-[200px] transition-colors"
                    style={s.id === sid ? { background: 'rgba(99,102,241,0.22)', border: '1px solid rgba(99,102,241,0.45)', color: '#fff' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#9ca3af', opacity: s.estado === 'ACTIVA' ? 1 : 0.65 }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: COLOR_TIPO[s.tipo] ?? '#94a3b8' }} />
                    <span className="truncate">{s.titulo}</span>
                    {s.privada && <Lock size={9} className="text-amber-400 flex-shrink-0" />}
                  </button>))}
                <button onClick={() => setNueva(o => !o)} disabled={!det} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] flex-shrink-0 text-indigo-200 disabled:opacity-40" style={{ background: 'rgba(99,102,241,0.12)', border: '1px dashed rgba(99,102,241,0.4)' }}><Plus size={11} /> Nueva sesión</button>
              </div>

              {nueva && (
                <div className="mx-4 mb-3 rounded-xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-gray-200">¿Qué tipo de sesión?</span><button onClick={() => setNueva(false)} className="text-[#7f8a9c] hover:text-gray-200"><X size={13} /></button></div>
                  <div className="grid grid-cols-2 gap-2">
                    {TIPOS_NUEVOS.map(t => (
                      <button key={t} onClick={() => setTipoNueva(t)} className="text-left rounded-lg px-3 py-2 transition-colors" style={tipoNueva === t ? { background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.45)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-200"><span className="w-1.5 h-1.5 rounded-full" style={{ background: COLOR_TIPO[t] }} />{ETIQUETA_TIPO[t]}</span>
                        <span className="block text-[11px] text-[#7f8a9c] mt-0.5 leading-snug">{DESCRIPCION_TIPO[t]}</span>
                      </button>))}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer"><input type="checkbox" checked={privadaNueva} onChange={e => setPrivadaNueva(e.target.checked)} className="accent-indigo-500" /> <Lock size={10} /> Privada (solo yo la veo)</label>
                    <span className="flex-1" />
                    <button onClick={() => void crearSesion(tipoNueva)} disabled={creando} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white flex items-center gap-1.5 disabled:opacity-50" style={{ background: 'rgba(99,102,241,0.85)' }}>{creando && <Loader2 size={11} className="animate-spin" />} Crear sesión</button>
                  </div>
                </div>)}
            </div>

            {error && <p className="px-4 py-2 text-[11px] text-red-400">{error}</p>}

            <div className="flex-1 min-h-0">
              {det && sesion && det.yo && (
                <ChatSesion key={sesion.id} proyectoId={pid} sesion={sesion} yo={det.yo} onCambio={refrescar}
                  onAbrirSesion={id => { if (id) setSid(id); else void cargarDetalle(pid) }}
                  onSesion={setSesionFull} onAbrirPanel={p => { setPanel(p); setPanelAbierto(true) }} />)}
              {det && !sesion && (
                <div className="h-full flex flex-col items-center justify-center text-center px-8 gap-3">
                  <MessageSquare size={26} className="text-indigo-400/60" />
                  <p className="text-[13px] text-gray-200 font-medium">Este proyecto todavía no tiene sesiones</p>
                  <p className="text-[12px] text-[#7f8a9c] max-w-md">Empieza una: la IA ya conoce la ficha, el PRD, el diseño, el backlog y todo lo que agregues a la memoria y los adjuntos.</p>
                  <button onClick={() => setNueva(true)} className="px-4 py-2 rounded-lg text-[12px] font-semibold text-white" style={{ background: 'rgba(99,102,241,0.85)' }}>Crear la primera sesión</button>
                </div>)}
            </div>
          </>)}
      </div>

      {/* ── Columna C: panel lateral ── */}
      {pid && panelAbierto && (
        <div className="w-[340px] flex-shrink-0 flex flex-col border-l border-white/5" style={{ background: 'rgba(0,0,0,0.15)' }}>
          <div className="flex border-b border-white/5 flex-shrink-0">
            {TABS.map(t => (
              <button key={t.k} onClick={() => setPanel(t.k)} title={t.txt} className="flex-1 flex flex-col items-center gap-0.5 py-2 relative transition-colors"
                style={panel === t.k ? { color: '#c7d2fe', borderBottom: '2px solid #6366f1', background: 'rgba(99,102,241,0.08)' } : { color: '#7f8a9c', borderBottom: '2px solid transparent' }}>
                <t.icono size={14} /><span className="text-[10px] font-medium">{t.txt}</span>
                {!!t.badge && <span className="absolute top-1 right-2 min-w-[14px] h-[14px] rounded-full text-[10px] font-bold flex items-center justify-center text-white px-1" style={{ background: t.k === 'memoria' ? '#f59e0b' : '#6366f1' }}>{t.badge}</span>}
              </button>))}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {panel === 'fases' && <PanelFases proyectoId={pid} onCambio={() => { void cargarLista() }} />}
            {panel === 'contexto' && <PanelContexto proyectoId={pid} sesion={sesionFull && sesionFull.id === sid ? sesionFull : null} onSesion={setSesionFull} />}
            {panel === 'memoria' && <PanelMemoria proyectoId={pid} onCambio={refrescar} />}
            {panel === 'adjuntos' && <PanelAdjuntos proyectoId={pid} onCambio={refrescar} />}
            {panel === 'buscar' && <PanelBuscar proyectoId={pid} onAbrirSesion={id => setSid(id)} onAbrirPanel={p => setPanel(p)} />}
            {panel === 'auto' && <PanelAuto proyectoId={pid} onCambio={refrescar} onAbrirBitacora={() => bitacora && setSid(bitacora.id)} />}
            {panel === 'ejecucion' && <PanelEjecucion proyectoId={pid} />}
          </div>
        </div>)}
    </div>
  )
}
