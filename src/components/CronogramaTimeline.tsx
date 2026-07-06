'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarRange, X, Trash2, ListPlus, CheckCircle2, Loader2 } from 'lucide-react'
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

    const withHours = completas.filter(f => f.horaEjecucion)
    const hours = withHours.map(f => parseHour(f.horaEjecucion!))
    const minH = Math.max(0, Math.min(...hours))
    const maxH = Math.min(23, Math.max(...hours) + 1)

    const uniqueDays = [...new Set(completas.map(f => f.fechaInicio))].sort()

    const slots: { dayStr: string; hour: number }[] = []
    for (const dayStr of uniqueDays) {
      for (let h = minH; h <= maxH; h++) {
        slots.push({ dayStr, hour: h })
      }
    }

    // Day groups for the 2-row header
    const hoursPerDay = maxH - minH + 1
    const dayGroups = uniqueDays.map((dayStr, di) => ({
      dayStr,
      label: fmt(dayStr),
      startSlot: di * hoursPerDay,
      count: hoursPerDay,
    }))

    // For each phase with horaEjecucion, compute end time:
    // end = next phase's horaEjecucion on same day, or +1h if last
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
          // horaFin explícita tiene prioridad
          endTimeMap.set(f.id, f.horaFin)
        } else if (j + 1 < arr.length) {
          endTimeMap.set(f.id, arr[j + 1].horaEjecucion!)
        } else {
          const [h, m] = f.horaEjecucion!.split(':').map(Number)
          const endH = Math.min(23, h + 1)
          endTimeMap.set(f.id, `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
        }
      })
    })

    return { slots, dayGroups, minH, maxH, hoursPerDay, endTimeMap }
  }, [hasHourData, completas])

  // ── Day-based grid (fallback) ─────────────────────────────────────────────
  const dayGrid = useMemo(() => {
    if (hasHourData || completas.length === 0) return null
    const starts = completas.map(f => new Date(f.fechaInicio + 'T00:00:00').getTime())
    const ends = completas.map(f => new Date(f.fechaFin + 'T00:00:00').getTime())
    const min = Math.min(...starts)
    const max = Math.max(...ends)
    const numDays = Math.round((max - min) / DAY_MS) + 1
    const days = Array.from({ length: numDays }, (_, i) => new Date(min + i * DAY_MS))
    return { min, max, numDays, days }
  }, [hasHourData, completas])

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

      <div className="border border-cyan-800/40 rounded-xl overflow-x-auto">
        <div className="min-w-max">

          {/* ── HOUR-BASED GRID ── */}
          {hasHourData && hourGrid && (() => {
            const { slots, dayGroups, hoursPerDay, endTimeMap } = hourGrid
            const gridCols = { gridTemplateColumns: `repeat(${slots.length}, ${HOUR_COL_PX}px)` }

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

                {/* Header row 2: hours */}
                <div className="flex border-b border-cyan-800/40 bg-cyan-950/20">
                  <div className="w-44 flex-shrink-0 border-r border-cyan-800/30" />
                  <div className="grid" style={gridCols}>
                    {slots.map((slot, i) => (
                      <div
                        key={i}
                        className="text-center text-[9px] text-cyan-400/60 font-mono py-1 border-r border-cyan-800/20 last:border-r-0"
                      >
                        {String(slot.hour).padStart(2, '0')}h
                      </div>
                    ))}
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
                      startSlotIdx = slots.findIndex(s => s.dayStr === f.fechaInicio && s.hour === startH)

                      const endTime = endTimeMap.get(f.id)
                      if (endTime) {
                        const endFracH = parseMinFrac(endTime)
                        const endH = Math.floor(endFracH)
                        endMinFrac = endFracH - endH
                        // If endFracH is a whole hour (e.g. 01:00 → frac=0), bar ends at previous slot
                        if (endMinFrac === 0) {
                          endSlotIdx = slots.findIndex(s => s.dayStr === f.fechaFin && s.hour === endH - 1)
                          endMinFrac = 1
                        } else {
                          endSlotIdx = slots.findIndex(s => s.dayStr === f.fechaFin && s.hour === endH)
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
                          <span
                            className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: `${color.bg}20`, color: color.text }}
                          >
                            {f.estado}
                          </span>
                          {f.horaEjecucion && (
                            <p className="mt-0.5 text-[9px] text-cyan-400/70 font-mono truncate">
                              ✓ {f.fechaEjecucion ? fmt(f.fechaEjecucion) : fmt(f.fechaInicio)} {f.horaEjecucion}{f.horaFin ? `–${f.horaFin}` : ''}
                            </p>
                          )}
                        </div>

                        {/* Hour cells */}
                        <div className="grid" style={gridCols}>
                          {slots.map((slot, i) => {
                            const inBar = startSlotIdx >= 0 && i >= startSlotIdx && i <= endSlotIdx
                            const isFirst = i === startSlotIdx
                            const isLast = i === endSlotIdx
                            const isSingle = startSlotIdx === endSlotIdx

                            // Phases without horaEjecucion: span full day range
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
                                className="relative h-12 border-r border-cyan-800/20 last:border-r-0 flex items-center"
                              >
                                {showBar && (
                                  <div
                                    className="absolute inset-y-2.5 rounded-md flex items-center overflow-hidden hover:brightness-125 transition-[filter]"
                                    style={{
                                      left: leftStyle,
                                      right: rightStyle,
                                      background: color.bg,
                                      boxShadow: `0 0 8px ${color.bg}60`,
                                    }}
                                  >
                                    {(isFirst || inDayRange) && f.horaEjecucion && (
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

          {/* ── DAY-BASED GRID (fallback) ── */}
          {!hasHourData && dayGrid && (() => {
            const { min, days } = dayGrid
            const numDays = days.length
            const dayGridStyle = { gridTemplateColumns: `repeat(${numDays}, minmax(${DAY_COL_MIN}px, 1fr))` }

            return (
              <>
                {/* Header */}
                <div className="flex border-b border-cyan-800/50 bg-cyan-950/40">
                  <div className="w-44 flex-shrink-0 border-r border-cyan-800/40 px-3 py-2 text-[11px] text-cyan-200 font-semibold">Fase</div>
                  <div className="grid flex-1" style={dayGridStyle}>
                    {days.map((d, i) => (
                      <div key={i} className="px-1 py-2 text-[10px] text-cyan-200 font-mono font-semibold text-center border-r border-cyan-800/30 last:border-r-0">
                        {d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rows */}
                <div className="divide-y divide-cyan-800/25">
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
                    const execHourPct = f.horaEjecucion
                      ? (() => { const [h, m] = f.horaEjecucion.split(':').map(Number); return ((h * 60 + m) / (24 * 60)) * 100 })()
                      : 50

                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => { setSelectedId(f.id); setBacklogError('') }}
                        className={`flex items-stretch w-full text-left transition-colors hover:bg-gray-800/50 cursor-pointer ${idx % 2 === 0 ? 'bg-gray-900/30' : 'bg-transparent'}`}
                      >
                        <div className="w-44 flex-shrink-0 border-r border-cyan-800/30 px-3 py-3 min-w-0">
                          <p className="text-sm text-gray-200 truncate" title={f.fase}>{f.fase || 'Sin nombre'}</p>
                          <span
                            className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: `${color.bg}20`, color: color.text }}
                          >
                            {f.estado}
                          </span>
                          {f.fechaEjecucion && (
                            <p className="mt-0.5 text-[9px] text-cyan-400/70 font-mono truncate">
                              ✓ {fmt(f.fechaEjecucion)}{f.horaEjecucion ? ' ' + f.horaEjecucion : ''}
                            </p>
                          )}
                        </div>
                        <div className="grid flex-1" style={dayGridStyle}>
                          {days.map((_, i) => {
                            const inRange = i >= startIdx && i < startIdx + spanDays
                            const isFirst = i === startIdx
                            const isExec = execIdx !== null && i === execIdx
                            return (
                              <div key={i} className="relative h-12 border-r border-cyan-800/20 last:border-r-0 flex items-center justify-center">
                                {inRange && (
                                  <div
                                    className="absolute inset-y-2.5 inset-x-0.5 rounded-md flex items-center justify-center hover:brightness-125 transition-[filter]"
                                    style={{ background: color.bg, boxShadow: `0 0 8px ${color.bg}60` }}
                                  >
                                    {isFirst && spanDays >= 3 && (
                                      <span className="text-[9px] text-white/80 font-mono px-1 truncate">{spanDays}d</span>
                                    )}
                                  </div>
                                )}
                                {isExec && (
                                  <div
                                    className="absolute inset-y-1 w-0.5 -translate-x-1/2 rounded-full z-10"
                                    style={{ left: `${execHourPct}%`, background: '#ffffff', boxShadow: '0 0 4px #fff8' }}
                                    title={execLabel ?? undefined}
                                  >
                                    <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white shadow" />
                                    {f.horaEjecucion && (
                                      <span className="absolute top-3 left-2 text-[8px] text-white/90 font-mono whitespace-nowrap bg-gray-900/80 px-1 rounded pointer-events-none">
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
