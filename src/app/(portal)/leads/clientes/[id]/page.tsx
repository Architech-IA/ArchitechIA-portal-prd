'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Building2, ArrowLeft, ExternalLink } from 'lucide-react'
import LeadsNav from '@/components/LeadsNav'

interface LeadRow {
  id: string
  companyName: string
  contactName: string
  status: string
  estimatedValue: number
  source: string
  createdAt: string
  user: { name: string }
}

interface ClienteDetail {
  id: string
  nombre: string
  industria: string
  contacto: string
  email: string
  pais: string
  estado: string
  valorTotal: number
  createdAt: string
  leads: LeadRow[]
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  NEW:             { label: 'Identificación', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)'  },
  CONTACTED:       { label: 'Contacto',       color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  DIAGNOSIS:       { label: 'Diagnóstico',    color: '#22d3ee', bg: 'rgba(34,211,238,0.12)'  },
  QUALIFIED:       { label: 'Diagnóstico',    color: '#22d3ee', bg: 'rgba(34,211,238,0.12)'  },
  DEMO_VALIDATION: { label: 'Demo',           color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)'  },
  PROPOSAL_SENT:   { label: 'Propuesta',      color: '#818cf8', bg: 'rgba(129,140,248,0.12)' },
  NEGOTIATION:     { label: 'Negociación',    color: '#f97316', bg: 'rgba(249,115,22,0.12)'  },
  WON:             { label: 'Ganado',         color: '#34d399', bg: 'rgba(52,211,153,0.12)'  },
  LOST:            { label: 'Perdido',        color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
}

export default function ClienteDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [cliente, setCliente] = useState<ClienteDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/clientes/${id}`).then(r => r.json()).then(c => { setCliente(c); setLoading(false) })
  }, [id])

  if (loading) return <div className="flex items-center justify-center h-full text-gray-500 text-sm">Cargando...</div>
  if (!cliente || (cliente as unknown as { error?: string }).error) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-sm">Cliente no encontrado</div>
  }

  const totalLeadsValue = cliente.leads.reduce((a, l) => a + l.estimatedValue, 0)
  const wonLeads = cliente.leads.filter(l => l.status === 'WON').length

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <LeadsNav />
      <button onClick={() => router.push('/leads/clientes')} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 mb-4 transition-colors">
        <ArrowLeft size={13} /> Volver a Clientes
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
          <Building2 size={20} className="text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">{cliente.nombre}</h1>
          <p className="text-xs text-gray-500">{cliente.industria} · {cliente.pais}</p>
        </div>
        <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-semibold ${cliente.estado === 'Activo' ? 'bg-green-500/10 text-green-400 border border-green-500/25' : 'bg-gray-500/10 text-gray-400 border border-gray-500/25'}`}>
          {cliente.estado}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Contacto', value: cliente.contacto || '—' },
          { label: 'Email', value: cliente.email || '—' },
          { label: 'Valor Total Cliente', value: `$${cliente.valorTotal.toLocaleString()}` },
          { label: 'Leads / Ganados', value: `${cliente.leads.length} / ${wonLeads}` },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{kpi.label}</p>
            <p className="text-sm font-semibold text-gray-200 truncate">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Historial de Leads</p>
          <p className="text-xs text-gray-500">Valor acumulado: <span className="text-orange-400 font-semibold">${totalLeadsValue.toLocaleString()}</span></p>
        </div>
        {cliente.leads.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">Este cliente aún no tiene leads asociados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-gray-500 border-b border-white/[0.06]">
                <th className="text-left px-4 py-2 font-semibold">Contacto</th>
                <th className="text-left px-4 py-2 font-semibold">Estado</th>
                <th className="text-left px-4 py-2 font-semibold">Fuente</th>
                <th className="text-right px-4 py-2 font-semibold">Valor</th>
                <th className="text-left px-4 py-2 font-semibold">Responsable</th>
                <th className="text-left px-4 py-2 font-semibold">Creado</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {cliente.leads.map(lead => {
                const sm = STATUS_META[lead.status]
                return (
                  <tr key={lead.id} className="border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={() => router.push(`/leads/${lead.id}/hub`)}>
                    <td className="px-4 py-2.5 text-gray-200">{lead.contactName}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ color: sm?.color, background: sm?.bg }}>{sm?.label ?? lead.status}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-400">{lead.source}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-300">${lead.estimatedValue.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-gray-400">{lead.user.name}</td>
                    <td className="px-4 py-2.5 text-gray-500">{new Date(lead.createdAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td className="px-4 py-2.5 text-right"><ExternalLink size={13} className="text-gray-600" /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
