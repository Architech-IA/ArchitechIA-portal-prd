'use client';

import { useState } from 'react';

type TabKey = 'propuestas' | 'presentaciones' | 'contratos' | 'manuales';

interface Tab {
  key: TabKey;
  label: string;
}

const TABS: Tab[] = [
  { key: 'propuestas',    label: 'Propuestas'    },
  { key: 'presentaciones', label: 'Presentaciones' },
  { key: 'contratos',     label: 'Contratos'     },
  { key: 'manuales',      label: 'Manuales'      },
];

const ICONS: Record<TabKey, string> = {
  propuestas:    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  presentaciones:'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z',
  contratos:     'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  manuales:      'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
};

const DESCRIPTIONS: Record<TabKey, string> = {
  propuestas:    'Plantillas y formatos estandarizados para propuestas comerciales. Incluye estructura, cronogramas y precios.',
  presentaciones: 'Diapositivas corporativas, pitch decks y plantillas de presentación para clientes e inversionistas.',
  contratos:     'Contratos tipo, NDAs, acuerdos de confidencialidad y documentos legales revisados por el equipo.',
  manuales:      'Manuales de usuario, guías técnicas, documentación de procesos y procedimientos internos.',
};

function EmptyState({ tab }: { tab: TabKey }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={ICONS[tab]} />
        </svg>
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{TABS.find(t => t.key === tab)?.label}</h3>
      <p className="text-gray-400 max-w-lg mx-auto leading-relaxed">{DESCRIPTIONS[tab]}</p>
      <p className="text-[#7f8a9c] text-sm mt-4">Próximamente disponible.</p>
    </div>
  );
}

export default function FormatosPage() {
  const [active, setActive] = useState<TabKey>('propuestas');

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <p className="text-gray-400 mt-1">Documentos, plantillas y formatos oficiales del equipo</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-gray-700 pb-px">
        {TABS.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className="relative px-5 py-3 text-sm font-medium transition-colors"
              style={{
                color: isActive ? '#fb923c' : '#6b7280',
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = '#e5e7eb';
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.color = '#6b7280';
              }}
            >
              {tab.label}
              {isActive && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                  style={{ background: '#f97316' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <EmptyState tab={active} />
    </div>
  );
}
