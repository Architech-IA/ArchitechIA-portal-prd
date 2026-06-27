'use client'

import Link from 'next/link'
import {
  FolderKanban, CheckCircle2, ArrowRight, Clock, Shield,
  Users, Rocket, FileText, MessageSquare,
} from 'lucide-react'
import SolucionesList from '@/components/SolucionesList'

const features = [
  {
    icon: FolderKanban,
    title: 'Gestión end-to-end',
    desc: 'Acompañamiento completo desde el descubrimiento hasta la entrega y soporte del proyecto.',
  },
  {
    icon: Users,
    title: 'Equipo especializado',
    desc: 'Arquitectos de soluciones, desarrolladores IA y project managers asignados a tu iniciativa.',
  },
  {
    icon: Clock,
    title: 'Metodología ágil',
    desc: 'Sprints quincenales, demos constantes y ajustes continuos para minimizar riesgos.',
  },
  {
    icon: Shield,
    title: 'Calidad y seguridad',
    desc: 'Revisiones técnicas, pruebas automatizadas y cumplimiento de estándares de seguridad.',
  },
]

const process = [
  { step: '01', title: 'Diagnóstico', desc: 'Entendemos tu problema, procesos y objetivos de negocio.' },
  { step: '02', title: 'Propuesta', desc: 'Diseñamos la arquitectura, alcance, tiempos y inversión.' },
  { step: '03', title: 'Ejecución', desc: 'Desarrollamos la solución con iteraciones cortas y feedback.' },
  { step: '04', title: 'Entrega', desc: 'Puesta en producción, capacitación y soporte continuo.' },
]

export default function ProjectsSolutionPage() {
  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-600 via-orange-700 to-red-700 p-8 md:p-10">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-4">
            <FolderKanban size={14} />
            Solución a la medida
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Projects</h1>
          <p className="text-white/90 text-lg leading-relaxed max-w-2xl">
            Desarrollo de proyectos tecnológicos completos con IA y automatización.
            Transformamos un reto de negocio en una solución productiva, escalable y medible.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/leads"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-orange-700 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              <MessageSquare size={16} />
              Hablar con comercial
            </Link>
            <Link
              href="/proposals"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/15 text-white rounded-lg text-sm font-medium hover:bg-white/25 transition-colors"
            >
              <FileText size={16} />
              Ver propuestas
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
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-orange-500/30 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-orange-600/15 flex items-center justify-center flex-shrink-0">
                <f.icon className="text-orange-400" size={20} />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Process */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8">
        <h2 className="text-xl font-bold text-white mb-6">Cómo funciona</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {process.map((p, idx) => (
            <div key={p.step} className="relative">
              {idx < process.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-gradient-to-r from-orange-500/50 to-transparent" />
              )}
              <div className="flex items-center gap-3 mb-3">
                <span className="w-12 h-12 rounded-full bg-orange-600/15 text-orange-400 font-bold flex items-center justify-center border border-orange-500/20">
                  {p.step}
                </span>
                <ArrowRight className="text-gray-600 lg:hidden" size={16} />
              </div>
              <h3 className="text-white font-semibold mb-1">{p.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Ideal for */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          'Automatización de procesos operativos críticos',
          'Desarrollo de productos digitales con IA',
          'Integraciones entre sistemas y plataformas',
        ].map(item => (
          <div key={item} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-4">
            <CheckCircle2 className="text-green-400 flex-shrink-0" size={18} />
            <span className="text-gray-300 text-sm">{item}</span>
          </div>
        ))}
      </div>

      {/* Soluciones asociadas */}
      <SolucionesList tipo="PROJECT" color="orange" title="Projects activos" />

      {/* CTA */}
      <div className="card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,90,0,0.12)', border: '1px solid rgba(255,90,0,0.2)' }}>
            <Rocket className="text-orange-400" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">¿Tienes un proyecto en mente?</h2>
            <p className="text-gray-400 text-sm">Agenda una llamada y construyamos juntos la solución.</p>
          </div>
        </div>
        <Link
          href="/leads"
          className="btn btn-primary flex-shrink-0"
        >
          Iniciar conversación
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}
