'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Play, Trash2, Plus, Radio } from 'lucide-react'
import { TIPOS_SUSCRIPCION, ETIQUETA_SUSCRIPCION, DESCRIPCION_SUSCRIPCION, type TipoSuscripcion } from '@/lib/proyectos/tipos'
import { api, post, patch, del, hace, type Suscripcion } from './api'

const INTERVALOS: { min: number; txt: string }[] = [
  { min: 10, txt: 'Cada 10 min' }, { min: 30, txt: 'Cada 30 min' }, { min: 60, txt: 'Cada hora' }, { min: 360, txt: 'Cada 6 horas' },
  { min: 1440, txt: 'Cada día' }, { min: 10080, txt: 'Cada semana' },
]

// Disparadores: el servidor revisa cada 10 minutos y, cuando toca, publica novedades en la Bitácora del proyecto.
export default function PanelAuto({ proyectoId, onAbrirBitacora, onCambio }: { proyectoId: string; onAbrirBitacora: () => void; onCambio?: () => void }) {
  const [lista, setLista] = useState<Suscripcion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ocupada, setOcupada] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    try { setLista(await api<Suscripcion[]>(`/api/proyectos/${proyectoId}/suscripciones`)) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar') } finally { setCargando(false) }
  }, [proyectoId])
  useEffect(() => { setCargando(true); void cargar() }, [cargar])

  const faltan = (TIPOS_SUSCRIPCION as readonly string[]).filter(t => !lista.some(s => s.tipo === t)) as TipoSuscripcion[]

  async function accion(id: string, fn: () => Promise<unknown>) {
    setOcupada(id); setError(null)
    try { await fn(); await cargar(); onCambio?.() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar') } finally { setOcupada(null) }
  }

  return (
    <div className="p-3 space-y-3">
      <p className="text-[11px] text-gray-500">Automatizaciones que vigilan el proyecto y <b className="text-gray-300">publican las novedades en su Bitácora</b> (una sesión más, que también puedes consultar con la IA). El servidor las revisa cada 10 minutos.</p>
      <button onClick={onAbrirBitacora} className="flex items-center gap-1.5 text-[11px] text-indigo-300 hover:text-indigo-200 underline underline-offset-2"><Radio size={12} /> Abrir la Bitácora</button>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {cargando && <div className="flex justify-center py-4 text-gray-500"><Loader2 size={14} className="animate-spin" /></div>}

      <ul className="space-y-2">
        {lista.map(s => (
          <li key={s.id} className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${s.activa ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.06)'}` }}>
            <div className="flex items-center gap-2">
              <span className="flex-1 text-[12px] font-medium text-gray-200">{ETIQUETA_SUSCRIPCION[s.tipo as TipoSuscripcion] ?? s.tipo}</span>
              <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
                <input type="checkbox" checked={s.activa} disabled={ocupada === s.id} onChange={e => void accion(s.id, () => patch(`/api/proyectos/${proyectoId}/suscripciones/${s.id}`, { activa: e.target.checked }))} className="accent-indigo-500" /> Activa
              </label>
            </div>
            <p className="text-[10px] text-gray-600">{DESCRIPCION_SUSCRIPCION[s.tipo as TipoSuscripcion]}</p>
            <div className="flex items-center gap-2">
              <select value={INTERVALOS.some(i => i.min === s.intervaloMin) ? s.intervaloMin : ''} disabled={ocupada === s.id}
                onChange={e => void accion(s.id, () => patch(`/api/proyectos/${proyectoId}/suscripciones/${s.id}`, { intervaloMin: Number(e.target.value) }))}
                className="text-[10px] rounded-md px-1.5 py-1 text-gray-300 outline-none" style={{ background: 'rgba(255,255,255,0.06)' }}>
                {!INTERVALOS.some(i => i.min === s.intervaloMin) && <option value="">{s.intervaloMin} min</option>}
                {INTERVALOS.map(i => <option key={i.min} value={i.min}>{i.txt}</option>)}
              </select>
              <span className="flex-1" />
              <button onClick={() => void accion(s.id, () => post(`/api/proyectos/${proyectoId}/suscripciones/${s.id}/ejecutar`))} disabled={ocupada === s.id}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-indigo-200 disabled:opacity-40" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)' }}>
                {ocupada === s.id ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />} Ejecutar ahora
              </button>
              <button onClick={() => window.confirm('¿Eliminar esta automatización?') && void accion(s.id, () => del(`/api/proyectos/${proyectoId}/suscripciones/${s.id}`))} className="text-gray-600 hover:text-red-400"><Trash2 size={12} /></button>
            </div>
            <p className="text-[10px] text-gray-500">{s.ultimaEjecucion ? `Última: ${hace(s.ultimaEjecucion)} — ${s.ultimoResultado ?? ''}` : 'Aún no se ha ejecutado'}</p>
          </li>))}
      </ul>

      {faltan.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-gray-600 font-semibold">Agregar</p>
          {faltan.map(t => (
            <button key={t} onClick={() => void accion(t, () => post(`/api/proyectos/${proyectoId}/suscripciones`, { tipo: t }))} disabled={ocupada === t}
              className="w-full text-left rounded-lg px-3 py-2 hover:bg-white/5 flex items-start gap-2 disabled:opacity-50" style={{ border: '1px dashed rgba(255,255,255,0.12)' }}>
              {ocupada === t ? <Loader2 size={13} className="animate-spin mt-0.5 text-gray-500" /> : <Plus size={13} className="mt-0.5 text-indigo-300" />}
              <span><span className="block text-[11px] text-gray-300">{ETIQUETA_SUSCRIPCION[t]}</span><span className="block text-[10px] text-gray-600">{DESCRIPCION_SUSCRIPCION[t]}</span></span>
            </button>))}
        </div>)}
    </div>
  )
}
