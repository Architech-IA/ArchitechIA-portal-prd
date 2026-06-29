'use client'

import { CalendarRange } from 'lucide-react'

export interface FaseCronograma {
  id: string
  fase: string
  fechaInicio: string
  fechaFin: string
  estado: string
}

const ESTADO_COLOR: Record<string, { bg: string; text: string }> = {
  PENDIENTE: { bg: '#475569', text: '#94a3b8' },
  EN_CURSO: { bg: '#06B6D4', text: '#22d3ee' },
  COMPLETADA: { bg: '#10B981', text: '#34d399' },
}

const DAY_MS = 86400000
const TICKS = 6

function fmt(d: string) {
  if (!d) return ''
  const date = new Date(d + 'T00:00:00')
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

function fmtTs(ts: number) {
  return fmt(new Date(ts).toISOString().slice(0, 10))
}

export default function CronogramaTimeline({ fases }: { fases: FaseCronograma[] }) {
  const completas = fases.filter(f => f.fechaInicio && f.fechaFin)
  const incompletas = fases.length - completas.length

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
  const span = Math.max(max - min, DAY_MS)
  const ticks = Array.from({ length: TICKS }, (_, i) => min + (span * i) / (TICKS - 1))

  return (
    <div className="space-y-3">
      {incompletas > 0 && (
        <p className="text-gray-600 text-xs">
          {incompletas} fase{incompletas > 1 ? 's' : ''} sin fecha completa no se muestra{incompletas > 1 ? 'n' : ''} acá — completalas en la vista Lista.
        </p>
      )}

      <div className="border border-gray-800 rounded-xl overflow-x-auto">
        <div className="min-w-[640px]">
          {/* Eje de fechas compartido */}
          <div className="flex border-b border-gray-800 bg-gray-950/60">
            <div className="w-44 flex-shrink-0 border-r border-gray-800 px-3 py-2 text-[11px] text-gray-500 font-medium">Fase</div>
            <div className="relative flex-1 h-9">
              {ticks.map((t, i) => (
                <span
                  key={i}
                  className="absolute top-1/2 text-[10px] text-gray-500 font-mono whitespace-nowrap"
                  style={{
                    left: `${(i / (TICKS - 1)) * 100}%`,
                    transform: `translate(${i === 0 ? '0%' : i === TICKS - 1 ? '-100%' : '-50%'}, -50%)`,
                  }}
                >
                  {fmtTs(t)}
                </span>
              ))}
            </div>
          </div>

          {/* Filas */}
          <div className="divide-y divide-gray-800/60">
            {completas.map(f => {
              const s = new Date(f.fechaInicio + 'T00:00:00').getTime()
              const e = new Date(f.fechaFin + 'T00:00:00').getTime()
              const leftPct = ((s - min) / span) * 100
              const widthPct = Math.max(((e - s) / span) * 100, 1.5)
              const color = ESTADO_COLOR[f.estado] || ESTADO_COLOR.PENDIENTE
              return (
                <div key={f.id} className="flex items-stretch">
                  <div className="w-44 flex-shrink-0 border-r border-gray-800 px-3 py-3 min-w-0">
                    <p className="text-sm text-gray-200 truncate" title={f.fase}>{f.fase || 'Sin nombre'}</p>
                    <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{ background: `${color.bg}20`, color: color.text }}>
                      {f.estado}
                    </span>
                  </div>
                  <div className="relative flex-1 py-3 px-2">
                    {/* líneas guía verticales, alineadas con el eje de fechas */}
                    {ticks.map((_, i) => (
                      <span key={i} className="absolute top-0 bottom-0 w-px bg-gray-800/40"
                        style={{ left: `${(i / (TICKS - 1)) * 100}%` }} />
                    ))}
                    <div className="relative h-6">
                      <div
                        className="absolute top-0 h-6 rounded-md"
                        style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: color.bg, boxShadow: `0 0 10px ${color.bg}60` }}
                      />
                      <span
                        className="absolute top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-mono whitespace-nowrap"
                        style={{ left: `calc(${leftPct + widthPct}% + 8px)` }}
                      >
                        {fmt(f.fechaInicio)} → {fmt(f.fechaFin)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
