'use client'

import Link from 'next/link'
import {
  FlaskConical, CheckCircle2, ArrowRight, Zap, Gauge,
  Target, ShieldCheck,
} from 'lucide-react'
import SolucionesList from '@/components/SolucionesList'

const benefits = [
  {
    icon: FlaskConical,
    title: 'Validación técnica',
    desc: 'Comprobamos que la tecnología elegida resuelve el caso de uso antes de invertir en desarrollo completo.',
  },
  {
    icon: Gauge,
    title: 'Rápido y enfocado',
    desc: 'PoC de 2 a 6 semanas con un alcance reducido y métricas claras de éxito.',
  },
  {
    icon: Target,
    title: 'Medición de impacto',
    desc: 'Definimos KPIs concretos para demostrar ROI y tomar decisiones con datos.',
  },
  {
    icon: ShieldCheck,
    title: 'Reducción de riesgo',
    desc: 'Identificamos limitaciones técnicas, costos reales y ajustes necesarios a tiempo.',
  },
]

const deliverables = [
  { title: 'Demo funcional', desc: 'Un prototipo ejecutable del caso de uso prioritario.' },
  { title: 'Informe técnico', desc: 'Arquitectura, stack, limitaciones y recomendaciones.' },
  { title: 'Propuesta de escala', desc: 'Roadmap y estimación para llevar el PoC a producción.' },
  { title: 'KPIs validados', desc: 'Resultados medibles contra los objetivos definidos.' },
]

export default function PocSolutionPage() {
  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {benefits.map(b => (
          <div
            key={b.title}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-cyan-500/30 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-cyan-600/15 flex items-center justify-center flex-shrink-0">
                <b.icon className="text-cyan-400" size={20} />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">{b.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{b.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8">
        <h2 className="text-xl font-bold text-white mb-6">Metodología del PoC</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: '01', title: 'Definición', desc: 'Seleccionamos el caso de uso, datos disponibles y criterios de éxito.' },
            { step: '02', title: 'Diseño', desc: 'Diseñamos el experimento mínimo viable y la arquitectura técnica.' },
            { step: '03', title: 'Implementación', desc: 'Construimos el demo funcional en tiempo record.' },
            { step: '04', title: 'Validación', desc: 'Medimos resultados y entregamos recomendación de go/no-go.' },
          ].map((p, idx, arr) => (
            <div key={p.step} className="relative">
              {idx < arr.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-gradient-to-r from-cyan-500/50 to-transparent" />
              )}
              <div className="flex items-center gap-3 mb-3">
                <span className="w-12 h-12 rounded-full bg-cyan-600/15 text-cyan-400 font-bold flex items-center justify-center border border-cyan-500/20">
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

      {/* Deliverables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {deliverables.map(d => (
          <div key={d.title} className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-xl p-5">
            <CheckCircle2 className="text-cyan-400 mt-0.5 flex-shrink-0" size={18} />
            <div>
              <h3 className="text-white font-medium mb-1">{d.title}</h3>
              <p className="text-gray-400 text-sm">{d.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Soluciones asociadas */}
      <SolucionesList tipo="DEMO" color="cyan" title="PoC activos" />

      {/* CTA */}
      <div className="card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <Zap className="text-cyan-400" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">¿Quieres validar una idea antes de invertir?</h2>
            <p className="text-gray-400 text-sm">Un PoC es la forma más segura de probar el valor de la IA en tu negocio.</p>
          </div>
        </div>
        <Link
          href="/leads"
          className="btn btn-primary flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)', borderColor: 'rgba(6,182,212,0.5)' }}
        >
          Empezar un PoC
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}
