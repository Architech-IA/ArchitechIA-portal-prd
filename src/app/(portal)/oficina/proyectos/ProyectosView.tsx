'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Loader2, Search, Plus, Lock, FolderKanban, Layers, Brain, Check, Paperclip, Radio, Rocket, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen, X, ExternalLink, MessageSquare, Sparkles, GitBranch,
} from 'lucide-react'
import { ETIQUETA_TIPO, DESCRIPCION_TIPO, type TipoSesion } from '@/lib/proyectos/tipos'
import { api, post, hace, ETIQUETA_BLOQUE, type Naturaleza, type FaseLista, type FasesRes, type ProyectoLista, type DetalleProyecto, type SesionFull, type SesionRes } from './api'
import ChatSesion from './ChatSesion'
import PanelContexto from './PanelContexto'
import PanelMemoria from './PanelMemoria'
import PanelAdjuntos from './PanelAdjuntos'
import PanelBuscar from './PanelBuscar'
import PanelAuto from './PanelAuto'
import PanelEjecucion from './PanelEjecucion'
import VistaFase from './VistaFase'
import BarraArtefactos from './BarraArtefactos'
import PanelPropuestas from './PanelPropuestas'
import PanelFases from './PanelFases'
import { TITULO_DE_TAB } from '../../solutions/pilots/[id]/ArbolArtefactos'
import type { ArtefactoMeta, TabKey } from '../../solutions/pilots/[id]/espacio'

// El hub de la solución (documentos, lienzos, cronograma…) vive aquí dentro, sin barra lateral propia. Se carga al abrir el primer artefacto.
const HubSolucion = dynamic(() => import('../../solutions/pilots/[id]/HubSolucion'), {
  ssr: false,
  loading: () => <div className="flex justify-center py-16 text-[#7f8a9c]"><Loader2 size={18} className="animate-spin" /></div>,
})

type Panel = 'fases' | 'contexto' | 'propuestas' | 'memoria' | 'adjuntos' | 'buscar' | 'auto' | 'ejecucion'
type FiltroNat = 'todas' | Naturaleza
type Orden = 'actividad' | 'fase' | 'nombre'
const ORDENES: { k: Orden; txt: string }[] = [{ k: 'actividad', txt: 'Actividad' }, { k: 'fase', txt: 'Fase' }, { k: 'nombre', txt: 'Nombre' }]
const esperaAprobacion = (f: FaseLista | null) => !!f && f.estadoMotor === 'EN_CURSO' && f.puerta.total > 0 && f.puerta.lista
const colorFase = (f: FaseLista) => (f.estadoMotor === 'CERRADO_PERDIDO' ? '#fca5a5' : f.estadoMotor === 'COMPLETADO' ? '#6ee7b7' : f.bloque !== 'EJECUCION' ? '#a5b4fc' : '#5eead4')
const textoFase = (f: FaseLista) => (f.estadoMotor === 'COMPLETADO' ? 'Completado' : f.estadoMotor === 'CERRADO_PERDIDO' ? `Perdido · ${f.nombre}` : `${f.numero}·${f.nombre}`)
const TIPOS_NUEVOS: TipoSesion[] = ['KICKOFF', 'PLANIFICACION', 'REVISION', 'LIBRE']
const COLOR_TIPO: Record<string, string> = { KICKOFF: '#f59e0b', PLANIFICACION: '#6366f1', REVISION: '#10b981', LIBRE: '#94a3b8', BITACORA: '#06b6d4' }

