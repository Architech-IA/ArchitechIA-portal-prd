'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, AlertTriangle, X, Check, Ban, Hammer } from 'lucide-react'
import { apiJson, dinero, fechaCorta } from './hubApi'

interface Cambio {
  id: string; titulo: string; descripcion: string | null; impactoAlcance: string | null; impactoCosto: number; impactoDias: number
  estado: string; solicitadoPor: string | null; decididoPor: string | null; decididoEn: string | null; decisionNota: string | null; aplicado: boolean; createdAt: string
}
const COLOR: Record<string, string> = {
  SOLICITADA: 'text-sky-300 border-sky-700/50', EN_EVALUACION: 'text-amber-300 border-amber-700/50',
  APROBADA: 'text-emerald-300 border-emerald-700/50', RECHAZADA: 'text-red-300 border-red-700/50', IMPLEMENTADA: 'text-teal-300 border-teal-700/50',
}
const ETIQUETA: Record<string, string> = { SOLICITADA: 'Solicitada', EN_EVALUACION: 'En evaluación', APROBADA: 'Aprobada', RECHAZADA: 'Rechazada', IMPLEMENTADA: 'Implementada' }

export default function Cambios({ solucionId, esAdmin, alCambiarValor }: { solucionId: string; esAdmin: boolean; alCambiarValor: () => void }) {
  const [lista, setLista] = useState<Cambio[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [f, setF] = useState({ titulo: '', descripcion: '', impactoAlcance: '', impactoCosto: '', impactoDias: '' })
  const [enviando, setEnviando] = useState(false)
  // Decisión (aprobar / rechazar) con su nota, en la propia tarjeta y no en un cuadro del navegador
  const [decidiendo, setDecidiendo] = useState<{ id: string; estado: 'APROBADA' | 'RECHAZADA' } | null>(null)
  const [nota, setNota] = useState('')

  const cargar = useCallback(async () => {
    try { const d = await apiJson<Cambio[]>(`/api/soluciones/${solucionId}/cambios`); setLista(Array.isArray(d) ? d : []) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los cambios') }
    finally { setCargando(false) }
  }, [solucionId])
  useEffect(() => { void cargar() }, [cargar])

  async function crear() {
    if (!f.titulo.trim()) return
    setEnviando(true); setError('')
    try {
      await apiJson(`/api/soluciones/${solucionId}/cambios`, { method: 'POST', body: JSON.stringify({ ...f, impactoCosto: Number(f.impactoCosto) || 0, impactoDias: Number(f.impactoDias) || 0 }) })
      setF({ titulo: '', descripcion: '', impactoAlcance: '', impactoCosto: '', impactoDias: '' }); setAbierto(false); await cargar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo registrar el cambio') }
    finally { setEnviando(false) }
  }
  async function decidir(c: Cambio, estado: string, decisionNota?: string) {
    setError('')
    try {
      await apiJson(`/api/cambios/${c.id}`, { method: 'PUT', body: JSON.stringify({ estado, ...(decisionNota !== undefined ? { decisionNota: decisionNota || null } : {}) }) })
      setDecidiendo(null); setNota('')
      await cargar(); alCambiarValor()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar la decisión') }
  }

  async function borrar(c: Cambio) {
    if (!window.confirm('¿Eliminar esta solicitud?')) return
    try { await apiJson(`/api/cambios/${c.id}`, { method: 'DELETE' }); await cargar() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar') }
  }

  if (cargando) return <div className="flex justify-center py-8"><Loader2 className="text-cyan-500 animate-spin" size={22} /></div>
  const campo = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-cyan-500'
  const totalAprobado = lista.filter(c => c.aplicado).reduce((a, c) => a + c.impactoCosto, 0)
  const diasAprobados = lista.filter(c => c.estado === 'APROBADA' || c.estado === 'IMPLEMENTADA').reduce((a, c) => a + c.impactoDias, 0)
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 leading-relaxed">
        Cualquier cambio de alcance pasa por aquí: se describe, se estima su costo y su plazo, y un administrador lo aprueba o lo rechaza. Al aprobarlo, su costo se suma al valor del proyecto y queda registrado quién decidió y cuándo.
        {lista.length > 0 && <> Cambios aprobados hasta hoy: <b className="text-gray-300">{dinero(totalAprobado)}</b> y <b className="text-gray-300">{diasAprobados}</b> día(s) de plazo.</>}
      </p>
      {error && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle size={13} /> {error} <button type="button" onClick={() => setError('')} className="ml-1 text-gray-500 hover:text-gray-300"><X size={12} /></button></p>}
      {abierto ? (
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-3 space-y-2">
          <input value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} placeholder="¿Qué cambia? (título corto)" className={campo} />
          <textarea value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} placeholder="Descripción: qué pide el cliente y por qué" rows={2} className={campo + ' resize-y'} />
          <textarea value={f.impactoAlcance} onChange={e => setF({ ...f, impactoAlcance: e.target.value })} placeholder="Impacto en el alcance: requisitos, pantallas o integraciones que se agregan, cambian o salen" rows={2} className={campo + ' resize-y'} />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="any" value={f.impactoCosto} onChange={e => setF({ ...f, impactoCosto: e.target.value })} placeholder="Costo adicional (en la moneda del proyecto)" className={campo} />
            <input type="number" value={f.impactoDias} onChange={e => setF({ ...f, impactoDias: e.target.value })} placeholder="Días adicionales de plazo" className={campo} />
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={enviando || !f.titulo.trim()} onClick={() => void crear()} className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold disabled:opacity-40">{enviando ? 'Enviando…' : 'Registrar solicitud'}</button>
            <button type="button" onClick={() => setAbierto(false)} className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 text-xs">Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAbierto(true)} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40 text-sm"><Plus size={14} /> Nueva solicitud de cambio</button>
      )}
      {lista.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Sin solicitudes de cambio.</p>}
      {lista.map(c => (
        <div key={c.id} className="bg-gray-950 border border-gray-800 rounded-xl p-3 space-y-1.5">
          <div className="flex items-start gap-2">
            <p className="flex-1 text-sm font-semibold text-gray-100">{c.titulo}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${COLOR[c.estado] ?? 'text-gray-400 border-gray-700'}`}>{ETIQUETA[c.estado] ?? c.estado}</span>
          </div>
          {c.descripcion && <p className="text-xs text-gray-400 whitespace-pre-line">{c.descripcion}</p>}
          {c.impactoAlcance && <p className="text-xs text-gray-500 whitespace-pre-line"><b className="text-gray-400">Alcance:</b> {c.impactoAlcance}</p>}
          <p className="text-[11px] text-gray-500">
            Costo {c.impactoCosto ? dinero(c.impactoCosto) : '—'} · Plazo {c.impactoDias ? `+${c.impactoDias} día(s)` : '—'} · Pidió {c.solicitadoPor ?? '—'} el {fechaCorta(c.createdAt)}
            {c.decididoPor && <> · Decidió {c.decididoPor} el {fechaCorta(c.decididoEn)}</>}
            {c.aplicado && <span className="text-emerald-400"> · ya sumado al valor del proyecto</span>}
          </p>
          {c.decisionNota && <p className="text-[11px] text-gray-400 italic">«{c.decisionNota}»</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            {esAdmin && c.estado !== 'APROBADA' && c.estado !== 'IMPLEMENTADA' && <button type="button" onClick={() => { setDecidiendo({ id: c.id, estado: 'APROBADA' }); setNota('') }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-800/60 hover:bg-emerald-700/60 text-emerald-100 text-[11px]"><Check size={11} /> Aprobar</button>}
            {esAdmin && c.estado !== 'RECHAZADA' && c.estado !== 'IMPLEMENTADA' && <button type="button" onClick={() => { setDecidiendo({ id: c.id, estado: 'RECHAZADA' }); setNota('') }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-900/40 hover:bg-red-800/50 text-red-200 text-[11px]"><Ban size={11} /> Rechazar</button>}
            {esAdmin && c.estado === 'APROBADA' && <button type="button" onClick={() => void decidir(c, 'IMPLEMENTADA')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-900/50 hover:bg-teal-800/50 text-teal-200 text-[11px]"><Hammer size={11} /> Marcar implementada</button>}
            {c.estado === 'SOLICITADA' && <button type="button" onClick={() => void apiJson(`/api/cambios/${c.id}`, { method: 'PUT', body: JSON.stringify({ estado: 'EN_EVALUACION' }) }).then(cargar).catch(e => setError(e instanceof Error ? e.message : 'Error'))} className="px-2.5 py-1 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 text-[11px]">Pasar a evaluación</button>}
            {!c.aplicado && <button type="button" onClick={() => void borrar(c)} className="px-2.5 py-1 rounded-lg text-gray-500 hover:text-red-400 text-[11px] ml-auto">Eliminar</button>}
          </div>
          {decidiendo?.id === c.id && (
            <div className="rounded-lg border border-gray-700 p-2 space-y-1.5">
              <p className="text-[11px] text-gray-400">
                {decidiendo.estado === 'APROBADA'
                  ? `Aprobar «${c.titulo}»${c.impactoCosto ? ` — se suma ${dinero(c.impactoCosto)} al valor del proyecto` : ''}.`
                  : `Rechazar «${c.titulo}».`}
              </p>
              <input value={nota} onChange={e => setNota(e.target.value)} placeholder={decidiendo.estado === 'APROBADA' ? 'Nota de la decisión (opcional)' : 'Motivo del rechazo'} className={campo} />
              <div className="flex gap-2">
                <button type="button" onClick={() => void decidir(c, decidiendo.estado, nota.trim())} disabled={decidiendo.estado === 'RECHAZADA' && !nota.trim()}
                  className={`px-3 py-1 rounded-lg text-white text-xs font-semibold disabled:opacity-40 ${decidiendo.estado === 'APROBADA' ? 'bg-emerald-700 hover:bg-emerald-600' : 'bg-red-800 hover:bg-red-700'}`}>
                  Confirmar {decidiendo.estado === 'APROBADA' ? 'aprobación' : 'rechazo'}
                </button>
                <button type="button" onClick={() => setDecidiendo(null)} className="px-3 py-1 rounded-lg border border-gray-700 text-gray-400 text-xs">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
