'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X, History } from 'lucide-react'
import { apiJson, fechaCorta } from './hubApi'

interface V { version: number; motivo: string | null; usuarioId: string | null; chars: number; createdAt: string }

/** Historial del PRD: cada edición guardada deja la versión anterior; se puede traer una al editor (queda sin guardar hasta pulsar Guardar). */
export default function Versiones({ solucionId, onRestaurar, onCerrar }: { solucionId: string; onRestaurar: (contenido: string, version: number) => void; onCerrar: () => void }) {
  const [lista, setLista] = useState<V[] | null>(null)
  const [error, setError] = useState('')
  const [trayendo, setTrayendo] = useState<number | null>(null)
  useEffect(() => {
    apiJson<V[]>(`/api/proyectos/${solucionId}/prd/versiones`).then(l => setLista(Array.isArray(l) ? l : [])).catch(e => setError(e instanceof Error ? e.message : 'No se pudo cargar el historial'))
  }, [solucionId])

  async function traer(v: V) {
    if (!window.confirm(`Traer la versión ${v.version} al editor? Reemplaza lo que ves ahora; no se guarda hasta que pulses «Guardar cambios» (y la versión actual queda en el historial).`)) return
    setTrayendo(v.version)
    try { const d = await apiJson<{ contenido: string }>(`/api/proyectos/${solucionId}/prd/versiones/${v.version}`); onRestaurar(d.contenido, v.version); onCerrar() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo traer la versión') }
    finally { setTrayendo(null) }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onCerrar}>
      <div className="w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-2xl p-5 bg-[#0e0a1c] border border-white/10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2"><History size={15} /> Historial del PRD</h3>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="text-gray-500 hover:text-gray-200"><X size={16} /></button>
        </div>
        {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
        {!lista && !error && <div className="flex justify-center py-6"><Loader2 className="text-cyan-500 animate-spin" size={20} /></div>}
        {lista && lista.length === 0 && <p className="text-xs text-gray-500 py-4">Todavía no hay versiones anteriores: aparecen cuando se guarda una edición del PRD o se confirma la venta.</p>}
        <ul className="divide-y divide-white/5">
          {(lista ?? []).map(v => (
            <li key={v.version} className="flex items-center gap-3 py-2 text-xs">
              <span className="w-8 text-gray-500">v{v.version}</span>
              <span className="flex-1 min-w-0"><span className="block text-gray-300 truncate">{v.motivo ?? 'Versión guardada'}</span><span className="text-gray-500">{fechaCorta(v.createdAt)} · {Math.round(v.chars / 1000)} mil caracteres</span></span>
              <button type="button" onClick={() => void traer(v)} disabled={trayendo !== null} className="px-2.5 py-1 rounded-lg border border-gray-700 text-gray-300 hover:text-white hover:bg-white/5 disabled:opacity-50">{trayendo === v.version ? '…' : 'Traer al editor'}</button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
