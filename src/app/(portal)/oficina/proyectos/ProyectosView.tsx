'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  Loader2, Search, Plus, Lock, FolderKanban, Layers, Brain, Check, Paperclip, Radio, Rocket, PanelRightClose, PanelRightOpen, PanelLeftClose, PanelLeftOpen, X, MessageSquare, Sparkles, FileText, ChevronDown, SlidersHorizontal,
} from 'lucide-react'
import { ETIQUETA_TIPO, DESCRIPCION_TIPO, type TipoSesion } from '@/lib/proyectos/tipos'
import { api, post, hace, ETIQUETA_BLOQUE, type Naturaleza, type FaseLista, type FasesRes, type ProyectoLista, type DetalleProyecto, type SesionFull, type SesionRes } from './api'
import ChatSesion from './ChatSesion'
import ResumenProyecto from './ResumenProyecto'
import PanelContexto from './PanelContexto'
import PanelMemoria from './PanelMemoria'
import PanelAdjuntos from './PanelAdjuntos'
import PanelBuscar from './PanelBuscar'
import PanelAuto from './PanelAuto'
import PanelEjecucion from './PanelEjecucion'
import VistaFase from './VistaFase'
import PanelArtefactos from './PanelArtefactos'
import GaleriaProyectos from './GaleriaProyectos'
import PlantillasFases from './PlantillasFases'
import FichaCliente from './FichaCliente'
import LeadRegistrado from './LeadRegistrado'
import NuevoProyecto from './NuevoProyecto'
import PanelPropuestas from './PanelPropuestas'
import { TITULO_DE_TAB } from '../../solutions/pilots/[id]/ArbolArtefactos'
import type { RolSesion } from './api'
import type { ArtefactoMeta, TabKey } from '../../solutions/pilots/[id]/espacio'

// El hub de la solución (documentos, lienzos, cronograma…) vive aquí dentro, sin barra lateral propia. Se carga al abrir el primer artefacto.
const HubSolucion = dynamic(() => import('../../solutions/pilots/[id]/HubSolucion'), {
  ssr: false,
  loading: () => <div className="flex justify-center py-16 text-[#7f8a9c]"><Loader2 size={18} className="animate-spin" /></div>,
})

