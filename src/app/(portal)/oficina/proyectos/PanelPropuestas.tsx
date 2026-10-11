'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Sparkles, RefreshCw } from 'lucide-react'
import { api, hace } from './api'
import { resumenOps, TAB_DE_CLAVE, type Propuesta, type TabKey } from '../../solutions/pilots/[id]/espacio'
import { TITULO_DE_TAB } from '../../solutions/pilots/[id]/ArbolArtefactos'

const ORIGEN: Record<string, string> = { TAREA: 'Tarea del motor', REVISOR: 'Revisor del motor', PERSONA: 'Una persona' }

/** Todo lo que el motor (o una persona) propone cambiar en los artefactos del proyecto. Se acepta o se rechaza dentro del artefacto, donde se ve el efecto. */
export default function PanelPropuestas({ proyectoId, onAbrir }: { proyectoId: string; onAbrir: (t: TabKey) => void }) {
  const [lista, setLista] = useState<Propuesta[] | null>(null)
  const [error, setError] = useState('')
  const cargar = useCallback(() => {
    setError('')
    api<Propuesta[]>(`/api/soluciones/${proyectoId}/propuestas?estado=PENDIENTE`).then(l => setLista(Array.isArray(l) ? l : [])).catch(e => setError(e instanceof Error ? e.message : 'No se pudieron cargar las propuestas'))
  }, [proyectoId])
  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-[11px] text-[#7f8a9c] flex-1 leading-snug">Cambios que propone el motor. Nada se aplica hasta que alguien lo acepta, dentro del propio artefacto.</p>
        <button onClick={cargar} title="Actualizar" className="text-[#7f8a9c] hover:text-gray-200"><RefreshCw size={12} /></button>
      </div>
      {!lista && !error && <div className="flex justify-center py-6 text-[#7f8a9c]"><Loader2 size={14} className="animate-spin" /></div>}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {lista && lista.length === 0 && <p className="text-[11px] text-[#7f8a9c] py-4 text-center">Sin propuestas pendientes.</p>}
      {(lista ?? []).map(p => (
        <div key={p.id} className="rounded-lg p-2.5 space-y-1.5" style={{ border: '1px dashed rgba(217,119,6,0.55)', background: 'rgba(245,158,11,0.07)' }}>
          <p className="text-[12px] text-amber-200 font-medium leading-snug flex items-start gap-1.5"><Sparkles size={12} className="mt-0.5 flex-shrink-0" />{p.titulo}</p>
          <p className="text-[10px] text-[#7f8a9c]">{TITULO_DE_TAB[TAB_DE_CLAVE[p.clave]] ?? p.clave} · {ORIGEN[p.origen] ?? p.origen} · {hace(p.createdAt)}</p>
          <div className="flex flex-wrap gap-1">{resumenOps(p).map((t, i) => <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-300">+ {t}</span>)}</div>
          <button onClick={() => TAB_DE_CLAVE[p.clave] && onAbrir(TAB_DE_CLAVE[p.clave])} className="text-[11px] px-2.5 py-1 rounded-lg text-white" style={{ background: 'rgba(99,102,241,0.7)' }}>Ver y decidir</button>
        </div>
      ))}
    </div>
  )
}
