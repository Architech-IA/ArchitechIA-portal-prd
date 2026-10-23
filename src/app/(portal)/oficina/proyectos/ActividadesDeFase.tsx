'use client'

import { useState } from 'react'
import { Bot, User, Sparkles, Play, MessageSquare, Check, Loader2, Undo2, Package } from 'lucide-react'
import { post, type FaseVista, type FaseActividadVista, type SesionRes } from './api'

// Las actividades de la fase: el trabajo que se hace como tareas del Backlog. Van bajo los entregables.
// Cada una puede producir un entregable: se cierra aquí (con la evidencia) o al cerrar la sesión de IA que la trabajó.

// Dónde deja su resultado la actividad: la nota de la fase o un artefacto
const NOMBRE_DESTINO: Record<string, string> = { nota: 'la nota de la fase', prd: 'el PRD', disenoTecnico: 'el diseño técnico', planEjecucion: 'el plan de ejecución' }
export const destinoTexto = (d?: string | null) => (d ? NOMBRE_DESTINO[d] ?? `el artefacto «${d}»` : null)

const ESTADO_TAREA: Record<string, string> = { BACKLOG: 'En cola', IN_PROGRESS: 'En curso', DONE: 'Hecha', FAILED: 'Fallida', BLOCKED: 'Bloqueada', CANCELLED: 'Cancelada' }

