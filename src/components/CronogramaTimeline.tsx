'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarRange, X, Trash2, ListPlus, CheckCircle2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import SesionPopup from '@/components/SesionPopup'
import { parseSesionesFromMarkdown, sesionNumeroFromFase, type SesionCard } from '@/lib/sesionParser'

export interface FaseCronograma {
  id: string
  fase: string
  fechaInicio: string
  fechaFin: string
  estado: string
  backlogItemId?: string
  resultado?: string
  fechaEjecucion?: string
  horaEjecucion?: string
  horaFin?: string
}

const ESTADO_A_BACKLOG: Record<string, string> = {
  PENDIENTE: 'BACKLOG',
  EN_CURSO: 'IN_PROGRESS',
  COMPLETADA: 'DONE',
}

const ESTADOS_FASE = ['PENDIENTE', 'EN_CURSO', 'COMPLETADA']

const ESTADO_COLOR: Record<string, { bg: string; text: string }> = {
  PENDIENTE: { bg: '#475569', text: '#94a3b8' },
  EN_CURSO: { bg: '#06B6D4', text: '#22d3ee' },
  COMPLETADA: { bg: '#10B981', text: '#34d399' },
}

const DAY_MS = 86400000
const DAY_COL_MIN = 56
const HOUR_COL_PX = 72

