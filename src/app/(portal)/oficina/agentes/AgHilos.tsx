'use client'
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api, hace, fechaHora } from '../proyectos/api'
import { NIVEL, CANALES, campo, borde, tarjeta, etiqueta } from './tipos'

// Trazabilidad: los hilos de los agentes, sin importar el canal, con cada decisión y las fuentes en que se apoyó.
interface Hilo { id: string; canal: string; agente: string; persona: string | null; personaTipo: string | null; asunto: string | null; estado: string; ultimoEn: string; mensajes: number; pendientes: number }
interface Decision { accion: string; decision: string; fuentes: { tipo?: string; id?: string; ref?: string }[]; autonomiaAplicada: string; estado: string; decididoPor: string | null }
interface Msg { id: string; direccion: string; autor: string; agente: string | null; persona: string | null; texto: string; estado: string; en: string; decision: Decision | null }
interface Detalle { hilo: { id: string; canal: string; agente: string; persona: string | null; asunto: string | null; solucionId: string | null }; mensajes: Msg[] }

const ESTADO: Record<string, string> = { ENTREGABLE: 'listo para entregar', PENDIENTE_APROBACION: 'esperando aprobación', RECHAZADO: 'rechazado', ENTREGADO: 'entregado' }

export default function AgHilos({ agentes }: { agentes: { slug: string; nombre: string }[] }) {
  const [filtroAgente, setFiltroAgente] = useState(''); const [filtroCanal, setFiltroCanal] = useState('')
  const [lista, setLista] = useState<Hilo[] | null>(null)
  const [det, setDet] = useState<Detalle | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setError(null); setLista(null)
    try { setLista(await api<Hilo[]>(`/api/gateway/hilos?agente=${encodeURIComponent(filtroAgente)}&canal=${filtroCanal}`)) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron leer los hilos') }
  }, [filtroAgente, filtroCanal])
  useEffect(() => { void cargar() }, [cargar])

  async function abrir(id: string) {
    setError(null)
    try { setDet(await api<Detalle>(`/api/gateway/hilos/${id}`)) } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir el hilo') }
  }

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-0">
      <div className="lg:w-[360px] flex-shrink-0 p-3 space-y-2 overflow-y-auto lg:border-r border-white/5">
        <div className="grid grid-cols-2 gap-2">
          <label><span className={etiqueta}>Agente</span><select className={campo} style={borde} value={filtroAgente} onChange={e => setFiltroAgente(e.target.value)}><option value="" style={{ color: '#111' }}>Todos</option>{agentes.map(a => <option key={a.slug} value={a.slug} style={{ color: '#111' }}>{a.nombre}</option>)}</select></label>
          <label><span className={etiqueta}>Canal</span><select className={campo} style={borde} value={filtroCanal} onChange={e => setFiltroCanal(e.target.value)}><option value="" style={{ color: '#111' }}>Todos</option>{CANALES.map(c => <option key={c} value={c} style={{ color: '#111' }}>{c.toLowerCase()}</option>)}</select></label>
        </div>
        {error && <p role="alert" className="text-[11px] text-red-300">{error}</p>}
        {!lista ? <div className="flex justify-center py-6 text-[#7f8a9c]"><Loader2 className="animate-spin" size={16} /></div>
          : lista.length === 0 ? <p className="text-[11px] text-[#9aa6b8]">Todavía no hay hilos.</p>
          : lista.map(h => (
            <button key={h.id} onClick={() => void abrir(h.id)} className="w-full text-left rounded-lg px-3 py-2 hover:bg-white/5" style={{ ...tarjeta, borderColor: det?.hilo.id === h.id ? 'rgba(167,139,250,0.5)' : undefined }}>
              <div className="flex justify-between gap-2 text-[11px]"><span className="font-semibold text-gray-100 truncate">{h.agente} · {h.canal.toLowerCase()}</span><span className="text-[#7f8a9c] flex-shrink-0">{hace(h.ultimoEn)}</span></div>
              <div className="text-[11px] text-[#9aa6b8] truncate">{h.persona ?? 'sin nombre'}{h.personaTipo ? ` (${h.personaTipo.toLowerCase()})` : ''} · {h.mensajes} mensajes{h.pendientes ? ` · ${h.pendientes} por aprobar` : ''}</div>
              {h.asunto && <div className="text-[11px] text-gray-300 truncate">{h.asunto}</div>}
            </button>))}
      </div>
      <div className="flex-1 min-w-0 p-4 overflow-y-auto">
        {!det ? <p className="text-[12px] text-[#7f8a9c]">Elige un hilo para ver cada mensaje, su agente, su decisión y sus fuentes.</p> : (
          <div className="space-y-3 max-w-3xl">
            <h2 className="text-[13px] font-semibold text-gray-100">{det.hilo.agente} con {det.hilo.persona ?? 'alguien'} · {det.hilo.canal.toLowerCase()}</h2>
            {det.mensajes.map(m => (
              <article key={m.id} className="rounded-lg p-3 space-y-1.5" style={{ ...tarjeta, marginLeft: m.direccion === 'SALIDA' ? 24 : 0 }}>
                <header className="flex justify-between gap-2 text-[10.5px] text-[#7f8a9c]"><span>{m.autor === 'AGENTE' ? `Agente ${m.agente}` : (m.persona ?? 'Persona')}</span><span>{fechaHora(m.en)}{m.direccion === 'SALIDA' ? ` · ${ESTADO[m.estado] ?? m.estado.toLowerCase()}` : ''}</span></header>
                <p className="text-[12px] text-gray-200 whitespace-pre-wrap">{m.texto}</p>
                {m.decision && (
                  <footer className="text-[11px] text-[#9aa6b8] border-t border-white/5 pt-1.5 space-y-0.5">
                    <p><b className="text-gray-300">Decisión ({m.decision.accion}):</b> {m.decision.decision}</p>
                    {m.decision.fuentes.length > 0 && <p><b className="text-gray-300">Fuentes:</b> {m.decision.fuentes.map(f => [f.tipo, f.ref ?? f.id].filter(Boolean).join(' ')).join(' · ')}</p>}
                    <p>Autonomía: <span style={{ color: NIVEL[m.decision.autonomiaAplicada]?.color }}>{NIVEL[m.decision.autonomiaAplicada]?.txt ?? m.decision.autonomiaAplicada}</span> · {m.decision.estado.toLowerCase().replace(/_/g, ' ')}{m.decision.decididoPor ? ` por ${m.decision.decididoPor}` : ''}</p>
                  </footer>)}
              </article>))}
          </div>)}
      </div>
    </div>
  )
}
