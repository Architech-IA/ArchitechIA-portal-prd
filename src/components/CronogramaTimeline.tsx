'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarRange, X, Trash2 } from 'lucide-react'

export interface FaseCronograma {
  id: string
  fase: string
  fechaInicio: string
  fechaFin: string
  estado: string
}

const ESTADOS_FASE = ['PENDIENTE', 'EN_CURSO', 'COMPLETADA']

const ESTADO_COLOR: Record<string, { bg: string; text: string }> = {
  PENDIENTE: { bg: '#475569', text: '#94a3b8' },
  EN_CURSO: { bg: '#06B6D4', text: '#22d3ee' },
  COMPLETADA: { bg: '#10B981', text: '#34d399' },
}

const DAY_MS = 86400000
const DAY_COL_MIN = 56

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

interface CronogramaTimelineProps {
  fases: FaseCronograma[]
  onUpdate?: (id: string, patch: Partial<FaseCronograma>) => void
  onRemove?: (id: string) => void
}

export default function CronogramaTimeline({ fases, onUpdate, onRemove }: CronogramaTimelineProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const completas = fases.filter(f => f.fechaInicio && f.fechaFin)
  const incompletas = fases.length - completas.length
  const selected = fases.find(f => f.id === selectedId) || null

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

  const starts = completas.map(f => new Date(f.fechaInicio + 'T00:00:00').getTime())
  const ends = completas.map(f => new Date(f.fechaFin + 'T00:00:00').getTime())
  const min = Math.min(...starts)
  const max = Math.max(...ends)
  const numDays = Math.round((max - min) / DAY_MS) + 1
  const days = Array.from({ length: numDays }, (_, i) => new Date(min + i * DAY_MS))
  const dayGridStyle = { gridTemplateColumns: `repeat(${numDays}, minmax(${DAY_COL_MIN}px, 1fr))` }

  return (
    <div className="space-y-3">
      {incompletas > 0 && (
        <p className="text-gray-600 text-xs">
          {incompletas} fase{incompletas > 1 ? 's' : ''} sin fecha completa no se muestra{incompletas > 1 ? 'n' : ''} acá — completalas en la vista Lista.
        </p>
      )}

      <div className="border border-gray-800 rounded-xl overflow-x-auto">
        <div className="min-w-max">
          {/* Encabezado: un día por columna */}
          <div className="flex border-b border-gray-800 bg-gray-950/60">
            <div className="w-44 flex-shrink-0 border-r border-gray-800 px-3 py-2 text-[11px] text-gray-500 font-medium">Fase</div>
            <div className="grid flex-1" style={dayGridStyle}>
              {days.map((d, i) => (
                <div key={i} className="px-1 py-2 text-[10px] text-gray-500 font-mono text-center border-r border-gray-800/40 last:border-r-0">
                  {d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                </div>
              ))}
            </div>
          </div>

          {/* Filas: una por actividad, con franjas alternadas para distinguirlas */}
          <div className="divide-y divide-gray-800/60">
            {completas.map((f, idx) => {
              const s = new Date(f.fechaInicio + 'T00:00:00').getTime()
              const e = new Date(f.fechaFin + 'T00:00:00').getTime()
              const startIdx = Math.round((s - min) / DAY_MS)
              const spanDays = Math.round((e - s) / DAY_MS) + 1
              const color = ESTADO_COLOR[f.estado] || ESTADO_COLOR.PENDIENTE
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedId(f.id)}
                  className={`flex items-stretch w-full text-left transition-colors hover:bg-gray-800/50 cursor-pointer ${idx % 2 === 0 ? 'bg-gray-900/30' : 'bg-transparent'}`}
                >
                  <div className="w-44 flex-shrink-0 border-r border-gray-800 px-3 py-3 min-w-0">
                    <p className="text-sm text-gray-200 truncate" title={f.fase}>{f.fase || 'Sin nombre'}</p>
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: `${color.bg}20`, color: color.text }}>
                      {f.estado}
                    </span>
                  </div>
                  <div className="grid flex-1" style={dayGridStyle}>
                    {days.map((_, i) => {
                      const inRange = i >= startIdx && i < startIdx + spanDays
                      const isFirst = i === startIdx
                      return (
                        <div key={i} className="relative h-12 border-r border-gray-800/30 last:border-r-0 flex items-center justify-center">
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
                        </div>
                      )
                    })}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Popup con el detalle/edición de la fase seleccionada.
          Va en un portal a document.body: si se renderiza en flujo normal,
          algún ancestro con backdrop-filter/transform (típico del estilo
          "glass" del portal) crea un containing block propio y el
          position:fixed deja de centrarse contra la ventana del navegador. */}
      {selected && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedId(null) }}
        >
          <div className="relative w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold text-sm truncate pr-2">{selected.fase || 'Sin nombre'}</h3>
              <button onClick={() => setSelectedId(null)}
                className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors flex-shrink-0">
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

              {onRemove && (
                <button
                  type="button"
                  onClick={() => { onRemove(selected.id); setSelectedId(null) }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                >
                  <Trash2 size={14} /> Eliminar fase
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
