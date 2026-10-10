'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Download, Printer, Link2, Copy, Camera, PackagePlus, ShieldOff, AlertTriangle, X } from 'lucide-react'
import { apiJson, fechaCorta } from './hubApi'
import { construirPaquete, descargarArchivo, type DatosPaquete } from './paquete'

interface Snap { id: string; etiqueta: string; tipo: string; creadoPorNombre: string | null; createdAt: string }
const archivoSeguro = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_')
const ETIQ_SNAP: Record<string, string> = { LINEA_BASE: 'Línea base', AS_BUILT: 'As-built', MANUAL: 'Manual' }

export default function Entrega({ solucionId, nombre, esAdmin, tokenCliente, onToken, hayCambios, parentId, irASolucion }: {
  solucionId: string; nombre: string; esAdmin: boolean
  tokenCliente: string | null; onToken: (t: string | null) => void
  hayCambios: boolean
  parentId: string | null
  irASolucion: (id: string) => void
}) {
  const [snaps, setSnaps] = useState<Snap[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [adicional, setAdicional] = useState({ nombre: '', tipo: 'PROJECT', valorEstimado: '' })
  const [hijas, setHijas] = useState<{ id: string; nombre: string }[]>([])
  const [padre, setPadre] = useState<{ id: string; nombre: string } | null>(null)

  const cargar = useCallback(async () => {
    try { const d = await apiJson<Snap[]>(`/api/soluciones/${solucionId}/snapshots`); setSnaps(Array.isArray(d) ? d : []) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar las fotografías') }
    finally { setCargando(false) }
  }, [solucionId])
  useEffect(() => { void cargar() }, [cargar])
  useEffect(() => {
    apiJson<{ id: string; nombre: string; parentId: string | null }[]>('/api/soluciones').then(l => {
      const todas = Array.isArray(l) ? l : []
      setHijas(todas.filter(x => x.parentId === solucionId))
      setPadre(parentId ? todas.find(x => x.id === parentId) ?? null : null)
    }).catch(() => undefined)
  }, [solucionId, parentId])

  const urlCliente = tokenCliente && typeof window !== 'undefined' ? `${window.location.origin}/cliente/${tokenCliente}` : ''

  async function paquete(modo: 'descargar' | 'imprimir') {
    setError(''); setOcupado('paquete')
    try {
      const [sol, hitos, riesgos, cambios] = await Promise.all([
        apiJson<Record<string, unknown>>(`/api/soluciones/${solucionId}`),
        apiJson<Record<string, unknown>[]>(`/api/hitos?solucionId=${solucionId}`),
        apiJson<Record<string, unknown>[]>(`/api/riesgos?solucionId=${solucionId}`),
        apiJson<Record<string, unknown>[]>(`/api/soluciones/${solucionId}/cambios`),
      ])
      const datos: DatosPaquete = { solucion: sol, hitos: hitos ?? [], riesgos: riesgos ?? [], cambios: cambios ?? [], cliente: (sol.lead as { companyName?: string } | null)?.companyName ?? (sol.empresa as string | undefined) }
      const html = construirPaquete(datos)
      if (modo === 'descargar') descargarArchivo(`${archivoSeguro(nombre)}_paquete_de_entrega.html`, html)
      else { const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 900) } else setError('El navegador bloqueó la ventana: permite ventanas emergentes para imprimir.') }
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo generar el paquete') }
    finally { setOcupado(null) }
  }

  async function congelar(tipo: 'LINEA_BASE' | 'AS_BUILT' | 'MANUAL') {
    const etiqueta = window.prompt(tipo === 'AS_BUILT' ? 'Etiqueta del as-built (queda congelado tal como está guardado hoy):' : 'Etiqueta de la fotografía:', tipo === 'AS_BUILT' ? 'As-built (entrega)' : tipo === 'LINEA_BASE' ? 'Línea base' : 'Fotografía manual')
    if (etiqueta === null) return
    setError(''); setOcupado(tipo)
    try { await apiJson(`/api/soluciones/${solucionId}/snapshots`, { method: 'POST', body: JSON.stringify({ tipo, etiqueta }) }); await cargar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear la fotografía') }
    finally { setOcupado(null) }
  }
  async function bajarSnap(s: Snap) {
    try { const d = await apiJson<{ contenido: unknown }>(`/api/soluciones/${solucionId}/snapshots/${s.id}`); descargarArchivo(`${archivoSeguro(nombre)}_${s.tipo.toLowerCase()}_${s.createdAt.slice(0, 10)}.json`, JSON.stringify(d.contenido, null, 2), 'application/json') }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo descargar') }
  }

  async function enlace(accion: 'crear' | 'revocar') {
    if (accion === 'revocar' && !window.confirm('El enlace actual dejará de funcionar para el cliente. ¿Continuar?')) return
    setError(''); setOcupado('enlace')
    try {
      if (accion === 'crear') { const r = await apiJson<{ token: string }>(`/api/soluciones/${solucionId}/enlace-cliente`, { method: 'POST' }); onToken(r.token) }
      else { await apiJson(`/api/soluciones/${solucionId}/enlace-cliente`, { method: 'DELETE' }); onToken(null) }
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar el enlace') }
    finally { setOcupado(null) }
  }

  async function crearAdicional() {
    if (!adicional.nombre.trim()) return
    setError(''); setOcupado('adicional')
    try {
      const n = await apiJson<{ id: string }>(`/api/soluciones/${solucionId}/adicional`, { method: 'POST', body: JSON.stringify({ ...adicional, valorEstimado: Number(adicional.valorEstimado) || 0 }) })
      irASolucion(n.id)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear la solución adicional') }
    finally { setOcupado(null) }
  }

  const caja = 'bg-gray-950 border border-gray-800 rounded-xl p-4 space-y-2'
  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-200 text-xs font-medium disabled:opacity-50'
  if (cargando) return <div className="flex justify-center py-8"><Loader2 className="text-cyan-500 animate-spin" size={22} /></div>
  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle size={13} /> {error} <button type="button" onClick={() => setError('')} className="ml-1 text-gray-500"><X size={12} /></button></p>}
      {hayCambios && <p className="text-xs text-amber-300 flex items-center gap-1.5"><AlertTriangle size={13} /> Hay cambios sin guardar: el paquete y las fotografías usan lo guardado. Guarda primero.</p>}

      <div className={caja}>
        <h3 className="text-sm font-semibold text-gray-200">Paquete de entrega</h3>
        <p className="text-xs text-gray-500 leading-relaxed">Un solo documento con el PRD, el diseño técnico, la arquitectura y los diagramas, el plan de ejecución, el cronograma, los hitos con su aceptación, los cambios aprobados, los riesgos y el acta de aceptación para firmar. Sirve como documentación de entrega (as-built).</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void paquete('descargar')} disabled={ocupado !== null} className={btn}>{ocupado === 'paquete' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Descargar (HTML)</button>
          <button type="button" onClick={() => void paquete('imprimir')} disabled={ocupado !== null} className={btn}><Printer size={12} /> Imprimir / PDF</button>
        </div>
      </div>

      <div className={caja}>
        <h3 className="text-sm font-semibold text-gray-200">Fotografías del proyecto</h3>
        <p className="text-xs text-gray-500 leading-relaxed">Copia congelada de todos los documentos, hitos, riesgos y cambios. La <b className="text-gray-400">línea base</b> se crea sola cuando PRD y diseño quedan aprobados; el <b className="text-gray-400">as-built</b> lo congela un administrador al entregar.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void congelar('LINEA_BASE')} disabled={ocupado !== null} className={btn}><Camera size={12} /> Línea base</button>
          {esAdmin && <button type="button" onClick={() => void congelar('AS_BUILT')} disabled={ocupado !== null} className={btn}><Camera size={12} /> Congelar as-built</button>}
          <button type="button" onClick={() => void congelar('MANUAL')} disabled={ocupado !== null} className={btn}><Camera size={12} /> Otra fotografía</button>
        </div>
        {snaps.length === 0 ? <p className="text-xs text-gray-600">Aún no hay fotografías.</p> : (
          <ul className="divide-y divide-white/5">
            {snaps.map(s => (
              <li key={s.id} className="flex items-center gap-2 py-1.5 text-xs">
                <span className="px-1.5 py-0.5 rounded-full border border-gray-700 text-[10px] text-gray-400">{ETIQ_SNAP[s.tipo] ?? s.tipo}</span>
                <span className="flex-1 text-gray-300 truncate">{s.etiqueta}</span>
                <span className="text-gray-500">{s.creadoPorNombre ?? ''} · {fechaCorta(s.createdAt)}</span>
                <button type="button" onClick={() => void bajarSnap(s)} title="Descargar (JSON)" className="text-gray-500 hover:text-cyan-300"><Download size={13} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={caja}>
        <h3 className="text-sm font-semibold text-gray-200">Seguimiento para el cliente</h3>
        <p className="text-xs text-gray-500 leading-relaxed">Un enlace de solo lectura, sin iniciar sesión: el cliente ve la fase del proyecto, el avance, sus hitos con fechas y aceptación y los cambios aprobados. No ve dinero, código, riesgos ni notas internas.</p>
        {tokenCliente ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input readOnly value={urlCliente} onFocus={e => e.currentTarget.select()} className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-gray-300 text-xs" />
              <button type="button" onClick={() => { void navigator.clipboard?.writeText(urlCliente); setCopiado(true); setTimeout(() => setCopiado(false), 1500) }} className={btn}><Copy size={12} /> {copiado ? 'Copiado' : 'Copiar'}</button>
            </div>
            {esAdmin && <div className="flex gap-2">
              <button type="button" onClick={() => void enlace('crear')} disabled={ocupado !== null} className={btn}><Link2 size={12} /> Generar uno nuevo</button>
              <button type="button" onClick={() => void enlace('revocar')} disabled={ocupado !== null} className={btn + ' hover:!text-red-300'}><ShieldOff size={12} /> Revocar</button>
            </div>}
          </div>
        ) : esAdmin ? (
          <button type="button" onClick={() => void enlace('crear')} disabled={ocupado !== null} className={btn}><Link2 size={12} /> Crear enlace para el cliente</button>
        ) : <p className="text-xs text-gray-600">No hay enlace creado (lo crea un administrador).</p>}
      </div>

      <div className={caja}>
        <h3 className="text-sm font-semibold text-gray-200">Solución adicional (fase 2, mantenimiento, ampliación)</h3>
        {padre && <p className="text-xs text-gray-400">Esta solución es un adicional de <button type="button" onClick={() => irASolucion(padre.id)} className="text-orange-300 hover:underline">{padre.nombre}</button>.</p>}
        {hijas.length > 0 && <p className="text-xs text-gray-400">Adicionales: {hijas.map((h, i) => <span key={h.id}>{i > 0 && ', '}<button type="button" onClick={() => irASolucion(h.id)} className="text-orange-300 hover:underline">{h.nombre}</button></span>)}</p>}
        <p className="text-xs text-gray-500 leading-relaxed">Un lead solo puede tener una Solución. Para otra fase del mismo cliente se crea un adicional ligado a esta solución: tiene su propio PRD, plan, hitos y motor de fases, y comparte el cliente.</p>
        <div className="flex flex-wrap gap-2">
          <input value={adicional.nombre} onChange={e => setAdicional({ ...adicional, nombre: e.target.value })} placeholder="Nombre (p. ej. Fase 2 — módulo de reportes)" className="flex-1 min-w-[220px] bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-cyan-500" />
          <select value={adicional.tipo} onChange={e => setAdicional({ ...adicional, tipo: e.target.value })} className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs"><option value="PROJECT">Project</option><option value="DEMO">Demo</option><option value="PARTNERSHIP">Partnership</option></select>
          <input type="number" min="0" value={adicional.valorEstimado} onChange={e => setAdicional({ ...adicional, valorEstimado: e.target.value })} placeholder="Valor" className="w-28 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white placeholder-gray-600 text-xs" />
          <button type="button" onClick={() => void crearAdicional()} disabled={ocupado !== null || !adicional.nombre.trim()} className={btn}>{ocupado === 'adicional' ? <Loader2 size={12} className="animate-spin" /> : <PackagePlus size={12} />} Crear</button>
        </div>
      </div>
    </div>
  )
}
