'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, EyeOff, Eye, Info } from 'lucide-react'
import { api, patch, hace, type FuenteCtx, type SesionFull } from './api'

const COLOR: Record<string, { punto: string; txt: string; label: string }> = {
  incluida: { punto: '#34d399', txt: 'text-emerald-300', label: 'Incluida' },
  recortada: { punto: '#fbbf24', txt: 'text-amber-300', label: 'Recortada' },
  omitida: { punto: '#f87171', txt: 'text-red-300', label: 'Omitida' },
  vacia: { punto: '#4b5563', txt: 'text-gray-500', label: 'Vacía' },
  excluida: { punto: '#4b5563', txt: 'text-gray-500', label: 'Excluida' },
}

// «Contexto exacto»: muestra qué fuentes recibiría la IA AHORA en esta sesión (leídas vivas de la
// base), su tamaño y su estado, y permite excluir las que no quieras enviar al modelo.
export default function PanelContexto({ proyectoId, sesion, onSesion }: {
  proyectoId: string
  sesion: SesionFull | null
  onSesion: (s: SesionFull) => void
}) {
  const [fuentes, setFuentes] = useState<FuenteCtx[]>([])
  const [total, setTotal] = useState(0)
  const [presupuesto, setPresupuesto] = useState(48000)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const r = await api<{ fuentes: FuenteCtx[]; totalChars: number; presupuesto: number }>(`/api/proyectos/${proyectoId}/contexto${sesion ? `?sesionId=${sesion.id}` : ''}`)
      setFuentes(r.fuentes); setTotal(r.totalChars); setPresupuesto(r.presupuesto)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo leer el contexto') } finally { setCargando(false) }
  }, [proyectoId, sesion?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void cargar() }, [cargar])

  async function alternar(clave: string) {
    if (!sesion || clave === 'ficha') return
    const excl = new Set(sesion.fuentesExcluidas ?? [])
    excl.has(clave) ? excl.delete(clave) : excl.add(clave)
    setGuardando(clave)
    try {
      const s = await patch<SesionFull>(`/api/proyectos/${proyectoId}/sesiones/${sesion.id}`, { fuentesExcluidas: [...excl] })
      onSesion({ ...sesion, ...s }); await cargar()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar') } finally { setGuardando(null) }
  }

  const pct = Math.min(100, Math.round((total / presupuesto) * 100))
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-start gap-2 text-[11px] text-gray-400 rounded-lg px-3 py-2" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)' }}>
        <Info size={13} className="flex-shrink-0 mt-0.5 text-indigo-300" />
        <p>Esto es <b className="text-gray-200">exactamente</b> lo que la IA lee al responder. Se relee de la base en cada mensaje: si cambias el PRD o el backlog, la próxima respuesta ya lo usa. {sesion ? 'Puedes excluir fuentes solo para esta sesión.' : 'Elige una sesión para excluir fuentes.'}</p>
      </div>

      <div>
        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
          <span>{total.toLocaleString('es-CO')} de {presupuesto.toLocaleString('es-CO')} caracteres</span>
          <button onClick={() => void cargar()} className="hover:text-gray-200 flex items-center gap-1"><RefreshCw size={10} className={cargando ? 'animate-spin' : ''} /> Actualizar</button>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 90 ? '#f87171' : pct > 70 ? '#fbbf24' : '#6366f1' }} />
        </div>
      </div>

      {error && <p className="text-[11px] text-red-400">{error}</p>}
      {cargando && fuentes.length === 0 && <div className="flex justify-center py-6 text-gray-500"><Loader2 size={16} className="animate-spin" /></div>}

      <ul className="space-y-1">
        {fuentes.map(f => {
          const c = COLOR[f.estado] ?? COLOR.vacia
          const excl = f.estado === 'excluida'
          return (
            <li key={f.clave} className="flex items-start gap-2 rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.punto }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-medium truncate ${excl || f.estado === 'vacia' ? 'text-gray-500' : 'text-gray-200'}`}>{f.etiqueta}</span>
                  <span className={`text-[9px] ${c.txt}`}>{c.label}</span>
                </div>
                <p className="text-[10px] text-gray-600">
                  {f.chars > 0 ? `${f.chars.toLocaleString('es-CO')} car.` : '—'}
                  {f.actualizado ? ` · act. ${hace(f.actualizado)}` : ''}
                  {f.nota ? ` · ${f.nota}` : ''}
                </p>
              </div>
              {sesion && f.clave !== 'ficha' && (
                <button onClick={() => void alternar(f.clave)} disabled={guardando === f.clave} title={excl ? 'Incluir en el contexto' : 'Excluir de esta sesión'}
                  className="flex-shrink-0 text-gray-500 hover:text-gray-200 mt-0.5 disabled:opacity-40">
                  {guardando === f.clave ? <Loader2 size={12} className="animate-spin" /> : excl ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>)}
            </li>)
        })}
      </ul>
    </div>
  )
}
