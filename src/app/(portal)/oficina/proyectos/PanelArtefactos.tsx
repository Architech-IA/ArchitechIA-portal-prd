'use client'

import { CLAVE_DE_TAB, PUNTO_ESTADO, ETIQUETA_ESTADO, type ArtefactoMeta, type TabKey } from '../../solutions/pilots/[id]/espacio'
import { TITULO_DE_TAB, ICONO_DE_TAB } from '../../solutions/pilots/[id]/ArbolArtefactos'

const GRUPOS: { titulo: string; items: TabKey[] }[] = [
  { titulo: 'Documentos', items: ['prd', 'diseno', 'plan-ejec', 'plan'] },
  { titulo: 'Diagramas y tiempos', items: ['arquitectura', 'diagramas', 'cronograma'] },
  { titulo: 'Control', items: ['riesgos', 'cumplimiento', 'cambios'] },
  { titulo: 'Cierre', items: ['revision', 'entrega', 'codigo'] },
]

/** Los artefactos del proyecto como lista agrupada: estado, propuestas del motor y comentarios abiertos de cada uno. */
export default function PanelArtefactos({ activo, onIr, meta }: { activo: TabKey | null; onIr: (t: TabKey) => void; meta: Record<string, ArtefactoMeta> }) {
  return (
    <div className="p-3 space-y-3" role="tablist" aria-label="Artefactos del proyecto">
      {GRUPOS.map(g => (
        <div key={g.titulo}>
          <p className="text-[9px] uppercase tracking-wider text-[#6b7280] mb-1">{g.titulo}</p>
          <div className="space-y-0.5">
            {g.items.map(t => {
              const Icono = ICONO_DE_TAB[t]
              const clave = CLAVE_DE_TAB[t]
              const m = clave ? meta[clave] : undefined
              const on = activo === t
              return (
                <button key={t} role="tab" aria-selected={on} onClick={() => onIr(t)} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[12px] transition-colors"
                  style={on ? { background: 'rgba(249,115,22,0.16)', border: '1px solid rgba(249,115,22,0.5)', color: '#fff' } : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#cbd5e1' }}>
                  <Icono size={13} className="flex-shrink-0 opacity-80" />
                  <span className="flex-1 truncate">{TITULO_DE_TAB[t]}</span>
                  {!!m && m.propuestas > 0 && <span className="text-[9px] px-1.5 rounded-full bg-amber-500/25 text-amber-300" title={`${m.propuestas} propuesta(s) del motor`}>{m.propuestas}</span>}
                  {!!m && m.comentarios > 0 && <span className="text-[9px] px-1.5 rounded-full bg-sky-500/20 text-sky-300" title={`${m.comentarios} comentario(s) abiertos`}>{m.comentarios}</span>}
                  {m && (
                    <span className="flex items-center gap-1 text-[10px] text-[#7f8a9c] flex-shrink-0" title={ETIQUETA_ESTADO[m.estado]}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: PUNTO_ESTADO[m.estado], opacity: m.conContenido || m.estado !== 'BORRADOR' ? 1 : 0.35 }} />
                      {m.conContenido || m.estado !== 'BORRADOR' ? ETIQUETA_ESTADO[m.estado] : 'Vacío'}
                    </span>)}
                </button>)
            })}
          </div>
        </div>))}
    </div>
  )
}
