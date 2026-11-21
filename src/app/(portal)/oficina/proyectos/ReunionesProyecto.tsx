'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, Check, Download, Link2, Loader2, X } from 'lucide-react'
import { api, post, del, hace } from './api'

// Reuniones del calendario asociadas al proyecto. Las «sugeridas» salen de coincidencias de nombre y las confirma una persona;
// una reunión puede pertenecer a varias soluciones. Traer las notas crea (o actualiza) una fuente tipo acta con lo que tenga la reunión.

interface Reu { id: string; titulo: string; fecha: string | null; tipo: string | null; conContenido: boolean; faseClave?: string | null; nota?: string | null; vinculadoPor?: string | null; importada?: boolean; motivo?: string }
interface Res { vinculadas: Reu[]; sugeridas: Reu[]; otras: Reu[] }

const caja = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }
const btnIndigo = { border: '1px solid rgba(99,102,241,0.45)' }

export default function ReunionesProyecto({ proyectoId, onTraida }: { proyectoId: string; onTraida: () => void | Promise<void> }) {
  const [d, setD] = useState<Res | null>(null)
  const [ocupada, setOcupada] = useState<string | null>(null)
  const [otras, setOtras] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try { setD(await api<Res>(`/api/proyectos/${proyectoId}/reuniones`)) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron leer las reuniones') }
  }, [proyectoId])
  useEffect(() => { void cargar() }, [cargar])

  async function accion(id: string, fn: () => Promise<unknown>, refrescarFuentes = false) {
    setOcupada(id); setError(null)
    try { await fn(); await cargar(); if (refrescarFuentes) await onTraida() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la acción') }
    finally { setOcupada(null) }
  }
  const asociar = (r: Reu, sugerida: boolean) => accion(r.id, () => post(`/api/proyectos/${proyectoId}/reuniones`, { meetingId: r.id, sugerida }))
  const quitar = (r: Reu) => accion(r.id, () => del(`/api/proyectos/${proyectoId}/reuniones/${r.id}`))
  const traer = (r: Reu) => accion(r.id, () => post(`/api/proyectos/${proyectoId}/fuentes/desde-reunion`, { meetingId: r.id }), true)

  if (!d) return <div className="rounded-lg p-3 flex justify-center text-[#7f8a9c]" style={caja}>{error ? <span className="text-[11px] text-red-300">{error}</span> : <Loader2 className="animate-spin" size={14} />}</div>

  const fila = (r: Reu, acciones: React.ReactNode) => (
    <li key={r.id} className="flex items-center justify-between gap-2 text-[11.5px]">
      <span className="min-w-0 text-gray-200">
        <span className="block truncate">{r.titulo}<span className="text-[#7f8a9c]"> · {r.fecha ? hace(r.fecha) : ''}</span></span>
        {r.motivo && <span className="block text-[10.5px] text-amber-300/90">{r.motivo}</span>}
        {r.importada && <span className="block text-[10.5px] text-emerald-300/90">Notas ya traídas como fuente</span>}
      </span>
      <span className="flex-shrink-0 flex items-center gap-1">{ocupada === r.id ? <Loader2 size={12} className="animate-spin text-[#7f8a9c]" /> : acciones}</span>
    </li>
  )

  return (
    <div className="rounded-lg p-3 space-y-2" style={caja}>
      <p className="flex items-center gap-1.5 text-[11.5px] text-gray-100 font-medium"><CalendarDays size={13} />Reuniones del proyecto <span className="text-[#7f8a9c] font-normal">({d.vinculadas.length})</span></p>
      {error && <p role="alert" className="text-[11px] text-red-300">{error}</p>}

      {d.vinculadas.length === 0 && <p className="text-[11px] text-[#7f8a9c]">Aún no hay reuniones asociadas a este proyecto.</p>}
      <ul className="space-y-1.5">
        {d.vinculadas.map(r => fila(r, <>
          <button onClick={() => void traer(r)} disabled={!r.conContenido} title={r.conContenido ? 'Importa notas, hub y acciones como fuente' : 'Sin notas ni acciones registradas'} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] text-indigo-100 disabled:opacity-40" style={btnIndigo}><Download size={10} />{r.importada ? 'Actualizar' : 'Traer notas'}</button>
          <button onClick={() => void quitar(r)} aria-label="Quitar de este proyecto" title="Quitar de este proyecto" className="p-1 rounded text-[#9aa6b8] hover:text-red-300"><X size={12} /></button>
        </>))}
      </ul>

      {d.sugeridas.length > 0 && (
        <div className="pt-1.5 border-t border-white/5 space-y-1.5">
          <p className="text-[10.5px] text-[#9aa6b8]">Sugeridas por coincidencia de nombre. Confírmalas una a una.</p>
          <ul className="space-y-1.5">
            {d.sugeridas.map(r => fila(r, <button onClick={() => void asociar(r, true)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] text-emerald-100" style={{ border: '1px solid rgba(52,211,153,0.45)' }}><Check size={10} />Asociar</button>))}
          </ul>
        </div>)}

      <div className="pt-1.5 border-t border-white/5">
        <button onClick={() => setOtras(o => !o)} className="inline-flex items-center gap-1.5 text-[10.5px] text-[#9aa6b8] hover:text-gray-200"><Link2 size={11} />{otras ? 'Ocultar otras reuniones' : 'Asociar otra reunión'}</button>
        {otras && (
          <ul className="mt-1.5 space-y-1.5 max-h-[220px] overflow-auto">
            {d.otras.length === 0 && <li className="text-[11px] text-[#7f8a9c]">No hay más reuniones disponibles.</li>}
            {d.otras.map(r => fila(r, <button onClick={() => void asociar(r, false)} className="px-2 py-0.5 rounded text-[10.5px] text-gray-200" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>Asociar</button>))}
          </ul>)}
      </div>
    </div>
  )
}
