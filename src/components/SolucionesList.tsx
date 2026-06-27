'use client'

import { useEffect, useState } from 'react'
import React from 'react'
import Link from 'next/link'
import { Loader2, ExternalLink, DollarSign, FlaskConical, Briefcase, Handshake, GraduationCap, Package } from 'lucide-react'

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
  refreshKey?: number
  headerAction?: React.ReactNode
}

const colorMap = {
  orange: { hex: '#FF5A00', text: 'text-orange-400', badge: 'badge-primary' },
  cyan:   { hex: '#06B6D4', text: 'text-cyan-400',   badge: 'badge-cyan' },
  violet: { hex: '#8B5CF6', text: 'text-violet-400', badge: 'badge-primary' },
  emerald:{ hex: '#10B981', text: 'text-emerald-400', badge: 'badge-success' },
}

const TIPO_ICON: Record<SolucionesListProps['tipo'], typeof FlaskConical> = {
  DEMO: FlaskConical,
  PROJECT: Briefcase,
  PARTNERSHIP: Handshake,
  INTERN: GraduationCap,
  PRODUCT: Package,
}

export default function SolucionesList({ tipo, color, title, refreshKey, headerAction }: SolucionesListProps) {
  const [soluciones, setSoluciones] = useState<Solucion[]>([])
  const [loading, setLoading] = useState(true)
  const c = colorMap[color]
  const Icon = TIPO_ICON[tipo]

  useEffect(() => {
    setLoading(true)
    fetch(`/api/soluciones?tipo=${tipo}`)
      .then(r => r.json())
      .then((data: Solucion[]) => {
        setSoluciones(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [tipo, refreshKey])

  if (loading) {
    return (
      <div className="card p-8 flex items-center justify-center">
        <Loader2 className={`${c.text} animate-spin`} size={24} />
      </div>
    )
  }

  if (soluciones.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="text-gray-500 text-sm">No hay soluciones de este tipo asociadas a leads.</p>
        <p className="text-gray-600 text-xs mt-1">Selecciona una solución al crear o editar un lead.</p>
      </div>
    )
  }

  return (
    <div className="card p-6 md:p-8">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${c.hex}1f`, border: `1px solid ${c.hex}33` }}>
            <Icon size={16} style={{ color: c.hex }} />
          </div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            {title || 'Soluciones asociadas'}
            <span className={`badge ${c.badge}`}>{soluciones.length}</span>
          </h2>
        </div>
        {headerAction}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {soluciones.map(s => (
          <div
            key={s.id}
            className="card card-hover p-5"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${c.hex}1f`, border: `1px solid ${c.hex}33` }}>
                  <Icon size={16} style={{ color: c.hex }} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-white font-semibold truncate">{s.nombre}</h3>
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
              </div>
              <span className={`badge ${c.badge} flex-shrink-0`}>
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
