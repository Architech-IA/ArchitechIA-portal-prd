'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { StickyNote, Pencil, Trash2, LayoutDashboard } from 'lucide-react';
import LeadsNav from '@/components/LeadsNav';

interface Lead {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  status: string;
  source: string;
  tipo: string | null;
  solucionAsociada: string | null;
  scope: string | null;
  repository: string | null;
  estimatedValue: number;
  notes: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

const EMPTY_FORM = {
  companyName: '', contactName: '', email: '', phone: '',
  status: 'NEW', source: '', tipo: '', solucionAsociada: '', scope: '', estimatedValue: '', notes: '', userId: '',
};

const STATUS_COLORS: Record<string, string> = {
  NEW:             'bg-blue-500/20 text-blue-400',
  CONTACTED:       'bg-purple-500/20 text-purple-400',
  DIAGNOSIS:       'bg-cyan-500/20 text-cyan-400',
  QUALIFIED:       'bg-cyan-500/20 text-cyan-400',
  DEMO_VALIDATION: 'bg-teal-500/20 text-teal-400',
  PROPOSAL_SENT:   'bg-indigo-500/20 text-indigo-400',
  NEGOTIATION:     'bg-orange-500/20 text-orange-400',
  WON:             'bg-green-500/20 text-green-400',
  LOST:            'bg-red-500/20 text-red-400',
};

function translateStatus(status: string) {
  const t: Record<string, string> = {
    NEW:             'Identificación',
    CONTACTED:       'Contacto',
    DIAGNOSIS:       'Diagnóstico',
    QUALIFIED:       'Diagnóstico',
    DEMO_VALIDATION: 'Demo',
    PROPOSAL_SENT:   'Propuesta',
    NEGOTIATION:     'Negociación',
    WON:             'Resultado',
    LOST:            'Resultado',
  };
  return t[status] || status;
}

const PAGE_SIZES = [10, 20, 50];

type SortKey = 'companyName' | 'scope' | 'contactName' | 'email' | 'status' | 'estimatedValue' | 'source' | 'user' | 'createdAt';

export default function LeadsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = ['ADMIN','SUPERADMIN'].includes((session?.user as { role?: string })?.role ?? '');

