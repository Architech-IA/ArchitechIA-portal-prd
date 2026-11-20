// Tipos y utilidades compartidas de las pantallas de agentes (identidad, gateway, trazabilidad).
export interface AreaOrg { id: string; nombre: string; slug: string; padre: string | null; color: string }
export interface AgenteOrg {
  slug: string; nombre: string; rol: string; areaId: string | null; estado: string; modelo: string | null
  superior: string | null; autonomia: string | null; herramientas: string[]; conFicha: boolean; conFuncion: boolean; reglasComunicacion: number
}
export interface Organigrama { areas: AreaOrg[]; agentes: AgenteOrg[] }

export interface Regla {
  tipoDestino: string; destino: string; direccion: string; canales: string[]; requiereAprobacion: boolean; nota: string | null
}
export interface Alma { mision: string; tono: string; valores: string[]; limites: string[]; ejemplos: string[] }
export interface FichaRes {
  agente: { slug: string; nombre: string; rol: string; area: string | null; estado: string; modelo: string | null; personalidad: string }
  ficha: { alma: Alma; alcance: string; superiorSlug: string | null; herramientas: string[]; autonomia: string; autonomiaPorAccion: Record<string, string>; version: number; actualizadoPor: string | null } | null
  comunicacion: Regla[]
  historial: { id: string; version: number; por: string | null; creadoEn: string }[]
}

export const NIVELES = ['ASISTIDA', 'SUPERVISADA', 'AUTONOMA'] as const
export const NIVEL: Record<string, { txt: string; color: string }> = {
  ASISTIDA: { txt: 'Asistida', color: '#94a3b8' },
  SUPERVISADA: { txt: 'Supervisada', color: '#fbbf24' },
  AUTONOMA: { txt: 'Autónoma', color: '#34d399' },
}
export const CANALES = ['TELEGRAM', 'CORREO', 'PORTAL'] as const
export const TIPOS_DESTINO = [['ROL', 'Un rol de personas'], ['AGENTE', 'Otro agente'], ['PERSONA', 'Una persona concreta'], ['AREA', 'Un área'], ['EXTERNO', 'Alguien externo']] as const
export const ROLES = ['EQUIPO', 'CLIENTE', 'EXTERNO'] as const
export const DIRECCIONES = [['AMBAS', 'Ambas'], ['ENTRADA', 'Solo le escriben'], ['SALIDA', 'Solo escribe']] as const

export const lineas = (t: string) => t.split('\n').map(s => s.trim()).filter(Boolean)
export const campo = 'w-full bg-transparent rounded px-2 py-1.5 text-[12px] text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-400/60'
export const borde = { border: '1px solid rgba(255,255,255,0.12)' } as const
export const tarjeta = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' } as const
export const etiqueta = 'block text-[10px] uppercase tracking-wider font-semibold text-[#7f8a9c] mb-1'
export const boton = 'px-3 py-1.5 rounded-md text-[11px] font-semibold text-purple-100 hover:bg-white/10 disabled:opacity-50'
export const botonBorde = { border: '1px solid rgba(167,139,250,0.45)' } as const
