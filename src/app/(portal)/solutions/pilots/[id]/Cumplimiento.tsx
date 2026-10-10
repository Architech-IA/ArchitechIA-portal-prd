'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Trash2, CheckCircle2, AlertTriangle, BadgeCheck, X } from 'lucide-react'
import { apiJson, dinero, fechaCorta, usePatchDiferido } from './hubApi'

const ESTADOS_HITO = ['PENDIENTE', 'CUMPLIDO', 'ATRASADO']
const ESTADOS_PAGO = ['PENDIENTE', 'FACTURADO', 'PAGADO']
const COLOR_HITO: Record<string, string> = {
  PENDIENTE: 'border-gray-700', CUMPLIDO: 'border-emerald-700/60', ATRASADO: 'border-red-700/60',
}
const COLOR_PAGO: Record<string, string> = {
  PENDIENTE: 'text-gray-400 border-gray-700', FACTURADO: 'text-amber-300 border-amber-700/50', PAGADO: 'text-emerald-300 border-emerald-700/50',
}

interface Hito {
  id: string; titulo: string; descripcion: string | null; fechaComprometida: string | null; fechaReal: string | null; estado: string
  monto: number; estadoPago: string; sprintId: string | null
  aceptadoPor: string | null; aceptadoEn: string | null; aceptadoNota: string | null
  sprint?: { id: string; sprintCode: string | null; name: string; total: number; hechas: number } | null
}
interface SprintLite { id: string; sprintCode: string | null; name: string }
interface Economia {
  valorEstimado: number; cambiosAprobados: number; diasCambios: number
  hitos: { total: number; monto: number; facturado: number; pagado: number; cumplidos: number; aceptados: number }
  tareas: { total: number; hechas: number; enCurso: number; fallidas: number }
  tokens: { total: number; entrada: number; salida: number; ejecuciones: number }
}

