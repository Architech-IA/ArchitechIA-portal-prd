'use client';

import { useState, useEffect } from 'react';

interface ResourceCard {
  title: string;
  description: string;
  href: string;
  icon: string;
}

const RESOURCES: ResourceCard[] = [
  {
    title: 'Cuentas',
    description: 'Gestiona las plataformas, servicios y cuentas activas del equipo.',
    href: '/finanzas?tab=cuentas',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  },
  {
    title: 'Formatos',
    description: 'Documentos, plantillas y formatos oficiales del equipo.',
    href: '/resources/formatos',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    title: 'Brand',
    description: 'Logo, paleta de colores, tipografías y guías de uso de marca.',
    href: '/resources/brand',
    icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
  },
  {
    title: 'Tutoriales',
    description: 'Cursos, guías de onboarding y material de capacitación del equipo.',
    href: '/resources/tutoriales',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
];

export default function ResourcesPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="text-gray-400 mt-1">Centro de recursos, herramientas y cuentas del equipo</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {RESOURCES.map((res, idx) => (
          <a
            key={res.href}
            href={res.href}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={res.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white group-hover:text-orange-400 transition-colors">
                  {res.title}
                </h3>
                <p className="text-sm text-gray-400 mt-1 leading-relaxed">{res.description}</p>
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
