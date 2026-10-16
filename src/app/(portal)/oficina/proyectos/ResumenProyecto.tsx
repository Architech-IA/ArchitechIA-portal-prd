'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, X, BellOff, RefreshCw } from 'lucide-react'
import { api, post, put, hace, type FasesRes } from './api'

interface Aviso { id: string; tipo: string; titulo: string; detalle: string; creadaEn: string }
interface Resumen {
  tareas: Record<string, number>
  sprints: { total: number; activos: number; planificados: number; cerrados: number; atrasados: number }
  pendientes: { accionesIA: number; propuestas: number; archivos: number }
  alertasAbiertas: number
  uso: {
    sesiones: { mensajes: number; entrada: string; cache: string; salida: string }
    ejecutor: { ejecuciones: number; total: string; entrada: string }
    otros: { origen: string; llamadas: number; entrada: string; salida: string; cache: string }[]
  }
}

interface CostoSesion { id: string; titulo: string; tipo: string; estado: string; mensajes: number; entrada: number; cache: number; salida: number; ultima: string | null; presupuesto: number | null }
interface Costo {
  sesiones: CostoSesion[]; dias: { dia: string; total: number }[]
  proyecto: { entrada: number; cache: number; salida: number; total: number; presupuesto: number | null }
  presupuestoSesionPorDefecto: number | null; estimadoUsd: number | null; conPrecios: boolean
}

const ESTADOS: { clave: string; etiqueta: string; color: string }[] = [
  { clave: 'DONE', etiqueta: 'Hechas', color: '#10b981' }, { clave: 'IN_PROGRESS', etiqueta: 'En curso', color: '#f59e0b' }, { clave: 'BACKLOG', etiqueta: 'En cola', color: '#6366f1' },
  { clave: 'BLOCKED', etiqueta: 'Bloqueadas', color: '#a855f7' }, { clave: 'FAILED', etiqueta: 'Fallidas', color: '#ef4444' },
]
const ICONO: Record<string, string> = { TAREA_ATASCADA: '⏱', TAREA_FALLIDA: '❌', TAREA_LIBERADA: '♻️', SPRINT_ATRASADO: '📅', ACCION_IA_PENDIENTE: '⏳', PROPUESTA_PENDIENTE: '⏳', ENTREGABLE_POR_REVISAR: '⏳', FASE_SIN_MOVIMIENTO: '🔔' }
const ORIGEN: Record<string, string> = { PRD: 'Generación del PRD', NOTAS: 'Notas desde sesiones', ENTREGABLES: 'Entregables en archivo', OTROS: 'Otras llamadas' }
const num = (v: string | number | null | undefined) => Number(v ?? 0).toLocaleString('es-CO')

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#b4bccb] mb-3">{titulo}</h3>
      {children}
    </section>)
}

