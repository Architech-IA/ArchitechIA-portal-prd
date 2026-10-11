// Modelo común del espacio de trabajo: cada pieza de la solución es un «artefacto» con el mismo ciclo de edición.

export type TabKey = 'arquitectura' | 'diagramas' | 'plan' | 'prd' | 'diseno' | 'plan-ejec' | 'cronograma' | 'riesgos' | 'cumplimiento' | 'cambios' | 'revision' | 'entrega' | 'codigo'

/** Pestañas que son un artefacto con estado, versiones, comentarios y propuestas, y la clave con la que las conoce el servidor. */
export const CLAVE_DE_TAB: Partial<Record<TabKey, string>> = {
  prd: 'prd',
  diseno: 'disenoTecnico',
  'plan-ejec': 'planEjecucion',
  arquitectura: 'arquitectura',
  cronograma: 'cronograma',
  diagramas: 'diagramas',
  plan: 'planTrabajo',
}
export const TAB_DE_CLAVE: Record<string, TabKey> = Object.fromEntries(Object.entries(CLAVE_DE_TAB).map(([t, c]) => [c as string, t as TabKey]))

export type EstadoArtefacto = 'BORRADOR' | 'EN_REVISION' | 'APROBADO'
export interface ArtefactoMeta {
  clave: string
  estado: EstadoArtefacto
  aprobacion: { porNombre?: string; en?: string } | null
  reabierto: { en?: string; motivo?: string; porNombre?: string } | null
  conContenido: boolean
  versiones: number
  comentarios: number
  propuestas: number
}

export interface Propuesta {
  id: string
  clave: string
  titulo: string
  detalle: string | null
  ops: { op: string; ruta?: string; valor?: Record<string, unknown>; dias?: number; desdeId?: string }[]
  origen: 'TAREA' | 'REVISOR' | 'PERSONA'
  tareaId: string | null
  estado: 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA'
  creadoPor: string | null
  createdAt: string
}

export const ETIQUETA_ESTADO: Record<EstadoArtefacto, string> = { BORRADOR: 'Borrador', EN_REVISION: 'En revisión', APROBADO: 'Aprobado' }
export const COLOR_ESTADO: Record<EstadoArtefacto, string> = {
  BORRADOR: 'text-gray-400 border-gray-600 bg-gray-800/40',
  EN_REVISION: 'text-amber-300 border-amber-600/50 bg-amber-900/20',
  APROBADO: 'text-emerald-300 border-emerald-600/50 bg-emerald-900/20',
}
export const PUNTO_ESTADO: Record<EstadoArtefacto, string> = { BORRADOR: '#6b7280', EN_REVISION: '#f59e0b', APROBADO: '#10b981' }

/** Dónde caería un componente propuesto que no trae posición: debajo del más bajo (igual que en el servidor). */
export function posicionLibre(nodos: { y: number }[]): { x: number; y: number } {
  if (nodos.length === 0) return { x: 16, y: 16 }
  return { x: 16, y: Math.max(...nodos.map(n => n.y)) + 88 }
}

/** Resumen legible de lo que hace una propuesta. */
export function resumenOps(p: Propuesta): string[] {
  return p.ops.map(o => {
    if (o.op === 'desplazar') return `${o.dias! > 0 ? 'Correr' : 'Adelantar'} ${Math.abs(o.dias!)} día(s)${o.desdeId ? ' desde esa fase y sus dependientes' : ' las fases pendientes'}`
    const v = o.valor ?? {}
    const nombre = (v.label ?? v.nombre ?? v.decision ?? v.sistema ?? v.tecnologia ?? '') as string
    const que = ({ nodes: 'Componente', connections: 'Conexión', entidades: 'Entidad', stack: 'Stack', integraciones: 'Integración', decisiones: 'Decisión técnica' } as Record<string, string>)[o.ruta ?? ''] ?? 'Elemento'
    return `${que}${nombre ? `: ${String(nombre).slice(0, 90)}` : ''}`
  })
}
