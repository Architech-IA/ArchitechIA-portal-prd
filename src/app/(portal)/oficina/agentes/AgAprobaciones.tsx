'use client'
import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { api, post, hace } from '../proyectos/api'
import { NIVEL, tarjeta, boton, botonBorde } from './tipos'

// Bandeja de aprobaciones: lo que un agente quiere decir o hacer y está retenido por su nivel de autonomía.
interface Pendiente {
  decisionId: string; agente: string; accion: string; decision: string; fuentes: { tipo?: string; id?: string; ref?: string }[]
  autonomia: string; mensajeId: string; texto: string; hiloId: string; canal: string; persona: string | null; en: string
}

export default function AgAprobaciones({ alCambiar }: { alCambiar: () => void }) {
  const [lista, setLista] = useState<Pendiente[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [trabajando, setTrabajando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null)
    try { setLista(await api<Pendiente[]>('/api/gateway/aprobaciones')) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer la bandeja') }
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  async function decidir(p: Pendiente, accion: 'aprobar' | 'rechazar') {
    setTrabajando(p.decisionId); setError(null); setAviso(null)
    try {
      await post(`/api/gateway/decisiones/${p.decisionId}/decidir`, { accion })
      setAviso(accion === 'aprobar' ? (p.canal === 'PORTAL' ? 'Aprobada.' : `Aprobada. Queda lista para entregarse por ${p.canal.toLowerCase()}.`) : 'Rechazada: no se entregará.')
      await cargar(); alCambiar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo decidir') } finally { setTrabajando(null) }
  }

  return (
    <div className="p-4 space-y-3 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-gray-100">Aprobaciones pendientes</h2>
        <button onClick={() => void cargar()} aria-label="Actualizar" title="Actualizar" className="p-1 rounded hover:bg-white/5"><RefreshCw size={13} /></button>
      </div>
      {error && <p role="alert" className="text-[11px] text-red-300">{error}</p>}
      {aviso && <p role="status" className="text-[11px] text-emerald-300">{aviso}</p>}
      {!lista ? <div className="flex justify-center py-6 text-[#7f8a9c]"><Loader2 className="animate-spin" size={16} /></div>
        : lista.length === 0 ? <p className="text-[12px] text-[#9aa6b8]">No hay nada esperando aprobación.</p>
        : lista.map(p => (
          <article key={p.decisionId} className="rounded-lg p-3 space-y-2" style={tarjeta}>
            <header className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold text-gray-100">{p.agente} · {p.accion}</span>
              <span className="text-[#9aa6b8]">{p.canal.toLowerCase()} · {p.persona ?? 'sin nombre'} · {hace(p.en)} · <span style={{ color: NIVEL[p.autonomia]?.color }}>{NIVEL[p.autonomia]?.txt ?? p.autonomia}</span></span>
            </header>
            <p className="text-[12px] text-gray-200 whitespace-pre-wrap">{p.texto}</p>
            <p className="text-[11px] text-[#9aa6b8]"><b className="text-gray-300">Por qué:</b> {p.decision}</p>
            {p.fuentes.length > 0 && <p className="text-[11px] text-[#9aa6b8]"><b className="text-gray-300">Fuentes:</b> {p.fuentes.map(f => [f.tipo, f.ref ?? f.id].filter(Boolean).join(' ')).join(' · ')}</p>}
            <div className="flex gap-2">
              <button disabled={trabajando === p.decisionId} onClick={() => void decidir(p, 'aprobar')} className={boton} style={botonBorde}>Aprobar</button>
              <button disabled={trabajando === p.decisionId} onClick={() => void decidir(p, 'rechazar')} className={boton} style={{ border: '1px solid rgba(248,113,113,0.4)' }}>Rechazar</button>
            </div>
          </article>))}
    </div>
  )
}