/** Costo por sesión, evolución diaria y presupuestos de tokens (el tope lo ponen los administradores). */
function CostoPorSesion({ proyectoId }: { proyectoId: string }) {
  const [c, setC] = useState<Costo | null>(null)
  const [error, setError] = useState('')
  const [editando, setEditando] = useState<string | null>(null) // 'proyecto' | id de sesión
  const [valor, setValor] = useState('')
  const [todas, setTodas] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const cargar = useCallback(async () => {
    try { setC(await api<Costo>(`/api/proyectos/${proyectoId}/costo`)); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el costo por sesión') }
  }, [proyectoId])
  useEffect(() => { void cargar() }, [cargar])
  async function guardar(sesionId: string | null, tokens: number | null) {
    setGuardando(true); setError('')
    try { await put(`/api/proyectos/${proyectoId}/costo/presupuesto`, { sesionId: sesionId ?? undefined, tokens }); setEditando(null); setValor(''); await cargar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el presupuesto') } finally { setGuardando(false) }
  }
  if (!c) return error ? <p className="text-[12px] text-red-300">{error}</p> : null
  const maxDia = Math.max(1, ...c.dias.map(d => d.total))
  const filas = todas ? c.sesiones : c.sesiones.slice(0, 8)
  const pctProy = c.proyecto.presupuesto ? Math.min(100, Math.round((100 * c.proyecto.total) / c.proyecto.presupuesto)) : null
  const editor = (sesionId: string | null, actual: number | null) => (
    <span className="inline-flex items-center gap-1.5">
      <input value={valor} onChange={e => setValor(e.target.value.replace(/[^0-9]/g, ''))} placeholder="tokens, ej. 500000" inputMode="numeric" autoFocus aria-label="Presupuesto en tokens" className="rounded px-2 py-0.5 text-[11px] text-gray-100 bg-black/30 border border-white/10 outline-none w-36" />
      <button onClick={() => void guardar(sesionId, Number(valor))} disabled={guardando || !valor} className="text-[11px] px-2 py-0.5 rounded text-white disabled:opacity-40" style={{ background: 'rgba(16,185,129,0.7)' }}>Guardar</button>
      {actual !== null && <button onClick={() => void guardar(sesionId, null)} disabled={guardando} className="text-[11px] px-2 py-0.5 rounded text-gray-200 bg-white/10 disabled:opacity-40">Quitar tope</button>}
      <button onClick={() => { setEditando(null); setValor('') }} className="text-[11px] text-[#9ca3af] hover:text-gray-200">Cancelar</button>
    </span>)
  return (
    <Tarjeta titulo="Costo por sesión y presupuestos">
      {error && <p className="text-[12px] text-red-300 mb-2">{error}</p>}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <div><p className="text-[10px] uppercase tracking-wide text-[#7f8a9c]">Sesiones (entrada + salida)</p><p className="text-[18px] font-bold text-gray-50 leading-tight">{num(c.proyecto.total)}</p></div>
        {c.conPrecios && c.estimadoUsd !== null && <div><p className="text-[10px] uppercase tracking-wide text-[#7f8a9c]">Costo estimado</p><p className="text-[18px] font-bold text-gray-50 leading-tight">US$ {c.estimadoUsd.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c]">Presupuesto del proyecto</p>
          {editando === 'proyecto' ? editor(null, c.proyecto.presupuesto) : (
            <p className="text-[12px] text-gray-200">{c.proyecto.presupuesto ? <>{num(c.proyecto.presupuesto)} tokens · <span className={pctProy !== null && pctProy >= 90 ? 'text-red-300' : pctProy !== null && pctProy >= 70 ? 'text-amber-300' : ''}>{pctProy} % usado</span></> : 'Sin tope'}{' '}
              <button onClick={() => { setEditando('proyecto'); setValor(c.proyecto.presupuesto ? String(c.proyecto.presupuesto) : '') }} className="text-[11px] text-orange-300 hover:text-orange-200 underline underline-offset-2">{c.proyecto.presupuesto ? 'cambiar' : 'poner tope'}</button></p>)}
        </div>
      </div>
      {c.dias.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-wide text-[#7f8a9c] mb-1">Últimos 14 días</p>
          <div className="flex items-end gap-1 h-12" role="img" aria-label="Tokens por día en los últimos 14 días">
            {c.dias.map(d => <div key={d.dia} title={`${d.dia}: ${num(d.total)} tokens`} className="flex-1 rounded-t" style={{ height: `${Math.max(6, (100 * d.total) / maxDia)}%`, background: 'linear-gradient(180deg,#f97316,#ea580c)', opacity: 0.85 }} />)}
          </div>
        </div>)}
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-[11px] text-left">
          <thead className="text-[#7f8a9c]"><tr><th className="py-1 pr-3 font-medium">Sesión</th><th className="py-1 pr-3 font-medium">Mensajes</th><th className="py-1 pr-3 font-medium">Entrada</th><th className="py-1 pr-3 font-medium">Salida</th><th className="py-1 pr-3 font-medium">Caché</th><th className="py-1 font-medium">Presupuesto</th></tr></thead>
          <tbody className="text-gray-300">
            {filas.map(s => {
              const tope = s.presupuesto ?? c.presupuestoSesionPorDefecto
              const usado = s.entrada + s.salida
              const pct = tope ? Math.min(100, Math.round((100 * usado) / tope)) : null
              return (
                <tr key={s.id} className="border-t border-white/5 align-top">
                  <td className="py-1 pr-3 max-w-[220px]"><span className="block truncate text-gray-100" title={s.titulo}>{s.titulo}</span><span className="text-[10px] text-[#7f8a9c]">{s.tipo}{s.estado === 'ARCHIVADA' ? ' · archivada' : ''}{s.ultima ? ` · ${hace(s.ultima)}` : ''}</span></td>
                  <td className="pr-3">{num(s.mensajes)}</td><td className="pr-3">{num(s.entrada)}</td><td className="pr-3">{num(s.salida)}</td>
                  <td className="pr-3">{s.entrada > 0 ? `${Math.round((100 * s.cache) / s.entrada)} %` : '—'}</td>
                  <td className="py-1">
                    {editando === s.id ? editor(s.id, s.presupuesto) : (<>
                      {tope ? (<div className="w-40"><div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: (pct ?? 0) >= 90 ? '#ef4444' : (pct ?? 0) >= 70 ? '#f59e0b' : '#10b981' }} /></div><span className="text-[10px] text-[#9ca3af]">{num(usado)} de {num(tope)}{s.presupuesto === null ? ' (por defecto)' : ''}</span></div>) : <span className="text-[#7f8a9c]">Sin tope</span>}{' '}
                      <button onClick={() => { setEditando(s.id); setValor(s.presupuesto ? String(s.presupuesto) : '') }} className="text-[10px] text-orange-300 hover:text-orange-200 underline underline-offset-2">{s.presupuesto ? 'cambiar' : 'poner tope'}</button></>)}
                  </td>
                </tr>)
            })}
            {c.sesiones.length === 0 && <tr><td colSpan={6} className="py-2 text-[#9ca3af]">Todavía no hay sesiones.</td></tr>}
          </tbody>
        </table>
      </div>
      {c.sesiones.length > 8 && <button onClick={() => setTodas(v => !v)} className="text-[11px] text-orange-300 hover:text-orange-200 mt-2">{todas ? 'Ver menos' : `Ver las ${c.sesiones.length} sesiones`}</button>}
      <p className="text-[10px] text-[#7f8a9c] mt-2 leading-snug">Cuando una sesión o el proyecto llega a su tope, la IA deja de gastar: termina la respuesta en curso sin más herramientas y los mensajes siguientes se rechazan hasta que un administrador suba el tope.{c.presupuestoSesionPorDefecto ? ` Tope por defecto de cada sesión: ${num(c.presupuestoSesionPorDefecto)} tokens.` : ''} Solo los administradores pueden cambiarlos.{!c.conPrecios ? ' El costo en dinero aparece cuando se configuran los precios por millón de tokens del proveedor.' : ''}</p>
    </Tarjeta>)
}

/** Avance, avisos y costo de un proyecto, en una sola pantalla. */
export default function ResumenProyecto({ proyectoId, fases, onCerrar }: { proyectoId: string; fases: FasesRes | null; onCerrar: () => void }) {
  const [r, setR] = useState<Resumen | null>(null)
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try {
      const [a, b] = await Promise.all([api<Resumen>(`/api/proyectos/${proyectoId}/resumen`), api<Aviso[]>(`/api/proyectos/${proyectoId}/alertas`)])
      setR(a); setAvisos(Array.isArray(b) ? b : [])
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el resumen') } finally { setCargando(false) }
  }, [proyectoId])
  useEffect(() => { void cargar() }, [cargar])
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar() }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onCerrar])

  async function descartar(a: Aviso) {
    try { await post(`/api/proyectos/${proyectoId}/alertas/${a.id}/descartar`); setAvisos(l => l.filter(x => x.id !== a.id)) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo descartar') }
  }

  const lista = fases?.fases ?? []
  const idx = lista.findIndex(f => f.clave === fases?.faseActual)
  const actual = idx >= 0 ? lista[idx] : null
  const reqs = actual?.requeridos ?? []
  const totalTareas = r ? Object.values(r.tareas).reduce((a, b) => a + b, 0) : 0
  const sesiones = r?.uso.sesiones
  const entradaTotal = r ? Number(r.uso.sesiones.entrada) + Number(r.uso.ejecutor.entrada) + r.uso.otros.reduce((a, o) => a + Number(o.entrada ?? 0), 0) : 0
  const total = r ? Number(r.uso.sesiones.entrada) + Number(r.uso.sesiones.salida) + Number(r.uso.ejecutor.total) + r.uso.otros.reduce((a, o) => a + Number(o.entrada ?? 0) + Number(o.salida ?? 0), 0) : 0
  const cachePct = sesiones && Number(sesiones.entrada) > 0 ? Math.round((100 * Number(sesiones.cache)) / Number(sesiones.entrada)) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(20px)', padding: 16 }} onClick={onCerrar}>
      <div role="dialog" aria-modal="true" aria-label="Resumen del proyecto" onClick={e => e.stopPropagation()} className="w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        style={{ background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 24, backdropFilter: 'blur(40px) saturate(180%)', boxShadow: '0 8px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(135deg,rgba(249,115,22,0.12),rgba(234,88,12,0.06),rgba(255,255,255,0.03))', padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.01em', flex: 1 }}>Resumen del proyecto</h2>
          <button onClick={() => void cargar()} disabled={cargando} title="Actualizar" aria-label="Actualizar" className="text-[#94a3b8] hover:text-gray-100 disabled:opacity-40">{cargando ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}</button>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94a3b8', width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4">
          {error && <p className="text-[12px] text-red-300">{error}</p>}
          {!r && !error && <div className="flex justify-center py-10 text-[#7f8a9c]"><Loader2 size={18} className="animate-spin" /></div>}
          {r && (<>
            <div className="grid md:grid-cols-2 gap-4">
              <Tarjeta titulo="Avance">
                {actual ? (<>
                  <p className="text-[13px] text-gray-100">Fase {actual.numero} de {lista.length} · <span className="font-semibold">{actual.nombre}</span></p>
                  <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.round(((idx + 1) / Math.max(1, lista.length)) * 100)}%`, background: 'linear-gradient(90deg,#f97316,#ea580c)' }} /></div>
                  <p className="text-[11px] text-[#9ca3af] mt-2">Entregables de la fase: {reqs.filter(x => x.ok).length} de {reqs.length}{actual.puerta?.cumplida ? ' · puerta lista para aprobar' : ''}</p>
                </>) : <p className="text-[12px] text-[#9ca3af]">{fases?.iniciado === false ? 'El motor de fases todavía no se inició.' : 'Sin fase actual (proyecto cerrado o sin fases).'}</p>}
                <p className="text-[11px] uppercase tracking-wide text-[#7f8a9c] mt-4 mb-1.5">Tareas del backlog ({totalTareas})</p>
                {totalTareas > 0 ? (<>
                  <div className="flex h-2 rounded-full overflow-hidden bg-white/10">{ESTADOS.map(e => (r.tareas[e.clave] ?? 0) > 0 && <div key={e.clave} title={`${e.etiqueta}: ${r.tareas[e.clave]}`} style={{ width: `${(100 * r.tareas[e.clave]) / totalTareas}%`, background: e.color }} />)}</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">{ESTADOS.map(e => (r.tareas[e.clave] ?? 0) > 0 && <span key={e.clave} className="text-[11px] text-gray-300 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: e.color }} />{e.etiqueta} {r.tareas[e.clave]}</span>)}</div>
                </>) : <p className="text-[11px] text-[#9ca3af]">Sin tareas todavía.</p>}
                <p className="text-[11px] text-[#9ca3af] mt-3">Sprints: {r.sprints.total} · activos {r.sprints.activos} · planificados {r.sprints.planificados} · cerrados {r.sprints.cerrados}{r.sprints.atrasados > 0 ? <span className="text-amber-300"> · {r.sprints.atrasados} atrasado(s)</span> : null}</p>
              </Tarjeta>

              <Tarjeta titulo={`Avisos (${avisos.length})`}>
                {avisos.length === 0 ? <p className="text-[12px] text-[#9ca3af]">Nada que atender por ahora. Se revisa solo cada 15 minutos.</p> : (
                  <ul className="space-y-2">{avisos.slice(0, 8).map(a => (
                    <li key={a.id} className="flex items-start gap-2">
                      <span className="text-[13px] leading-5">{ICONO[a.tipo] ?? '🔔'}</span>
                      <div className="min-w-0 flex-1"><p className="text-[12px] text-gray-100 leading-snug">{a.titulo}</p><p className="text-[11px] text-[#9ca3af] leading-snug break-words">{a.detalle} · {hace(a.creadaEn)}</p></div>
                      <button onClick={() => void descartar(a)} title="Descartar este aviso" aria-label="Descartar" className="text-[#7f8a9c] hover:text-gray-200 mt-0.5"><BellOff size={13} /></button>
                    </li>))}
                  </ul>)}
                {avisos.length > 8 && <p className="text-[11px] text-[#7f8a9c] mt-2">… y {avisos.length - 8} más.</p>}
                <p className="text-[11px] uppercase tracking-wide text-[#7f8a9c] mt-4 mb-1.5">Esperando a una persona</p>
                <p className="text-[12px] text-gray-300">{r.pendientes.accionesIA} acción(es) de la IA · {r.pendientes.propuestas} propuesta(s) de artefactos · {r.pendientes.archivos} archivo(s) por revisar</p>
              </Tarjeta>
            </div>

            <Tarjeta titulo="Costo en tokens">
              <p className="text-[22px] font-bold text-gray-50 leading-none">{num(total)} <span className="text-[12px] font-normal text-[#9ca3af]">tokens en total · entrada {num(entradaTotal)}</span></p>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-[11px] text-left">
                  <thead className="text-[#7f8a9c]"><tr><th className="py-1 pr-3 font-medium">Origen</th><th className="py-1 pr-3 font-medium">Llamadas</th><th className="py-1 pr-3 font-medium">Entrada</th><th className="py-1 pr-3 font-medium">Salida</th><th className="py-1 font-medium">Caché</th></tr></thead>
                  <tbody className="text-gray-300">
                    <tr className="border-t border-white/5"><td className="py-1 pr-3">Sesiones de chat</td><td className="pr-3">{num(r.uso.sesiones.mensajes)} mensajes</td><td className="pr-3">{num(r.uso.sesiones.entrada)}</td><td className="pr-3">{num(r.uso.sesiones.salida)}</td><td>{cachePct !== null ? `${cachePct} %` : '—'}</td></tr>
                    <tr className="border-t border-white/5"><td className="py-1 pr-3">Motor (ejecución de tareas)</td><td className="pr-3">{num(r.uso.ejecutor.ejecuciones)} ejecuciones</td><td className="pr-3">{num(r.uso.ejecutor.entrada)}</td><td className="pr-3">{num(Number(r.uso.ejecutor.total) - Number(r.uso.ejecutor.entrada))}</td><td>—</td></tr>
                    {r.uso.otros.map(o => <tr key={o.origen} className="border-t border-white/5"><td className="py-1 pr-3">{ORIGEN[o.origen] ?? o.origen}</td><td className="pr-3">{num(o.llamadas)} llamadas</td><td className="pr-3">{num(o.entrada)}</td><td className="pr-3">{num(o.salida)}</td><td>{Number(o.entrada) > 0 ? `${Math.round((100 * Number(o.cache)) / Number(o.entrada))} %` : '—'}</td></tr>)}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-[#7f8a9c] mt-2 leading-snug">Son tokens, no dinero: el precio depende del plan del proveedor. «Caché» es la parte de la entrada que el proveedor ya tenía guardada (cuanto más alta, más barato). Lo que se generó antes de activar este registro no aparece en «Otras llamadas».</p>
            </Tarjeta>
            <CostoPorSesion proyectoId={proyectoId} />
          </>)}
        </div>
      </div>
    </div>
  )
}
