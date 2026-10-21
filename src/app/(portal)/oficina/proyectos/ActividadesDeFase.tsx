'use client'

import { Bot, User, Sparkles } from 'lucide-react'
import type { FaseVista } from './api'

// Las actividades de la fase: el trabajo que se hace como tareas del Backlog. Van bajo los entregables.

const ESTADO_TAREA: Record<string, string> = { BACKLOG: 'En cola', IN_PROGRESS: 'En curso', DONE: 'Hecha', FAILED: 'Fallida', BLOCKED: 'Bloqueada', CANCELLED: 'Cancelada' }

export default function ActividadesDeFase({ fase, onInvestigar }: { fase: FaseVista; onInvestigar?: () => void }) {
  const items = fase.actividades.items
  if (!items.length) return <p className="text-[11px] text-[#7f8a9c]">Esta fase no define actividades.</p>
  return (
    <div className="space-y-1.5">
      {items.map(a => {
        // «Investigar la empresa» es la consulta de la IA que completa la ficha del cliente
        const investigar = a.clave === 'ficha_cliente' && a.tipo === 'AGENTE' && !!onInvestigar && a.status !== 'DONE'
        const hecha = a.status === 'DONE'
        return (
          <div key={a.clave} className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {a.tipo === 'AGENTE' ? <Bot size={14} className="text-indigo-300 mt-0.5 flex-shrink-0" /> : <User size={14} className="text-amber-300 mt-0.5 flex-shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-gray-200 leading-snug">{a.titulo}</p>
              <p className="text-[10px] text-[#7f8a9c] mt-0.5">{a.tipo === 'AGENTE' ? 'Agente' : 'Persona'} · {a.area}{a.taskCode ? ' · ' + a.taskCode : ''}</p>
            </div>
            {investigar && (
              <button onClick={onInvestigar} title="La IA propone razón social, NIT, sector, ciudad y país para que los confirmes" className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg flex-shrink-0" style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', color: '#fed7aa', fontWeight: 600 }}><Sparkles size={11} /> Investigar</button>)}
            <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={hecha ? { background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' } : a.status === 'FAILED' ? { background: 'rgba(239,68,68,0.15)', color: '#fca5a5' } : { background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }}>
              {a.creada ? (ESTADO_TAREA[a.status ?? ''] ?? a.status) : 'Aún no creada'}</span>
          </div>)
      })}
    </div>
  )
}