type Panel = 'artefactos' | 'contexto' | 'propuestas' | 'memoria' | 'adjuntos' | 'buscar' | 'auto' | 'ejecucion'
const PRINCIPALES: Panel[] = ['artefactos', 'contexto', 'propuestas']
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
export default function ProyectosView({ initialProyectoId, initialArtefacto, abrirPlantillas }: { initialProyectoId?: string | null; initialArtefacto?: string | null; abrirPlantillas?: boolean }) {
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
  const [panel, setPanel] = useState<Panel>('artefactos')
  const [panelAbierto, setPanelAbierto] = useState(true)
  const [masAbierto, setMasAbierto] = useState(false)
  const [editorPlantillas, setEditorPlantillas] = useState(!!abrirPlantillas)
  const [plantillasIni, setPlantillasIni] = useState<{ codigo: string; fase: string } | null>(null)
  useEffect(() => { if (abrirPlantillas) setEditorPlantillas(true) }, [abrirPlantillas])
  const [fichaAbierta, setFichaAbierta] = useState(false)
  const [resumenAbierto, setResumenAbierto] = useState(false)
  const [avisosN, setAvisosN] = useState(0)
  const [leadAbierto, setLeadAbierto] = useState(false)
  const [fichaAuto, setFichaAuto] = useState(0)
  // Escape cierra el diálogo abierto (ficha / lead)
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { setFichaAbierta(false); setLeadAbierto(false) } }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [])
  const [nuevoProyecto, setNuevoProyecto] = useState(false)
  const [fichaResumen, setFichaResumen] = useState<{ existe: boolean; nombre: string; ok: number; total: number } | null>(null)
  const cargarFicha = useCallback((id: string) => {
    api<{ existe: boolean; cliente: { nombre: string } | null; completitud: { ok: number; total: number } }>(`/api/proyectos/${id}/cliente`)
      .then(d => { if (pidRef.current === id) setFichaResumen({ existe: d.existe, nombre: d.cliente?.nombre ?? '', ok: d.completitud.ok, total: d.completitud.total }) })
      .catch(() => { if (pidRef.current === id) setFichaResumen(null) })
  }, [])
  const [listaAbierta, setListaAbierta] = useState(true)
  useEffect(() => { try { if (localStorage.getItem('proyectos.lista') === '0') setListaAbierta(false) } catch { /* sin almacenamiento */ } }, [])
  const alternarLista = () => setListaAbierta(o => { const n = !o; try { localStorage.setItem('proyectos.lista', n ? '1' : '0') } catch { /* sin almacenamiento */ } return n })
  const [nueva, setNueva] = useState(false)
  const [vista, setVista] = useState<string>('asistente')
  const [fasesRes, setFasesRes] = useState<FasesRes | null>(null)
  // Cuántos avisos abiertos tiene el proyecto (la insignia del botón «Resumen»)
  useEffect(() => {
    if (!pid) { setAvisosN(0); return }
    let vivo = true
    api<unknown[]>(`/api/proyectos/${pid}/alertas`).then(l => { if (vivo) setAvisosN(Array.isArray(l) ? l.length : 0) }).catch(() => { if (vivo) setAvisosN(0) })
    return () => { vivo = false }
  }, [pid, resumenAbierto])
  // Hub embebido: se monta al abrir el primer artefacto y se oculta (no se desmonta) al volver al chat para no perder lo que se está editando
  const [hubAbierto, setHubAbierto] = useState(false)
  const [tabArt, setTabArt] = useState<TabKey | null>(null)
  const [metaArt, setMetaArt] = useState<Record<string, ArtefactoMeta>>({})
  const [hubSucio, setHubSucio] = useState(false)
  const artInicial = useRef<string | null>(initialArtefacto ?? null)
  const tabVista = vista.startsWith('art:') ? (vista.slice(4) as TabKey) : null
  const nPropuestas = Object.values(metaArt).reduce((n, m) => n + (m.propuestas || 0), 0)
  const irArtefacto = useCallback((t: TabKey) => { setTabArt(t); setHubAbierto(true); setVista('art:' + t); setPanel('artefactos'); setPanelAbierto(true) }, [])
  const [faseNueva, setFaseNueva] = useState<string | null>(null)
  const [rolSel, setRolSel] = useState<string | null>(null) // null = el primero de la fase; '' = libre
  const [creandoRol, setCreandoRol] = useState<string | null>(null)
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
    setHubAbierto(false); setTabArt(null); setHubSucio(false); setMetaArt({}); cargarMeta(id); setFichaResumen(null); setFichaAbierta(false)
    setPid(id); pidRef.current = id; setFasesRes(null); setVista('asistente'); void cargarFases(id, true); setDet(null); setSid(null); setSesionFull(null); setNueva(false); setError(null); setCargandoDet(true)
    void cargarDetalle(id)
    cargarFicha(id)
  }
  // Proyecto recibido por URL (?p=…)
  useEffect(() => {
    if (!initialProyectoId) return
    if (initialProyectoId !== pidRef.current) { artInicial.current = initialArtefacto ?? null; elegirProyecto(initialProyectoId) }
    else if (initialArtefacto && initialArtefacto in TITULO_DE_TAB) irArtefacto(initialArtefacto as TabKey)
  }, [initialProyectoId, initialArtefacto]) // eslint-disable-line react-hooks/exhaustive-deps

  const refrescar = useCallback(() => { if (pidRef.current) { void cargarDetalle(pidRef.current); void cargarFases(pidRef.current); cargarFicha(pidRef.current) } void cargarLista() }, [cargarDetalle, cargarFases, cargarFicha, cargarLista])

  async function crearSesion(tipo: TipoSesion, rol?: { fase: string; rol: string }) {
    if (!pid || creando) return
    setCreando(true); setError(null)
    try {
      const s = await post<SesionRes>(`/api/proyectos/${pid}/sesiones`, { tipo, privada: privadaNueva, ...(rol ?? {}) })
      setNueva(false); setPrivadaNueva(false); setVista('asistente')
      await cargarDetalle(pid, s.id); void cargarLista()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear la sesión') } finally { setCreando(false) }
  }

  async function iniciarRol(fase: string, rol: string) {
    setCreandoRol(rol)
    try { await crearSesion('LIBRE', { fase, rol }) } finally { setCreandoRol(null) }
  }
  const fasesConRoles = !!fasesRes?.fases?.length
  const faseSel = faseNueva ?? (fasesRes?.fases?.some(f => f.clave === vista) ? vista : fasesRes?.faseActual) ?? fasesRes?.fases?.[0]?.clave ?? ''
  const rolesSel = fasesRes?.fases?.find(f => f.clave === faseSel)?.sesiones ?? []
  const rolEfectivo = rolSel ?? rolesSel[0]?.clave ?? ''
  const rolDe = (s: SesionRes | null): { fase: string; rol: RolSesion } | null => {
    const f = s?.faseClave ? fasesRes?.fases?.find(x => x.clave === s.faseClave) : null
    const r = f?.sesiones?.find(x => x.clave === s?.rol)
    return f && r ? { fase: `${f.numero}·${f.nombre}`, rol: r } : null
  }
  const crearDesdeNueva = () => (fasesConRoles && rolEfectivo ? crearSesion('LIBRE', { fase: faseSel, rol: rolEfectivo }) : crearSesion(tipoNueva))

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
    { k: 'artefactos', icono: FileText, txt: 'Artefactos' },
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
      {editorPlantillas && <PlantillasFases inicial={plantillasIni ?? undefined} onCerrar={() => { setEditorPlantillas(false); setPlantillasIni(null) }} onCambio={refrescar} />}
      {nuevoProyecto && <NuevoProyecto onCerrar={() => setNuevoProyecto(false)} onCreado={id => { setNuevoProyecto(false); void cargarLista().then(() => elegirProyecto(id)) }} />}
      {resumenAbierto && pid && <ResumenProyecto proyectoId={pid} fases={fasesRes} onCerrar={() => setResumenAbierto(false)} />}
      {leadAbierto && pid && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(20px)', padding: 16 }} onClick={() => setLeadAbierto(false)}>
          <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', boxShadow: '0 8px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)', padding: 28, width: '100%', maxWidth: 720, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06),rgba(255,255,255,0.03))', margin: '-28px -28px 24px -28px', padding: '20px 28px', borderRadius: '24px 24px 0 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.01em' }}>Lead del proyecto</h2>
              <button onClick={() => setLeadAbierto(false)} aria-label="Cerrar" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 15, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <LeadRegistrado leadId={fasesRes?.lead?.id ?? null} />
          </div>
        </div>)}
      {fichaAbierta && pid && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(20px)', padding: 16 }} onClick={() => setFichaAbierta(false)}>
          <div role="dialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, backdropFilter: 'blur(40px) saturate(180%)', WebkitBackdropFilter: 'blur(40px) saturate(180%)', boxShadow: '0 8px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)', padding: 28, width: '100%', maxWidth: 980, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06),rgba(255,255,255,0.03))', margin: '-28px -28px 24px -28px', padding: '20px 28px', borderRadius: '24px 24px 0 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.01em' }}>Ficha del cliente</h2>
              <button onClick={() => setFichaAbierta(false)} aria-label="Cerrar" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', cursor: 'pointer', fontSize: 15, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <FichaCliente proyectoId={pid} onCambio={refrescar} onCerrar={() => setFichaAbierta(false)} autoIA={fichaAuto} />
          </div>
        </div>)}
      <style>{`.px-hover button:not(:disabled), .px-hover select, .px-hover summary, .px-hover [role="button"] { cursor: pointer; transition: box-shadow .12s, filter .12s, color .12s; }
.px-hover button:not(:disabled):hover, .px-hover select:hover, .px-hover summary:hover, .px-hover [role="button"]:hover { box-shadow: inset 0 0 0 999px rgba(255,255,255,0.075); filter: brightness(1.18); }
.px-hover button:not(:disabled):active { filter: brightness(1.05); }
.px-hover input:hover, .px-hover textarea:hover { border-color: rgba(255,255,255,0.22); }
.px-hover button:not(:disabled):focus-visible, .px-hover select:focus-visible { outline: 2px solid rgba(129,140,248,0.7); outline-offset: 1px; }
.px-hover a[href] { cursor: pointer; transition: filter .12s, color .12s; }
.px-hover a[href]:hover { filter: brightness(1.35); text-decoration: underline; text-underline-offset: 2px; }
.px-hover input:not([type="checkbox"]):not([type="radio"]):not([type="file"]), .px-hover textarea { transition: box-shadow .12s; }
.px-hover input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):hover, .px-hover textarea:hover { box-shadow: 0 0 0 1px rgba(255,255,255,0.22); }
.px-hover input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):focus, .px-hover textarea:focus { box-shadow: 0 0 0 1px rgba(249,115,22,0.55); }
.px-hover label:has(input[type="checkbox"]), .px-hover label:has(input[type="radio"]) { cursor: pointer; transition: filter .12s; }
.px-hover label:has(input[type="checkbox"]):hover, .px-hover label:has(input[type="radio"]):hover { filter: brightness(1.35); }
.px-hover [role="tab"]:not(:disabled):hover, .px-hover [role="menuitem"]:hover { filter: brightness(1.2); }
/* Superficies del navegador: selección, cursor, barras de desplazamiento y foco con la paleta del motor */
.px-hover ::selection { background: rgba(249,115,22,0.35); color: #fff; }
.px-hover input, .px-hover textarea { caret-color: #fb923c; }
.px-hover *, .px-hover { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.28) transparent; }
.px-hover ::-webkit-scrollbar { width: 8px; height: 8px; }
.px-hover ::-webkit-scrollbar-track { background: transparent; }
.px-hover ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.25); border-radius: 8px; border: 2px solid transparent; background-clip: content-box; }
.px-hover ::-webkit-scrollbar-thumb:hover { background: rgba(148,163,184,0.45); background-clip: content-box; }
.px-hover a[href]:focus-visible, .px-hover summary:focus-visible, .px-hover [role="tab"]:focus-visible, .px-hover [role="button"]:focus-visible { outline: 2px solid rgba(249,115,22,0.75); outline-offset: 2px; border-radius: 6px; }
.px-hover button:not(:disabled):focus-visible, .px-hover select:focus-visible { outline-color: rgba(249,115,22,0.75); }
.px-hover button:disabled, .px-hover select:disabled { cursor: not-allowed; }
.px-hover summary { list-style: none; } .px-hover summary::-webkit-details-marker { display: none; }
.px-hover details > summary::before { content: '▸'; display: inline-block; margin-right: 6px; transition: transform .15s cubic-bezier(.22,1,.36,1); }
.px-hover details[open] > summary::before { transform: rotate(90deg); }
.px-hover { font-variant-numeric: tabular-nums; }
@keyframes px-entra { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.px-hover section { animation: px-entra .22s cubic-bezier(.22,1,.36,1) both; }
@media (prefers-reduced-motion: reduce) { .px-hover *, .px-hover section { animation: none !important; transition: none !important; } }`}</style>
      {/* ── Columna A: proyectos ── */}
      <div className={`w-60 flex-shrink-0 flex flex-col border-r border-white/5 ${pid && listaAbierta ? '' : 'hidden'}`} style={{ background: 'rgba(0,0,0,0.15)' }}>
        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 mb-2"><FolderKanban size={14} className="text-indigo-300" /><span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Proyectos</span><span className="text-[11px] text-[#7f8a9c]">{lista.length}</span><span className="flex-1" />
            <button onClick={() => setNuevoProyecto(true)} title="Nuevo proyecto: registra el lead, crea el proyecto y arranca el motor" aria-label="Nuevo proyecto" className="text-[#7f8a9c] hover:text-gray-200"><Plus size={14} /></button>
            <button onClick={() => setEditorPlantillas(true)} title="Plantillas de fases: entregables, criterios y roles de sesión" aria-label="Plantillas de fases" className="text-[#7f8a9c] hover:text-gray-200"><SlidersHorizontal size={13} /></button></div>
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
          <GaleriaProyectos proyectos={filtrada} cargando={cargandoLista} filtro={filtro} onFiltro={setFiltro} nat={filtroNat} onNat={setFiltroNat}
            conteo={k => (k === 'todas' ? lista.length : lista.filter(p => p.naturaleza === k).length)} orden={orden} onOrden={o => setOrden(o as Orden)} ordenes={ORDENES}
            onElegir={id => { setListaAbierta(false); elegirProyecto(id) }} onNuevo={() => setNuevoProyecto(true)} onPlantillas={() => setEditorPlantillas(true)}
            espera={esperaAprobacion} color={colorFase} texto={textoFase} />)}

        {pid && (
          <>
            {/* Cabecera + sesiones */}
            <div className="flex-shrink-0 border-b border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="flex items-center gap-2 px-4 pt-2.5">
                <button onClick={alternarLista} className="text-[#7f8a9c] hover:text-gray-200 flex-shrink-0" title={listaAbierta ? 'Ocultar la lista de proyectos' : 'Mostrar la lista de proyectos'} aria-label={listaAbierta ? 'Ocultar la lista de proyectos' : 'Mostrar la lista de proyectos'}>{listaAbierta ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}</button>
                <h2 className="text-[13px] font-bold text-gray-100 truncate">{proyecto?.nombre ?? det?.proyecto.nombre ?? '…'}</h2>
                <button onClick={() => setVista('asistente')} title="Asistente: las sesiones de IA del proyecto" aria-label="Asistente" aria-pressed={vista === 'asistente'} className="flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 transition-colors"
                  style={vista === 'asistente' ? { background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.5)', color: '#fff' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#9ca3af' }}>
                  <MessageSquare size={12} /></button>
                <span className="flex-1" />
                <button onClick={() => setPanelAbierto(o => !o)} className="text-[#7f8a9c] hover:text-gray-200" title={panelAbierto ? 'Ocultar panel' : 'Mostrar panel'}>{panelAbierto ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}</button>
              </div>
              {/* Una pestaña por fase: el asistente (sesiones de IA) y las 12 fases del proyecto */}
              <div className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto border-t border-white/5">
                {!fasesRes && <Loader2 size={12} className="animate-spin text-[#7f8a9c] mx-2" />}
                {(fasesRes?.fases ?? []).map((f, i, todas) => {
                  const activa = vista === f.clave
                  const color = !fasesRes?.iniciado ? '#6b7280' : f.estado === 'HECHA' ? '#6ee7b7' : f.estado === 'ACTUAL' ? '#a5b4fc' : f.estado === 'CERRADA' ? '#fca5a5' : '#6b7280'
                  const lista = fasesRes?.iniciado && f.estado === 'ACTUAL' && f.puerta.cumplida
                  return (
                    <span key={f.clave} className="flex items-center gap-1 flex-shrink-0">
                      
                      <button onClick={() => setVista(f.clave)} title={f.objetivo} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors"
                        style={activa ? { background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.55)', color: '#fff' } : { background: f.estado === 'ACTUAL' && fasesRes?.iniciado ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)', border: f.estado === 'ACTUAL' && fasesRes?.iniciado ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.06)', color }}>
                        {fasesRes?.iniciado && f.estado === 'HECHA' ? <Check size={10} /> : <span className="text-[10px] opacity-70">{f.numero}</span>}
                        {f.nombre}
                        {lista && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="La puerta está completa: espera aprobación" />}
                      </button>
                    </span>)
                })}
              </div>
              {vista === 'asistente' && (det?.sesiones.length ?? 0) > 1 && <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto">
                {cargandoDet && !det && <Loader2 size={13} className="animate-spin text-[#7f8a9c]" />}
                {det?.sesiones.map(s => (
                  <button key={s.id} onClick={() => { setSid(s.id); setNueva(false) }} title={`${s.rol ? `${fasesRes?.fases?.find(f => f.clave === s.faseClave)?.sesiones?.find(r => r.clave === s.rol)?.titulo ?? s.rol} · ` : ''}${ETIQUETA_TIPO[s.tipo as TipoSesion] ?? s.tipo} · ${s.creadaPorNombre} · ${s.mensajes} mensajes`}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] flex-shrink-0 max-w-[200px] transition-colors"
                    style={s.id === sid ? { background: 'rgba(99,102,241,0.22)', border: '1px solid rgba(99,102,241,0.45)', color: '#fff' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#9ca3af', opacity: s.estado === 'ACTIVA' ? 1 : 0.65 }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: COLOR_TIPO[s.tipo] ?? '#94a3b8' }} />
                    {s.faseClave && <span className="text-[9px] opacity-60 flex-shrink-0">{fasesRes?.fases?.find(f => f.clave === s.faseClave)?.numero}</span>}<span className="truncate">{s.titulo}</span>
                    {s.privada && <Lock size={9} className="text-amber-400 flex-shrink-0" />}
                  </button>))}
              </div>}

              {vista === 'asistente' && nueva && (
                <div className="mx-4 mb-3 rounded-xl p-3 space-y-2" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between"><span className="text-[11px] font-semibold text-gray-200">¿Qué tipo de sesión?</span><button onClick={() => setNueva(false)} className="text-[#7f8a9c] hover:text-gray-200"><X size={13} /></button></div>
                  {fasesConRoles && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px] text-gray-400">Fase
                        <select value={faseSel} onChange={e => { setFaseNueva(e.target.value); setRolSel(null) }} className="rounded px-1.5 py-1 text-[11px] text-gray-200 bg-black/30 border border-white/10 outline-none">
                          {fasesRes?.fases?.map(f => <option key={f.clave} value={f.clave}>{f.numero}. {f.nombre}{f.clave === fasesRes.faseActual ? ' (actual)' : ''}</option>)}</select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {rolesSel.map(r => (
                          <button key={r.clave} onClick={() => setRolSel(r.clave)} className="text-left rounded-lg px-3 py-2 transition-colors" style={rolEfectivo === r.clave ? { background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.45)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <span className="block text-[11px] font-semibold text-gray-200">{r.titulo}</span>
                            <span className="block text-[11px] text-[#7f8a9c] mt-0.5 leading-snug">{r.objetivo}</span>
                          </button>))}
                        <button onClick={() => { setRolSel(''); setTipoNueva('LIBRE') }} className="text-left rounded-lg px-3 py-2 transition-colors" style={rolEfectivo === '' ? { background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.45)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          <span className="block text-[11px] font-semibold text-gray-200">Libre</span>
                          <span className="block text-[11px] text-[#7f8a9c] mt-0.5 leading-snug">Conversación abierta, sin rol ni lista de cierre.</span>
                        </button>
                      </div>
                    </div>)}
                  <div className={`grid grid-cols-2 gap-2 ${fasesConRoles ? 'hidden' : ''}`}>
                    {TIPOS_NUEVOS.map(t => (
                      <button key={t} onClick={() => setTipoNueva(t)} className="text-left rounded-lg px-3 py-2 transition-colors" style={tipoNueva === t ? { background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.45)' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-200"><span className="w-1.5 h-1.5 rounded-full" style={{ background: COLOR_TIPO[t] }} />{ETIQUETA_TIPO[t]}</span>
                        <span className="block text-[11px] text-[#7f8a9c] mt-0.5 leading-snug">{DESCRIPCION_TIPO[t]}</span>
                      </button>))}
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[11px] text-gray-400 cursor-pointer"><input type="checkbox" checked={privadaNueva} onChange={e => setPrivadaNueva(e.target.checked)} className="accent-indigo-500" /> <Lock size={10} /> Privada (solo yo la veo)</label>
                    <span className="flex-1" />
                    <button onClick={() => void crearDesdeNueva()} disabled={creando} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white flex items-center gap-1.5 disabled:opacity-50" style={{ background: 'rgba(99,102,241,0.85)' }}>{creando && <Loader2 size={11} className="animate-spin" />} Crear sesión</button>
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
              return f ? <div className="flex-1 min-h-0"><VistaFase onAbrirPlantillas={(fase: string) => { setPlantillasIni({ codigo: fasesRes?.plantilla?.codigo ?? (proyecto?.naturaleza === 'INTERNO' ? 'INICIATIVA_INTERNA' : 'PROYECTO_COMPLETO'), fase }); setEditorPlantillas(true) }} key={`${pid}-${f.clave}`} proyectoId={pid} fase={f} data={fasesRes} onCambio={refrescar} onAbrirPanel={p => { setPanel(p); setPanelAbierto(true) }} onAbrirArtefacto={irArtefacto} onAbrirFicha={() => setFichaAbierta(true)} onAbrirLead={() => setLeadAbierto(true)} onInvestigarEmpresa={() => { setFichaAuto(n => n + 1); setFichaAbierta(true) }}
                sesiones={det?.sesiones ?? []} creandoRol={creandoRol} onIniciarSesion={(fa, ro) => void iniciarRol(fa, ro)} onAbrirSesion={id => { setSid(id); setVista('asistente') }} /></div> : null
            })()}

            {vista === 'asistente' && <div className="flex-1 min-h-0">
              {det && sesion && det.yo && (
                <ChatSesion key={sesion.id} proyectoId={pid} sesion={sesion}
                  acciones={<button onClick={() => setNueva(o => !o)} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] flex-shrink-0 text-indigo-200" style={{ background: 'rgba(99,102,241,0.12)', border: '1px dashed rgba(99,102,241,0.4)' }}><Plus size={11} /> Nueva sesión</button>} rolInfo={rolDe(sesion)} yo={det.yo} onCambio={refrescar}
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
          <div className="flex border-b border-white/5 flex-shrink-0 relative">
            {TABS.filter(t => PRINCIPALES.includes(t.k)).map(t => (
              <button key={t.k} onClick={() => { setPanel(t.k); setMasAbierto(false) }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 relative transition-colors"
                style={panel === t.k ? { color: '#c7d2fe', borderBottom: '2px solid #6366f1', background: 'rgba(99,102,241,0.08)' } : { color: '#7f8a9c', borderBottom: '2px solid transparent' }}>
                <t.icono size={14} /><span className="text-[11px] font-medium">{t.txt}</span>
                {!!t.badge && <span className="min-w-[15px] h-[15px] rounded-full text-[10px] font-bold flex items-center justify-center text-white px-1" style={{ background: '#f59e0b' }}>{t.badge}</span>}
              </button>))}
            {(() => {
              const secundarias = TABS.filter(t => !PRINCIPALES.includes(t.k))
              const activa = secundarias.find(t => t.k === panel)
              const avisos = secundarias.reduce((n, t) => n + (t.badge || 0), 0)
              return (
                <>
                  <button onClick={() => setMasAbierto(o => !o)} aria-haspopup="menu" aria-expanded={masAbierto} className="flex items-center justify-center gap-1.5 px-3 py-2.5 relative transition-colors flex-shrink-0"
                    style={activa ? { color: '#c7d2fe', borderBottom: '2px solid #6366f1', background: 'rgba(99,102,241,0.08)' } : { color: '#7f8a9c', borderBottom: '2px solid transparent' }}>
                    {activa ? <><activa.icono size={14} /><span className="text-[11px] font-medium">{activa.txt}</span></> : <span className="text-[11px] font-medium">Más</span>}
                    <ChevronDown size={12} />
                    {!activa && avisos > 0 && <span className="absolute top-1.5 right-1 w-2 h-2 rounded-full bg-indigo-400" />}
                  </button>
                  {masAbierto && (
                    <>
                      <button aria-label="Cerrar el menú" onClick={() => setMasAbierto(false)} className="fixed inset-0 z-10 cursor-default" style={{ background: 'transparent' }} />
                      <div role="menu" className="absolute right-2 top-full mt-1 z-20 w-48 rounded-xl py-1 shadow-xl" style={{ background: '#14142b', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {secundarias.map(t => (
                          <button key={t.k} role="menuitem" onClick={() => { setPanel(t.k); setMasAbierto(false) }} className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-white/5"
                            style={{ color: panel === t.k ? '#c7d2fe' : '#cbd5e1' }}>
                            <t.icono size={14} /><span className="flex-1">{t.txt}</span>
                            {!!t.badge && <span className="min-w-[15px] h-[15px] rounded-full text-[10px] font-bold flex items-center justify-center text-white px-1" style={{ background: t.k === 'memoria' ? '#f59e0b' : '#6366f1' }}>{t.badge}</span>}
                          </button>))}
                      </div>
                    </>)}
                </>)
            })()}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {panel === 'artefactos' && <PanelArtefactos activo={tabVista} onIr={irArtefacto} meta={metaArt} onAbrirFicha={() => setFichaAbierta(true)}
              proyecto={(proyecto?.tipo ?? fasesRes?.solucion?.tipo) ? { id: pid, tipo: (proyecto?.tipo ?? fasesRes?.solucion?.tipo) as string, onCambio: refrescar, avisos: avisosN, onResumen: () => setResumenAbierto(true) } : null}
              ficha={fichaResumen && (fichaResumen.existe || (fasesRes?.fases ?? []).some(x => (x.requeridos ?? []).some(r => r.tipo === 'ficha_cliente'))) ? fichaResumen : null} />}
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
