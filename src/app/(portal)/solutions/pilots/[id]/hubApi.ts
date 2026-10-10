'use client'

import { useCallback, useEffect, useRef } from 'react'

export interface ErrorApi extends Error { status: number; data: Record<string, unknown> }

/** fetch + JSON con error legible (el mensaje es el `error` del servidor). */
export async function apiJson<T = any>(url: string, init?: RequestInit): Promise<T> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const e = new Error((data as { error?: string })?.error || `Error ${res.status}`) as ErrorApi
    e.status = res.status
    e.data = data as Record<string, unknown>
    throw e
  }
  return data as T
}

export const fechaCorta = (v?: string | null) => (v ? new Date(v).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' }) : '')
export const dinero = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CO')

/**
 * Guardado con espera para filas que se editan tecla a tecla (riesgos, hitos): junta los cambios de cada fila en un
 * solo PUT, avisa si falla y envía lo pendiente al salir de la pantalla.
 */
export function usePatchDiferido(urlDe: (id: string) => string, onError: (mensaje: string) => void, ms = 600) {
  const pend = useRef<Record<string, { patch: Record<string, unknown>; t: ReturnType<typeof setTimeout> }>>({})
  const enviar = useCallback(async (id: string) => {
    const p = pend.current[id]
    if (!p) return
    delete pend.current[id]
    try { await apiJson(urlDe(id), { method: 'PUT', body: JSON.stringify(p.patch) }) }
    catch (e) { onError(e instanceof Error ? e.message : 'No se pudo guardar el cambio') }
  }, [urlDe, onError])
  const patch = useCallback((id: string, cambios: Record<string, unknown>) => {
    const actual = pend.current[id]
    if (actual) clearTimeout(actual.t)
    pend.current[id] = { patch: { ...(actual?.patch ?? {}), ...cambios }, t: setTimeout(() => { void enviar(id) }, ms) }
  }, [enviar, ms])
  const descartar = useCallback((id: string) => { const a = pend.current[id]; if (a) { clearTimeout(a.t); delete pend.current[id] } }, [])
  useEffect(() => () => { Object.keys(pend.current).forEach(id => { clearTimeout(pend.current[id].t); void enviar(id) }) }, [enviar])
  return { patch, descartar }
}
