'use client'

import Link from 'next/link'
import {
  Handshake, CheckCircle2, ArrowRight, TrendingUp, Network,
  Briefcase, Award, FileText, MessageSquare,
} from 'lucide-react'
import SolucionesList from '@/components/SolucionesList'

const models = [
  {
    icon: TrendingUp,
    title: 'Revenue share',
    desc: 'Co-construimos la solución y compartimos los ingresos generados por el producto o servicio.',
  },
  {
    icon: Briefcase,
    title: 'Joint venture tecnológica',
    desc: 'Combinamos tu conocimiento de mercado con nuestra capacidad de ingeniería para lanzar algo nuevo.',
  },
  {
    icon: Network,
    title: 'Centro de innovación',
    desc: 'Equipo dedicado de ArchiTechIA que opera como tu área de I+D e innovación digital.',
  },
  {
    icon: Award,
    title: 'Alianza estratégica',
    desc: 'Te respaldamos como partner tecnológico en licitaciones, proyectos grandes o transformaciones.',
  },
]

const idealPartners = [
  'Consultoras que quieren ofrecer IA a sus clientes sin armar un área técnica',
  'Empresas con casos de uso repetibles que pueden convertirse en producto',
  'Startups que necesitan un equipo técnico senior sin contratarlo de inmediato',
  'Integradores que buscan un partner de IA y automatización confiable',
]

export default function PartnershipSolutionPage() {
  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-violet-700 to-purple-800 p-8 md:p-10">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium mb-4">
            <Handshake size={14} />
            Alianzas estratégicas
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Partnership</h1>
          <p className="text-white/90 text-lg leading-relaxed max-w-2xl">
            Colaboramos como partner tecnológico para co-crear soluciones, productos o capacidades de IA.
            Una relación a largo plazo donde tu negocio y nuestra ingeniería crecen juntos.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/leads"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-violet-700 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              <MessageSquare size={16} />
              Explorar alianza
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

      {/* Models */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {models.map(m => (
          <div
            key={m.title}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-violet-500/30 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-violet-600/15 flex items-center justify-center flex-shrink-0">
                <m.icon className="text-violet-400" size={20} />
              </div>
              <div>
                <h3 className="text-white font-semibold mb-1">{m.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{m.desc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* How it works */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8">
        <h2 className="text-xl font-bold text-white mb-6">Cómo armamos un partnership</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: '01', title: 'Exploración', desc: 'Entendemos tu modelo de negocio, clientes y oportunidades de colaboración.' },
            { step: '02', title: 'Alineación', desc: 'Definimos el modelo comercial, roles, responsabilidades y expectativas.' },
            { step: '03', title: 'Piloto', desc: 'Ejecutamos un primer proyecto conjunto para validar la dinámica.' },
            { step: '04', title: 'Escala', desc: 'Estandarizamos procesos y escalamos la alianza a más iniciativas.' },
          ].map((p, idx, arr) => (
            <div key={p.step} className="relative">
              {idx < arr.length - 1 && (
                <div className="hidden lg:block absolute top-6 left-full w-full h-px bg-gradient-to-r from-violet-500/50 to-transparent" />
              )}
              <div className="flex items-center gap-3 mb-3">
                <span className="w-12 h-12 rounded-full bg-violet-600/15 text-violet-400 font-bold flex items-center justify-center border border-violet-500/20">
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

      {/* Ideal partners */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 md:p-8">
        <h2 className="text-xl font-bold text-white mb-5">¿Con quién trabajamos?</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {idealPartners.map(item => (
            <div key={item} className="flex items-start gap-3 p-3 rounded-lg bg-gray-800/40 border border-gray-800">
              <CheckCircle2 className="text-violet-400 mt-0.5 flex-shrink-0" size={18} />
              <span className="text-gray-300 text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Soluciones asociadas */}
      <SolucionesList tipo="PARTNERSHIP" color="violet" title="Partnerships activos" />

      {/* CTA */}
      <div className="card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <Handshake className="text-violet-400" size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">¿Listo para una alianza?</h2>
            <p className="text-gray-400 text-sm">Hablemos de cómo podemos construir y escalar juntos.</p>
          </div>
        </div>
        <Link
          href="/leads"
          className="btn flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)', color: 'white', borderColor: 'rgba(139,92,246,0.5)' }}
        >
          Conversar con comercial
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}
