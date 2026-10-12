'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

// El Lead Hub ya no existe: todo lo que tenía vive en el proyecto del lead (Oficina › Proyectos). Esta ruta solo lleva hacia allá
// para que los enlaces y marcadores antiguos sigan funcionando.
export default function LeadHubRedirect() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [estado, setEstado] = useState<'buscando' | 'sin_proyecto' | 'error'>('buscando')
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    let vivo = true
    fetch(`/api/leads/${id}/proyecto`)
      .then(async r => {
        if (!vivo) return
        if (r.ok) { const d = await r.json(); router.replace(`/oficina?view=proyectos&p=${d.solucionId}`) }
        else if (r.status === 404) { setEstado('sin_proyecto') }
        else { setEstado('error') }
      })
      .catch(() => { if (vivo) setEstado('error') })
    return () => { vivo = false }
  }, [id, router])

  async function crear() {
    setCreando(true)
    try {
      const r = await fetch(`/api/motor/leads/${id}/iniciar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const d = await r.json().catch(() => null)
      if (r.ok && d?.solucionId) router.replace(`/oficina?view=proyectos&p=${d.solucionId}`)
      else { setEstado('error'); setCreando(false) }
    } catch { setEstado('error'); setCreando(false) }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center p-10 min-h-[50vh]">
      {estado === 'buscando' && <><Loader2 size={20} className="animate-spin text-slate-500" /><p className="text-xs text-slate-400">Abriendo el proyecto del lead…</p></>}
      {estado === 'sin_proyecto' && (<>
        <p className="text-sm font-semibold text-slate-200">Este lead todavía no tiene proyecto</p>
        <p className="text-xs text-slate-400 max-w-md">El Lead Hub ya no existe: el trabajo de cada lead se hace en su proyecto. Puedes crearlo ahora (requiere ser administrador).</p>
        <button onClick={() => void crear()} disabled={creando} className="px-4 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>{creando ? 'Creando…' : 'Crear el proyecto'}</button>
      </>)}
      {estado === 'error' && <p className="text-xs text-red-300">No se pudo abrir el proyecto de este lead. Inténtalo de nuevo.</p>}
    </div>
  )
}
