'use client'

import { useState } from 'react'
import { Check, Circle, Loader2, ExternalLink } from 'lucide-react'
import type { TabKey } from '../../solutions/pilots/[id]/espacio'
import { post, type FaseVista, type RequeridoFase } from './api'
import { FORMATO } from './formatos'

const fechaCorta = (v: string) => { const d = new Date(v); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' }) }

/** Lo mínimo que debe existir para cerrar la fase. Se comprueba solo con lo que hay en el sistema; lo que no se puede comprobar lo marca una persona con su evidencia. */
export default function EntregablesDeFase({ proyectoId, fase, editable, onCambio, onAbrirArtefacto, onAbrirFicha, onAbrirLead }: {
  onAbrirLead?: () => void
  proyectoId: string; fase: FaseVista; editable: boolean; onCambio: () => void; onAbrirArtefacto?: (t: TabKey) => void; onAbrirFicha?: () => void
}) {
  const [evid, setEvid] = useState<Record<string, string>>({})
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState('')
  const lista: RequeridoFase[] = fase.requeridos ?? []
  // Fases que se cerraron antes de que existiera esta exigencia: se muestran como referencia, sin alarmar.
  const cerrada = fase.estado === 'HECHA'
  if (!lista.length) return <p className="text-[11px] text-[#7f8a9c]">Esta fase no define entregables obligatorios.</p>

  async function marcar(r: RequeridoFase, ok: boolean) {
    setOcupado(r.clave); setError('')
    try { await post(`/api/proyectos/${proyectoId}/fases/entregable`, { fase: fase.clave, clave: r.clave, ok, evidencia: (evid[r.clave] ?? r.evidencia ?? '').trim() || undefined }); onCambio() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') } finally { setOcupado(null) }
  }

  return (
    <div className="space-y-2">
      {cerrada && lista.some(r => !r.ok) && <p className="text-[10px] text-[#7f8a9c]">Fase ya cerrada: lo que figura como pendiente no estaba registrado en el sistema (se cerró antes de exigir entregables o se hizo fuera de él).</p>}
      {lista.map(r => {
        // Cada entregable se abre donde se trabaja: la ficha, el lead o el artefacto
        const abrir = r.tipo.startsWith('ficha') ? onAbrirFicha : r.tipo === 'lead_registrado' ? onAbrirLead : r.artefacto && onAbrirArtefacto ? () => onAbrirArtefacto(r.artefacto as TabKey) : undefined
        return (
        <div key={r.clave} onClick={abrir ? ev => { if (!(ev.target as HTMLElement).closest('button,input,a,select,textarea')) abrir() } : undefined}
          className={`rounded-lg px-3 py-2 transition-colors ${abrir ? 'cursor-pointer hover:brightness-125' : ''}`} role={abrir ? 'button' : undefined} tabIndex={abrir ? 0 : undefined}
          onKeyDown={abrir ? ev => { if (ev.key === 'Enter' && ev.target === ev.currentTarget) abrir() } : undefined} style={{ background: r.ok ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${r.ok ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}` }}>
          <div className="flex items-start gap-2">
            {r.ok ? <Check size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" /> : <Circle size={14} className="text-[#6b7280] mt-0.5 flex-shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-gray-100 leading-snug">{r.titulo} <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full align-middle" style={{ background: 'rgba(99,102,241,0.18)', color: '#a5b4fc' }} title="Formato en el que se espera este entregable">{FORMATO[r.formato] ?? r.formato}</span></p>
              <p className="text-[10px] mt-0.5" style={{ color: r.ok ? '#6ee7b7' : cerrada ? '#9ca3af' : '#fcd34d' }}>{r.detalle}{r.manual && r.ok && r.por ? ` · ${r.por}${r.en ? ` · ${fechaCorta(r.en)}` : ''}` : ''}</p>
              {!r.ok && !cerrada && r.ayuda && <p className="text-[10px] text-[#7f8a9c] mt-0.5 leading-snug">{r.ayuda}</p>}
              {r.manual && r.ok && r.evidencia && <p className="text-[10px] text-gray-300 mt-0.5 break-words">Evidencia: {/^https?:\/\//.test(r.evidencia) ? <a href={r.evidencia} target="_blank" rel="noreferrer" className="text-indigo-300 underline">{r.evidencia}</a> : r.evidencia}</p>}
            </div>
            {r.tipo.startsWith('ficha') && onAbrirFicha && <button onClick={onAbrirFicha} className="flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200 flex-shrink-0"><ExternalLink size={10} /> Abrir ficha</button>}
            {r.artefacto && onAbrirArtefacto && <button onClick={() => onAbrirArtefacto(r.artefacto as TabKey)} className="flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200 flex-shrink-0"><ExternalLink size={10} /> Abrir</button>}
          </div>
          {r.manual && editable && (
            <div className="flex items-center gap-2 mt-2 pl-6">
              {!r.ok && <input value={evid[r.clave] ?? r.evidencia ?? ''} onChange={e => setEvid(p => ({ ...p, [r.clave]: e.target.value }))} placeholder={`Enlace (https://…) a: ${FORMATO[r.formato] ?? r.formato}`} maxLength={500}
                className="flex-1 min-w-0 rounded-md px-2 py-1 text-[11px] text-gray-200 bg-black/30 border border-white/10 outline-none focus:border-indigo-500/50" />}
              <button disabled={ocupado === r.clave || (!r.ok && !/^https?:\/\//.test((evid[r.clave] ?? r.evidencia ?? '').trim()))} onClick={() => void marcar(r, !r.ok)} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg text-white disabled:opacity-40 flex-shrink-0"
                style={{ background: r.ok ? 'rgba(255,255,255,0.1)' : 'rgba(16,185,129,0.7)' }}>
                {ocupado === r.clave ? <Loader2 size={11} className="animate-spin" /> : null}{r.ok ? 'Desmarcar' : 'Marcar como listo'}</button>
            </div>)}
        </div>)
      })}
      {error && <p className="text-[11px] text-red-300">{error}</p>}
    </div>
  )
}
