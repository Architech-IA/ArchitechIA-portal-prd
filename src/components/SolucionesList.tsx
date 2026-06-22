'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, ExternalLink, DollarSign } from 'lucide-react'

interface Solucion {
  id: string
  nombre: string
  descripcion: string | null
  tipo: string
  estado: string
  valorEstimado: number
  leadId: string | null
  lead: { id: string; companyName: string; contactName: string; status: string } | null
  createdAt: string
}

interface SolucionesListProps {
  tipo: 'PROJECT' | 'DEMO' | 'PARTNERSHIP' | 'PRODUCT' | 'INTERN'
  color: 'orange' | 'cyan' | 'violet' | 'emerald'
  title?: string
}

const colorMap = {
  orange: {
    border: 'border-orange-500/30',
    bg: 'bg-orange-600/15',
    text: 'text-orange-400',
    badge: 'bg-orange-900/30 text-orange-400 border-orange-800/40',
  },
  cyan: {
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-600/15',
    text: 'text-cyan-400',
    badge: 'bg-cyan-900/30 text-cyan-400 border-cyan-800/40',
  },
  violet: {
    border: 'border-violet-500/30',
    bg: 'bg-violet-600/15',
    text: 'text-violet-400',
    badge: 'bg-violet-900/30 text-violet-400 border-violet-800/40',
  },
  emerald: {
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-600/15',
    text: 'text-emerald-400',
    badge: 'bg-emerald-900/30 text-emerald-400 border-emerald-800/40',
  },
}

export default function SolucionesList({ tipo, color, title }: SolucionesListProps) {
  const [soluciones, setSoluciones] = useState<Solucion[]>([])
  const [loading, setLoading] = useState(true)
  const c = colorMap[color]

  useEffect(() => {
    fetch(`/api/soluciones?tipo=${tipo}`)
      .then(r => r.json())
      .then((data: Solucion[]) => {
        setSoluciones(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [tipo])

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 flex items-center justify-center">
        <Loader2 className={`${c.text} animate-spin`} size={24} />
      </div>
    )
  }

  if (soluciones.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
        <p className="text-gray-500 text-sm">No hay soluciones de este tipo asociadas a leads.</p>
        <p className="text-gray-600 text-xs mt-1">Selecciona una solución al crear o editar un lead.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8">
      <h2 className="text-xl font-bold text-white mb-5 flex items-center gap-2">
        {title || 'Soluciones asociadas'}
        <span className={`px-2 py-0.5 text-xs rounded-full border ${c.badge}`}>{soluciones.length}</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {soluciones.map(s => (
          <div
            key={s.id}
            className={`bg-gray-950 border border-gray-800 rounded-xl p-5 hover:${c.border} transition-colors`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-white font-semibold">{s.nombre}</h3>
                {s.lead && (
                  <Link
                    href={`/leads/lista`}
                    className={`text-xs ${c.text} hover:underline flex items-center gap-1 mt-1`}
                  >
                    Lead: {s.lead.companyName}
                    <ExternalLink size={10} />
                  </Link>
                )}
              </div>
              <span className={`px-2 py-0.5 text-[10px] rounded-full border ${c.badge}`}>
                {s.estado}
              </span>
            </div>
            {s.descripcion && (
              <p className="text-gray-400 text-sm mb-3 line-clamp-2">{s.descripcion}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <DollarSign size={14} className={c.text} />
              <span className="font-medium">${s.valorEstimado.toLocaleString()}</span>
              <span className="text-gray-600 mx-2">·</span>
              <span className="text-gray-500 text-xs">{new Date(s.createdAt).toLocaleDateString('es-CO')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
