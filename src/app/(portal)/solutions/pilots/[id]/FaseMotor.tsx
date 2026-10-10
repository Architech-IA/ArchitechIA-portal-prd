'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, CheckCircle2, Circle, Play, ArrowUpRight } from 'lucide-react'
import { apiJson } from './hubApi'

interface FaseV { clave: string; numero: number; nombre: string; bloque: string; estado: 'HECHA' | 'ACTUAL' | 'PENDIENTE' | 'CERRADA' }
interface Res { iniciado: boolean; plantilla?: { nombre: string }; estado?: string; faseActual?: string; fases?: FaseV[] }

/** Una sola línea de vida del proyecto: la del motor de fases. Aquí solo se muestra dónde va y se enlaza a su vista. */
export default function FaseMotor({ solucionId, esAdmin, glass }: { solucionId: string; esAdmin: boolean; glass: React.CSSProperties }) {
  const [d, setD] = useState<Res | null>(null)
  const [error, setError] = useState('')
  const [iniciando, setIniciando] = useState(false)
  const cargar = useCallback(() => { apiJson<Res>(`/api/proyectos/${solucionId}/fases`).then(setD).catch(e => setError(e instanceof Error ? e.message : 'Error')) }, [solucionId])
  useEffect(() => { cargar() }, [cargar])

  async function iniciar() {
    setIniciando(true); setError('')
    try { await apiJson(`/api/proyectos/${solucionId}/fases/iniciar`, { method: 'POST', body: JSON.stringify({}) }); cargar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo iniciar') }
    finally { setIniciando(false) }
  }

  const fases = d?.fases ?? []
  const actual = fases.find(f => f.clave === d?.faseActual)
  return (
    <div className="rounded-2xl p-4" style={glass}>
      <p className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Fase del proyecto</p>
      {!d && !error && <Loader2 size={14} className="animate-spin text-gray-600" />}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {d && !d.iniciado && (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-500">El motor de fases todavía no está iniciado para esta solución.</p>
          {esAdmin && <button type="button" onClick={() => void iniciar()} disabled={iniciando} className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 text-[11px] text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50">{iniciando ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />} Iniciar motor</button>}
        </div>
      )}
      {d?.iniciado && (
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-gray-100">{d.estado === 'COMPLETADO' ? 'Proyecto completado' : d.estado === 'CERRADO_PERDIDO' ? 'Cerrado (venta perdida)' : actual ? `${actual.numero}. ${actual.nombre}` : '—'}</p>
          <p className="text-[11px] text-gray-500">{actual ? `Fase ${actual.numero} de ${fases.length} · ${actual.bloque.toLowerCase()}` : d.plantilla?.nombre}</p>
          <div className="flex flex-wrap gap-1">
            {fases.map(f => (
              <span key={f.clave} title={`${f.numero}. ${f.nombre}`}>
                {f.estado === 'HECHA' ? <CheckCircle2 size={13} className="text-emerald-400" /> : f.estado === 'ACTUAL' ? <Circle size={13} className="text-orange-400 fill-orange-400/40" /> : <Circle size={13} className="text-gray-700" />}
              </span>
            ))}
          </div>
          <a href={`/oficina?view=proyectos&p=${solucionId}`} className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 text-[11px] text-indigo-300 hover:text-indigo-200 hover:bg-indigo-500/10">
            Ver y mover las fases <ArrowUpRight size={11} />
          </a>
        </div>
      )}
    </div>
  )
}
