'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'

/** Las notas y el diagrama del lead ahora viven en su proyecto: manda hacia allá. */
export default function AvisoProyecto({ leadId }: { leadId: string }) {
  const [sol, setSol] = useState<string | null | undefined>(undefined)
  useEffect(() => { fetch(`/api/leads/${leadId}/proyecto`).then(r => (r.ok ? r.json() : null)).then(d => setSol(d?.solucionId ?? null)).catch(() => setSol(null)) }, [leadId])
  return (
    <div className="p-8 flex flex-col items-center text-center gap-3 max-w-xl mx-auto">
      <p className="text-sm font-semibold text-slate-200">Las notas y el diagrama de este lead ahora están en su proyecto</p>
      <p className="text-xs text-slate-400 leading-relaxed">Cada fase del proyecto tiene sus notas y sus archivos, y la arquitectura es el artefacto del proyecto. Aquí quedan las interacciones y la propuesta del lead.</p>
      {sol === undefined && <Loader2 size={16} className="animate-spin text-slate-500" />}
      {sol && <a href={`/oficina?view=proyectos&p=${sol}`} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>Abrir el proyecto <ArrowRight size={13} /></a>}
      {sol === null && <p className="text-xs text-amber-300">Este lead todavía no tiene un proyecto.</p>}
    </div>
  )
}
