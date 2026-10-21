'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { post } from './api'

// Tipo del proyecto (Solución): de él sale su naturaleza (comercial o interno) y, con ella, la plantilla de fases.
// Cambiar a otra naturaleza con el motor ya iniciado lo reinicia con la plantilla nueva: el servidor avisa y se pide confirmación.

const TIPOS: { valor: string; etiqueta: string; interno: boolean }[] = [
  { valor: 'PROJECT', etiqueta: 'Proyecto', interno: false }, { valor: 'DEMO', etiqueta: 'Demo', interno: false }, { valor: 'PARTNERSHIP', etiqueta: 'Alianza', interno: false },
  { valor: 'PRODUCT', etiqueta: 'Producto propio', interno: true }, { valor: 'INTERN', etiqueta: 'Mejora interna', interno: true },
]

export default function TipoProyecto({ proyectoId, tipo, onCambio }: { proyectoId: string; tipo: string; onCambio: () => void }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const actual = TIPOS.find(t => t.valor === tipo)
  async function cambiar(nuevo: string) {
    if (nuevo === tipo) return
    setOcupado(true); setError('')
    try {
      const url = `/api/proyectos/${proyectoId}/tipo`
      const r = await post<{ requiereConfirmacion?: boolean; mensaje?: string }>(url, { tipo: nuevo })
      if (r.requiereConfirmacion) {
        if (window.confirm(r.mensaje ?? 'Esto reinicia el motor de fases con otra plantilla. ¿Continuar?')) await post(url, { tipo: nuevo, reiniciar: true })
      }
      onCambio()
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cambiar el tipo') } finally { setOcupado(false) }
  }
  return (
    <span className="inline-flex items-center gap-1 flex-shrink-0">
      <select value={tipo} disabled={ocupado} onChange={e => void cambiar(e.target.value)} aria-label="Tipo del proyecto" title={error || 'Tipo del proyecto: define si es comercial o interno y su plantilla de fases'}
        className="text-[10px] rounded-full px-2 py-0.5 outline-none cursor-pointer disabled:opacity-60"
        style={actual?.interno ? { background: 'rgba(168,85,247,0.2)', color: '#d8b4fe', border: '1px solid rgba(168,85,247,0.35)' } : { background: 'rgba(255,255,255,0.07)', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)' }}>
        {!actual && <option value={tipo}>{tipo}</option>}
        {TIPOS.map(t => <option key={t.valor} value={t.valor} style={{ background: '#111827', color: '#e5e7eb' }}>{t.interno ? 'Interno' : 'Comercial'} · {t.etiqueta}</option>)}
      </select>
      {ocupado && <Loader2 size={11} className="animate-spin text-[#7f8a9c]" />}
      {error && <span className="text-[10px] text-red-300 max-w-[200px] truncate" title={error}>{error}</span>}
    </span>)
}
