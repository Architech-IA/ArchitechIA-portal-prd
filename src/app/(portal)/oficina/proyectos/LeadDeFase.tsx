'use client'

import { useEffect, useState } from 'react'
import { Loader2, ChevronDown, ChevronRight, ExternalLink, Phone, Mail, Users, MessageCircle } from 'lucide-react'
import { api } from './api'

// Lo que el módulo de leads sigue guardando de este lead: la propuesta y las interacciones con el cliente. (Las notas y los archivos viven en el proyecto.)
interface Interaccion { id: string; type: 'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP'; description: string; date: string; user: { name: string } }
interface Propuesta { id: string; title: string; amount: number; status: string; documents?: { id: string; name: string; url: string; archived: boolean }[] }
const ICONO_INT = { CALL: Phone, EMAIL: Mail, MEETING: Users, WHATSAPP: MessageCircle } as const
const dinero = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CO')
const fechaCorta = (v: string) => new Date(v).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' })

export default function LeadDeFase({ leadId, clave }: { leadId: string; clave: string }) {
  const [ints, setInts] = useState<Interaccion[] | null>(null)
  const [prop, setProp] = useState<Propuesta | null>(null)
  const [abierto, setAbierto] = useState(false)
  useEffect(() => {
    let vivo = true
    Promise.all([api<Interaccion[]>(`/api/leads/${leadId}/interactions`).catch(() => []), api<Propuesta | null>(`/api/leads/${leadId}/proposal`).catch(() => null)])
      .then(([i, p]) => { if (vivo) { setInts(Array.isArray(i) ? i : []); setProp(p && p.id ? p : null) } })
    return () => { vivo = false }
  }, [leadId])
  if (!ints) return <div className="flex justify-center py-3 text-[#7f8a9c]"><Loader2 size={14} className="animate-spin" /></div>
  const conPropuesta = clave === 'propuesta' || clave === 'negociacion'
  return (
    <div className="space-y-3">
      {conPropuesta && (prop
        ? (<div className="rounded-lg px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <p className="text-[12px] text-gray-200">{prop.title} <span className="text-[10px] text-[#7f8a9c]">· {prop.status} · {dinero(prop.amount)}</span></p>
          {(prop.documents ?? []).filter(d => !d.archived).map(d => <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="block text-[11px] text-indigo-300 hover:text-indigo-200 truncate">{d.name}</a>)}
        </div>)
        : <p className="text-[11px] text-[#7f8a9c]">El lead no tiene propuesta registrada.</p>)}
      {ints.length > 0 && (
        <div>
          <button onClick={() => setAbierto(o => !o)} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[#7f8a9c] hover:text-gray-300">
            {abierto ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Interacciones con el cliente ({ints.length}) · de todo el lead
          </button>
          {abierto && (
            <div className="mt-1 space-y-1">
              {ints.slice(0, 20).map(i => { const I = ICONO_INT[i.type] ?? Phone; return (
                <div key={i.id} className="flex items-start gap-2 text-[11px] px-2 py-1">
                  <I size={11} className="text-[#7f8a9c] mt-0.5 flex-shrink-0" /><span className="text-gray-300 flex-1">{i.description}</span><span className="text-[10px] text-[#7f8a9c] flex-shrink-0">{fechaCorta(i.date)} · {i.user?.name}</span>
                </div>) })}
            </div>)}
        </div>)}
      <a href={`/leads/${leadId}/hub`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-[#7f8a9c] hover:text-gray-200"><ExternalLink size={10} /> Registrar interacciones o la propuesta en el módulo de leads</a>
    </div>
  )
}
