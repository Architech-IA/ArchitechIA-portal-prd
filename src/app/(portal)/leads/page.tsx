'use client';

import { useState, useEffect } from 'react';

interface LeadCard {
  title: string;
  description: string;
  href: string;
  icon: string;
}

const LEAD_CARDS: LeadCard[] = [
  {
    title: 'Leads',
    description: 'Lista completa de prospectos con filtros avanzados, ordenamiento y gestión.',
    href: '/leads/lista',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  },
  {
    title: 'Pipeline',
    description: 'Visualización del pipeline de ventas por etapas con arrastrar y soltar.',
    href: '/leads/pipeline',
    icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  },
  {
    title: 'Clientes',
    description: 'Gestión de clientes activos, historial y seguimiento post-venta.',
    href: '/leads/clientes',
    icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  },
  {
    title: 'Prospector',
    description: 'Herramienta de prospección inteligente y búsqueda de nuevos leads.',
    href: '/leads/prospector',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  },
  {
    title: 'Mercado',
    description: 'Análisis de nichos de mercado y mapa de oportunidades.',
    href: '/leads/mercado',
    icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'Calculador',
    description: 'Estima costos, esfuerzo y margen para proyectos de IA. Genera presupuestos por tipo de tecnología y complejidad.',
    href: '/leads/calculador',
    icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  },
];

export default function LeadsHubPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div style={{ padding: '10px 32px 32px' }}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {LEAD_CARDS.map((card, idx) => (
          <a
            key={card.href}
            href={card.href}
            className="group block bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-orange-500/50 transition-all"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(12px)',
              transition: `all 0.35s ease ${idx * 80}ms`,
            }}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-orange-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white group-hover:text-orange-400 transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-gray-400 mt-1 leading-relaxed">{card.description}</p>
              </div>
              <svg
                className="w-5 h-5 text-gray-600 group-hover:text-orange-400 transition-colors flex-shrink-0 mt-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