export default function Cumplimiento({ solucionId, esAdmin, refrescarClave }: { solucionId: string; esAdmin: boolean; refrescarClave?: number }) {
  const [hitos, setHitos] = useState<Hito[]>([])
  const [sprints, setSprints] = useState<SprintLite[]>([])
  const [eco, setEco] = useState<Economia | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [aceptando, setAceptando] = useState<string | null>(null)
  const [aceptNombre, setAceptNombre] = useState('')
  const [aceptNota, setAceptNota] = useState('')
  const [precio, setPrecio] = useState('')
  useEffect(() => { try { setPrecio(localStorage.getItem('hub.usdPorMillon') ?? '') } catch { /* sin almacenamiento */ } }, [])

  const cargar = useCallback(async () => {
    try {
      const [h, e] = await Promise.all([
        apiJson<Hito[]>(`/api/hitos?solucionId=${solucionId}`),
        apiJson<Economia>(`/api/soluciones/${solucionId}/economia`).catch(() => null),
      ])
      setHitos(Array.isArray(h) ? h : [])
      setEco(e)
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudieron cargar los hitos') }
    finally { setCargando(false) }
  }, [solucionId])
  useEffect(() => { void cargar() }, [cargar, refrescarClave])
  useEffect(() => {
    apiJson<(SprintLite & { solucion?: { id: string } | null; solucionId?: string | null })[]>('/api/backlog/sprints')
      .then(l => setSprints((Array.isArray(l) ? l : []).filter(s => s.solucionId === solucionId || s.solucion?.id === solucionId)))
      .catch(() => setSprints([]))
  }, [solucionId])

  const alFallar = useCallback((m: string) => setError(m), [])
  const urlHito = useCallback((id: string) => `/api/hitos/${id}`, [])
  const { patch, descartar } = usePatchDiferido(urlHito, alFallar)

  const editar = (id: string, p: Partial<Hito>) => {
    setHitos(prev => prev.map(h => (h.id === id ? { ...h, ...p } : h)))
    patch(id, p as Record<string, unknown>)
  }
  /** Cambios con efecto inmediato (pago, aceptación, sprint): se espera la respuesta y se muestra el error. */
  async function accion(id: string, body: Record<string, unknown>) {
    setError('')
    descartar(id)
    try { await apiJson(`/api/hitos/${id}`, { method: 'PUT', body: JSON.stringify(body) }); await cargar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar'); await cargar() }
  }
  async function agregar() {
    setError('')
    try { const n = await apiJson<Hito>('/api/hitos', { method: 'POST', body: JSON.stringify({ solucionId, titulo: 'Nuevo hito' }) }); setHitos(p => [...p, n]) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el hito') }
  }
  async function quitar(id: string) {
    if (!window.confirm('¿Eliminar este hito?')) return
    descartar(id)
    setHitos(p => p.filter(h => h.id !== id))
    try { await apiJson(`/api/hitos/${id}`, { method: 'DELETE' }) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar'); await cargar() }
  }

  const hoy = new Date().toISOString().slice(0, 10)
  const valor = eco?.valorEstimado ?? 0
  const suma = useMemo(() => hitos.reduce((a, h) => a + (Number(h.monto) || 0), 0), [hitos])
  const descuadre = valor > 0 && hitos.length > 0 && Math.abs(suma - valor) > 1
  const usd = Number(precio.replace(',', '.')) || 0
  const costoTokens = eco && usd > 0 ? (eco.tokens.total / 1_000_000) * usd : null

  if (cargando) return <div className="flex justify-center py-8"><Loader2 className="text-cyan-500 animate-spin" size={22} /></div>

  return (
    <div className="space-y-4">
      {eco && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            ['Valor del proyecto', dinero(valor), eco.cambiosAprobados ? `incluye ${dinero(eco.cambiosAprobados)} en cambios aprobados` : ''],
            ['Calendario de pagos', dinero(suma), descuadre ? `¡no cuadra con el valor (${dinero(valor - suma)})!` : hitos.length ? 'cuadra con el valor' : 'sin hitos con monto'],
            ['Facturado / pagado', `${dinero(eco.hitos.facturado)} / ${dinero(eco.hitos.pagado)}`, `por cobrar ${dinero(Math.max(0, suma - eco.hitos.pagado))}`],
            ['Tareas hechas', `${eco.tareas.hechas} / ${eco.tareas.total}`, `${eco.tareas.enCurso} en curso · ${eco.tareas.fallidas} fallidas`],
          ].map(([t, v, s]) => (
            <div key={t} className={`bg-gray-950 border rounded-xl p-3 ${t === 'Calendario de pagos' && descuadre ? 'border-amber-700/60' : 'border-gray-800'}`}>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">{t}</p>
              <p className="text-white text-sm font-semibold mt-0.5">{v}</p>
              <p className={`text-[11px] mt-0.5 ${t === 'Calendario de pagos' && descuadre ? 'text-amber-300' : 'text-gray-500'}`}>{s}</p>
            </div>
          ))}
          <div className="col-span-2 md:col-span-4 bg-gray-950 border border-gray-800 rounded-xl p-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span><b className="text-gray-200">{eco.tokens.total.toLocaleString('es-CO')}</b> tokens usados por los agentes ({eco.tokens.ejecuciones} ejecuciones)</span>
            <label className="flex items-center gap-1.5 ml-auto">USD por millón de tokens
              <input value={precio} onChange={e => { setPrecio(e.target.value); try { localStorage.setItem('hub.usdPorMillon', e.target.value) } catch { /* sin almacenamiento */ } }}
                placeholder="p. ej. 3" inputMode="decimal" className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-cyan-500" />
            </label>
            {costoTokens !== null && <span>≈ <b className="text-gray-200">US$ {costoTokens.toFixed(2)}</b> de IA en este proyecto</span>}
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle size={13} /> {error} <button type="button" onClick={() => setError('')} className="ml-1 text-gray-500 hover:text-gray-300"><X size={12} /></button></p>}
      {hitos.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Sin hitos registrados todavía.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {hitos.map(h => {
          const vencido = h.estado === 'PENDIENTE' && !!h.fechaComprometida && h.fechaComprometida.slice(0, 10) < hoy
          const pct = valor > 0 && h.monto > 0 ? Math.round((h.monto / valor) * 100) : null
          return (
            <div key={h.id} className={`bg-gray-950 border rounded-xl p-3 space-y-2 ${vencido ? 'border-red-700/60' : COLOR_HITO[h.estado] ?? 'border-gray-700'}`}>
              <div className="flex items-center gap-2">
                <input type="text" value={h.titulo} onChange={e => editar(h.id, { titulo: e.target.value })} placeholder="Título del hito / entregable"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm font-medium focus:outline-none focus:border-cyan-500" />
                <button type="button" onClick={() => void quitar(h.id)} className="w-8 h-8 flex-shrink-0 rounded-lg bg-gray-900 hover:bg-red-900/30 text-gray-500 hover:text-red-400 flex items-center justify-center"><Trash2 size={14} /></button>
              </div>
              <input type="text" value={h.descripcion ?? ''} onChange={e => editar(h.id, { descripcion: e.target.value })} placeholder="Descripción (opcional)"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 placeholder-gray-500 text-xs focus:outline-none focus:border-cyan-500" />
              <div className="grid grid-cols-3 gap-2">
                <input type="date" value={h.fechaComprometida ? h.fechaComprometida.slice(0, 10) : ''} onChange={e => editar(h.id, { fechaComprometida: e.target.value || null })} title="Fecha comprometida"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500" />
                <input type="date" value={h.fechaReal ? h.fechaReal.slice(0, 10) : ''} onChange={e => editar(h.id, { fechaReal: e.target.value || null })} title="Fecha real de entrega"
                  className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500" />
                <select value={h.estado} onChange={e => editar(h.id, { estado: e.target.value })} title="Estado" className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 cursor-pointer">
                  {ESTADOS_HITO.map(es => <option key={es} value={es}>{es}</option>)}
                </select>
              </div>
              {vencido && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertTriangle size={11} /> Vencido: la fecha comprometida ya pasó y sigue pendiente.</p>}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-gray-500">Monto del hito {pct !== null && <span className="text-gray-500">({pct}% del valor)</span>}
                  <input type="number" min="0" step="any" value={h.monto || ''} onChange={e => editar(h.id, { monto: Number(e.target.value) || 0 })} placeholder="0"
                    className="mt-0.5 w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500" />
                </label>
                <label className="text-[11px] text-gray-500">Pago {!esAdmin && <span className="text-gray-500">(solo administradores)</span>}
                  <select value={h.estadoPago} disabled={!esAdmin} onChange={e => void accion(h.id, { estadoPago: e.target.value })}
                    className={`mt-0.5 w-full bg-gray-900 border rounded-lg px-2 py-1.5 text-xs focus:outline-none cursor-pointer disabled:opacity-60 ${COLOR_PAGO[h.estadoPago] ?? 'text-white border-gray-700'}`}>
                    {ESTADOS_PAGO.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-[11px] text-gray-500">Sprint que lo construye
                <select value={h.sprintId ?? ''} onChange={e => void accion(h.id, { sprintId: e.target.value || null })}
                  className="mt-0.5 w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 cursor-pointer">
                  <option value="">— sin sprint —</option>
                  {sprints.map(s => <option key={s.id} value={s.id}>{s.sprintCode ? `${s.sprintCode} · ` : ''}{s.name}</option>)}
                </select>
              </label>
              {h.sprint && h.sprint.total > 0 && (
                <div>
                  <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden"><div className="h-full bg-cyan-500" style={{ width: `${Math.round((h.sprint.hechas / h.sprint.total) * 100)}%` }} /></div>
                  <p className="text-[10px] text-gray-500 mt-0.5">{h.sprint.hechas} de {h.sprint.total} tareas del sprint hechas</p>
                </div>
              )}
              {h.aceptadoEn ? (
                <div className="flex items-start justify-between gap-2 rounded-lg border border-emerald-700/40 bg-emerald-900/10 px-2.5 py-1.5">
                  <p className="text-[11px] text-emerald-300 flex items-start gap-1.5"><BadgeCheck size={13} className="mt-0.5 flex-shrink-0" />
                    <span>Aceptado por <b>{h.aceptadoPor}</b> el {fechaCorta(h.aceptadoEn)}{h.aceptadoNota ? <> — {h.aceptadoNota}</> : null}</span></p>
                  {esAdmin && <button type="button" onClick={() => void accion(h.id, { aceptar: null })} className="text-[10px] text-gray-500 hover:text-red-400 flex-shrink-0">Quitar</button>}
                </div>
              ) : aceptando === h.id ? (
                <div className="space-y-1.5 rounded-lg border border-gray-700 p-2">
                  <input value={aceptNombre} onChange={e => setAceptNombre(e.target.value)} placeholder="Quién del cliente acepta (nombre y cargo)"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-cyan-500" />
                  <input value={aceptNota} onChange={e => setAceptNota(e.target.value)} placeholder="Nota o referencia (correo, acta…)"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-cyan-500" />
                  <div className="flex gap-2">
                    <button type="button" disabled={!aceptNombre.trim()} onClick={() => { void accion(h.id, { aceptar: { nombre: aceptNombre.trim(), nota: aceptNota.trim() || undefined } }); setAceptando(null); setAceptNombre(''); setAceptNota('') }}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40">Registrar aceptación</button>
                    <button type="button" onClick={() => setAceptando(null)} className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 text-xs">Cancelar</button>
                  </div>
                </div>
              ) : esAdmin ? (
                <button type="button" onClick={() => { setAceptando(h.id); setAceptNombre(''); setAceptNota('') }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-gray-700 text-gray-500 hover:text-emerald-300 hover:border-emerald-600/50 text-xs">
                  <CheckCircle2 size={12} /> Registrar aceptación del cliente
                </button>
              ) : (
                <p className="text-[11px] text-gray-500">Sin aceptación del cliente registrada.</p>
              )}
            </div>
          )
        })}
      </div>
      <button type="button" onClick={() => void agregar()} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40 text-sm transition-colors">
        <Plus size={14} /> Agregar hito
      </button>
    </div>
  )
}
