'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, AlertTriangle, X } from 'lucide-react'
import { apiJson, usePatchDiferido } from './hubApi'

const SEVERIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA']
const PROBABILIDADES = ['BAJA', 'MEDIA', 'ALTA']
const ESTADOS_RIESGO = ['ABIERTO', 'MITIGADO', 'CERRADO']
const SEVERIDAD_COLOR: Record<string, string> = {
  BAJA: 'border-gray-700', MEDIA: 'border-yellow-700/50', ALTA: 'border-orange-700/60', CRITICA: 'border-red-700/70',
}

interface Riesgo {
  id: string; titulo: string; descripcion: string | null; severidad: string; probabilidad: string
  mitigacion: string | null; estado: string; responsable: string | null
}

export default function Riesgos({ solucionId }: { solucionId: string }) {
  const [riesgos, setRiesgos] = useState<Riesgo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    apiJson<Riesgo[]>(`/api/riesgos?solucionId=${solucionId}`)
      .then(d => setRiesgos(Array.isArray(d) ? d : []))
      .catch(e => setError(e instanceof Error ? e.message : 'No se pudieron cargar los riesgos'))
      .finally(() => setCargando(false))
  }, [solucionId])

  const alFallar = useCallback((m: string) => setError(m), [])
  const urlRiesgo = useCallback((id: string) => `/api/riesgos/${id}`, [])
  const { patch, descartar } = usePatchDiferido(urlRiesgo, alFallar)

  const editar = (id: string, p: Partial<Riesgo>) => {
    setRiesgos(prev => prev.map(r => (r.id === id ? { ...r, ...p } : r)))
    patch(id, p as Record<string, unknown>)
  }
  async function agregar() {
    setError('')
    try { const n = await apiJson<Riesgo>('/api/riesgos', { method: 'POST', body: JSON.stringify({ solucionId, titulo: 'Nuevo riesgo' }) }); setRiesgos(p => [...p, n]) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo crear el riesgo') }
  }
  async function quitar(id: string) {
    if (!window.confirm('¿Eliminar este riesgo?')) return
    descartar(id)
    const antes = riesgos
    setRiesgos(p => p.filter(r => r.id !== id))
    try { await apiJson(`/api/riesgos/${id}`, { method: 'DELETE' }) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo eliminar'); setRiesgos(antes) }
  }

  if (cargando) return <div className="flex justify-center py-8"><Loader2 className="text-cyan-500 animate-spin" size={22} /></div>
  const campo = 'bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 transition-colors'
  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertTriangle size={13} /> {error} <button type="button" onClick={() => setError('')} className="ml-1 text-gray-500 hover:text-gray-300"><X size={12} /></button></p>}
      {riesgos.length === 0 && <p className="text-gray-500 text-sm text-center py-4">Sin riesgos registrados todavía.</p>}
      <div className="space-y-3">
        {riesgos.map(r => (
          <div key={r.id} className={`bg-gray-950 border rounded-xl p-3 space-y-2 ${SEVERIDAD_COLOR[r.severidad] ?? 'border-gray-700'}`}>
            <div className="flex items-center gap-2">
              <input type="text" value={r.titulo} onChange={e => editar(r.id, { titulo: e.target.value })} placeholder="Título del riesgo"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm font-medium focus:outline-none focus:border-cyan-500 transition-colors" />
              <button type="button" onClick={() => void quitar(r.id)} className="w-8 h-8 flex-shrink-0 rounded-lg bg-gray-900 hover:bg-red-900/30 text-gray-500 hover:text-red-400 flex items-center justify-center transition-colors"><Trash2 size={14} /></button>
            </div>
            <textarea value={r.descripcion ?? ''} onChange={e => editar(r.id, { descripcion: e.target.value })} placeholder="Descripción del riesgo" rows={2}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 placeholder-gray-500 text-xs focus:outline-none focus:border-cyan-500 transition-colors resize-y" />
            <div className="grid grid-cols-4 gap-2">
              <select value={r.severidad} onChange={e => editar(r.id, { severidad: e.target.value })} title="Severidad" className={campo + ' cursor-pointer'}>{SEVERIDADES.map(s => <option key={s} value={s}>{s}</option>)}</select>
              <select value={r.probabilidad} onChange={e => editar(r.id, { probabilidad: e.target.value })} title="Probabilidad" className={campo + ' cursor-pointer'}>{PROBABILIDADES.map(p => <option key={p} value={p}>{p}</option>)}</select>
              <select value={r.estado} onChange={e => editar(r.id, { estado: e.target.value })} title="Estado" className={campo + ' cursor-pointer'}>{ESTADOS_RIESGO.map(s => <option key={s} value={s}>{s}</option>)}</select>
              <input type="text" value={r.responsable ?? ''} onChange={e => editar(r.id, { responsable: e.target.value })} placeholder="Responsable" className={campo + ' placeholder-gray-500'} />
            </div>
            <input type="text" value={r.mitigacion ?? ''} onChange={e => editar(r.id, { mitigacion: e.target.value })} placeholder="Mitigación propuesta"
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 placeholder-gray-500 text-xs focus:outline-none focus:border-cyan-500 transition-colors" />
          </div>
        ))}
      </div>
      <button type="button" onClick={() => void agregar()} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/40 text-sm transition-colors">
        <Plus size={14} /> Agregar riesgo
      </button>
    </div>
  )
}
