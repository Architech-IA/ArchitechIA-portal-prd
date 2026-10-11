'use client'

import { useMemo, useRef, useState } from 'react'
import { Plus, Diamond, Trash2, Flag, Target, X } from 'lucide-react'

export interface FaseGantt {
  id: string
  fase: string
  fechaInicio: string
  fechaFin: string
  estado: string
  backlogItemId?: string
  dependeDe?: string
  /** Línea base: las fechas con las que se comprometió la fase. */
  base?: { inicio: string; fin: string }
  /** Hito: una fecha, sin duración (se dibuja como rombo). */
  hito?: boolean
  [k: string]: unknown
}
interface TareaLite { id: string; status: string; title: string; taskCode: string | null }

const DIA = 86400000
const toDay = (s: string) => { const p = s.split('-').map(Number); return p.length === 3 && p.every(n => !isNaN(n)) ? Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / DIA) : NaN }
const fromDay = (n: number) => new Date(n * DIA).toISOString().slice(0, 10)
const hoyDia = () => Math.floor(Date.now() / DIA)
const corto = (s: string) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—')

export const sumarDiasFecha = (f: string, d: number) => (isNaN(toDay(f)) ? f : fromDay(toDay(f) + d))

/** Igual que en el servidor: la fase de origen alarga su fin y las que dependen de ella (en cadena) se corren completas. */
export function aplicarDesplazamiento(fases: FaseGantt[], dias: number, desdeId?: string): FaseGantt[] {
  let afectadas: string[] = desdeId ? [desdeId] : []
  if (desdeId) {
    for (;;) {
      const nuevas = fases.filter(f => f.dependeDe && afectadas.includes(f.dependeDe) && !afectadas.includes(f.id)).map(f => f.id)
      if (nuevas.length === 0) break
      afectadas = [...afectadas, ...nuevas]
    }
  } else {
    afectadas = fases.filter(f => f.estado !== 'COMPLETADA').map(f => f.id)
  }
  return fases.map(f => {
    if (!afectadas.includes(f.id)) return f
    return { ...f, fechaInicio: f.id === desdeId ? f.fechaInicio : sumarDiasFecha(f.fechaInicio, dias), fechaFin: sumarDiasFecha(f.fechaFin, dias) }
  })
}

const ALTO = 34
const CAB = 46
const ZOOMS = [{ k: 'mes', t: 'Mes', px: 5 }, { k: 'semana', t: 'Semana', px: 14 }, { k: 'dia', t: 'Día', px: 30 }] as const
const COLOR: Record<string, { fill: string; avance: string }> = {
  PENDIENTE: { fill: '#475569', avance: '#94a3b8' },
  EN_CURSO: { fill: '#0e7490', avance: '#22d3ee' },
  COMPLETADA: { fill: '#047857', avance: '#34d399' },
}
let contador = 0
const nuevoId = () => `f${Date.now().toString(36)}${(contador++).toString(36)}`

