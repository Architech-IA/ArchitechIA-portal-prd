'use client'

import { useEffect, useState } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'
import { api } from './api'

// El lead al que está ligado el proyecto: sus datos y su etapa. Se edita en el módulo de leads.
interface Lead { id: string; companyName: string; contactName: string; email: string; phone: string | null; status: string; source: string | null; estimatedValue: number | null; scope: string | null; outcome: string | null; user?: { name: string } | null; createdAt: string }
const ETAPA: Record<string, string> = { NEW: 'Identificación', CONTACTED: 'Contacto', DIAGNOSIS: 'Diagnóstico', DEMO_VALIDATION: 'Demo', PROPOSAL_SENT: 'Propuesta', NEGOTIATION: 'Negociación', RESULT: 'Resultado' }
const etiq = 'text-[11px] font-semibold text-[#64748b] uppercase tracking-[0.06em]'

export default function LeadRegistrado({ leadId }: { leadId: string | null }) {
  const [lead, setLead] = useState<Lead | null | undefined>(undefined)
  useEffect(() => {
    if (!leadId) { setLead(null); return }
    api<Lead>(`/api/leads/${leadId}`).then(setLead).catch(() => setLead(null))
  }, [leadId])

  if (lead === undefined) return <div className="flex justify-center py-6 text-[#7f8a9c]"><Loader2 size={16} className="animate-spin" /></div>
  if (!lead) return (
    <div className="space-y-2">
      <p className="text-[12px] text-amber-300">Este proyecto no está ligado a un lead del módulo de leads.</p>
      <p className="text-[11px] text-[#94a3b8] leading-relaxed">Los proyectos comerciales nacen de un lead. Si este se creó sin él, el lead se registra en el módulo de leads y luego se liga al proyecto.</p>
    </div>)
  const dato = (t: string, v: string | null | undefined) => (
    <div><p className={etiq}>{t}</p><p className="text-[12px] text-gray-100 mt-1">{v?.trim() ? v : <span className="text-[#64748b]">Sin dato</span>}</p></div>)
  return (
    <div className="space-y-4">
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        {dato('Empresa', lead.companyName)}
        {dato('Etapa del lead', ETAPA[lead.status] ?? lead.status)}
        {dato('Responsable', lead.user?.name)}
        {dato('Contacto', lead.contactName)}
        {dato('Correo', lead.email)}
        {dato('Teléfono', lead.phone)}
        {dato('Fuente', lead.source)}
        {dato('Valor estimado', lead.estimatedValue ? '$' + Math.round(lead.estimatedValue).toLocaleString('es-CO') : null)}
        {dato('Alcance', lead.scope)}
      </div>
      <p className="text-[11px] text-[#94a3b8]">Cada dato de la empresa y del contacto también está en la ficha del cliente del proyecto. El estado del lead y su etapa se mueven solos con las fases.</p>
      <a href="/leads/lista" className="inline-flex items-center gap-1.5 text-[11px] text-indigo-300 hover:text-indigo-200"><ExternalLink size={11} /> Editar el lead en el módulo de leads</a>
    </div>
  )
}