export default function ActividadesDeFase({ fase, proyectoId, sesiones, onInvestigar, onIniciar, onAbrirSesion, onCambio }: {
  fase: FaseVista; proyectoId: string; sesiones: SesionRes[]
  onInvestigar?: () => void
  onIniciar?: (a: FaseActividadVista) => Promise<void> | void
  onAbrirSesion?: (id: string) => void
  onCambio?: () => void
}) {
  const [cerrando, setCerrando] = useState<string | null>(null)
  const [evidencia, setEvidencia] = useState('')
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const items = fase.actividades.items
  if (!items.length) return <p className="text-[11px] text-[#7f8a9c]">Esta fase no define actividades.</p>

  const enviar = async (a: FaseActividadVista, accion: 'completar' | 'reabrir', ev?: string) => {
    setOcupada(a.clave); setError(null)
    try {
      await post(`/api/proyectos/${proyectoId}/fases/actividad`, { fase: fase.clave, clave: a.clave, accion, evidencia: ev?.trim() || undefined })
      setCerrando(null); setEvidencia(''); onCambio?.()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar la actividad') } finally { setOcupada(null) }
  }
  const iniciar = async (a: FaseActividadVista) => {
    setOcupada(a.clave); setError(null)
    try { await onIniciar?.(a) } finally { setOcupada(null) }
  }

  return (
    <div className="space-y-1.5">
      {items.map(a => {
        // «Investigar la empresa» es la consulta de la IA que completa la ficha del cliente
        const investigar = a.clave === 'ficha_cliente' && a.tipo === 'AGENTE' && !!onInvestigar && a.status !== 'DONE'
        const hecha = a.status === 'DONE'
        const abierta = a.creada && !hecha && a.status !== 'CANCELLED'
        const sesion = sesiones.find(s => s.faseClave === fase.clave && s.actividadClave === a.clave && s.estado === 'ACTIVA')
        const ocup = ocupada === a.clave
        const porAceptar = a.status === 'IN_PROGRESS' && !!a.destino && sesiones.some(s => s.faseClave === fase.clave && s.actividadClave === a.clave && s.estado === 'CERRADA') && !sesion
        const destino = destinoTexto(a.destino)
        return (
          <div key={a.clave} className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="flex items-start gap-2">
              {a.tipo === 'AGENTE' ? <Bot size={14} className="text-indigo-300 mt-0.5 flex-shrink-0" /> : <User size={14} className="text-amber-300 mt-0.5 flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-gray-200 leading-snug">{a.titulo}</p>
                <p className="text-[10px] text-[#7f8a9c] mt-0.5">{a.tipo === 'AGENTE' ? 'Agente' : 'Persona'} · {a.area}{a.taskCode ? ' · ' + a.taskCode : ''}</p>
                {abierta && destino && a.tipo === 'AGENTE' && (
                  <p className="text-[10px] mt-1 text-[#9ca3af]">{porAceptar ? `Falta aceptar el resultado en ${destino}` : `El resultado se deja en ${destino} y una persona lo acepta`}</p>)}
                {a.entregable && (
                  <p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: a.entregable.ok ? '#6ee7b7' : '#fcd34d' }} title="El entregable que produce esta actividad">
                    <Package size={10} /> {a.entregable.titulo}{a.entregable.ok ? ' · cumplido' : ' · pendiente'}</p>)}
              </div>
              {investigar && (
                <button onClick={onInvestigar} title="La IA propone razón social, NIT, sector, ciudad y país para que los confirmes" className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg flex-shrink-0" style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.4)', color: '#fed7aa', fontWeight: 600 }}>
                  <Sparkles size={11} /> Investigar la empresa</button>)}
              <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={hecha ? { background: 'rgba(16,185,129,0.15)', color: '#6ee7b7' } : a.status === 'FAILED' ? { background: 'rgba(239,68,68,0.15)', color: '#fca5a5' } : { background: 'rgba(255,255,255,0.07)', color: '#9ca3af' }}>
                {a.creada ? (porAceptar ? 'Por aceptar' : (ESTADO_TAREA[a.status ?? ''] ?? a.status)) : 'Aún no creada'}</span>
            </div>

            {(abierta || (hecha && a.creada)) && (
              <div className="flex items-center gap-1.5 mt-2 pl-[22px] flex-wrap">
                {abierta && a.tipo === 'AGENTE' && !investigar && onIniciar && (sesion
                  ? <button onClick={() => onAbrirSesion?.(sesion.id)} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-indigo-200" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}><MessageSquare size={11} /> Abrir la sesión</button>
                  : <button disabled={ocup} onClick={() => void iniciar(a)} title="Abre una sesión de IA que trabaja esta actividad; al cerrarla, la actividad queda hecha" className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-white disabled:opacity-50" style={{ background: 'rgba(99,102,241,0.85)' }}>
                    {ocup ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Iniciar con IA</button>)}
                {abierta && cerrando !== a.clave && (
                  <button disabled={ocup} onClick={() => { setCerrando(a.clave); setEvidencia(''); setError(null) }} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg text-gray-200 disabled:opacity-50" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}>
                    <Check size={11} /> Marcar hecha</button>)}
                {hecha && (
                  <button disabled={ocup} onClick={() => void enviar(a, 'reabrir')} className="flex items-center gap-1 text-[10px] text-[#7f8a9c] hover:text-gray-200 disabled:opacity-50"><Undo2 size={10} /> Reabrir</button>)}
              </div>)}

            {cerrando === a.clave && (
              <div className="mt-2 pl-[22px] space-y-1.5">
                <input value={evidencia} onChange={e => setEvidencia(e.target.value)} placeholder={a.entregable ? 'Enlace a la evidencia o al entregable (opcional)' : 'Enlace a la evidencia (opcional)'}
                  className="w-full rounded-lg px-2.5 py-1.5 text-[11px] text-gray-200 bg-black/30 border border-white/10 outline-none focus:border-indigo-400/50" />
                <div className="flex items-center gap-1.5">
                  <button disabled={ocup} onClick={() => void enviar(a, 'completar', evidencia)} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg text-white disabled:opacity-50" style={{ background: 'rgba(16,185,129,0.8)' }}>
                    {ocup ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Confirmar</button>
                  <button disabled={ocup} onClick={() => setCerrando(null)} className="text-[11px] px-2 py-1 text-[#9ca3af] hover:text-gray-200">Cancelar</button>
                </div>
              </div>)}
          </div>)
      })}
      {error && <p className="text-[11px] text-red-300">{error}</p>}
    </div>
  )
}