/** Cronograma editable: se arrastra una barra para moverla o sus bordes para cambiar inicio y fin; las dependencias se dibujan y se pueden mover en cadena. */
export default function CronogramaGantt({ fases, onChange, tareasPorId, fantasma }: {
  fases: FaseGantt[]
  onChange: (f: FaseGantt[]) => void
  tareasPorId: Record<string, TareaLite>
  /** Cómo quedarían las fases si se aceptaran las propuestas del motor (se dibuja punteado). */
  fantasma?: FaseGantt[]
}) {
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]['k']>('semana')
  const px = ZOOMS.find(z => z.k === zoom)!.px
  const [sel, setSel] = useState<string | null>(null)
  const [verBase, setVerBase] = useState(true)
  const [cascada, setCascada] = useState(true)
  const drag = useRef<{ id: string; modo: 'mover' | 'ini' | 'fin'; x0: number; ini: number; fin: number; deps: Map<string, { ini: number; fin: number }> } | null>(null)

  const validas = fases.filter(f => !isNaN(toDay(f.fechaInicio)) && !isNaN(toDay(f.fechaFin)))
  const sinFechas = fases.filter(f => isNaN(toDay(f.fechaInicio)) || isNaN(toDay(f.fechaFin)))
  const hoy = hoyDia()
  const [d0, d1] = useMemo(() => {
    const todas = [...validas, ...(fantasma ?? []).filter(f => !isNaN(toDay(f.fechaFin)))]
    const ini = todas.length ? Math.min(...todas.map(f => toDay(f.fechaInicio)), hoy) : hoy - 7
    const fin = todas.length ? Math.max(...todas.map(f => toDay(f.fechaFin)), hoy + 30) : hoy + 60
    return [ini - 7, fin + 14]
  }, [validas, fantasma, hoy])
  const ancho = (d1 - d0 + 1) * px
  const x = (dia: number) => (dia - d0) * px
  const filas = fases
  const alto = CAB + filas.length * ALTO + 8

  const dependientes = (id: string): string[] => {
    let res: string[] = []
    for (;;) {
      const nuevas = fases.filter(f => f.dependeDe && (f.dependeDe === id || res.includes(f.dependeDe)) && !res.includes(f.id)).map(f => f.id)
      if (nuevas.length === 0) return res
      res = [...res, ...nuevas]
    }
  }

  const actualizar = (id: string, p: Partial<FaseGantt>) => onChange(fases.map(f => (f.id === id ? { ...f, ...p } : f)))

  const down = (e: React.PointerEvent, f: FaseGantt, modo: 'mover' | 'ini' | 'fin') => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const deps = new Map<string, { ini: number; fin: number }>()
    if (modo === 'mover' && cascada) dependientes(f.id).forEach(id => { const d = fases.find(x2 => x2.id === id); if (d) deps.set(id, { ini: toDay(d.fechaInicio), fin: toDay(d.fechaFin) }) })
    drag.current = { id: f.id, modo, x0: e.clientX, ini: toDay(f.fechaInicio), fin: toDay(f.fechaFin), deps }
    setSel(f.id)
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dd = Math.round((e.clientX - d.x0) / px)
    onChange(fases.map(f => {
      if (f.id === d.id) {
        if (d.modo === 'mover') return { ...f, fechaInicio: fromDay(d.ini + dd), fechaFin: fromDay(d.fin + dd) }
        if (d.modo === 'ini') return { ...f, fechaInicio: fromDay(Math.min(d.ini + dd, d.fin)) }
        return { ...f, fechaFin: fromDay(Math.max(d.fin + dd, d.ini)) }
      }
      const dep = d.deps.get(f.id)
      return dep ? { ...f, fechaInicio: fromDay(dep.ini + dd), fechaFin: fromDay(dep.fin + dd) } : f
    }))
  }
  const up = () => { drag.current = null }

  const agregar = (hito: boolean) => {
    const ultimo = validas.length ? Math.max(...validas.map(f => toDay(f.fechaFin))) : hoy
    const ini = hito ? ultimo : ultimo
    const nueva: FaseGantt = { id: nuevoId(), fase: hito ? 'Nuevo hito' : 'Nueva fase', fechaInicio: fromDay(ini), fechaFin: fromDay(hito ? ini : ini + 14), estado: 'PENDIENTE', hito }
    onChange([...fases, nueva])
    setSel(nueva.id)
  }
  const fijarBase = () => {
    if (!window.confirm('Fijar la línea base guarda las fechas actuales de todas las fases como las comprometidas. A partir de ahora se verá el desvío contra ellas. ¿Continuar?')) return
    onChange(fases.map(f => (isNaN(toDay(f.fechaInicio)) ? f : { ...f, base: { inicio: f.fechaInicio, fin: f.fechaFin } })))
  }
  const quitar = (id: string) => { onChange(fases.filter(f => f.id !== id).map(f => (f.dependeDe === id ? { ...f, dependeDe: undefined } : f))); setSel(null) }

  const seleccionada = fases.find(f => f.id === sel) ?? null
  const conBase = fases.some(f => f.base)
  const marcasMes: { dia: number; txt: string }[] = []
  for (let d = d0; d <= d1; d++) {
    const f = new Date(d * DIA)
    if (f.getUTCDate() === 1 || d === d0) marcasMes.push({ dia: d, txt: f.toLocaleDateString('es-CO', { month: 'short', year: 'numeric', timeZone: 'UTC' }) })
  }
  // El rótulo del primer tramo se omite si el mes siguiente empieza enseguida (se pisarían).
  if (marcasMes.length > 1 && (marcasMes[1].dia - marcasMes[0].dia) * px < 90) marcasMes.shift()
  const marcasSemana: number[] = []
  if (px >= 12) for (let d = d0; d <= d1; d++) if (new Date(d * DIA).getUTCDay() === 1) marcasSemana.push(d)
  const btn = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors disabled:opacity-40'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => agregar(false)} className={btn}><Plus size={12} /> Fase</button>
        <button type="button" onClick={() => agregar(true)} className={btn}><Diamond size={12} /> Hito</button>
        <span className="w-px h-5 bg-gray-700" />
        {ZOOMS.map(z => <button key={z.k} type="button" onClick={() => setZoom(z.k)} className={`${btn} ${zoom === z.k ? '!bg-cyan-900/50 !text-cyan-300' : ''}`}>{z.t}</button>)}
        <span className="w-px h-5 bg-gray-700" />
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none" title="Al mover una fase, también se mueven las que dependen de ella"><input type="checkbox" checked={cascada} onChange={e => setCascada(e.target.checked)} /> Mover dependientes</label>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none"><input type="checkbox" checked={verBase} onChange={e => setVerBase(e.target.checked)} /> Línea base</label>
        <button type="button" onClick={fijarBase} disabled={validas.length === 0} className={btn} title="Guarda las fechas actuales como las comprometidas"><Target size={12} /> {conBase ? 'Actualizar línea base' : 'Fijar línea base'}</button>
      </div>

      {fases.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">Sin fases todavía. Agrega la primera con «Fase» o genéralas desde el Plan de Trabajo.</p>
      ) : (
        <div className="flex rounded-xl border border-gray-700 overflow-hidden bg-[#0a0a1c]">
          <div className="flex-shrink-0 border-r border-gray-700 bg-gray-950/60" style={{ width: 190 }}>
            <div style={{ height: CAB }} className="px-3 flex items-end pb-1.5 text-[11px] text-gray-500">Fase</div>
            {filas.map(f => {
              const t = f.backlogItemId ? tareasPorId[f.backlogItemId] : undefined
              return (
                <button key={f.id} type="button" onClick={() => setSel(f.id)} style={{ height: ALTO }}
                  className={`w-full flex items-center gap-1.5 px-3 text-left text-xs border-t border-white/5 ${sel === f.id ? 'bg-orange-500/10 text-orange-200' : 'text-gray-300 hover:bg-white/[0.04]'}`}>
                  {f.hito ? <Diamond size={11} className="text-violet-400 flex-shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: COLOR[f.estado]?.avance ?? '#94a3b8' }} />}
                  <span className="truncate">{f.fase || 'Sin nombre'}</span>
                  {t && <span className={`ml-auto text-[10px] ${t.status === 'DONE' ? 'text-emerald-400' : t.status === 'FAILED' ? 'text-red-400' : 'text-gray-500'}`}>{t.status === 'DONE' ? '✓' : t.status === 'FAILED' ? '!' : '·'}</span>}
                </button>
              )
            })}
          </div>
          <div className="overflow-x-auto flex-1 min-w-0">
            <svg width={ancho} height={alto} onPointerMove={move} onPointerUp={up} style={{ display: 'block', touchAction: 'none' }} role="img">
              <title>Cronograma editable</title>
              <defs>
                <marker id="gantt-flecha" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker>
              </defs>
              {marcasMes.map(m => <g key={m.dia}><line x1={x(m.dia)} x2={x(m.dia)} y1={0} y2={alto} stroke="#334155" strokeWidth={0.5} /><text x={x(m.dia) + 4} y={16} fontSize={11} fill="#94a3b8">{m.txt}</text></g>)}
              {marcasSemana.map(d => <g key={d}><line x1={x(d)} x2={x(d)} y1={24} y2={alto} stroke="#1e293b" strokeWidth={0.5} /><text x={x(d) + 3} y={38} fontSize={11} fill="#64748b">{new Date(d * DIA).getUTCDate()}</text></g>)}
              <line x1={0} x2={ancho} y1={CAB - 2} y2={CAB - 2} stroke="#334155" strokeWidth={0.5} />
              {filas.map((f, i) => <line key={f.id} x1={0} x2={ancho} y1={CAB + (i + 1) * ALTO} y2={CAB + (i + 1) * ALTO} stroke="#1e293b" strokeWidth={0.5} />)}

              {/* dependencias */}
              {filas.map((f, i) => {
                const dep = f.dependeDe ? fases.findIndex(g => g.id === f.dependeDe) : -1
                if (dep < 0 || isNaN(toDay(f.fechaInicio)) || isNaN(toDay(fases[dep].fechaFin))) return null
                const x1 = x(toDay(fases[dep].fechaFin) + 1)
                const x2 = x(toDay(f.fechaInicio))
                const y1 = CAB + dep * ALTO + ALTO / 2
                const y2 = CAB + i * ALTO + ALTO / 2
                const choque = toDay(f.fechaInicio) <= toDay(fases[dep].fechaFin)
                const xm = Math.max(x1 + 8, Math.min(x2 - 8, x1 + 8))
                return <path key={'d' + f.id} d={`M${x1},${y1} L${xm},${y1} L${xm},${y2} L${x2 - 1},${y2}`} fill="none" stroke={choque ? '#f87171' : '#94a3b8'} strokeWidth={1} markerEnd="url(#gantt-flecha)" />
              })}

              {/* barras */}
              {filas.map((f, i) => {
                if (isNaN(toDay(f.fechaInicio)) || isNaN(toDay(f.fechaFin))) return null
                const y = CAB + i * ALTO + 6
                const x1 = x(toDay(f.fechaInicio))
                const x2 = x(toDay(f.fechaFin) + 1)
                const w = Math.max(x2 - x1, 6)
                const c = COLOR[f.estado] ?? COLOR.PENDIENTE
                const t = f.backlogItemId ? tareasPorId[f.backlogItemId] : undefined
                const avance = f.estado === 'COMPLETADA' || t?.status === 'DONE' ? 1 : t?.status === 'IN_PROGRESS' ? 0.5 : f.estado === 'EN_CURSO' ? 0.4 : 0
                const vencida = f.estado !== 'COMPLETADA' && toDay(f.fechaFin) < hoy
                const g = fantasma?.find(z => z.id === f.id)
                const cambia = g && (g.fechaInicio !== f.fechaInicio || g.fechaFin !== f.fechaFin)
                return (
                  <g key={f.id}>
                    {verBase && f.base && !f.hito && <rect x={x(toDay(f.base.inicio))} y={y + ALTO - 12} width={Math.max(x(toDay(f.base.fin) + 1) - x(toDay(f.base.inicio)), 3)} height={3} fill="#94a3b8" opacity={0.8}><title>{`Línea base: ${corto(f.base.inicio)} a ${corto(f.base.fin)}`}</title></rect>}
                    {cambia && !g!.hito && <rect x={x(toDay(g!.fechaInicio))} y={y} width={Math.max(x(toDay(g!.fechaFin) + 1) - x(toDay(g!.fechaInicio)), 6)} height={ALTO - 14} rx={4} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3"><title>{`Propuesta del motor: ${corto(g!.fechaInicio)} a ${corto(g!.fechaFin)}`}</title></rect>}
                    {f.hito ? (
                      <polygon points={`${x1},${y - 1} ${x1 + 10},${y + 9} ${x1},${y + 19} ${x1 - 10},${y + 9}`} fill="#7c3aed" stroke={sel === f.id ? '#fff' : '#a78bfa'} strokeWidth={sel === f.id ? 2 : 1} style={{ cursor: 'grab' }} onPointerDown={e => down(e, f, 'mover')}><title>{`${f.fase} · ${corto(f.fechaInicio)}`}</title></polygon>
                    ) : (
                      <>
                        <rect x={x1} y={y} width={w} height={ALTO - 14} rx={4} fill={c.fill} stroke={sel === f.id ? '#fff' : vencida ? '#f87171' : 'none'} strokeWidth={sel === f.id ? 2 : 1.5} style={{ cursor: 'grab' }} onPointerDown={e => down(e, f, 'mover')} />
                        {avance > 0 && <rect x={x1} y={y} width={w * avance} height={ALTO - 14} rx={4} fill={c.avance} opacity={0.55} pointerEvents="none" />}
                        {w > 70 && <text x={x1 + 6} y={y + (ALTO - 14) / 2 + 4} fontSize={11} fill="#fff" pointerEvents="none">{corto(f.fechaInicio)} – {corto(f.fechaFin)}</text>}
                        <rect x={x1 - 2} y={y} width={7} height={ALTO - 14} fill="transparent" style={{ cursor: 'ew-resize' }} onPointerDown={e => down(e, f, 'ini')} />
                        <rect x={x1 + w - 5} y={y} width={7} height={ALTO - 14} fill="transparent" style={{ cursor: 'ew-resize' }} onPointerDown={e => down(e, f, 'fin')} />
                      </>
                    )}
                  </g>
                )
              })}
              {hoy >= d0 && hoy <= d1 && <g><line x1={x(hoy) + px / 2} x2={x(hoy) + px / 2} y1={22} y2={alto} stroke="#ef4444" strokeWidth={1} /><text x={x(hoy) + px / 2 + 3} y={alto - 2} fontSize={11} fill="#ef4444">Hoy</text></g>}
            </svg>
          </div>
        </div>
      )}
      {sinFechas.length > 0 && <p className="text-[11px] text-amber-400">{sinFechas.length} fase(s) sin fechas completas no se dibujan: {sinFechas.map(f => f.fase || 'Sin nombre').join(', ')}. Selecciónalas en la lista para ponerles fechas.</p>}

      {seleccionada && (
        <div className="rounded-xl border border-gray-700 bg-gray-950/70 p-3">
          <div className="flex items-center gap-2 mb-2">
            {seleccionada.hito ? <Flag size={13} className="text-violet-400" /> : <span className="w-2 h-2 rounded-full" style={{ background: COLOR[seleccionada.estado]?.avance }} />}
            <p className="text-xs font-semibold text-gray-200">{seleccionada.hito ? 'Hito' : 'Fase'}</p>
            <button type="button" onClick={() => setSel(null)} aria-label="Cerrar" className="ml-auto text-gray-500 hover:text-gray-300"><X size={13} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <label className="col-span-2 text-[11px] text-gray-500">Nombre
              <input type="text" value={seleccionada.fase} onChange={e => actualizar(seleccionada.id, { fase: e.target.value })} className="mt-0.5 w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500" /></label>
            <label className="text-[11px] text-gray-500">{seleccionada.hito ? 'Fecha' : 'Inicio'}
              <input type="date" value={seleccionada.fechaInicio} onChange={e => actualizar(seleccionada.id, seleccionada.hito ? { fechaInicio: e.target.value, fechaFin: e.target.value } : { fechaInicio: e.target.value })} className="mt-0.5 w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500" /></label>
            {!seleccionada.hito && <label className="text-[11px] text-gray-500">Fin
              <input type="date" value={seleccionada.fechaFin} onChange={e => actualizar(seleccionada.id, { fechaFin: e.target.value })} className="mt-0.5 w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500" /></label>}
            <label className="text-[11px] text-gray-500">Estado
              <select value={seleccionada.estado} onChange={e => actualizar(seleccionada.id, { estado: e.target.value })} className="mt-0.5 w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 cursor-pointer">
                {['PENDIENTE', 'EN_CURSO', 'COMPLETADA'].map(e => <option key={e} value={e}>{e}</option>)}</select></label>
            <label className="col-span-2 text-[11px] text-gray-500">Depende de
              <select value={seleccionada.dependeDe ?? ''} onChange={e => actualizar(seleccionada.id, { dependeDe: e.target.value || undefined })} className="mt-0.5 w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 cursor-pointer">
                <option value="">— ninguna —</option>
                {fases.filter(f => f.id !== seleccionada.id && !dependientes(seleccionada.id).includes(f.id)).map(f => <option key={f.id} value={f.id}>{f.fase || 'Sin nombre'}</option>)}</select></label>
            <div className="col-span-2 flex items-end gap-2">
              <button type="button" onClick={() => quitar(seleccionada.id)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 text-xs font-medium"><Trash2 size={12} /> Eliminar</button>
            </div>
          </div>
          {(() => {
            const t = seleccionada.backlogItemId ? tareasPorId[seleccionada.backlogItemId] : undefined
            const dep = seleccionada.dependeDe ? fases.find(f => f.id === seleccionada.dependeDe) : undefined
            const choque = dep && toDay(seleccionada.fechaInicio) <= toDay(dep.fechaFin)
            return (
              <div className="mt-2 space-y-1 text-[11px]">
                {t && <p className="text-gray-400">Tarea en el backlog: {t.taskCode ? `${t.taskCode} — ` : ''}{t.title} · <span className={t.status === 'DONE' ? 'text-emerald-400' : t.status === 'FAILED' ? 'text-red-400' : 'text-gray-300'}>{t.status}</span></p>}
                {choque && <p className="text-amber-300">Empieza antes de que termine «{dep!.fase}».</p>}
                {seleccionada.base && <p className="text-gray-500">Línea base: {corto(seleccionada.base.inicio)} a {corto(seleccionada.base.fin)}{seleccionada.base.fin !== seleccionada.fechaFin ? ` · desvío de fin: ${toDay(seleccionada.fechaFin) - toDay(seleccionada.base.fin)} día(s)` : ''}</p>}
              </div>
            )
          })()}
        </div>
      )}
      <p className="text-[11px] text-gray-500">Arrastra una barra para moverla y sus bordes para cambiar el inicio o el fin. Las flechas son dependencias (rojas si la fase empieza antes de que termine la anterior). Las barras punteadas ámbar son lo que propone el motor.</p>
    </div>
  )
}
