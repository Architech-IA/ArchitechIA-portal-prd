'use client';

import { useState } from 'react';
import {
  Zap, Shield, BarChart3, ArrowRight, Check, Menu, X,
  Star, Users, Clock, Globe,
} from 'lucide-react';
import type { AppInstance } from '@/lib/app-types';
import AppBackButton from '@/components/apps/shared/AppBackButton';

interface Feature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

interface Testimonial {
  name: string;
  role: string;
  company: string;
  text: string;
  avatar: string;
}

interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  highlighted: boolean;
}

const FEATURES: Feature[] = [
  {
    icon: Zap,
    title: 'Automatización Inteligente',
    description: 'Reduce tareas repetitivas con agentes de IA entrenados para tu negocio.',
  },
  {
    icon: Shield,
    title: 'Seguridad Empresarial',
    description: 'Tu información protegida con los más altos estándares de la industria.',
  },
  {
    icon: BarChart3,
    title: 'Analytics en Tiempo Real',
    description: 'Toma decisiones con dashboards actualizados al instante.',
  },
  {
    icon: Users,
    title: 'Colaboración de Equipos',
    description: 'Conecta a tu equipo en un solo lugar con flujos de trabajo claros.',
  },
  {
    icon: Clock,
    title: 'Disponibilidad 24/7',
    description: 'Infraestructura cloud que nunca duerme, igual que tu negocio.',
  },
  {
    icon: Globe,
    title: 'Escalable Globalmente',
    description: 'Desde startup hasta enterprise, crecemos contigo sin límites.',
  },
];

const TESTIMONIALS: Testimonial[] = [
  {
    name: 'Roberto Sánchez',
    role: 'CEO',
    company: 'TechCorp',
    text: 'La transformación fue inmediata. Redujimos el tiempo operativo en un 40% desde el primer mes.',
    avatar: 'RS',
  },
  {
    name: 'Laura Fernández',
    role: 'CTO',
    company: 'InnovateLab',
    text: 'Finalmente tenemos una solución de IA que el equipo comercial puede usar sin depender de ingeniería.',
    avatar: 'LF',
  },
  {
    name: 'Miguel Torres',
    role: 'Director de Ops',
    company: 'DataFlow',
    text: 'El ROI fue evidente en semanas. La integración con nuestros sistemas fue sorprendentemente simple.',
    avatar: 'MT',
  },
];

const PRICING: PricingTier[] = [
  {
    name: 'Starter',
    price: '$299',
    period: '/mes',
    description: 'Perfecto para equipos pequeños que empiezan con IA.',
    features: ['1 agente de IA', '1,000 interacciones/mes', 'Dashboard básico', 'Soporte por email'],
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$799',
    period: '/mes',
    description: 'Para empresas que quieren escalar sus operaciones con IA.',
    features: ['5 agentes de IA', '10,000 interacciones/mes', 'Dashboard avanzado', 'Integraciones CRM', 'Soporte prioritario'],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'Solución a medida con implementación dedicada.',
    features: ['Agentes ilimitados', 'Interacciones ilimitadas', 'Analytics personalizado', 'SLA garantizado', 'Equipo de éxito asignado'],
    highlighted: false,
  },
];

