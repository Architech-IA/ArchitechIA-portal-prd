'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, AlertTriangle, AlertOctagon, Info, Sparkles, CheckCircle2 } from 'lucide-react'
import { apiJson } from './hubApi'

interface Hallazgo { nivel: 'CRITICO' | 'ALERTA' | 'INFO'; area: string; mensaje: string; tab: string }
interface Cruce { faltantes: { promesa: string; motivo: string }[]; extras: { requisito: string; motivo: string }[]; cubiertos?: number; resumen?: string }

const ESTILO = {
  CRITICO: { icono: AlertOctagon, cls: 'border-red-700/50 bg-red-950/20 text-red-300', etiqueta: 'Crítico' },
  ALERTA: { icono: AlertTriangle, cls: 'border-amber-700/50 bg-amber-950/10 text-amber-300', etiqueta: 'Alerta' },
  INFO: { icono: Info, cls: 'border-gray-700 bg-gray-900/40 text-gray-300', etiqueta: 'Aviso' },
} as const

export default function Revision({ solucionId, hayCambios, onIr, tienePropuestas }: {
  solucionId: string; hayCambios: boolean; onIr: (tab: string) => void; tienePropuestas: boolean
}) {
  const [h, setH] = useState<Hallazgo[] | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [cruce, setCruce] = useState<Cruce | null>(null)
  const [cruzando, setCruzando] = useState(false)
  const [errorCruce, setErrorCruce] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true); setError('')
    try { const d = await apiJson<{ hallazgos: Hallazgo[] }>(`/api/soluciones/${solucionId}/coherencia`); setH(d.hallazgos) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo revisar la solución') }
    finally { setCargando(false) }
  }, [solucionId])
  useEffect(() => { void cargar() }, [cargar])

  async function cruzar() {
    setCruzando(true); setErrorCruce(''); setCruce(null)
    try { setCruce(await apiJson<Cruce>(`/api/soluciones/${solucionId}/cruce-propuesta`, { method: 'POST' })) }
    catch (e) { setErrorCruce(e instanceof Error ? e.message : 'No se pudo comparar con la propuesta') }
    finally { setCruzando(false) }
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500 leading-relaxed">
        Revisión automática de que los documentos del proyecto se sostienen entre sí: PRD, diseño, plan, cronograma, hitos, dinero y propuesta. Lee lo <b className="text-gray-400">guardado</b> en la base de datos.
      </p>
      {hayCambios && <p className="text-xs text-amber-300 flex items-center gap-1.5"><AlertTriangle size={13} /> Hay cambios sin guardar: la revisión todavía no los ve. Guarda y vuelve a revisar.</p>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void cargar()} disabled={cargando} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-200 text-xs font-medium disabled:opacity-50">
          {cargando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Revisar de nuevo
        </button>
        {h && <span className="text-[11px] text-gray-500">{h.filter(x => x.nivel === 'CRITICO').length} crítico(s) · {h.filter(x => x.nivel === 'ALERTA').length} alerta(s) · {h.filter(x => x.nivel === 'INFO').length} aviso(s)</span>}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {h && h.length === 0 && <p className="text-emerald-300 text-sm flex items-center gap-1.5"><CheckCircle2 size={15} /> No se encontraron incoherencias.</p>}
      <div className="space-y-2">
        {(['CRITICO', 'ALERTA', 'INFO'] as const).flatMap(n => (h ?? []).filter(x => x.nivel === n)).map((x, i) => {
          const e = ESTILO[x.nivel]; const Ico = e.icono
          return (
            <div key={i} className={`flex items-start gap-2.5 rounded-xl border px-3 py-2 ${e.cls}`}>
              <Ico size={15} className="mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs"><b>{x.area}:</b> <span className="text-gray-200">{x.mensaje}</span></p>
              </div>
              {x.tab && <button type="button" onClick={() => onIr(x.tab)} className="text-[11px] underline decoration-white/30 hover:text-white flex-shrink-0">Ir</button>}
            </div>
          )
        })}
      </div>

      <div className="border-t border-white/5 pt-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-200">Alcance vendido vs. PRD</h3>
        <p className="text-xs text-gray-500">La IA compara lo que prometió la propuesta comercial del lead con los requisitos del PRD guardado: qué se prometió y no está, y qué hay en el PRD que no se prometió (alcance que podría no estar cobrado).</p>
        <button type="button" onClick={() => void cruzar()} disabled={cruzando || !tienePropuestas}
          title={tienePropuestas ? '' : 'Esta solución no tiene un lead con propuestas'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 text-xs font-semibold disabled:opacity-50">
          {cruzando ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {cruzando ? 'Comparando…' : 'Comparar con la propuesta'}
        </button>
        {!tienePropuestas && <p className="text-[11px] text-gray-600">No hay propuestas asociadas al lead de esta solución.</p>}
        {errorCruce && <p className="text-xs text-red-400">{errorCruce}</p>}
        {cruce && (
          <div className="space-y-3 text-xs">
            {cruce.resumen && <p className="text-gray-300 leading-relaxed">{cruce.resumen}</p>}
            <div>
              <p className="font-semibold text-red-300 mb-1">Prometido y sin requisito ({cruce.faltantes?.length ?? 0})</p>
              {(cruce.faltantes ?? []).length === 0 ? <p className="text-gray-500">Nada faltante.</p> : (
                <ul className="space-y-1.5">{cruce.faltantes.map((f, i) => <li key={i} className="rounded-lg border border-red-900/40 bg-red-950/10 px-3 py-1.5"><b className="text-gray-200">{f.promesa}</b><br /><span className="text-gray-500">{f.motivo}</span></li>)}</ul>
              )}
            </div>
            <div>
              <p className="font-semibold text-amber-300 mb-1">En el PRD y no prometido ({cruce.extras?.length ?? 0})</p>
              {(cruce.extras ?? []).length === 0 ? <p className="text-gray-500">Nada extra.</p> : (
                <ul className="space-y-1.5">{cruce.extras.map((f, i) => <li key={i} className="rounded-lg border border-amber-900/40 bg-amber-950/10 px-3 py-1.5"><b className="text-gray-200">{f.requisito}</b><br /><span className="text-gray-500">{f.motivo}</span></li>)}</ul>
              )}
            </div>
            <p className="text-[11px] text-gray-600">Es una ayuda de la IA: confirma cada hallazgo antes de actuar.</p>
          </div>
        )}
      </div>
    </div>
  )
}
