'use client'

import Link from 'next/link'
import {
  Building2, CheckCircle2, ArrowRight, Shield,
  Users, Rocket, Settings, Gauge,
} from 'lucide-react'
import SolucionesList from '@/components/SolucionesList'

const features = [
  {
    icon: Shield,
    title: 'Uso interno',
    desc: 'Herramientas diseñadas para equipos ArchiTechIA: operaciones, comercial, delivery y administración.',
  },
  {
    icon: Users,
    title: 'Colaboración centralizada',
    desc: 'Un solo portal para gestionar leads, proyectos, propuestas, reuniones y conocimiento.',
  },
  {
    icon: Gauge,
    title: 'Productividad medida',
    desc: 'Dashboards personales y métricas de uso que ayudan a identificar cuellos de botella.',
  },
  {
    icon: Settings,
    title: 'Evolución continua',
    desc: 'Mejoras iterativas basadas en retroalimentación interna y necesidades del equipo.',
  },
]

const modules = [
  'Gestión de leads y pipeline comercial',
  'Backlog, sprints y tareas de delivery',
  'Calendario de reuniones integrado',
  'Propuestas y documentos centralizados',
  'Finanzas, reportes y trazabilidad',
]

export default function InternSolutionPage() {
  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 p-8 md:p-10">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-4">
            <Building2 size={14} />
            Solución interna
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Intern</h1>
          <p className="text-white/90 text-lg leading-relaxed max-w-2xl">
            Soluciones, herramientas y plataformas que potencian el día a día de ArchiTechIA.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/backlog"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-emerald-700 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              <Rocket size={16} />
              Ver backlog
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/15 text-white rounded-lg text-sm font-medium hover:bg-white/25 transition-colors"
            >
              <Gauge size={16} />
              Dashboard
            </Link>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {features.map(f => (
          <div
            key={f.title}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-emerald-500/30 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/15 flex items-center justify-center flex-shrink-0">
                <f.icon className="text-emerald-400" size={20} />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modules */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8">
        <h2 className="text-xl font-bold text-white mb-6">Módulos del Portal Interno</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(item => (
            <div key={item} className="flex items-center gap-3 bg-gray-950 border border-gray-800 rounded-xl p-4">
              <CheckCircle2 className="text-emerald-400 flex-shrink-0" size={18} />
              <span className="text-gray-300 text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Soluciones asociadas */}
      <SolucionesList tipo="INTERN" color="emerald" title="Soluciones internas" />

      {/* CTA */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <Rocket className="text-emerald-400" size={22} />
            ¿Necesitas una mejora interna?
          </h2>
          <p className="text-gray-400 text-sm">Registra una tarea en el backlog y asígnala al equipo correspondiente.</p>
        </div>
        <Link
          href="/backlog"
          className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Ir al backlog
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}