export default function LandingRuntime({ app }: { app: AppInstance }) {
  const config = app.config;
  const headline = String(config.headline || 'Transforma tu negocio con IA');
  const subheadline = String(config.subheadline || 'Automatiza procesos, toma mejores decisiones y escala tu operación con agentes inteligentes diseñados a tu medida.');
  const ctaText = String(config.ctaText || 'Solicitar demo');
  const primaryColor = String(config.primaryColor || '#FF5A00');
  const companyName = String(config.companyName || app.name);
  const formFields = Array.isArray(config.formFields) ? (config.formFields as string[]) : ['Nombre', 'Email', 'Empresa'];

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="flex h-full flex-col overflow-auto bg-white text-gray-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg text-white font-bold"
              style={{ backgroundColor: primaryColor }}
            >
              {companyName.slice(0, 1).toUpperCase()}
            </div>
            <span className="text-lg font-bold">{companyName}</span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900">Features</a>
            <a href="#testimonials" className="text-sm text-gray-600 hover:text-gray-900">Testimonios</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</a>
            <button
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {ctaText}
            </button>
            <AppBackButton />
          </div>

          <div className="flex items-center gap-3 md:hidden">
            <AppBackButton />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="mt-4 space-y-3 border-t border-gray-100 pt-4 md:hidden">
            <a href="#features" className="block text-sm text-gray-600">Features</a>
            <a href="#testimonials" className="block text-sm text-gray-600">Testimonios</a>
            <a href="#pricing" className="block text-sm text-gray-600">Pricing</a>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white px-6 py-20 md:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <div
                className="mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
              >
                <Star className="h-3.5 w-3.5" />
                Demo powered by ArchiTechIA
              </div>
              <h1 className="text-4xl font-bold leading-tight md:text-6xl">{headline}</h1>
              <p className="mt-6 text-lg text-gray-600 md:text-xl">{subheadline}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  className="rounded-xl px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  {ctaText}
                </button>
                <button className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-8 py-4 text-base font-semibold text-gray-700 hover:bg-gray-50">
                  Ver demo en vivo
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-4 text-sm text-gray-500">Sin tarjeta de crédito • Setup en 48 horas</p>
            </div>

            {/* Lead form */}
            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-xl">
              <h3 className="text-xl font-bold">Empieza hoy</h3>
              <p className="mt-2 text-sm text-gray-600">Déjanos tus datos y te contactamos en minutos.</p>
              {submitted ? (
                <div className="mt-6 rounded-xl p-6 text-center" style={{ backgroundColor: `${primaryColor}10` }}>
                  <div
                    className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Check className="h-6 w-6" />
                  </div>
                  <p className="font-semibold">¡Gracias por tu interés!</p>
                  <p className="text-sm text-gray-600">Nos pondremos en contacto pronto.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                  {formFields.map((field) => (
                    <div key={field}>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">{field}</label>
                      <input
                        type="text"
                        required
                        value={formData[field] || ''}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        placeholder={field}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-orange-500"
                      />
                    </div>
                  ))}
                  <button
                    type="submit"
                    className="w-full rounded-lg py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {ctaText}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Todo lo que necesitas para escalar</h2>
            <p className="mt-4 text-gray-600">Una plataforma completa diseñada para resultados reales.</p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature, index) => (
              <div key={index} className="rounded-xl border border-gray-100 bg-gray-50 p-6 transition-shadow hover:shadow-lg">
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="bg-gray-900 px-6 py-20 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Lo que dicen nuestros clientes</h2>
            <p className="mt-4 text-gray-400">Empresas que ya transformaron su operación.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, index) => (
              <div key={index} className="rounded-xl bg-gray-800 p-6">
                <div className="mb-4 flex gap-1 text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="text-gray-300">&ldquo;{t.text}&rdquo;</p>
                <div className="mt-6 flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}, {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Planes simples y transparentes</h2>
            <p className="mt-4 text-gray-600">Elige el que mejor se adapte a tu etapa.</p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {PRICING.map((tier, index) => (
              <div
                key={index}
                className={`rounded-2xl p-8 ${tier.highlighted ? 'relative border-2 shadow-xl' : 'border border-gray-200 bg-white'}`}
                style={tier.highlighted ? { borderColor: primaryColor } : {}}
              >
                {tier.highlighted && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Más popular
                  </div>
                )}
                <h3 className="text-lg font-semibold">{tier.name}</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  <span className="text-gray-500">{tier.period}</span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{tier.description}</p>
                <ul className="mt-6 space-y-3">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 flex-shrink-0 text-green-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`mt-8 w-full rounded-lg py-3 text-sm font-semibold transition-opacity hover:opacity-90 ${tier.highlighted ? 'text-white' : 'border border-gray-200 bg-white text-gray-900'}`}
                  style={tier.highlighted ? { backgroundColor: primaryColor } : {}}
                >
                  Elegir plan
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20">
        <div
          className="mx-auto max-w-5xl rounded-3xl px-6 py-16 text-center text-white"
          style={{ backgroundColor: primaryColor }}
        >
          <h2 className="text-3xl font-bold md:text-4xl">¿Listo para transformar tu negocio?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg opacity-90">
            Agenda una demo personalizada y descubre cómo {companyName} puede acelerar tu crecimiento.
          </p>
          <button className="mt-8 rounded-xl bg-white px-8 py-4 text-base font-semibold transition-opacity hover:opacity-90" style={{ color: primaryColor }}>
            {ctaText}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {companyName.slice(0, 1).toUpperCase()}
              </div>
              <span className="font-semibold">{companyName}</span>
            </div>
            <p className="text-sm text-gray-500">
              © 2026 {companyName}. Demo creada por ArchiTechIA.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
