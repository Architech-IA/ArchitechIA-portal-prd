'use client';

import { useEffect, useState } from 'react';

interface UsageData {
  active: number;
  total: number;
}

/**
 * Barra de "uso" del footer del sidebar — réplica visual del bloque
 * "Credits used 810/3,300" de la referencia, pero con un dato real:
 * tareas de backlog activas (pendientes + en progreso) sobre el total.
 */
export default function SidebarUsage() {
  const [data, setData] = useState<UsageData | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/dashboard')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!alive || !d) return;
        const bs = d?.backlogStats;
        const total = bs?.total ?? 0;
        const active = (bs?.pendientes ?? 0) + (bs?.enProgreso ?? 0);
        setData({ active, total });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!data || data.total === 0) return null;

  const pct = Math.min(100, Math.round((data.active / data.total) * 100));

  return (
    <div className="px-3 pt-2 pb-1">
      <div
        className="rounded-xl px-3 py-2.5"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>
            Tareas activas
          </span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: '#cbd5e1' }}>
            {data.active}/{data.total}
          </span>
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.07)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #FF5A00 0%, #FF7A2F 100%)',
              boxShadow: '0 0 8px rgba(255,90,0,0.5)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
