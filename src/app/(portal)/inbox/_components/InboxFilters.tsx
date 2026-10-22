'use client';

import { Search, Filter } from 'lucide-react';
import type { InboxFilters as InboxFiltersType, InboxCounts } from '@/eaih';

export interface InboxFiltersProps {
  filters: InboxFiltersType;
  counts: InboxCounts;
  onChange: (filters: InboxFiltersType) => void;
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  padding: '8px 12px',
  color: '#e2e8f0',
  fontSize: '13px',
  outline: 'none',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  paddingRight: '28px',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
};

export function InboxFilters({ filters, counts, onChange }: InboxFiltersProps) {
  const update = <K extends keyof InboxFiltersType>(key: K, value: InboxFiltersType[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div className="px-5 py-3 border-b border-white/5 space-y-3">
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Filter className="w-3.5 h-3.5" />
        <span>
          Total {counts.total} · No leídos {counts.unread} · Importantes {counts.important} ·
          Microsoft {counts.microsoft} · Google {counts.google}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar correo..."
            value={filters.query}
            onChange={(e) => update('query', e.target.value)}
            className="pl-9 pr-3 py-2 text-sm"
            style={inputStyle}
          />
        </div>

        <select
          value={filters.provider}
          onChange={(e) => update('provider', e.target.value as InboxFiltersType['provider'])}
          style={selectStyle}
        >
          <option value="ALL">Todos los proveedores</option>
          <option value="MICROSOFT">Microsoft 365</option>
          <option value="GOOGLE">Google Workspace</option>
        </select>

        <select
          value={filters.status}
          onChange={(e) => update('status', e.target.value as InboxFiltersType['status'])}
          style={selectStyle}
        >
          <option value="ALL">Todos los estados</option>
          <option value="UNREAD">No leídos</option>
          <option value="READ">Leídos</option>
        </select>

        <select
          value={filters.priority}
          onChange={(e) => update('priority', e.target.value as InboxFiltersType['priority'])}
          style={selectStyle}
        >
          <option value="ALL">Todas las prioridades</option>
          <option value="IMPORTANT">Importantes</option>
        </select>

        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => update('dateFrom', e.target.value)}
          style={inputStyle}
          aria-label="Desde"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => update('dateTo', e.target.value)}
          style={inputStyle}
          aria-label="Hasta"
        />
      </div>
    </div>
  );
}
