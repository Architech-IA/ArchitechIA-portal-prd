// Constantes y tipos compartidos (servidor y navegador) de Oficina > Proyectos.

export const TIPOS_SESION = ['KICKOFF', 'PLANIFICACION', 'REVISION', 'LIBRE', 'BITACORA'] as const
export type TipoSesion = (typeof TIPOS_SESION)[number]

export const ETIQUETA_TIPO: Record<TipoSesion, string> = {
  KICKOFF: 'Kickoff',
  PLANIFICACION: 'Planificación',
  REVISION: 'Revisión',
  LIBRE: 'Libre',
  BITACORA: 'Bitácora',
}

export const DESCRIPCION_TIPO: Record<TipoSesion, string> = {
  KICKOFF: 'Entrevista guiada de Orión para definir alcance, usuarios y criterios de éxito.',
  PLANIFICACION: 'Coordinador: descompone el trabajo en tareas y las convierte en backlog.',
  REVISION: 'Revisa el estado: avance, contradicciones entre documentos, riesgos y acciones.',
  LIBRE: 'Conversación abierta sobre el proyecto, con todo su contexto.',
  BITACORA: 'Actividad automática del proyecto (suscripciones).',
}

export const TIPOS_SUSCRIPCION = ['BACKLOG_CAMBIOS', 'DOCUMENTOS_CAMBIOS', 'RESUMEN_PERIODICO'] as const
export type TipoSuscripcion = (typeof TIPOS_SUSCRIPCION)[number]

export const ETIQUETA_SUSCRIPCION: Record<TipoSuscripcion, string> = {
  BACKLOG_CAMBIOS: 'Cambios en el backlog',
  DOCUMENTOS_CAMBIOS: 'Cambios en PRD / diseño / plan',
  RESUMEN_PERIODICO: 'Resumen de estado periódico',
}

export const DESCRIPCION_SUSCRIPCION: Record<TipoSuscripcion, string> = {
  BACKLOG_CAMBIOS: 'Publica en la Bitácora las tareas nuevas o modificadas desde la última revisión.',
  DOCUMENTOS_CAMBIOS: 'Avisa cuando cambian el PRD, el diseño técnico, el plan, la arquitectura o el cronograma.',
  RESUMEN_PERIODICO: 'La IA redacta un informe de estado del proyecto con cada periodo.',
}

// Claves de las fuentes de contexto (las que la persona puede incluir o excluir por sesión)
export const FUENTES_CLAVES = [
  'ficha', 'memoria', 'resumen', 'prd', 'diseno', 'backlog', 'adjuntos', 'plan_ejec',
  'lead', 'historial', 'riesgos', 'hitos', 'cronograma', 'plan_trabajo',
] as const
export type FuenteClave = (typeof FUENTES_CLAVES)[number]

export interface FuenteCtx {
  clave: string
  etiqueta: string
  estado: 'incluida' | 'excluida' | 'vacia' | 'recortada' | 'omitida'
  chars: number
  nota?: string
  actualizado?: string | null
}

export const ESTADOS_MENSAJE = ['GENERANDO', 'LISTO', 'ERROR'] as const
