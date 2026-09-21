'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Loader2, Search, MessageSquare, FileText, Brain } from 'lucide-react'
import { api, hace, type ResultadoBusqueda } from './api'

const ICONO = { MENSAJE: MessageSquare, ADJUNTO: FileText, MEMORIA: Brain }
const ETIQ = { MENSAJE: 'Sesión', ADJUNTO: 'Adjunto', MEMORIA: 'Memoria' }

// Resalta lo que el buscador marcó entre «…»
function resaltar(t: string): ReactNode[] {
  return t.split(/(«[^»]*»)/g).map((p, i) => (p.startsWith('«') ? <mark key={i} className="bg-indigo-500/30 text-indigo-100 rounded px-0.5">{p.slice(1, -1)}</mark> : p))
}

// Búsqueda de texto completo (en español) en todas las sesiones visibles, adjuntos y memoria.
export default function PanelBuscar({ proyectoId, onAbrirSesion, onAbrirPanel }: {
  proyectoId: string
  onAbrirSesion: (id: string) => void
  onAbrirPanel: (p: 'memoria' | 'adjuntos') => void
}) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<ResultadoBusqueda[] | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (q.trim().length < 2) { setRes(null); return }
    const t = setTimeout(async () => {
      setCargando(true); setError(null)
      try { setRes(await api<ResultadoBusqueda[]>(`/api/proyectos/${proyectoId}/buscar?q=${encodeURIComponent(q.trim())}`)) }
      catch (e) { setError(e instanceof Error ? e.message : 'No se pudo buscar') } finally { setCargando(false) }
    }, 350)
    return () => clearTimeout(t)
  }, [q, proyectoId])

  return (
    <div className="p-3 space-y-3">
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-2.5 text-gray-500" />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar en sesiones, adjuntos y memoria…"
          className="w-full rounded-xl pl-8 pr-3 py-2 text-[12px] text-gray-200 outline-none border border-white/10 focus:border-indigo-500/50 placeholder-gray-600" style={{ background: 'rgba(255,255,255,0.05)' }} />
        {cargando && <Loader2 size={12} className="absolute right-2.5 top-3 animate-spin text-gray-500" />}
      </div>
      <p className="text-[10px] text-gray-600">Búsqueda por palabras (español: entiende plurales y conjugaciones). Solo ves las sesiones compartidas y las tuyas.</p>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {res && res.length === 0 && !cargando && <p className="text-[11px] text-gray-500 text-center py-4">Sin resultados para «{q}».</p>}
      <ul className="space-y-1.5">
        {(res ?? []).map(r => {
          const Ic = ICONO[r.tipo]
          return (
            <li key={`${r.tipo}${r.id}`}>
              <button onClick={() => (r.tipo === 'MENSAJE' && r.sesionId ? onAbrirSesion(r.sesionId) : r.tipo === 'MEMORIA' ? onAbrirPanel('memoria') : onAbrirPanel('adjuntos'))}
                className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-white/5" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-0.5"><Ic size={11} className="text-indigo-300" /><span className="text-gray-300 font-medium truncate flex-1">{r.titulo}</span><span>{ETIQ[r.tipo]} · {hace(r.fecha)}</span></div>
                <p className="text-[11px] text-gray-400 leading-snug">{resaltar(r.fragmento)}</p>
              </button>
            </li>)
        })}
      </ul>
    </div>
  )
}
