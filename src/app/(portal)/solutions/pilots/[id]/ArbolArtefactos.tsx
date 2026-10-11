'use client'

import {
  FileText, LayoutGrid, Boxes, Network, ClipboardCheck, Calendar, AlertTriangle, Flag, GitPullRequest, CheckCircle2, Upload, Code2, ClipboardList, FolderOpen,
} from 'lucide-react'
import { CLAVE_DE_TAB, PUNTO_ESTADO, type ArtefactoMeta, type TabKey } from './espacio'

interface Item { tab: TabKey; titulo: string; icono: typeof FileText }
const GRUPOS: { titulo: string; items: Item[] }[] = [
  { titulo: 'Arranque', items: [{ tab: 'prd', titulo: 'PRD', icono: ClipboardList }] },
  {
    titulo: 'Diseño y plan',
    items: [
      { tab: 'diseno', titulo: 'Diseño técnico', icono: Boxes },
      { tab: 'arquitectura', titulo: 'Arquitectura', icono: LayoutGrid },
      { tab: 'diagramas', titulo: 'Diagramas', icono: Network },
      { tab: 'plan-ejec', titulo: 'Plan de ejecución', icono: ClipboardCheck },
      { tab: 'plan', titulo: 'Plan de trabajo', icono: FileText },
      { tab: 'cronograma', titulo: 'Cronograma', icono: Calendar },
    ],
  },
  {
    titulo: 'Control',
    items: [
      { tab: 'riesgos', titulo: 'Riesgos', icono: AlertTriangle },
      { tab: 'cumplimiento', titulo: 'Cumplimiento', icono: Flag },
      { tab: 'cambios', titulo: 'Cambios de alcance', icono: GitPullRequest },
    ],
  },
  {
    titulo: 'Cierre',
    items: [
      { tab: 'revision', titulo: 'Revisión', icono: CheckCircle2 },
      { tab: 'entrega', titulo: 'Entrega', icono: Upload },
      { tab: 'codigo', titulo: 'Código fuente', icono: Code2 },
    ],
  },
]

export const TITULO_DE_TAB: Record<TabKey, string> = Object.fromEntries(GRUPOS.flatMap(g => g.items.map(i => [i.tab, i.titulo]))) as Record<TabKey, string>
export const ICONO_DE_TAB: Record<TabKey, typeof FileText> = Object.fromEntries(GRUPOS.flatMap(g => g.items.map(i => [i.tab, i.icono]))) as Record<TabKey, typeof FileText>

/** El árbol de la solución: las piezas agrupadas por etapa, con su estado, sus comentarios abiertos y sus propuestas pendientes. */
export default function ArbolArtefactos({ activo, onIr, meta, sucios }: {
  activo: TabKey
  onIr: (t: TabKey) => void
  meta: Record<string, ArtefactoMeta>
  sucios: Partial<Record<TabKey, boolean>>
}) {
  return (
    <nav aria-label="Piezas de la solución" className="space-y-3">
      {GRUPOS.map(g => (
        <div key={g.titulo}>
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-1 px-1"><FolderOpen size={11} /> {g.titulo}</p>
          <ul className="space-y-0.5">
            {g.items.map(i => {
              const clave = CLAVE_DE_TAB[i.tab]
              const m = clave ? meta[clave] : undefined
              const on = i.tab === activo
              return (
                <li key={i.tab}>
                  <button type="button" onClick={() => onIr(i.tab)} aria-current={on ? 'page' : undefined}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[12.5px] transition-colors ${on ? 'bg-orange-500/10 text-orange-300' : 'text-gray-300 hover:bg-white/[0.05]'}`}>
                    <i.icono size={14} className={on ? 'text-orange-400' : 'text-gray-500'} />
                    <span className="flex-1 truncate">{i.titulo}</span>
                    {sucios[i.tab] && <span title="Cambios sin guardar" className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                    {!!m && m.propuestas > 0 && <span title={`${m.propuestas} propuesta(s) del motor`} className="text-[10px] px-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">{m.propuestas}</span>}
                    {!!m && m.comentarios > 0 && <span title={`${m.comentarios} comentario(s) abiertos`} className="text-[10px] px-1.5 rounded-full bg-sky-500/15 text-sky-300">{m.comentarios}</span>}
                    {m && <span title={m.estado === 'APROBADO' ? 'Aprobado' : m.estado === 'EN_REVISION' ? 'En revisión' : 'Borrador'} className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PUNTO_ESTADO[m.estado], opacity: m.conContenido || m.estado !== 'BORRADOR' ? 1 : 0.35 }} />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
