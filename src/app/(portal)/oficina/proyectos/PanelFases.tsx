'use client'

import { Check, Loader2, Lock } from 'lucide-react'
import { ETIQUETA_BLOQUE, type FasesRes } from './api'

const COLOR = { HECHA: '#6ee7b7', ACTUAL: '#a5b4fc', CERRADA: '#fca5a5', PENDIENTE: '#6b7280' } as const

/** Las fases del proyecto como línea de tiempo vertical: dónde está, qué falta en la puerta y un clic para abrir cada una. */
export default function PanelFases({ data, activa, onAbrir }: { data: FasesRes | null; activa: string | null; onAbrir: (clave: string) => void }) {
  if (!data) return <div className="flex justify-center py-8 text-[#7f8a9c]"><Loader2 size={14} className="animate-spin" /></div>
  const fases = data.fases ?? []
  if (!fases.length) return <p className="p-4 text-[11px] text-[#7f8a9c]">Este proyecto no tiene motor de fases.</p>
  const hechas = data.iniciado ? fases.filter(f => f.estado === 'HECHA').length : 0
  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden flex gap-px">{fases.map(f => <span key={f.clave} className="flex-1" style={{ background: data.iniciado ? COLOR[f.estado] : COLOR.PENDIENTE, opacity: f.estado === 'PENDIENTE' || !data.iniciado ? 0.35 : 1 }} />)}</div>
        <span className="text-[10px] text-[#7f8a9c]">{hechas}/{fases.length}</span>
      </div>
      {!data.iniciado && <p className="text-[11px] text-[#7f8a9c] mb-2">El motor de fases aún no se inició. Abre una fase para ver qué se espera de ella.</p>}
      <ol className="relative">
        {fases.map((f, i) => {
          const color = data.iniciado ? COLOR[f.estado] : COLOR.PENDIENTE
          const on = activa === f.clave
          const nuevoBloque = i === 0 || fases[i - 1].bloque !== f.bloque
          const ok = f.puerta.criterios.filter(c => c.ok).length
          return (
            <li key={f.clave}>
              {nuevoBloque && <p className={`text-[9px] uppercase tracking-wider text-[#6b7280] mb-1 ${i === 0 ? '' : 'mt-3'}`}>{ETIQUETA_BLOQUE[f.bloque] ?? f.bloque}</p>}
              <button onClick={() => onAbrir(f.clave)} title={f.objetivo} className="w-full flex items-start gap-2.5 text-left rounded-lg px-2 py-1.5 transition-colors"
                style={on ? { background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.5)' } : { background: f.estado === 'ACTUAL' && data.iniciado ? 'rgba(99,102,241,0.08)' : 'transparent', border: '1px solid transparent' }}>
                <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-semibold mt-0.5" style={{ border: `1.5px solid ${color}`, color, background: f.estado === 'HECHA' && data.iniciado ? 'rgba(16,185,129,0.15)' : 'transparent' }}>
                  {data.iniciado && f.estado === 'HECHA' ? <Check size={11} /> : f.numero}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[12px] leading-snug ${on || f.estado === 'ACTUAL' ? 'text-white font-medium' : 'text-gray-300'}`}>{f.nombre}</span>
                  {data.iniciado && f.estado === 'ACTUAL' && (
                    <span className="block text-[10px] mt-0.5" style={{ color: f.puerta.cumplida ? '#6ee7b7' : '#fcd34d' }}>
                      {f.puerta.cumplida ? 'Puerta completa: espera aprobación' : `Puerta: ${ok}/${f.puerta.criterios.length} criterios`}
                    </span>)}
                  {data.iniciado && f.estado === 'ACTUAL' && f.actividades.total > 0 && <span className="block text-[10px] text-[#7f8a9c]">{f.actividades.hechas}/{f.actividades.total} actividades</span>}
                </span>
                {data.iniciado && f.estado === 'PENDIENTE' && <Lock size={10} className="text-[#6b7280] mt-1.5 flex-shrink-0" />}
              </button>
            </li>)
        })}
      </ol>
    </div>
  )
}
