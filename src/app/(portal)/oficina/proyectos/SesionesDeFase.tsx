'use client'

import { Loader2, MessageSquare, Play, CheckCircle2 } from 'lucide-react'
import { TITULO_DE_TAB } from '../../solutions/pilots/[id]/ArbolArtefactos'
import type { TabKey } from '../../solutions/pilots/[id]/espacio'
import type { FaseVista, SesionRes } from './api'

/** Los roles de sesión de una fase: qué se busca con cada uno, qué artefactos suele tocar, las sesiones que ya hay y cómo iniciar la que falta. */
export default function SesionesDeFase({ fase, sesiones, creando, onIniciar, onAbrirSesion, onAbrirArtefacto }: {
  fase: FaseVista; sesiones: SesionRes[]; creando: string | null
  onIniciar: (fase: string, rol: string) => void; onAbrirSesion: (id: string) => void; onAbrirArtefacto?: (t: TabKey) => void
}) {
  const roles = fase.sesiones ?? []
  if (!roles.length) return <p className="text-[11px] text-[#7f8a9c]">Esta fase no define sesiones.</p>
  return (
    <div className="space-y-2.5">
      {roles.map(r => {
        const hechas = sesiones.filter(s => s.faseClave === fase.clave && s.rol === r.clave && s.estado !== 'ARCHIVADA')
        const abierta = hechas.find(s => s.estado === 'ACTIVA')
        return (
          <div key={r.clave} className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-start gap-2">
              <MessageSquare size={14} className="text-indigo-300 mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-gray-100 font-medium leading-snug">{r.titulo}</p>
                <p className="text-[11px] text-[#9ca3af] mt-0.5 leading-snug">{r.objetivo}</p>
              </div>
              <button disabled={creando === r.clave} onClick={() => onIniciar(fase.clave, r.clave)} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg text-white flex-shrink-0 disabled:opacity-50" style={{ background: 'rgba(99,102,241,0.75)' }}>
                {creando === r.clave ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}{abierta ? 'Otra sesión' : 'Iniciar'}</button>
            </div>
            <p className="text-[10px] text-[#7f8a9c] leading-snug"><span className="uppercase tracking-wide">Resultado esperado · </span>{r.resultado}</p>
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-[#7f8a9c] uppercase tracking-wide mr-0.5">Suele tocar</span>
              {r.artefactos.filter(a => a in TITULO_DE_TAB).map(a => (
                <button key={a} onClick={() => onAbrirArtefacto?.(a as TabKey)} disabled={!onAbrirArtefacto} className="text-[10px] px-1.5 py-0.5 rounded-md text-orange-200" style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}>{TITULO_DE_TAB[a as TabKey]}</button>))}
            </div>
            {hechas.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-white/5">
                {hechas.map(s => {
                  const ok = (s.cierre ?? []).filter(c => c.ok).length
                  return (
                    <button key={s.id} onClick={() => onAbrirSesion(s.id)} className="w-full flex items-center gap-2 text-left rounded-md px-2 py-1 hover:bg-white/[0.06]">
                      {s.estado === 'CERRADA' ? <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0" /> : <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0 mx-0.5" />}
                      <span className="text-[11px] text-gray-300 truncate flex-1">{s.titulo}</span>
                      <span className="text-[10px] text-[#7f8a9c] flex-shrink-0">{s.estado === 'CERRADA' ? 'Cerrada' : 'Abierta'} · {ok}/{(s.cierre ?? []).length}</span>
                    </button>)
                })}
              </div>)}
          </div>)
      })}
    </div>
  )
}