// Oficina Virtual > Proyectos. Proyecto = Solución. Cada proyecto tiene sesiones (conversaciones con
// la IA) TODAS persistentes, con contexto vivo y exacto, memoria propia, adjuntos y automatizaciones.
export default function ProyectosView({ initialProyectoId, initialArtefacto }: { initialProyectoId?: string | null; initialArtefacto?: string | null }) {
  const [lista, setLista] = useState<ProyectoLista[]>([])
  const [cargandoLista, setCargandoLista] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [filtroNat, setFiltroNat] = useState<FiltroNat>('todas')
  const [orden, setOrden] = useState<Orden>('actividad')
  const [pid, setPid] = useState<string | null>(null)
  const [det, setDet] = useState<DetalleProyecto | null>(null)
  const [cargandoDet, setCargandoDet] = useState(false)
  const [sid, setSid] = useState<string | null>(null)
  const [sesionFull, setSesionFull] = useState<SesionFull | null>(null)
  const [panel, setPanel] = useState<Panel>('fases')
  const [panelAbierto, setPanelAbierto] = useState(true)
  const [listaAbierta, setListaAbierta] = useState(true)
  useEffect(() => { try { if (localStorage.getItem('proyectos.lista') === '0') setListaAbierta(false) } catch { /* sin almacenamiento */ } }, [])
  const alternarLista = () => setListaAbierta(o => { const n = !o; try { localStorage.setItem('proyectos.lista', n ? '1' : '0') } catch { /* sin almacenamiento */ } return n })
  const [nueva, setNueva] = useState(false)
  const [vista, setVista] = useState<string>('asistente')
  const [fasesRes, setFasesRes] = useState<FasesRes | null>(null)
  // Hub embebido: se monta al abrir el primer artefacto y se oculta (no se desmonta) al volver al chat para no perder lo que se está editando
  const [hubAbierto, setHubAbierto] = useState(false)
  const [tabArt, setTabArt] = useState<TabKey | null>(null)
  const [metaArt, setMetaArt] = useState<Record<string, ArtefactoMeta>>({})
  const [hubSucio, setHubSucio] = useState(false)
  const artInicial = useRef<string | null>(initialArtefacto ?? null)
  const tabVista = vista.startsWith('art:') ? (vista.slice(4) as TabKey) : null
  const nPropuestas = Object.values(metaArt).reduce((n, m) => n + (m.propuestas || 0), 0)
  const irArtefacto = useCallback((t: TabKey) => { setTabArt(t); setHubAbierto(true); setVista('art:' + t) }, [])
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

  // Fases del proyecto elegido (una pestaña por fase). Al abrir un proyecto con motor se muestra su fase actual.
  const cargarFases = useCallback(async (id: string, primera = false) => {
    try {
      const r = await api<FasesRes>(`/api/proyectos/${id}/fases`)
      if (pidRef.current !== id) return
      setFasesRes(r)
      if (primera && artInicial.current && artInicial.current in TITULO_DE_TAB) { const t = artInicial.current as TabKey; artInicial.current = null; setTabArt(t); setHubAbierto(true); setVista('art:' + t) }
      else if (primera) setVista(r.iniciado && r.estado === 'EN_CURSO' && r.faseActual ? r.faseActual : 'asistente')
    } catch (e) { if (pidRef.current === id) setError(e instanceof Error ? e.message : 'No se pudieron cargar las fases') }
  }, [])

  const cargarMeta = useCallback((id: string) => {
    api<ArtefactoMeta[]>(`/api/soluciones/${id}/artefactos`).then(a => { if (pidRef.current === id) setMetaArt(Object.fromEntries((Array.isArray(a) ? a : []).map(m => [m.clave, m]))) }).catch(() => { /* la barra queda sin puntos */ })
  }, [])

  function elegirProyecto(id: string) {
    if (id === pid) return
    if (hubSucio && !window.confirm('Hay cambios sin guardar en los artefactos de este proyecto. Si cambias de proyecto se pierden. ¿Continuar?')) return
    setHubAbierto(false); setTabArt(null); setHubSucio(false); setMetaArt({}); cargarMeta(id)
    setPid(id); pidRef.current = id; setFasesRes(null); setVista('asistente'); void cargarFases(id, true); setDet(null); setSid(null); setSesionFull(null); setNueva(false); setError(null); setCargandoDet(true)
    void cargarDetalle(id)
  }
  // Proyecto recibido por URL (?p=…)
  useEffect(() => {
    if (!initialProyectoId) return
    if (initialProyectoId !== pidRef.current) { artInicial.current = initialArtefacto ?? null; elegirProyecto(initialProyectoId) }
    else if (initialArtefacto && initialArtefacto in TITULO_DE_TAB) irArtefacto(initialArtefacto as TabKey)
  }, [initialProyectoId, initialArtefacto]) // eslint-disable-line react-hooks/exhaustive-deps

  const refrescar = useCallback(() => { if (pidRef.current) { void cargarDetalle(pidRef.current); void cargarFases(pidRef.current) } void cargarLista() }, [cargarDetalle, cargarFases, cargarLista])

  async function crearSesion(tipo: TipoSesion) {
    if (!pid || creando) return
    setCreando(true); setError(null)
    try {
      const s = await post<SesionRes>(`/api/proyectos/${pid}/sesiones`, { tipo, privada: privadaNueva })
      setNueva(false); setPrivadaNueva(false)
      await cargarDetalle(pid, s.id); void cargarLista()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear la sesión') } finally { setCreando(false) }
  }

  const filtrada = useMemo(() => {
    const t = filtro.trim().toLowerCase()
    let r = t ? lista.filter(p => p.nombre.toLowerCase().includes(t) || (p.codigo ?? '').toLowerCase().includes(t)) : lista
    if (filtroNat !== 'todas') r = r.filter(p => p.naturaleza === filtroNat)
    if (orden === 'nombre') r = [...r].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    else if (orden === 'fase') r = [...r].sort((a, b) => (a.fase ? a.fase.numero : 99) - (b.fase ? b.fase.numero : 99) || a.nombre.localeCompare(b.nombre, 'es'))
    return r
  }, [lista, filtro, filtroNat, orden])

  const sesion = det?.sesiones.find(s => s.id === sid) ?? null
  const bitacora = det?.sesiones.find(s => s.tipo === 'BITACORA') ?? null
  const proyecto = lista.find(p => p.id === pid)

  const TABS: { k: Panel; icono: typeof Layers; txt: string; badge?: number }[] = [
    { k: 'fases', icono: GitBranch, txt: 'Fases', badge: fasesRes?.iniciado && fasesRes.fases?.some(f => f.estado === 'ACTUAL' && f.puerta.cumplida) ? 1 : undefined },
    { k: 'contexto', icono: Layers, txt: 'Contexto' },
    { k: 'propuestas', icono: Sparkles, txt: 'Propuestas', badge: nPropuestas },
    { k: 'memoria', icono: Brain, txt: 'Memoria', badge: det?.propuestasPendientes },
    { k: 'adjuntos', icono: Paperclip, txt: 'Adjuntos', badge: det?.adjuntos },
    { k: 'buscar', icono: Search, txt: 'Buscar' },
    { k: 'auto', icono: Radio, txt: 'Auto' },
    { k: 'ejecucion', icono: Rocket, txt: 'Ejecución' },
  ]

  return (
    <div className="px-hover flex h-full min-h-0 w-full">
      <style>{`.px-hover button:not(:disabled), .px-hover select, .px-hover summary, .px-hover [role="button"] { cursor: pointer; transition: box-shadow .12s, filter .12s, color .12s; }
.px-hover button:not(:disabled):hover, .px-hover select:hover, .px-hover summary:hover, .px-hover [role="button"]:hover { box-shadow: inset 0 0 0 999px rgba(255,255,255,0.075); filter: brightness(1.18); }
.px-hover button:not(:disabled):active { filter: brightness(1.05); }
.px-hover input:hover, .px-hover textarea:hover { border-color: rgba(255,255,255,0.22); }
.px-hover button:not(:disabled):focus-visible, .px-hover select:focus-visible { outline: 2px solid rgba(129,140,248,0.7); outline-offset: 1px; }`}</style>
      {/* ── Columna A: proyectos ── */}
      <div className={`w-60 flex-shrink-0 flex flex-col border-r border-white/5 ${listaAbierta || !pid ? '' : 'hidden'}`} style={{ background: 'rgba(0,0,0,0.15)' }}>
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2"><FolderKanban size={14} className="text-indigo-300" /><span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Proyectos</span><span className="text-[11px] text-[#7f8a9c]">{lista.length}</span></div>
          <div className="relative">
            <Search size={11} className="absolute left-2 top-2 text-[#7f8a9c]" />
            <input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Filtrar…" className="w-full rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-gray-300 outline-none border border-white/10 focus:border-indigo-500/40 placeholder-gray-600" style={{ background: 'rgba(255,255,255,0.04)' }} />
          </div>
          <div className="flex gap-1 mt-2">
            {([['todas', 'ALL'], ['COMERCIAL', 'BUSINESS'], ['INTERNO', 'INTERN']] as const).map(([k, txt]) => (
              <button key={k} onClick={() => setFiltroNat(k)} className="flex-1 px-1.5 py-0.5 rounded-md text-[10px] transition-colors"
                style={filtroNat === k ? { background: 'rgba(168,85,247,0.25)', color: '#f3e8ff', border: '1px solid rgba(168,85,247,0.5)' } : { background: 'rgba(255,255,255,0.04)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.07)' }}>
                {txt} {k === 'todas' ? lista.length : lista.filter(p => p.naturaleza === k).length}</button>))}
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
                {p.naturaleza === 'INTERNO' && <span title={`Interno (${p.tipo})`} className="text-[9px] px-1 rounded flex-shrink-0" style={{ background: 'rgba(168,85,247,0.2)', color: '#d8b4fe' }}>interno</span>}
                {esperaAprobacion(p.fase) && <span title="La puerta de la fase está completa: espera aprobación" className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
                {p.propuestasPendientes > 0 && <span title="Propuestas de memoria pendientes" className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />}
              </div>
              {p.fase
                ? <p className="text-[10px] mt-0.5 truncate font-medium" style={{ color: colorFase(p.fase) }}>{textoFase(p.fase)}<span className="font-normal text-[#7f8a9c]"> · {(ETIQUETA_BLOQUE[p.fase.bloque] ?? '').toLowerCase()}{p.fase.estadoMotor === 'EN_CURSO' && p.fase.puerta.total > 0 ? ` · puerta ${p.fase.puerta.ok}/${p.fase.puerta.total}` : ''}</span></p>
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
                <button onClick={alternarLista} className="text-[#7f8a9c] hover:text-gray-200 flex-shrink-0" title={listaAbierta ? 'Ocultar la lista de proyectos' : 'Mostrar la lista de proyectos'} aria-label={listaAbierta ? 'Ocultar la lista de proyectos' : 'Mostrar la lista de proyectos'}>{listaAbierta ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}</button>
                <h2 className="text-[13px] font-bold text-gray-100 truncate">{proyecto?.nombre ?? det?.proyecto.nombre ?? '…'}</h2>
                {det && <span className="text-[10px] px-1.5 py-0.5 rounded-full text-gray-400" style={{ background: 'rgba(255,255,255,0.07)' }}>{det.proyecto.estado}</span>}
                {fasesRes?.iniciado && fasesRes.faseActual && (() => { const f = fasesRes.fases?.find(x => x.clave === fasesRes.faseActual); return f ? (
                  <button onClick={() => { setVista(f.clave); setPanel('fases'); setPanelAbierto(true) }} title={f.objetivo} className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(99,102,241,0.2)', color: '#c7d2fe', border: '1px solid rgba(99,102,241,0.4)' }}>{f.numero}·{f.nombre}</button>) : null })()}
                <span className="flex-1" />
                <a href={`/solutions/pilots/${pid}`} className="flex items-center gap-1 text-[11px] text-[#7f8a9c] hover:text-gray-200" title="Abrir el hub de la solución en su pantalla clásica"><ExternalLink size={11} /> Hub clásico</a>
                <button onClick={() => setPanelAbierto(o => !o)} className="text-[#7f8a9c] hover:text-gray-200" title={panelAbierto ? 'Ocultar panel' : 'Mostrar panel'}>{panelAbierto ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}</button>
              </div>
              <BarraArtefactos activo={tabVista} onIr={irArtefacto} meta={metaArt} chatActivo={vista === 'asistente'} onChat={() => setVista('asistente')} />
              {vista === 'asistente' && <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto">
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
              </div>}

              {vista === 'asistente' && nueva && (
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

            {hubAbierto && <div className={`flex-1 min-h-0 overflow-y-auto ${tabVista ? '' : 'hidden'}`}>
              <HubSolucion key={pid} idDirecto={pid} embebido tabExterna={tabArt}
                onTabChange={t => { setTabArt(t); setVista(v => (v.startsWith('art:') ? 'art:' + t : v)) }}
                onMeta={m => setMetaArt(m)} onSucio={setHubSucio} />
            </div>}

            {vista !== 'asistente' && !tabVista && fasesRes?.fases && (() => {
              const f = fasesRes.fases.find(x => x.clave === vista)
              return f ? <div className="flex-1 min-h-0"><VistaFase key={`${pid}-${f.clave}`} proyectoId={pid} fase={f} data={fasesRes} onCambio={refrescar} onAbrirPanel={p => { setPanel(p); setPanelAbierto(true) }} onAbrirArtefacto={irArtefacto} /></div> : null
            })()}

            {vista === 'asistente' && <div className="flex-1 min-h-0">
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
            </div>}
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
            {panel === 'fases' && <PanelFases data={fasesRes} activa={vista} onAbrir={clave => setVista(clave)} />}
            {panel === 'contexto' && <PanelContexto proyectoId={pid} sesion={sesionFull && sesionFull.id === sid ? sesionFull : null} onSesion={setSesionFull} />}
            {panel === 'propuestas' && <PanelPropuestas key={nPropuestas} proyectoId={pid} onAbrir={irArtefacto} />}
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
