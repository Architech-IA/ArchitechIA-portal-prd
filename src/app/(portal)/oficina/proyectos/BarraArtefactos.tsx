'use client'

import { CLAVE_DE_TAB, PUNTO_ESTADO, type ArtefactoMeta, type TabKey } from '../../solutions/pilots/[id]/espacio'
import { TITULO_DE_TAB, ICONO_DE_TAB } from '../../solutions/pilots/[id]/ArbolArtefactos'

const GRUPOS: { titulo: string; items: TabKey[] }[] = [
  { titulo: 'Documentos', items: ['prd', 'diseno', 'plan-ejec', 'plan'] },
  { titulo: 'Diagramas y tiempos', items: ['arquitectura', 'diagramas', 'cronograma'] },
  { titulo: 'Control', items: ['riesgos', 'cumplimiento', 'cambios'] },
  { titulo: 'Cierre', items: ['revision', 'entrega', 'codigo'] },
]

/** Los artefactos del proyecto como pestañas de trabajo: cada uno con su estado, sus propuestas pendientes y sus comentarios abiertos. */
export default function BarraArtefactos({ activo, onIr, meta }: { activo: TabKey | null; onIr: (t: TabKey) => void; meta: Record<string, ArtefactoMeta> }) {
  return (
    <div className="flex items-center gap-1 px-4 py-1.5 overflow-x-auto border-t border-white/5" role="tablist" aria-label="Artefactos del proyecto">
      {GRUPOS.map((g, gi) => (
        <span key={g.titulo} className="flex items-center gap-1 flex-shrink-0">
          <span className={`text-[9px] uppercase tracking-wider text-[#6b7280] mr-0.5 ${gi > 0 ? 'ml-2' : ''}`}>{g.titulo}</span>
          {g.items.map(t => {
            const Icono = ICONO_DE_TAB[t]
            const clave = CLAVE_DE_TAB[t]
            const m = clave ? meta[clave] : undefined
            const on = activo === t
            return (
              <button key={t} role="tab" aria-selected={on} onClick={() => onIr(t)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors"
                style={on ? { background: 'rgba(249,115,22,0.18)', border: '1px solid rgba(249,115,22,0.5)', color: '#fff' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#9ca3af' }}>
                <Icono size={11} />
                {TITULO_DE_TAB[t]}
                {m && <span className="w-1.5 h-1.5 rounded-full" style={{ background: PUNTO_ESTADO[m.estado], opacity: m.conContenido || m.estado !== 'BORRADOR' ? 1 : 0.35 }} title={m.estado === 'APROBADO' ? 'Aprobado' : m.estado === 'EN_REVISION' ? 'En revisión' : 'Borrador'} />}
                {!!m && m.propuestas > 0 && <span className="text-[9px] px-1 rounded-full bg-amber-500/25 text-amber-300" title={`${m.propuestas} propuesta(s) del motor`}>{m.propuestas}</span>}
                {!!m && m.comentarios > 0 && <span className="text-[9px] px-1 rounded-full bg-sky-500/20 text-sky-300" title={`${m.comentarios} comentario(s) abiertos`}>{m.comentarios}</span>}
              </button>
            )
          })}
        </span>
      ))}
    </div>
  )
}
