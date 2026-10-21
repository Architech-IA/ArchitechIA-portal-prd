'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import NextLink from 'next/link'
import { Loader2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../proyectos/api'
import { CostoPorSesion } from '../proyectos/ResumenProyecto'

// Oficina > Costos — cuántos tokens gasta cada proyecto (sesiones y ejecutor de tareas), este mes y en total, con su presupuesto.
// El detalle por sesión y los topes se abren al expandir un proyecto (los topes solo los cambian los administradores).

interface Proy { id: string; nombre: string; sesiones: number; total: number; tokensMes: number; presupuesto: number | null }
interface Ejec { id: string; nombre: string; total: number; tokensMes: number; ejecuciones: number }
interface Res { proyectos: Proy[]; ejecutor: Ejec[]; conPrecios: boolean; presupuestoSesionPorDefecto: number | null }

const n = (x: number) => x.toLocaleString('es-CO')
const miles = (x: number) => (x >= 1_000_000 ? `${(x / 1_000_000).toFixed(1)} M` : x >= 1000 ? `${Math.round(x / 1000)} k` : String(x))

function Cifra({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div className="rounded-xl px-4 py-2.5 min-w-[130px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[22px] font-bold leading-none text-gray-100">{miles(valor)}</p>
      <p className="text-[10px] text-[#7f8a9c] mt-1">{etiqueta}</p>
    </div>)
}

export default function CostosView() {
  const [d, setD] = useState<Res | null>(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [abierto, setAbierto] = useState<string | null>(null)
  const cargar = useCallback(async () => {
    setCargando(true)
    try { setD(await api<Res>('/api/costos')); setError('') } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los costos') } finally { setCargando(false) }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  if (!d) return <div className="p-6 text-[12px] text-[#7f8a9c] flex items-center gap-2">{error ? <span className="text-red-300">{error}</span> : <><Loader2 size={14} className="animate-spin" /> Cargando los costos…</>}</div>

  const ejec = new Map(d.ejecutor.map(e => [e.id, e]))
  const ids = new Set([...d.proyectos.map(p => p.id), ...d.ejecutor.map(e => e.id)])
  const filas = [...ids].map(id => {
    const p = d.proyectos.find(x => x.id === id); const e = ejec.get(id)
    return { id, nombre: p?.nombre ?? e?.nombre ?? id, sesiones: p?.sesiones ?? 0, sesMes: p?.tokensMes ?? 0, sesTotal: p?.total ?? 0, ejMes: e?.tokensMes ?? 0, ejTotal: e?.total ?? 0, presupuesto: p?.presupuesto ?? null }
  }).sort((a, b) => (b.sesMes + b.ejMes) - (a.sesMes + a.ejMes) || (b.sesTotal + b.ejTotal) - (a.sesTotal + a.ejTotal))
  const suma = (k: 'sesMes' | 'sesTotal' | 'ejMes' | 'ejTotal') => filas.reduce((a, f) => a + f[k], 0)

  return (
    <div className="h-full overflow-y-auto p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-gray-100">Costos</h2>
          <p className="text-[11px] text-[#7f8a9c]">Tokens que gasta cada proyecto, en sesiones con la IA y en tareas del ejecutor. Abre un proyecto para ver sus sesiones y poner topes.</p>
        </div>
        <span className="flex-1" />
        <button onClick={() => void cargar()} className="flex items-center gap-1.5 text-[11px] text-[#9ca3af] hover:text-gray-100 px-2.5 py-1.5 rounded-lg border border-white/10"><RefreshCw size={12} className={cargando ? 'animate-spin' : ''} /> Actualizar</button>
      </div>
      {error && <p className="text-[11px] text-red-300">{error}</p>}
      <div className="flex flex-wrap gap-2.5">
        <Cifra valor={suma('sesMes') + suma('ejMes')} etiqueta="tokens este mes" />
        <Cifra valor={suma('sesMes')} etiqueta="de sesiones, este mes" />
        <Cifra valor={suma('ejMes')} etiqueta="del ejecutor, este mes" />
        <Cifra valor={suma('sesTotal') + suma('ejTotal')} etiqueta="tokens en total" />
      </div>
      <section className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-left">
            <thead className="text-[#7f8a9c]"><tr className="border-b border-white/5">
              <th className="px-4 py-2 font-medium">Proyecto</th><th className="py-2 pr-3 font-medium">Sesiones</th><th className="py-2 pr-3 font-medium">Este mes</th><th className="py-2 pr-3 font-medium">Total</th><th className="py-2 pr-3 font-medium">Ejecutor (total)</th><th className="py-2 pr-4 font-medium">Presupuesto</th>
            </tr></thead>
            <tbody className="text-gray-300">
              {filas.length === 0 && <tr><td colSpan={6} className="px-4 py-3 text-[#7f8a9c]">Todavía no hay consumo registrado.</td></tr>}
              {filas.map(f => {
                const gastado = f.sesTotal
                const pct = f.presupuesto ? Math.min(100, Math.round((100 * gastado) / f.presupuesto)) : null
                const abierta = abierto === f.id
                return (
                  <Fragment key={f.id}>
                    <tr className="border-t border-white/5 hover:bg-white/[0.03] cursor-pointer" onClick={() => setAbierto(abierta ? null : f.id)}>
                      <td className="px-4 py-2"><span className="flex items-center gap-1.5 text-gray-100">{abierta ? <ChevronDown size={12} /> : <ChevronRight size={12} />}{f.nombre}</span></td>
                      <td className="pr-3">{n(f.sesiones)}</td><td className="pr-3">{n(f.sesMes + f.ejMes)}</td><td className="pr-3">{n(f.sesTotal)}</td><td className="pr-3">{n(f.ejTotal)}</td>
                      <td className="pr-4">{f.presupuesto
                        ? <div className="w-36"><div className="h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: (pct ?? 0) >= 90 ? '#ef4444' : (pct ?? 0) >= 70 ? '#f59e0b' : '#10b981' }} /></div><span className="text-[10px] text-[#9ca3af]">{n(gastado)} de {n(f.presupuesto)}</span></div>
                        : <span className="text-[#7f8a9c]">Sin tope</span>}</td>
                    </tr>
                    {abierta && <tr><td colSpan={6} className="px-4 pb-3"><CostoPorSesion proyectoId={f.id} /><NextLink href={`/oficina?view=proyectos&p=${f.id}`} className="inline-block mt-2 text-[11px] text-indigo-300 hover:text-indigo-200">Abrir el proyecto</NextLink></td></tr>}
                  </Fragment>)
              })}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 border-t border-white/5 text-[10px] text-[#7f8a9c] leading-snug">El presupuesto se compara con los tokens de las sesiones del proyecto (entrada más salida). El ejecutor de tareas se muestra aparte y no consume ese tope.{!d.conPrecios ? ' El costo en dinero aparece cuando se configuran los precios por millón de tokens del proveedor.' : ''}</p>
      </section>
    </div>
  )
}