function fmt(d: string) {
  if (!d) return ''
  const date = new Date(d + 'T00:00:00')
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

function fmtLarga(d: string) {
  if (!d) return '—'
  const date = new Date(d + 'T00:00:00')
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function parseHour(t: string): number { return parseInt(t.split(':')[0]) }
function parseMinFrac(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h * 60 + m) / 60 // fractional hours from midnight
}

interface CronogramaTimelineProps {
  fases: FaseCronograma[]
  onUpdate?: (id: string, patch: Partial<FaseCronograma>) => void
  onRemove?: (id: string) => void
  solucionId?: string
  planMarkdown?: string
}

export default function CronogramaTimeline({ fases, onUpdate, onRemove, solucionId, planMarkdown }: CronogramaTimelineProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [cargandoBacklog, setCargandoBacklog] = useState(false)
  const [backlogError, setBacklogError] = useState('')
  const dayGridContainerRef = useRef<HTMLDivElement>(null)
  const [dayGridContainerWidth, setDayGridContainerWidth] = useState(0)
  // Ventana visible de la linea de tiempo: padding fijo antes de la primera
  // fase y despues de la ultima, mas un desplazamiento (pan) que el usuario
  // controla con las flechas sobre el header para navegar dias atras/adelante.
  const diasAtras = 3
  const diasAdelante = 14
  const [panDias, setPanDias] = useState(0)

  // Mide el ancho disponible del contenedor de la grilla por dias para poder
  // agregar columnas de dias vacios al final y que la linea de tiempo llene
  // todo el ancho, en vez de dejar un hueco despues del ultimo dia con datos.
  useEffect(() => {
    const el = dayGridContainerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width
      if (width) setDayGridContainerWidth(width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const sesiones = useMemo<SesionCard[]>(
    () => (planMarkdown ? parseSesionesFromMarkdown(planMarkdown) : []),
    [planMarkdown]
  )

  const completas = fases.filter(f => f.fechaInicio && f.fechaFin)
  const incompletas = fases.length - completas.length
  const selected = fases.find(f => f.id === selectedId) || null

  const matchedSesion = useMemo<SesionCard | null>(() => {
    if (!selected || sesiones.length === 0) return null
    const num = sesionNumeroFromFase(selected.fase)
    if (!num) return null
    return sesiones.find(s => s.numero === num) ?? null
  }, [selected, sesiones])

  // ── Hour-based cascade grid ──────────────────────────────────────────────
  const hasHourData = completas.some(f => f.horaEjecucion)

  const hourGrid = useMemo(() => {
    if (!hasHourData) return null

    type HourSlot = { type: 'hour'; dayStr: string; hour: number }
    type GapSlot  = { type: 'gap';  dayStr: string; fromH: number; toH: number }
    type Slot = HourSlot | GapSlot

    const withHours = completas.filter(f => f.horaEjecucion)
    const uniqueDays = [...new Set(completas.map(f => f.fechaInicio))].sort()

    // Compute end times first so we know which hours are active
    const phasesByDay = new Map<string, FaseCronograma[]>()
    withHours.forEach(f => {
      const arr = phasesByDay.get(f.fechaInicio) ?? []
      arr.push(f)
      phasesByDay.set(f.fechaInicio, arr)
    })
    phasesByDay.forEach(arr => arr.sort((a, b) => a.horaEjecucion!.localeCompare(b.horaEjecucion!)))

    const endTimeMap = new Map<string, string>()
    phasesByDay.forEach(arr => {
      arr.forEach((f, j) => {
        if (f.horaFin) {
          endTimeMap.set(f.id, f.horaFin)
        } else if (j + 1 < arr.length) {
          endTimeMap.set(f.id, arr[j + 1].horaEjecucion!)
        } else {
          const [h, m] = f.horaEjecucion!.split(':').map(Number)
          endTimeMap.set(f.id, `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
        }
      })
    })

    // Which hours are actually touched by sessions with horaEjecucion (per day)
    const activePerDay = new Map<string, Set<number>>()
    withHours.forEach(f => {
      const startH = parseHour(f.horaEjecucion!)
      const endT = endTimeMap.get(f.id) ?? `${Math.min(23, startH + 1)}:00`
      const [endH, endM] = endT.split(':').map(Number)
      // If end is exactly on the hour boundary (endM===0), that hour column is empty — exclude it
      const lastH = endM > 0 ? endH : endH - 1
      const set = activePerDay.get(f.fechaInicio) ?? new Set<number>()
      for (let h = startH; h <= lastH; h++) set.add(h)
      activePerDay.set(f.fechaInicio, set)
    })

    // Build slots with gap markers between non-contiguous runs
    const slots: Slot[] = []
    const dayGroups: { dayStr: string; label: string; startSlot: number; count: number }[] = []

    for (const dayStr of uniqueDays) {
      const dayStart = slots.length
      const activeHours = [...(activePerDay.get(dayStr) ?? new Set<number>())].sort((a, b) => a - b)

      if (activeHours.length === 0) continue

      // Split into contiguous runs
      const runs: number[][] = []
      let run = [activeHours[0]]
      for (let i = 1; i < activeHours.length; i++) {
        if (activeHours[i] === activeHours[i - 1] + 1) {
          run.push(activeHours[i])
        } else {
          runs.push(run); run = [activeHours[i]]
        }
      }
      runs.push(run)

      for (let g = 0; g < runs.length; g++) {
        if (g > 0) {
          const prev = runs[g - 1]
          slots.push({ type: 'gap', dayStr, fromH: prev[prev.length - 1] + 1, toH: runs[g][0] - 1 })
        }
        for (const h of runs[g]) {
          slots.push({ type: 'hour', dayStr, hour: h })
        }
      }

      dayGroups.push({ dayStr, label: fmt(dayStr), startSlot: dayStart, count: slots.length - dayStart })
    }

    return { slots, dayGroups, endTimeMap }
  }, [hasHourData, completas])

  // ── Day-based grid (fallback) ─────────────────────────────────────────────
  const dayGrid = useMemo(() => {
    if (hasHourData || completas.length === 0) return null
    const starts = completas.map(f => new Date(f.fechaInicio + 'T00:00:00').getTime())
    const ends = completas.map(f => new Date(f.fechaFin + 'T00:00:00').getTime())
    const min = Math.min(...starts) - diasAtras * DAY_MS + panDias * DAY_MS
    const max = Math.max(...ends) + diasAdelante * DAY_MS + panDias * DAY_MS
    const numDays = Math.round((max - min) / DAY_MS) + 1
    const days = Array.from({ length: numDays }, (_, i) => new Date(min + i * DAY_MS))
    return { min, max, numDays, days }
  }, [hasHourData, completas, panDias])

  // ── Backlog / helpers ─────────────────────────────────────────────────────
  async function cargarEnBacklog(f: FaseCronograma) {
    if (!onUpdate || !solucionId) return
    setCargandoBacklog(true)
    setBacklogError('')
    try {
      const res = await fetch('/api/backlog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: f.fase || 'Sin nombre',
          solucionId,
          type: 'TASK',
          priority: 'MEDIUM',
          status: ESTADO_A_BACKLOG[f.estado] || 'BACKLOG',
        }),
      })
      if (!res.ok) throw new Error()
      const created = await res.json()
      onUpdate(f.id, { backlogItemId: created.id })
    } catch {
      setBacklogError('No se pudo cargar al backlog.')
    } finally {
      setCargandoBacklog(false)
    }
  }

  function closePopup() {
    setSelectedId(null)
    setBacklogError('')
  }

  if (fases.length === 0) {
    return (
      <div className="text-center py-10">
        <CalendarRange size={28} className="text-gray-700 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">Sin fases todavía.</p>
      </div>
    )
  }

  if (completas.length === 0) {
    return (
      <div className="text-center py-10">
        <CalendarRange size={28} className="text-gray-700 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">Ninguna fase tiene fecha de inicio y fin todavía.</p>
        <p className="text-gray-600 text-xs mt-1">Completá las fechas en la vista Lista para ver la línea de tiempo.</p>
      </div>
    )
  }

  // ── Popup tab content ─────────────────────────────────────────────────────
  const resultadoContent = selected ? (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Fecha y hora de ejecución real</label>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="date"
            value={selected.fechaEjecucion ?? ''}
            onChange={e => onUpdate?.(selected.id, { fechaEjecucion: e.target.value })}
            disabled={!onUpdate}
            title="Fecha de ejecución"
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60"
          />
          <input
            type="time"
            value={selected.horaEjecucion ?? ''}
            onChange={e => onUpdate?.(selected.id, { horaEjecucion: e.target.value })}
            disabled={!onUpdate}
            title="Hora de inicio"
            placeholder="Inicio"
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60"
          />
          <input
            type="time"
            value={selected.horaFin ?? ''}
            onChange={e => onUpdate?.(selected.id, { horaFin: e.target.value })}
            disabled={!onUpdate}
            title="Hora de fin"
            placeholder="Fin"
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60"
          />
        </div>
        <div className="flex gap-2 mt-1">
          <span className="text-[9px] text-gray-600 flex-1 text-center">Fecha</span>
          <span className="text-[9px] text-gray-600 flex-1 text-center">Inicio</span>
          <span className="text-[9px] text-gray-600 flex-1 text-center">Fin</span>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Resumen de la sesión
          <span className="ml-2 text-gray-600 font-normal normal-case">visible para el equipo y el agente siguiente</span>
        </label>
        <textarea
          value={selected.resultado ?? ''}
          onChange={e => onUpdate?.(selected.id, { resultado: e.target.value })}
          disabled={!onUpdate}
          rows={12}
          placeholder={`## Qué se hizo\n- \n\n## Decisiones tomadas\n- \n\n## Links\n- \n\n## Pendiente para la próxima sesión\n- `}
          className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-xs font-mono leading-relaxed focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60 resize-none placeholder:text-gray-700"
        />
      </div>
      {selected.resultado?.trim() && (
        <p className="text-[10px] text-gray-600">
          Guardado automáticamente al escribir. El agente que inicie la próxima sesión verá este contenido en el plan.
        </p>
      )}
    </div>
  ) : null

  const gestionContent = selected ? (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Estado</label>
        <select
          value={selected.estado}
          onChange={e => onUpdate?.(selected.id, { estado: e.target.value })}
          disabled={!onUpdate}
          className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60 appearance-none cursor-pointer"
        >
          {ESTADOS_FASE.map(es => <option key={es} value={es}>{es}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Inicio</label>
          <input
            type="date"
            value={selected.fechaInicio}
            onChange={e => onUpdate?.(selected.id, { fechaInicio: e.target.value })}
            disabled={!onUpdate}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Fin</label>
          <input
            type="date"
            value={selected.fechaFin}
            onChange={e => onUpdate?.(selected.id, { fechaFin: e.target.value })}
            disabled={!onUpdate}
            className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60"
          />
        </div>
      </div>

      <p className="text-gray-500 text-xs">
        {fmtLarga(selected.fechaInicio)} → {fmtLarga(selected.fechaFin)}
      </p>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Backlog</label>
        {selected.backlogItemId ? (
          <div className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2">
            <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
            <p className="text-emerald-400 text-xs">Ya está cargada en el Backlog.</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => cargarEnBacklog(selected)}
            disabled={cargandoBacklog || !onUpdate || !solucionId}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {cargandoBacklog ? <Loader2 size={14} className="animate-spin" /> : <ListPlus size={14} />}
            {cargandoBacklog ? 'Cargando…' : 'Cargar al backlog'}
          </button>
        )}
        {backlogError && <p className="text-red-400 text-xs mt-1.5">{backlogError}</p>}
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={() => { onRemove(selected.id); closePopup() }}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
        >
          <Trash2 size={14} /> Eliminar fase
        </button>
      )}
    </div>
  ) : null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {incompletas > 0 && (
        <p className="text-gray-600 text-xs">
          {incompletas} fase{incompletas > 1 ? 's' : ''} sin fecha completa no se muestra{incompletas > 1 ? 'n' : ''} acá — completalas en la vista Lista.
        </p>
      )}

      <div className="relative">
        {!hasHourData && dayGrid && (
          <>
            {/* Ancladas solo a la altura de la fila de fecha (segunda fila del
                header), no a la fila de mes de arriba. */}
            <button
              type="button"
              onClick={() => setPanDias(d => d - 7)}
              style={{ top: 28, height: 44 }}
              className="absolute left-1 z-30 flex items-center justify-center w-5 rounded-md bg-gray-950/60 hover:bg-cyan-900/50 text-gray-400 hover:text-cyan-300 transition-colors"
              title="Ver días anteriores"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={() => setPanDias(d => d + 7)}
              style={{ top: 28, height: 44 }}
              className="absolute right-1 z-30 flex items-center justify-center w-5 rounded-md bg-gray-950/60 hover:bg-cyan-900/50 text-gray-400 hover:text-cyan-300 transition-colors"
              title="Ver días siguientes"
            >
              <ChevronRight size={14} />
            </button>
          </>
        )}

        <div
          ref={dayGridContainerRef}
          className={`border border-cyan-800/40 rounded-xl overflow-x-auto ${!hasHourData && dayGrid ? 'mx-7' : ''}`}
        >
        <div className="min-w-max">

          {/* ── HOUR-BASED GRID ── */}
          {hasHourData && hourGrid && (() => {
            const { slots, dayGroups, endTimeMap } = hourGrid
            const GAP_W = 36
            const gridCols = {
              gridTemplateColumns: slots.map(s => s.type === 'gap' ? `${GAP_W}px` : `${HOUR_COL_PX}px`).join(' ')
            }

            return (
              <>
                {/* Header row 1: days */}
                <div className="flex border-b border-cyan-800/50 bg-cyan-950/40">
                  <div className="w-44 flex-shrink-0 border-r border-cyan-800/40 px-3 py-2 text-[11px] text-cyan-200 font-semibold">
                    Fase
                  </div>
                  <div className="grid" style={gridCols}>
                    {dayGroups.map(dg => (
                      <div
                        key={dg.dayStr}
                        className="text-center text-[10px] text-cyan-200 font-semibold py-1 border-r border-cyan-800/40 last:border-r-0"
                        style={{ gridColumn: `span ${dg.count}` }}
                      >
                        {dg.label}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Header row 2: hours / gap labels */}
                <div className="flex border-b border-cyan-800/40 bg-cyan-950/20">
                  <div className="w-44 flex-shrink-0 border-r border-cyan-800/30" />
                  <div className="grid" style={gridCols}>
                    {slots.map((slot, i) =>
                      slot.type === 'gap' ? (
                        <div key={i} className="flex items-center justify-center py-1 border-r border-cyan-800/20 last:border-r-0">
                          <span className="text-[8px] text-gray-600 tracking-widest">···</span>
                        </div>
                      ) : (
                        <div key={i} className="text-center text-[9px] text-cyan-400/60 font-mono py-1 border-r border-cyan-800/20 last:border-r-0">
                          {String(slot.hour).padStart(2, '0')}h
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-cyan-800/25">
                  {completas.map((f, idx) => {
                    const color = ESTADO_COLOR[f.estado] || ESTADO_COLOR.PENDIENTE

                    // Compute bar span in slots
                    let startSlotIdx = -1
                    let endSlotIdx = -1
                    let startMinFrac = 0
                    let endMinFrac = 1

                    if (f.horaEjecucion) {
                      const startFracH = parseMinFrac(f.horaEjecucion)
                      const startH = Math.floor(startFracH)
                      startMinFrac = startFracH - startH
                      startSlotIdx = slots.findIndex(s => s.type === 'hour' && s.dayStr === f.fechaInicio && s.hour === startH)

                      const endTime = endTimeMap.get(f.id)
                      if (endTime) {
                        const endFracH = parseMinFrac(endTime)
                        const endH = Math.floor(endFracH)
                        endMinFrac = endFracH - endH
                        if (endMinFrac === 0) {
                          endSlotIdx = slots.findIndex(s => s.type === 'hour' && s.dayStr === f.fechaFin && s.hour === endH - 1)
                          endMinFrac = 1
                        } else {
                          endSlotIdx = slots.findIndex(s => s.type === 'hour' && s.dayStr === f.fechaFin && s.hour === endH)
                        }
                      } else {
                        endSlotIdx = startSlotIdx
                        endMinFrac = Math.min(1, startMinFrac + 0.5)
                      }
                    }

                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => { setSelectedId(f.id); setBacklogError('') }}
                        className={`flex items-stretch w-full text-left transition-colors hover:bg-gray-800/50 cursor-pointer ${idx % 2 === 0 ? 'bg-gray-900/30' : 'bg-transparent'}`}
                      >
                        {/* Left label */}
                        <div className="w-44 flex-shrink-0 border-r border-cyan-800/30 px-3 py-3 min-w-0">
                          <p className="text-sm text-gray-200 truncate" title={f.fase}>{f.fase || 'Sin nombre'}</p>
                        </div>

                        {/* Hour cells */}
                        <div className="grid" style={gridCols}>
                          {slots.map((slot, i) => {
                            // Gap slot: narrow separator, no bar content
                            if (slot.type === 'gap') {
                              return (
                                <div key={i} className="relative h-12 flex items-center justify-center border-r border-dashed border-cyan-800/30 last:border-r-0">
                                  <span className="text-[8px] text-gray-700 tracking-widest select-none">···</span>
                                </div>
                              )
                            }

                            const inBar = startSlotIdx >= 0 && i >= startSlotIdx && i <= endSlotIdx
                            const isFirst = i === startSlotIdx
                            const isLast = i === endSlotIdx
                            const isSingle = startSlotIdx === endSlotIdx

                            // Phases without horaEjecucion: span all hour slots of their day range
                            const inDayRange = !f.horaEjecucion && slot.dayStr >= f.fechaInicio && slot.dayStr <= f.fechaFin

                            const showBar = inBar || inDayRange

                            let leftStyle = '2px'
                            let rightStyle = '2px'

                            if (inBar) {
                              if (isSingle) {
                                leftStyle = `${startMinFrac * 100}%`
                                rightStyle = `${(1 - endMinFrac) * 100}%`
                              } else if (isFirst) {
                                leftStyle = `${startMinFrac * 100}%`
                                rightStyle = '0px'
                              } else if (isLast) {
                                leftStyle = '0px'
                                rightStyle = `${(1 - endMinFrac) * 100}%`
                              } else {
                                leftStyle = '0px'
                                rightStyle = '0px'
                              }
                            }

                            return (
                              <div
                                key={i}
                                className="relative h-12 flex items-center"
                              >
                                {/* Borde de hora como div z-0 — el pill (z-10) queda encima */}
                                {i < slots.length - 1 && <div className="absolute right-0 inset-y-0 w-px bg-cyan-800/20 z-0 pointer-events-none" />}
                                {showBar && (
                                  <div
                                    className={`absolute inset-y-2.5 z-10 flex items-center overflow-hidden hover:brightness-125 transition-[filter] ${isSingle || inDayRange ? 'rounded-md' : isFirst ? 'rounded-l-md' : isLast ? 'rounded-r-md' : 'rounded-none'}`}
                                    style={{
                                      left: leftStyle,
                                      right: rightStyle,
                                      background: color.bg,
                                      boxShadow: `0 0 8px ${color.bg}60`,
                                    }}
                                  >
                                    {isFirst && f.horaEjecucion && (
                                      <span className="text-[9px] text-white/90 font-mono px-1.5 whitespace-nowrap flex-shrink-0">
                                        {f.horaEjecucion}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            )
          })()}

          {/* ── DAY-BASED GRID (fallback) — estilo "Project Timeline" pedido:
              header con meses agrupados + dia/fecha, columna de "hoy"
              resaltada con linea punteada, y filas con pills redondeadas
              posicionadas por rango de fecha (sin la columna fija de
              "Fase" — el nombre va DENTRO del pill, igual que la referencia).
              El color sigue codificando el estado real (gris/cian/verde) en
              vez de colores arbitrarios por tarea — es informacion real, no
              solo decorativa, asi que se preservo esa semantica. ── */}
          {!hasHourData && dayGrid && (() => {
            const { min } = dayGrid
            const COL_W = 64
            // Completa dias vacios al final (y si hace falta al inicio) para que
            // la grilla llene todo el ancho disponible del contenedor, en vez de
            // dejar un hueco despues del ultimo dia con datos.
            const minDaysToFill = dayGridContainerWidth ? Math.ceil(dayGridContainerWidth / COL_W) : 0
            const days = dayGrid.days.length >= minDaysToFill
              ? dayGrid.days
              : Array.from({ length: minDaysToFill }, (_, i) => new Date(min + i * DAY_MS))
            const numDays = days.length
            const totalW = numDays * COL_W
            const todayStr = new Date().toISOString().slice(0, 10)
            const todayIdx = days.findIndex(d => d.toISOString().slice(0, 10) === todayStr)

            // Agrupa columnas consecutivas por mes para la fila superior del header.
            const monthGroups: { label: string; count: number }[] = []
            days.forEach(d => {
              const label = d.toLocaleDateString('es-CO', { month: 'short' }).toUpperCase().replace('.', '')
              const last = monthGroups[monthGroups.length - 1]
              if (last && last.label === label) last.count++
              else monthGroups.push({ label, count: 1 })
            })

            return (
              <div style={{ width: totalW }} className="relative">
                {/* Header fila 1: meses agrupados */}
                <div className="flex border-b border-cyan-800/30">
                  {monthGroups.map((g, i) => (
                    <div key={i} style={{ width: g.count * COL_W }}
                      className="px-2 py-1.5 text-[10px] font-bold text-cyan-300 tracking-wide border-r border-cyan-800/20 last:border-r-0">
                      {g.label}
                    </div>
                  ))}
                </div>
                {/* Header fila 2: dia de semana + fecha. El dia de "hoy" es un chip
                    solido (no un sombreado de fondo, eso queda solo en las filas) */}
                <div className="flex border-b border-cyan-800/40 bg-cyan-950/20">
                  {days.map((d, i) => {
                    const isToday = i === todayIdx
                    return (
                      <div key={i} style={{ width: COL_W }} className="flex items-center justify-center py-1.5 border-r border-cyan-800/10 last:border-r-0">
                        <div className={`flex flex-col items-center justify-center rounded-lg px-4 py-1 ${isToday ? 'bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]' : ''}`}>
                          <span className={`text-[9px] font-medium capitalize ${isToday ? 'text-white/90' : 'text-gray-500'}`}>
                            {d.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '')}
                          </span>
                          <span className={`mt-0.5 text-[11px] font-bold leading-none ${isToday ? 'text-white' : 'text-gray-300'}`}>
                            {d.getDate()}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Cuerpo (filas): banda de fondo + linea punteada solo aqui para la
                    columna de "hoy" — el header ya se distingue con su propio chip
                    solido arriba y no lleva ninguno de los dos. */}
                <div className="relative">
                  {todayIdx >= 0 && (
                    <>
                      <div className="absolute inset-y-0 bg-orange-500/10 pointer-events-none"
                        style={{ left: todayIdx * COL_W, width: COL_W }} />
                      <div className="absolute inset-y-0 border-l-2 border-dashed border-orange-500/70 z-20 pointer-events-none"
                        style={{ left: todayIdx * COL_W + COL_W / 2 }} />
                    </>
                  )}
                  <div className="divide-y divide-cyan-800/15 relative">
                    {completas.map((f, idx) => {
                    const s = new Date(f.fechaInicio + 'T00:00:00').getTime()
                    const e = new Date(f.fechaFin + 'T00:00:00').getTime()
                    const startIdx = Math.round((s - min) / DAY_MS)
                    const spanDays = Math.round((e - s) / DAY_MS) + 1
                    const color = ESTADO_COLOR[f.estado] || ESTADO_COLOR.PENDIENTE

                    const execIdx = f.fechaEjecucion
                      ? Math.round((new Date(f.fechaEjecucion + 'T00:00:00').getTime() - min) / DAY_MS)
                      : null
                    const execLabel = f.fechaEjecucion
                      ? `Ejecutado: ${fmt(f.fechaEjecucion)}${f.horaEjecucion ? ' ' + f.horaEjecucion : ''}`
                      : null
                    const execPct = execIdx !== null ? ((execIdx + 0.5) / numDays) * 100 : null

                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => { setSelectedId(f.id); setBacklogError('') }}
                        className={`relative flex items-center w-full h-14 text-left transition-colors hover:bg-gray-800/40 cursor-pointer ${idx % 2 === 0 ? 'bg-gray-900/20' : 'bg-transparent'}`}
                      >
                        <div
                          className="absolute top-1/2 -translate-y-1/2 h-8 rounded-full flex items-center gap-1.5 px-3 hover:brightness-125 transition-[filter] overflow-hidden"
                          style={{ left: startIdx * COL_W + 4, width: Math.max(spanDays * COL_W - 8, 8), background: color.bg, boxShadow: `0 2px 10px ${color.bg}50` }}
                        >
                          <span className="text-[11px] font-semibold text-white truncate">{f.fase || 'Sin nombre'}</span>
                          {/* "Avatar" real: no hay asignado por fase en el modelo — se muestra
                              un badge circular con el estado en vez de inventar una foto de
                              persona que no existe. */}
                          <span className="ml-auto flex-shrink-0 w-4 h-4 rounded-full bg-white/25 flex items-center justify-center">
                            {f.estado === 'COMPLETADA' ? <CheckCircle2 size={10} className="text-white" /> : null}
                          </span>
                        </div>

                        {execPct !== null && (
                          <div
                            className="absolute top-1 bottom-1 w-0.5 -translate-x-1/2 rounded-full z-10"
                            style={{ left: `${execPct}%`, background: '#ffffff', boxShadow: '0 0 4px #fff8' }}
                            title={execLabel ?? undefined}
                          >
                            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white shadow" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                  </div>
                </div>
              </div>
            )
          })()}

        </div>
        </div>
      </div>

      {/* Popup */}
      {selected && typeof document !== 'undefined' && (
        matchedSesion ? (
          <SesionPopup
            sesion={matchedSesion}
            onClose={closePopup}
            defaultTab="objetivo"
            extraTabs={[
              { key: 'resultado', label: 'Resultado', content: resultadoContent },
              { key: 'gestion',   label: 'Gestión',   content: gestionContent  },
            ]}
          />
        ) : createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) closePopup() }}
          >
            <div className="relative w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                <h3 className="text-white font-semibold text-sm truncate pr-2">{selected.fase || 'Sin nombre'}</h3>
                <button
                  onClick={closePopup}
                  className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Estado</label>
                  <select
                    value={selected.estado}
                    onChange={e => onUpdate?.(selected.id, { estado: e.target.value })}
                    disabled={!onUpdate}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60 appearance-none cursor-pointer"
                  >
                    {ESTADOS_FASE.map(es => <option key={es} value={es}>{es}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Inicio</label>
                    <input
                      type="date"
                      value={selected.fechaInicio}
                      onChange={e => onUpdate?.(selected.id, { fechaInicio: e.target.value })}
                      disabled={!onUpdate}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Fin</label>
                    <input
                      type="date"
                      value={selected.fechaFin}
                      onChange={e => onUpdate?.(selected.id, { fechaFin: e.target.value })}
                      disabled={!onUpdate}
                      className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors disabled:opacity-60"
                    />
                  </div>
                </div>

                <p className="text-gray-500 text-xs">
                  {fmtLarga(selected.fechaInicio)} → {fmtLarga(selected.fechaFin)}
                </p>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Backlog</label>
                  {selected.backlogItemId ? (
                    <div className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-800/40 rounded-lg px-3 py-2">
                      <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                      <p className="text-emerald-400 text-xs">Ya está cargada en el Backlog.</p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => cargarEnBacklog(selected)}
                      disabled={cargandoBacklog || !onUpdate || !solucionId}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {cargandoBacklog ? <Loader2 size={14} className="animate-spin" /> : <ListPlus size={14} />}
                      {cargandoBacklog ? 'Cargando…' : 'Cargar al backlog'}
                    </button>
                  )}
                  {backlogError && <p className="text-red-400 text-xs mt-1.5">{backlogError}</p>}
                </div>

                {onRemove && (
                  <button
                    type="button"
                    onClick={() => { onRemove(selected.id); closePopup() }}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                  >
                    <Trash2 size={14} /> Eliminar fase
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      )}
    </div>
  )
}
