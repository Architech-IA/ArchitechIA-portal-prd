'use client'

import { Loader2, Play, MessageSquare, CheckCircle2 } from 'lucide-react'
import type { FaseVista, SesionRes } from './api'

// El corazón de cada fase: sus sesiones con la IA, un rol por tarjeta. Al elegir una sesión, su chat se abre en la misma pantalla.

export default function FaseSesiones({ fase, sesiones, creando, activaId, onIniciar, onElegir }: {
  fase: FaseVista; sesiones: SesionRes[]; creando: string | null; activaId: string | null
  onIniciar: (fase: string, rol: string) => void; onElegir: (id: string) => void
}) {
  const roles = fase.sesiones ?? []
  return (
    <div>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
        {roles.map(r => {
          const propias = sesiones.filter(s => s.faseClave === fase.clave && s.rol === r.clave && s.estado !== 'ARCHIVADA').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          const abierta = propias.find(s => s.estado === 'ACTIVA')
          const mostrada = abierta ?? propias[0]
          const elegida = propias.some(s => s.id === activaId)
          const estado = abierta ? { t: 'en curso', bg: 'rgba(99,102,241,0.22)', c: '#c7d2fe' } : propias.length ? { t: 'cerrada', bg: 'rgba(16,185,129,0.16)', c: '#6ee7b7' } : { t: 'sin empezar', bg: 'rgba(255,255,255,0.07)', c: '#9ca3af' }
          const cierre = abierta?.cierre ?? []
          const hechos = cierre.filter(c => c.ok).length
          return (
            <div key={r.clave} role={mostrada ? 'button' : undefined} tabIndex={mostrada ? 0 : undefined} onClick={mostrada ? () => onElegir((elegida ? activaId : mostrada.id) as string) : undefined}
              onKeyDown={mostrada ? e => { if (e.key === 'Enter') onElegir(mostrada.id) } : undefined}
              className={'rounded-xl p-3 flex flex-col gap-1.5 transition-colors ' + (mostrada ? 'cursor-pointer' : '')}
              style={elegida ? { background: 'rgba(99,102,241,0.14)', border: '1.5px solid rgba(129,140,248,0.7)' } : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2">
                <MessageSquare size={13} className="text-indigo-300 flex-shrink-0" />
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: estado.bg, color: estado.c }}>{estado.t}</span>
                {abierta && cierre.length > 0 && <span className="text-[10px] text-[#9ca3af]" title="Puntos de la lista de cierre de la sesión">{hechos}/{cierre.length}</span>}
                <span className="flex-1" />
                <span className="text-[9px] uppercase tracking-wide text-[#6b7280]">Sesión</span>
              </div>
              <p className="text-[12px] text-gray-100 font-medium leading-snug">{r.titulo}</p>
              <p className="text-[11px] text-[#9ca3af] leading-snug" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.objetivo}</p>
              {!abierta && (
                <button disabled={creando === r.clave} onClick={e => { e.stopPropagation(); onIniciar(fase.clave, r.clave) }} className="self-start mt-0.5 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg text-white disabled:opacity-50" style={{ background: 'rgba(99,102,241,0.75)' }}>
                  {creando === r.clave ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}{propias.length ? 'Otra sesión' : 'Iniciar'}</button>)}
              {propias.length > 0 && !abierta && <span className="flex items-center gap-1 text-[10px] text-emerald-300"><CheckCircle2 size={11} /> Ya la hiciste</span>}
            </div>)
        })}
        {roles.length === 0 && <p className="text-[11px] text-[#7f8a9c]">Esta fase no define sesiones.</p>}
      </div>
    </div>
  )
}
