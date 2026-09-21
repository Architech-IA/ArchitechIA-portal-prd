import type { FuenteCtx } from '@/lib/proyectos/tipos'

export type { FuenteCtx }

export interface ProyectoLista {
  id: string; nombre: string; tipo: string; estado: string; codigo: string | null
  sesiones: number; ultimaActividad: string | null; memoriaVersion: number; propuestasPendientes: number; adjuntos: number
}

export interface SesionRes {
  id: string; titulo: string; tipo: string; estado: string; privada: boolean
  creadaPorId: string; creadaPorNombre: string; cierreEstado: string | null
  createdAt: string; updatedAt: string; mensajes: number; mia: boolean
}

export interface DetalleProyecto {
  proyecto: { id: string; nombre: string; tipo: string; estado: string; solucionCode: string | null; leadId: string | null; updatedAt: string }
  yo: { id: string; nombre: string }
  sesiones: SesionRes[]
  memoriaVersion: number
  propuestasPendientes: number
  adjuntos: number
}

export interface SesionFull {
  id: string; solucionId: string; titulo: string; tipo: string; estado: string; privada: boolean
  creadaPorId: string; creadaPorNombre: string; resumen: string; fuentesExcluidas: string[]
  cierreEstado: string | null; createdAt: string; updatedAt: string
}

export interface FuenteMeta { clave: string; etiqueta: string; estado: string; chars: number; actualizado: string | null; nota: string | null }

export interface Mensaje {
  id: string; sesionId: string; orden: number; rol: 'user' | 'assistant'; contenido: string
  estado: 'GENERANDO' | 'LISTO' | 'ERROR'; error: string | null
  metadata: { contexto?: FuenteMeta[]; totalChars?: number; ms?: number; adjuntos?: { id: string; nombre: string }[]; origen?: string } | null
  autorId: string | null; autorNombre: string | null; createdAt: string; updatedAt: string
}

export interface Adjunto {
  id: string; nombre: string; mime: string | null; size: number; textoLen: number; legible: boolean
  sesionId: string | null; creadoPorNombre: string; createdAt: string
}

export interface Suscripcion {
  id: string; tipo: string; nombre: string; activa: boolean; intervaloMin: number
  ultimaEjecucion: string | null; ultimoResultado: string | null; createdAt: string
}

export interface ResultadoBusqueda {
  tipo: 'MENSAJE' | 'ADJUNTO' | 'MEMORIA'; id: string; sesionId: string | null; sesionTitulo: string | null
  titulo: string; fragmento: string; rank: number; fecha: string
}

export class ErrorApi extends Error {
  status: number
  data: Record<string, unknown>
  constructor(msg: string, status: number, data: Record<string, unknown>) { super(msg); this.status = status; this.data = data }
}

export async function api<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const esForm = typeof FormData !== 'undefined' && init.body instanceof FormData
  const res = await fetch(url, { ...init, headers: { ...(esForm || !init.body ? {} : { 'Content-Type': 'application/json' }), ...(init.headers ?? {}) } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ErrorApi((data as { error?: string }).error || `Error ${res.status}`, res.status, data as Record<string, unknown>)
  return data as T
}

export const post = <T,>(url: string, body?: unknown) => api<T>(url, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
export const patch = <T,>(url: string, body: unknown) => api<T>(url, { method: 'PATCH', body: JSON.stringify(body) })
export const put = <T,>(url: string, body: unknown) => api<T>(url, { method: 'PUT', body: JSON.stringify(body) })
export const del = <T,>(url: string) => api<T>(url, { method: 'DELETE' })

export function hace(iso: string | null | undefined): string {
  if (!iso) return '—'
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'ahora'
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
  if (s < 86400 * 30) return `hace ${Math.floor(s / 86400)} d`
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota' })
}

export const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bogota' })

export const kb = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`)