  const [leads, setLeads]         = useState<Lead[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editLead, setEditLead]   = useState<Lead | null>(null);
  const [confirmDel, setConfirmDel] = useState<Lead | null>(null);
  const [users, setUsers]         = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData]   = useState(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting]   = useState(false);
  const [delError, setDelError]   = useState('');
  const [notesLead, setNotesLead]     = useState<Lead | null>(null);
  const [notesList, setNotesList]     = useState<{ id: string; description: string; createdAt: string; user: { name: string } }[]>([]);
  const [noteText, setNoteText]       = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [addingNote, setAddingNote]   = useState(false);
  // ── Filtros avanzados ──
  const [showFilters, setShowFilters] = useState(false);
  const [fStatus, setFStatus] = useState('');
  const [fSource, setFSource] = useState('');
  const [fScope, setFScope] = useState('');
  const [fValueMin, setFValueMin] = useState('');
  const [fValueMax, setFValueMax] = useState('');
  const [fUserId, setFUserId] = useState('');
  const [fDateFrom, setFDateFrom] = useState('');
  const [fDateTo, setFDateTo] = useState('');
  const [search, setSearch] = useState('');

  // ── Ordenamiento ──
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // ── Paginación ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);


  useEffect(() => {
    Promise.all([
      fetch('/api/leads').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([l, u]) => { setLeads(l); setUsers(u); setLoading(false); });
  }, []);

  const openNew = () => {
    setEditLead(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (lead: Lead) => {
    setEditLead(lead);
    setFormError('');
    setFormData({
      companyName:    lead.companyName,
      contactName:    lead.contactName,
      email:          lead.email,
      phone:          lead.phone || '',
      status:         lead.status,
      source:         lead.source,
      tipo:             lead.tipo || '',
      solucionAsociada: lead.solucionAsociada || '',
      scope:            lead.scope || '',
      estimatedValue:   String(lead.estimatedValue),
      notes:          lead.notes || '',
      userId:         lead.user.id,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editLead) {
        const res = await fetch(`/api/leads/${editLead.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          const updated = await res.json();
          setLeads(leads.map(l => l.id === updated.id ? updated : l));
          setShowModal(false);
        } else {
          const data = await res.json();
          setFormError(data.error || `Error ${res.status}`);
        }
      } else {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (res.ok) {
          const newLead = await res.json();
          setLeads([newLead, ...leads]);
          setShowModal(false);
        } else {
          const data = await res.json();
          setFormError(data.error || `Error ${res.status}`);
        }
      }
    } catch {
      setFormError('Error de conexión. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    setDelError('');
    try {
      const res = await fetch(`/api/leads/${confirmDel.id}`, { method: 'DELETE' });
      if (res.ok) {
        setLeads(leads.filter(l => l.id !== confirmDel.id));
        setConfirmDel(null);
      } else {
        const data = await res.json();
        setDelError(data.error || `Error ${res.status}`);
      }
    } catch {
      setDelError('Error de conexión. Intenta de nuevo.');
    } finally {
      setDeleting(false);
    }
  };

  const openNotes = async (lead: Lead) => {
    setNotesLead(lead);
    setNoteText('');
    setNotesLoading(true);
    const data = await fetch(`/api/leads/${lead.id}/notes`).then(r => r.json());
    setNotesList(data);
    setNotesLoading(false);
  };

  const addNote = async () => {
    if (!notesLead || !noteText.trim()) return;
    setAddingNote(true);
    const res = await fetch(`/api/leads/${notesLead.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: noteText }),
    });
    if (res.ok) {
      const note = await res.json();
      setNotesList(prev => [note, ...prev]);
      setNoteText('');
    }
    setAddingNote(false);
  };

  // ── Filtrado ──
  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (search) {
        const q = search.toLowerCase();
        if (!l.companyName.toLowerCase().includes(q) && !l.contactName.toLowerCase().includes(q) && !l.email.toLowerCase().includes(q))
          return false;
      }
      if (fStatus && l.status !== fStatus) return false;
      if (fSource && !l.source.toLowerCase().includes(fSource.toLowerCase())) return false;
      if (fScope && l.scope && !l.scope.toLowerCase().includes(fScope.toLowerCase())) return false;
      if (fValueMin && l.estimatedValue < Number(fValueMin)) return false;
      if (fValueMax && l.estimatedValue > Number(fValueMax)) return false;
      if (fUserId && l.user.id !== fUserId) return false;
      if (fDateFrom) {
        const d = new Date(l.createdAt);
        d.setHours(0,0,0,0);
        if (d < new Date(fDateFrom + 'T00:00:00')) return false;
      }
      if (fDateTo) {
        const d = new Date(l.createdAt);
        d.setHours(0,0,0,0);
        if (d > new Date(fDateTo + 'T23:59:59')) return false;
      }
      return true;
    });
  }, [leads, search, fStatus, fSource, fValueMin, fValueMax, fUserId, fDateFrom, fDateTo]);

  // ── Ordenamiento ──
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      if (sortKey === 'user') {
        aVal = a.user.name.toLowerCase();
        bVal = b.user.name.toLowerCase();
      } else if (sortKey === 'createdAt') {
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
      } else if (sortKey === 'estimatedValue') {
        aVal = a.estimatedValue;
        bVal = b.estimatedValue;
      } else {
        aVal = (a[sortKey as keyof Lead] as string)?.toLowerCase?.() ?? '';
        bVal = (b[sortKey as keyof Lead] as string)?.toLowerCase?.() ?? '';
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  // ── Paginación ──
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset page when filters or pageSize change
  const activeFilterCount = [fStatus, fSource, fScope, fValueMin, fValueMax, fUserId, fDateFrom, fDateTo].filter(v => v).length;
  useMemo(() => { setPage(1); }, [search, fStatus, fSource, fScope, fValueMin, fValueMax, fUserId, fDateFrom, fDateTo, pageSize]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };


  const clearFilters = () => {
    setSearch('');
    setFStatus('');
    setFSource('');
    setFScope('');
    setFValueMin('');
    setFValueMax('');
    setFUserId('');
    setFDateFrom('');
    setFDateTo('');
  };

  const exportCSV = () => {
    const data = sorted;
    const headers = ['Empresa', 'Alcance', 'Contacto', 'Email', 'Teléfono', 'Estado', 'Fuente', 'Valor Estimado', 'Responsable', 'Creado'];
    const rows = data.map(l => [
      l.companyName, l.scope ?? '', l.contactName, l.email, l.phone ?? '', translateStatus(l.status),
      l.source, l.estimatedValue, l.user.name, new Date(l.createdAt).toLocaleDateString('es-ES'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <span className="text-gray-600 ml-1">↕</span>;
    return <span className="text-orange-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );

  const totalPipeline   = leads.filter(l => l.status !== 'LOST').reduce((a, l) => a + l.estimatedValue, 0);
  const totalGanado     = leads.filter(l => l.status === 'WON').reduce((a, l) => a + l.estimatedValue, 0);
  const leadsGanados    = leads.filter(l => l.status === 'WON').length;
  const tasaConversion  = leads.length > 0 ? Math.round((leadsGanados / leads.length) * 100) : 0;

  return (
    <div className="p-8">
      {/* Header */}
      <LeadsNav />

        <>
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Leads',      value: leads.length,                           color: 'text-white' },
              { label: 'Pipeline activo',  value: `$${totalPipeline.toLocaleString()}`,   color: 'text-orange-400' },
              { label: 'Valor resultado',  value: `$${totalGanado.toLocaleString()}`,     color: 'text-green-400' },
              { label: 'Tasa conversión',  value: `${tasaConversion}%`,                   color: 'text-blue-400' },
            ].map(k => (
              <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Barra de búsqueda + toggle filtros */}
          <div className="flex gap-3 mb-4">
            <button onClick={exportCSV} className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors text-sm flex items-center gap-2 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              CSV
            </button>
            <button onClick={openNew} className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium flex-shrink-0">
              + Nuevo Lead
            </button>
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                placeholder="Buscar por empresa, contacto o email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-gray-800 text-white text-sm"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 ${
                showFilters || activeFilterCount > 0
                  ? 'bg-orange-600/20 border-orange-500/50 text-orange-400'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
              Filtros {activeFilterCount > 0 && `(${activeFilterCount})`}
            </button>
          </div>

          {/* Panel de filtros */}
          {showFilters && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4 grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Estado</label>
                <select value={fStatus} onChange={e => setFStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-orange-500">
                  <option value="">Todos</option>
                  <option value="NEW">Identificación</option>
                  <option value="CONTACTED">Contacto</option>
                  <option value="DIAGNOSIS">Diagnóstico</option>
                  <option value="QUALIFIED">Diagnóstico</option>
                  <option value="DEMO_VALIDATION">Demo</option>
                  <option value="PROPOSAL_SENT">Propuesta</option>
                  <option value="NEGOTIATION">Negociación</option>
                  <option value="WON">Resultado</option>
                  <option value="LOST">Resultado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Fuente</label>
                <input type="text" placeholder="LinkedIn, Web, Referido..." value={fSource} onChange={e => setFSource(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Alcance</label>
                <input type="text" placeholder="Buscar por alcance..." value={fScope} onChange={e => setFScope(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Valor mín.</label>
                <input type="number" placeholder="$0" value={fValueMin} onChange={e => setFValueMin(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Valor máx.</label>
                <input type="number" placeholder="$100,000" value={fValueMax} onChange={e => setFValueMax(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Responsable</label>
                <select value={fUserId} onChange={e => setFUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-orange-500">
                  <option value="">Todos</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Desde fecha</label>
                <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-orange-500 [color-scheme:dark]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">Hasta fecha</label>
                <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-orange-500 [color-scheme:dark]" />
              </div>
              <div className="flex items-end">
                <button onClick={clearFilters} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
                  Limpiar filtros
                </button>
              </div>
            </div>
          )}

          {/* Active filter badges */}
          {activeFilterCount > 0 && !showFilters && (
            <div className="flex flex-wrap gap-2 mb-4">
              {fStatus && <span className="px-2.5 py-1 bg-orange-600/20 border border-orange-500/30 rounded-full text-xs text-orange-400 flex items-center gap-1">{translateStatus(fStatus)} <button onClick={() => setFStatus('')} className="hover:text-white">×</button></span>}
              {fSource && <span className="px-2.5 py-1 bg-orange-600/20 border border-orange-500/30 rounded-full text-xs text-orange-400 flex items-center gap-1">Fuente: {fSource} <button onClick={() => setFSource('')} className="hover:text-white">×</button></span>}
              {fScope && <span className="px-2.5 py-1 bg-orange-600/20 border border-orange-500/30 rounded-full text-xs text-orange-400 flex items-center gap-1">Alcance: {fScope} <button onClick={() => setFScope('')} className="hover:text-white">×</button></span>}
              {fValueMin && <span className="px-2.5 py-1 bg-orange-600/20 border border-orange-500/30 rounded-full text-xs text-orange-400 flex items-center gap-1">≥ ${Number(fValueMin).toLocaleString()} <button onClick={() => setFValueMin('')} className="hover:text-white">×</button></span>}
              {fValueMax && <span className="px-2.5 py-1 bg-orange-600/20 border border-orange-500/30 rounded-full text-xs text-orange-400 flex items-center gap-1">≤ ${Number(fValueMax).toLocaleString()} <button onClick={() => setFValueMax('')} className="hover:text-white">×</button></span>}
              {fUserId && <span className="px-2.5 py-1 bg-orange-600/20 border border-orange-500/30 rounded-full text-xs text-orange-400 flex items-center gap-1">{users.find(u => u.id === fUserId)?.name} <button onClick={() => setFUserId('')} className="hover:text-white">×</button></span>}
              {fDateFrom && <span className="px-2.5 py-1 bg-orange-600/20 border border-orange-500/30 rounded-full text-xs text-orange-400 flex items-center gap-1">Desde: {formatDate(fDateFrom)} <button onClick={() => setFDateFrom('')} className="hover:text-white">×</button></span>}
              {fDateTo && <span className="px-2.5 py-1 bg-orange-600/20 border border-orange-500/30 rounded-full text-xs text-orange-400 flex items-center gap-1">Hasta: {formatDate(fDateTo)} <button onClick={() => setFDateTo('')} className="hover:text-white">×</button></span>}
            </div>
          )}


          {/* Tabla */}
          <div className="bg-gray-900 rounded-xl shadow border border-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    {isAdmin && (
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                    )}
                    {([
                      { key: 'companyName' as SortKey,     label: 'Empresa' },
                      { key: 'scope' as SortKey,           label: 'Alcance' },
                      { key: 'contactName' as SortKey,     label: 'Contacto' },
                      { key: 'email' as SortKey,            label: 'Email' },
                      { key: 'status' as SortKey,           label: 'Estado' },
                      { key: 'estimatedValue' as SortKey,   label: 'Valor' },
                      { key: 'source' as SortKey,           label: 'Fuente' },
                      { key: 'createdAt' as SortKey,       label: 'Días' },
                      { key: 'user' as SortKey,             label: 'Responsable' },
                    ]).map(col => (
                      <th key={col.key}
                        onClick={() => handleSort(col.key)}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-white transition-colors">
                        {col.label}{sortIcon(col.key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-gray-900 divide-y divide-gray-800">
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 11 : 10} className="px-6 py-16 text-center">
                        {leads.length === 0 ? (
                          <div>
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                            </div>
                            <p className="text-gray-400 font-medium mb-1">No hay leads todavía</p>
                            <p className="text-gray-500 text-sm mb-4">Crea tu primer lead para empezar a gestionar oportunidades.</p>
                            <button onClick={openNew} className="px-4 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors">+ Nuevo Lead</button>
                          </div>
                        ) : (
                          <div>
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                              <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <p className="text-gray-400 font-medium mb-1">Sin resultados</p>
                            <p className="text-gray-500 text-sm mb-4">Ningún lead coincide con los filtros aplicados.</p>
                            <button onClick={clearFilters} className="px-4 py-2 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600 transition-colors">Limpiar filtros</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginated.map(lead => (
                      <tr key={lead.id} className="hover:bg-gray-800/50">
                        {isAdmin && (
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <button onClick={() => router.push(`/leads/${lead.id}/hub`)} title="HUB" className="text-orange-400 hover:text-orange-300 transition-colors"><LayoutDashboard size={15} /></button>
                              <button onClick={() => openNotes(lead)} title="Notas" className="text-blue-400 hover:text-blue-300 transition-colors"><StickyNote size={14} /></button>
                              <button onClick={() => openEdit(lead)} title="Editar" className="text-gray-400 hover:text-white transition-colors"><Pencil size={14} /></button>
                              <button onClick={() => setConfirmDel(lead)} title="Eliminar" className="text-red-500/60 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{lead.companyName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{lead.scope || '—'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{lead.contactName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{lead.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-1 text-xs font-semibold rounded-full w-fit ${STATUS_COLORS[lead.status] || 'bg-gray-800 text-gray-400'}`}>
                              {translateStatus(lead.status)}
                            </span>
                            {lead.tipo && (
                              <span className="px-2 py-0.5 text-[10px] bg-gray-700 text-gray-400 rounded-full w-fit">
                                {lead.tipo}
                              </span>
                            )}
                            {lead.solucionAsociada && (
                              <span className="px-2 py-0.5 text-[10px] bg-orange-900/30 text-orange-400 border border-orange-800/40 rounded-full w-fit">
                                {lead.solucionAsociada}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">${lead.estimatedValue.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{lead.source}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            !['WON', 'LOST'].includes(lead.status) &&
                            (Date.now() - new Date(lead.createdAt).getTime()) / 86400000 > 7
                              ? 'bg-red-900/20 text-red-400' : 'text-gray-500'
                          }`}>
                            {Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86400000)}d
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-sm text-gray-400">{lead.user.name}</p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {sorted.length > 0 && (
              <div className="px-6 py-3 border-t border-gray-800 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3 text-gray-400">
                  <span>{sorted.length} resultado{sorted.length !== 1 ? 's' : ''}</span>
                  <span className="text-gray-600">|</span>
                  <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:ring-2 focus:ring-orange-500">
                    {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / pág</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                    className="px-2 py-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    ‹
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => {
                    if (totalPages <= 7) return true;
                    if (p === 1 || p === totalPages) return true;
                    if (Math.abs(p - safePage) <= 1) return true;
                    return false;
                  }).map((p, i, arr) => (
                    <span key={p}>
                      {i > 0 && arr[i - 1] !== p - 1 && <span className="text-gray-600 px-1">…</span>}
                      <button onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                          p === safePage ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }`}>
                        {p}
                      </button>
                    </span>
                  ))}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                    className="px-2 py-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                    ›
                  </button>
                </div>
              </div>
            )}
          </div>
        </>

      {/* Modal crear / editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">{editLead ? 'Editar Lead' : 'Nuevo Lead'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Empresa</label>
                  <input type="text" required value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Alcance</label>
                  <input type="text" placeholder="Describe el alcance u objeto del requerimiento..." value={formData.scope} onChange={e => setFormData({...formData, scope: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white text-sm placeholder-gray-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Contacto</label>
                  <input type="text" required value={formData.contactName} onChange={e => setFormData({...formData, contactName: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Teléfono</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
                  <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white">
                    <option value="">Seleccionar...</option>
                    <option value="Desarrollos">Desarrollos</option>
                    <option value="Productos">Productos</option>
                    <option value="Servicios Gestionados">Servicios Gestionados</option>
                    <option value="Soporte">Soporte</option>
                    <option value="Consultoría">Consultoría</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Solución Asociada</label>
                  <select value={formData.solucionAsociada} onChange={e => setFormData({...formData, solucionAsociada: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white">
                    <option value="">Seleccionar...</option>
                    <option value="Project">Project</option>
                    <option value="Demo">Demo</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Products">Products</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Estado</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white">
                    <option value="NEW">Identificación</option>
                    <option value="CONTACTED">Contacto</option>
                    <option value="DIAGNOSIS">Diagnóstico</option>
                    <option value="QUALIFIED">Diagnóstico</option>
                    <option value="DEMO_VALIDATION">Demo</option>
                    <option value="PROPOSAL_SENT">Propuesta</option>
                    <option value="NEGOTIATION">Negociación</option>
                    <option value="WON">Resultado</option>
                    <option value="LOST">Resultado</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Fuente</label>
                  <input type="text" required value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Valor Estimado</label>
                  <input type="number" value={formData.estimatedValue} onChange={e => setFormData({...formData, estimatedValue: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Responsable</label>
                <select required value={formData.userId} onChange={e => setFormData({...formData, userId: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white">
                  <option value="">Seleccionar...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Notas</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={3} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white" />
              </div>
              {formError && (
                <div className="px-4 py-2 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">
                  {formError}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800/50 text-gray-300">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2">
                  {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {editLead ? 'Guardar Cambios' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal notas */}
      {notesLead && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Notas — {notesLead.companyName}</h2>
              <button onClick={() => setNotesLead(null)} className="text-gray-400 hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addNote()}
                placeholder="Escribe una nota..."
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
              />
              <button
                onClick={addNote}
                disabled={addingNote || !noteText.trim()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50"
              >
                {addingNote ? '...' : 'Agregar'}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {notesLoading && <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" /></div>}
              {!notesLoading && notesList.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-4">Sin notas aún. Agrega la primera.</p>
              )}
              {notesList.map(n => (
                <div key={n.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                  <p className="text-sm text-white">{n.description}</p>
                  <p className="text-xs text-gray-500 mt-1">{n.user.name} · {new Date(n.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">Eliminar lead</h3>
                <p className="text-gray-400 text-sm">¿Seguro que deseas eliminar <span className="text-white font-medium">{confirmDel.companyName}</span>? Esta acción no se puede deshacer.</p>
              </div>
            </div>
            {delError && (
              <div className="mb-3 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">
                {delError}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button onClick={() => { setConfirmDel(null); setDelError(''); }} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-60 flex items-center gap-2">
                {deleting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
