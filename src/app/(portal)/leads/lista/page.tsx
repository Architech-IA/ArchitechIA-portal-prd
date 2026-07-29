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
  status: 'NEW', source: '', solucionAsociada: '', scope: '', estimatedValue: '', notes: '', userId: '',
};

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  NEW:             { label: 'Identificación', color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.25)'  },
  CONTACTED:       { label: 'Contacto',       color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)' },
  DIAGNOSIS:       { label: 'Diagnóstico',    color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  border: 'rgba(34,211,238,0.25)'  },
  QUALIFIED:       { label: 'Diagnóstico',    color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  border: 'rgba(34,211,238,0.25)'  },
  DEMO_VALIDATION: { label: 'Demo',           color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)',  border: 'rgba(45,212,191,0.25)'  },
  PROPOSAL_SENT:   { label: 'Propuesta',      color: '#818cf8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.25)' },
  NEGOTIATION:     { label: 'Negociación',    color: '#f97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.25)'  },
  WON:             { label: 'Resultado',      color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.25)'  },
  LOST:            { label: 'Resultado',      color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' },
};

const glass = {
  card:  { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px' },
  panel: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', backdropFilter: 'blur(12px)' },
  input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', outline: 'none', width: '100%' },
  modal: { background: 'rgba(8,8,26,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', backdropFilter: 'blur(24px)' },
};

function translateStatus(status: string) { return STATUS_META[status]?.label ?? status; }

const PAGE_SIZES = [10, 20, 50];
type SortKey = 'companyName' | 'scope' | 'contactName' | 'email' | 'status' | 'estimatedValue' | 'source' | 'user' | 'createdAt';

export default function LeadsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = ['ADMIN','SUPERADMIN'].includes((session?.user as { role?: string })?.role ?? '');

  const [leads, setLeads]           = useState<Lead[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editLead, setEditLead]     = useState<Lead | null>(null);
  const [confirmDel, setConfirmDel] = useState<Lead | null>(null);
  const [users, setUsers]           = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData]     = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');
  const [deleting, setDeleting]     = useState(false);
  const [delError, setDelError]     = useState('');
  const [notesLead, setNotesLead]   = useState<Lead | null>(null);
  const [notesList, setNotesList]   = useState<{ id: string; description: string; createdAt: string; user: { name: string } }[]>([]);
  const [noteText, setNoteText]     = useState('');
  const [notesLoading, setNotesLoading] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [fStatus, setFStatus]   = useState('');
  const [fSource, setFSource]   = useState('');
  const [fScope, setFScope]     = useState('');
  const [fValueMin, setFValueMin] = useState('');
  const [fValueMax, setFValueMax] = useState('');
  const [fUserId, setFUserId]   = useState('');
  const [fDateFrom, setFDateFrom] = useState('');
  const [fDateTo, setFDateTo]   = useState('');
  const [search, setSearch]     = useState('');
  const [sortKey, setSortKey]   = useState<SortKey>('createdAt');
  const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('desc');
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    Promise.all([
      fetch('/api/leads').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([l, u]) => { setLeads(l); setUsers(u); setLoading(false); });
  }, []);

  const openNew = () => { setEditLead(null); setFormData(EMPTY_FORM); setFormError(''); setShowModal(true); };
  const openEdit = (lead: Lead) => {
    setEditLead(lead); setFormError('');
    setFormData({ companyName: lead.companyName, contactName: lead.contactName, email: lead.email, phone: lead.phone || '', status: lead.status, source: lead.source, solucionAsociada: lead.solucionAsociada || '', scope: lead.scope || '', estimatedValue: String(lead.estimatedValue), notes: lead.notes || '', userId: lead.user.id });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setFormError('');
    try {
      if (editLead) {
        const res = await fetch(`/api/leads/${editLead.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
        if (res.ok) { const updated = await res.json(); setLeads(leads.map(l => l.id === updated.id ? updated : l)); setShowModal(false); }
        else { const data = await res.json(); setFormError(data.error || `Error ${res.status}`); }
      } else {
        const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
        if (res.ok) { const newLead = await res.json(); setLeads([newLead, ...leads]); setShowModal(false); }
        else { const data = await res.json(); setFormError(data.error || `Error ${res.status}`); }
      }
    } catch { setFormError('Error de conexión. Intenta de nuevo.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDel) return; setDeleting(true); setDelError('');
    try {
      const res = await fetch(`/api/leads/${confirmDel.id}`, { method: 'DELETE' });
      if (res.ok) { setLeads(leads.filter(l => l.id !== confirmDel.id)); setConfirmDel(null); }
      else { const data = await res.json(); setDelError(data.error || `Error ${res.status}`); }
    } catch { setDelError('Error de conexión. Intenta de nuevo.'); }
    finally { setDeleting(false); }
  };

  const openNotes = async (lead: Lead) => {
    setNotesLead(lead); setNoteText(''); setNotesLoading(true);
    const data = await fetch(`/api/leads/${lead.id}/notes`).then(r => r.json());
    setNotesList(data); setNotesLoading(false);
  };

  const addNote = async () => {
    if (!notesLead || !noteText.trim()) return; setAddingNote(true);
    const res = await fetch(`/api/leads/${notesLead.id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: noteText }) });
    if (res.ok) { const note = await res.json(); setNotesList(prev => [note, ...prev]); setNoteText(''); }
    setAddingNote(false);
  };

  const filtered = useMemo(() => leads.filter(l => {
    if (search) { const q = search.toLowerCase(); if (!l.companyName.toLowerCase().includes(q) && !l.contactName.toLowerCase().includes(q) && !l.email.toLowerCase().includes(q)) return false; }
    if (fStatus && l.status !== fStatus) return false;
    if (fSource && !l.source.toLowerCase().includes(fSource.toLowerCase())) return false;
    if (fScope && l.scope && !l.scope.toLowerCase().includes(fScope.toLowerCase())) return false;
    if (fValueMin && l.estimatedValue < Number(fValueMin)) return false;
    if (fValueMax && l.estimatedValue > Number(fValueMax)) return false;
    if (fUserId && l.user.id !== fUserId) return false;
    if (fDateFrom) { const d = new Date(l.createdAt); d.setHours(0,0,0,0); if (d < new Date(fDateFrom + 'T00:00:00')) return false; }
    if (fDateTo) { const d = new Date(l.createdAt); d.setHours(0,0,0,0); if (d > new Date(fDateTo + 'T23:59:59')) return false; }
    return true;
  }), [leads, search, fStatus, fSource, fValueMin, fValueMax, fUserId, fDateFrom, fDateTo, fScope]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let aVal: string | number = '', bVal: string | number = '';
      if (sortKey === 'user') { aVal = a.user.name.toLowerCase(); bVal = b.user.name.toLowerCase(); }
      else if (sortKey === 'createdAt') { aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime(); }
      else if (sortKey === 'estimatedValue') { aVal = a.estimatedValue; bVal = b.estimatedValue; }
      else { aVal = (a[sortKey as keyof Lead] as string)?.toLowerCase?.() ?? ''; bVal = (b[sortKey as keyof Lead] as string)?.toLowerCase?.() ?? ''; }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const paginated  = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const activeFilterCount = [fStatus, fSource, fScope, fValueMin, fValueMax, fUserId, fDateFrom, fDateTo].filter(v => v).length;
  useMemo(() => { setPage(1); }, [search, fStatus, fSource, fScope, fValueMin, fValueMax, fUserId, fDateFrom, fDateTo, pageSize]);

  const handleSort = (key: SortKey) => { if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc'); } };
  const clearFilters = () => { setSearch(''); setFStatus(''); setFSource(''); setFScope(''); setFValueMin(''); setFValueMax(''); setFUserId(''); setFDateFrom(''); setFDateTo(''); };

  const exportCSV = () => {
    const headers = ['Empresa','Alcance','Contacto','Email','Teléfono','Estado','Fuente','Valor Estimado','Responsable','Creado'];
    const rows = sorted.map(l => [l.companyName, l.scope ?? '', l.contactName, l.email, l.phone ?? '', translateStatus(l.status), l.source, l.estimatedValue, l.user.name, new Date(l.createdAt).toLocaleDateString('es-ES')]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  const sortIcon = (key: SortKey) => sortKey !== key
    ? <span style={{ color: '#334155', marginLeft: '4px' }}>↕</span>
    : <span style={{ color: '#f97316', marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;

  const inputCls: React.CSSProperties = { ...glass.input, padding: '8px 12px', fontSize: '13px' };
  const labelCls: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }
      const selectCls: React.CSSProperties = { ...glass.input, padding: '8px 12px', fontSize: '13px', colorScheme: 'dark', cursor: 'pointer' };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#f97316', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  const totalPipeline  = leads.filter(l => l.status !== 'LOST').reduce((a, l) => a + l.estimatedValue, 0);
  const totalGanado    = leads.filter(l => l.status === 'WON').reduce((a, l) => a + l.estimatedValue, 0);
  const leadsGanados   = leads.filter(l => l.status === 'WON').length;
  const tasaConversion = leads.length > 0 ? Math.round((leadsGanados / leads.length) * 100) : 0;

  const KPI_CARDS = [
    { label: 'Total Leads',     value: leads.length,                         color: '#f1f5f9', accent: 'rgba(241,245,249,0.08)' },
    { label: 'Pipeline activo', value: `$${totalPipeline.toLocaleString()}`, color: '#f97316', accent: 'rgba(249,115,22,0.08)'   },
    { label: 'Valor resultado', value: `$${totalGanado.toLocaleString()}`,   color: '#34d399', accent: 'rgba(52,211,153,0.08)'   },
    { label: 'Tasa conversión', value: `${tasaConversion}%`,                 color: '#60a5fa', accent: 'rgba(96,165,250,0.08)'   },
  ];

  return (
    <div style={{ padding: '10px 32px 32px' }}>
      <LeadsNav />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
        {KPI_CARDS.map(k => (
          <div key={k.label} style={{ ...glass.card, padding: '16px 20px', background: k.accent }}>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{k.label}</p>
            <p style={{ fontSize: '24px', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
        <button onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          CSV
        </button>
        <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 12px rgba(249,115,22,0.3)' }}>
          + Nuevo Lead
        </button>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569' }} width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Buscar por empresa, contacto o email..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputCls, paddingLeft: '36px' }} />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', flexShrink: 0, border: showFilters || activeFilterCount > 0 ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.08)', background: showFilters || activeFilterCount > 0 ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.05)', color: showFilters || activeFilterCount > 0 ? '#f97316' : '#64748b' }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
          Filtros {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{ ...glass.panel, padding: '20px', marginBottom: '12px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
          {[
            { label: 'Estado', el: <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={inputCls}>
                <option value="">Todos</option>
                {Object.entries(STATUS_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select> },
            { label: 'Fuente', el: <input type="text" placeholder="LinkedIn, Web..." value={fSource} onChange={e => setFSource(e.target.value)} style={inputCls} /> },
            { label: 'Alcance', el: <input type="text" placeholder="Buscar alcance..." value={fScope} onChange={e => setFScope(e.target.value)} style={inputCls} /> },
            { label: 'Valor mín.', el: <input type="number" placeholder="$0" value={fValueMin} onChange={e => setFValueMin(e.target.value)} style={inputCls} /> },
            { label: 'Valor máx.', el: <input type="number" placeholder="$100,000" value={fValueMax} onChange={e => setFValueMax(e.target.value)} style={inputCls} /> },
            { label: 'Responsable', el: <select value={fUserId} onChange={e => setFUserId(e.target.value)} style={inputCls}>
                <option value="">Todos</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select> },
            { label: 'Desde fecha', el: <input type="date" value={fDateFrom} onChange={e => setFDateFrom(e.target.value)} style={{ ...inputCls, colorScheme: 'dark' } as React.CSSProperties} /> },
            { label: 'Hasta fecha', el: <input type="date" value={fDateTo} onChange={e => setFDateTo(e.target.value)} style={{ ...inputCls, colorScheme: 'dark' } as React.CSSProperties} /> },
          ].map(f => (
            <div key={f.label}>
              <label style={labelCls}>{f.label}</label>
              {f.el}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={clearFilters} style={{ padding: '8px 14px', fontSize: '12px', color: '#64748b', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', cursor: 'pointer' }}>
              Limpiar filtros
            </button>
          </div>
        </div>
      )}

      {/* Active filter badges */}
      {activeFilterCount > 0 && !showFilters && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
          {fStatus && <span style={{ padding: '3px 10px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '20px', fontSize: '11px', color: '#f97316', display: 'flex', alignItems: 'center', gap: '4px' }}>{translateStatus(fStatus)} <button onClick={() => setFStatus('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', lineHeight: 1 }}>×</button></span>}
          {fSource && <span style={{ padding: '3px 10px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '20px', fontSize: '11px', color: '#f97316', display: 'flex', alignItems: 'center', gap: '4px' }}>Fuente: {fSource} <button onClick={() => setFSource('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', lineHeight: 1 }}>×</button></span>}
          {fScope && <span style={{ padding: '3px 10px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '20px', fontSize: '11px', color: '#f97316', display: 'flex', alignItems: 'center', gap: '4px' }}>Alcance: {fScope} <button onClick={() => setFScope('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', lineHeight: 1 }}>×</button></span>}
          {fValueMin && <span style={{ padding: '3px 10px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '20px', fontSize: '11px', color: '#f97316', display: 'flex', alignItems: 'center', gap: '4px' }}>≥ ${Number(fValueMin).toLocaleString()} <button onClick={() => setFValueMin('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', lineHeight: 1 }}>×</button></span>}
          {fValueMax && <span style={{ padding: '3px 10px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '20px', fontSize: '11px', color: '#f97316', display: 'flex', alignItems: 'center', gap: '4px' }}>≤ ${Number(fValueMax).toLocaleString()} <button onClick={() => setFValueMax('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', lineHeight: 1 }}>×</button></span>}
          {fUserId && <span style={{ padding: '3px 10px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '20px', fontSize: '11px', color: '#f97316', display: 'flex', alignItems: 'center', gap: '4px' }}>{users.find(u => u.id === fUserId)?.name} <button onClick={() => setFUserId('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', lineHeight: 1 }}>×</button></span>}
          {fDateFrom && <span style={{ padding: '3px 10px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '20px', fontSize: '11px', color: '#f97316', display: 'flex', alignItems: 'center', gap: '4px' }}>Desde: {formatDate(fDateFrom)} <button onClick={() => setFDateFrom('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', lineHeight: 1 }}>×</button></span>}
          {fDateTo && <span style={{ padding: '3px 10px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', borderRadius: '20px', fontSize: '11px', color: '#f97316', display: 'flex', alignItems: 'center', gap: '4px' }}>Hasta: {formatDate(fDateTo)} <button onClick={() => setFDateTo('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', lineHeight: 1 }}>×</button></span>}
        </div>
      )}

      {/* Table */}
      <div style={{ ...glass.card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {isAdmin && <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Acciones</th>}
                {([
                  { key: 'companyName'    as SortKey, label: 'Empresa'     },
                  { key: 'scope'          as SortKey, label: 'Alcance'     },
                  { key: 'contactName'    as SortKey, label: 'Contacto'    },
                  { key: 'email'          as SortKey, label: 'Email'       },
                  { key: 'status'         as SortKey, label: 'Estado'      },
                  { key: 'estimatedValue' as SortKey, label: 'Valor'       },
                  { key: 'source'         as SortKey, label: 'Fuente'      },
                  { key: 'createdAt'      as SortKey, label: 'Días'        },
                  { key: 'user'           as SortKey, label: 'Responsable' },
                ]).map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key)} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}>
                    {col.label}{sortIcon(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} style={{ padding: '64px 24px', textAlign: 'center' }}>
                    <div style={{ width: '52px', height: '52px', margin: '0 auto 16px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="24" height="24" fill="none" stroke="#475569" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 500 }}>{leads.length === 0 ? 'No hay leads todavía' : 'Sin resultados'}</p>
                    <p style={{ color: '#334155', fontSize: '12px', marginTop: '4px' }}>{leads.length === 0 ? 'Crea tu primer lead.' : 'Ningún lead coincide con los filtros.'}</p>
                  </td>
                </tr>
              ) : (
                paginated.map((lead, i) => {
                  const sm = STATUS_META[lead.status];
                  const days = Math.floor((Date.now() - new Date(lead.createdAt).getTime()) / 86400000);
                  const oldAlert = !['WON','LOST'].includes(lead.status) && days > 7;
                  return (
                    <tr key={lead.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                    >
                      {isAdmin && (
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button onClick={() => router.push(`/leads/${lead.id}/hub`)} title="HUB" style={{ background: 'none', border: 'none', color: '#f97316', cursor: 'pointer', display: 'flex' }}><LayoutDashboard size={14} /></button>
                            <button onClick={() => openNotes(lead)} title="Notas" style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', display: 'flex' }}><StickyNote size={14} /></button>
                            <button onClick={() => openEdit(lead)} title="Editar" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex' }}><Pencil size={14} /></button>
                            <button onClick={() => setConfirmDel(lead)} title="Eliminar" style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', opacity: 0.6 }}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      )}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{lead.companyName}</td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.scope || '—'}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: '12px', color: '#94a3b8' }}>{lead.contactName}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: '12px', color: '#64748b' }}>{lead.email}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {sm && <span style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 700, borderRadius: '20px', background: sm.bg, color: sm.color, border: `1px solid ${sm.border}`, width: 'fit-content' }}>{sm.label}</span>}
                          {lead.tipo && <span style={{ padding: '2px 8px', fontSize: '10px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)', width: 'fit-content' }}>{lead.tipo}</span>}
                          {lead.solucionAsociada && <span style={{ padding: '2px 8px', fontSize: '10px', borderRadius: '20px', background: 'rgba(249,115,22,0.08)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)', width: 'fit-content' }}>{lead.solucionAsociada}</span>}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>${lead.estimatedValue.toLocaleString()}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: '12px', color: '#64748b' }}>{lead.source}</td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: oldAlert ? 'rgba(248,113,113,0.1)' : 'transparent', color: oldAlert ? '#f87171' : '#475569', border: oldAlert ? '1px solid rgba(248,113,113,0.2)' : 'none' }}>{days}d</span>
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontSize: '12px', color: '#64748b' }}>{lead.user.name}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {sorted.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569' }}>
              <span>{sorted.length} resultado{sorted.length !== 1 ? 's' : ''}</span>
              <span style={{ color: '#1e293b' }}>|</span>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '3px 8px', color: '#94a3b8', fontSize: '11px' }}>
                {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / pág</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} style={{ padding: '4px 8px', borderRadius: '6px', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '14px' }}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => { if (totalPages <= 7) return true; if (p === 1 || p === totalPages) return true; if (Math.abs(p - safePage) <= 1) return true; return false; }).map((p, i, arr) => (
                <span key={p}>
                  {i > 0 && arr[i-1] !== p-1 && <span style={{ color: '#334155', padding: '0 4px' }}>…</span>}
                  <button onClick={() => setPage(p)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: p === safePage ? 'linear-gradient(135deg,#f97316,#ea580c)' : 'transparent', color: p === safePage ? '#fff' : '#475569' }}>{p}</button>
                </span>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} style={{ padding: '4px 8px', borderRadius: '6px', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '14px' }}>›</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal crear / editar */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(4px)' }}>
          <div style={{ ...glass.modal, padding: '28px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,rgba(249,115,22,0.15),rgba(234,88,12,0.08))', margin: '-28px -28px 24px -28px', padding: '20px 28px', borderRadius: '18px 18px 0 0', borderBottom: '1px solid rgba(249,115,22,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: '0 0 8px rgba(249,115,22,0.6)' }} />
                <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#f1f5f9', margin: 0 }}>{editLead ? 'Editar Lead' : 'Nuevo Lead'}</h2>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#94a3b8', cursor: 'pointer', fontSize: '16px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>x</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
                {[['Empresa','companyName','text',true],['Alcance','scope','text',false],['Contacto','contactName','text',true]].map(([l,k,t,r]) => (
                  <div key={k as string}>
                    <label style={labelCls}>{l as string}</label>
                    <input type={t as string} required={r as boolean} value={formData[k as keyof typeof formData]} onChange={e => setFormData({...formData, [k as string]: e.target.value})} style={inputCls} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
                {[['Email','email','email',true],['Teléfono','phone','text',false]].map(([l,k,t,r]) => (
                  <div key={k as string}>
                    <label style={labelCls}>{l as string}</label>
                    <input type={t as string} required={r as boolean} value={formData[k as keyof typeof formData]} onChange={e => setFormData({...formData, [k as string]: e.target.value})} style={inputCls} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
                <div>
                  <label style={labelCls}>Solución Asociada</label>
                  <select value={formData.solucionAsociada} onChange={e => setFormData({...formData, solucionAsociada: e.target.value})} style={selectCls}>
                    <option value="" style={{ background: '#0f172a', color: '#f1f5f9' }}>Seleccionar...</option>
                    {['Project','Demo','Partnership','Products','Intern'].map(v => <option key={v} value={v} style={{ background: '#0f172a', color: '#f1f5f9' }}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelCls}>Estado</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={selectCls}>
                    {Object.entries(STATUS_META).map(([k,v]) => <option key={k} value={k} style={{ background: '#0f172a', color: '#f1f5f9' }}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
                <div>
                  <label style={labelCls}>Fuente</label>
                  <select required value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} style={selectCls}>
                    <option value="" style={{ background: '#0f172a', color: '#f1f5f9' }}>Seleccionar...</option>
                    {['Directo','Referido','Partnership'].map(v => <option key={v} value={v} style={{ background: '#0f172a', color: '#f1f5f9' }}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelCls}>Valor Estimado</label>
                  <input type="number" value={formData.estimatedValue} onChange={e => setFormData({...formData, estimatedValue: e.target.value})} style={inputCls} />
                </div>
              </div>
              <div>
                <label style={labelCls}>Responsable</label>
                <select required value={formData.userId} onChange={e => setFormData({...formData, userId: e.target.value})} style={selectCls}>
                  <option value="" style={{ background: '#0f172a', color: '#f1f5f9' }}>Seleccionar...</option>
                  {users.map(u => <option key={u.id} value={u.id} style={{ background: '#0f172a', color: '#f1f5f9' }}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelCls}>Notas</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={3} style={{ ...inputCls, resize: 'vertical' }} />
              </div>
              {formError && <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', color: '#f87171', fontSize: '13px' }}>{formError}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '8px 18px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: '9px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.6 : 1 }}>
                  {saving && <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />}
                  {editLead ? 'Guardar Cambios' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal notas */}
      {notesLead && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(4px)' }}>
          <div style={{ ...glass.modal, padding: '24px', width: '100%', maxWidth: '480px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Notas — {notesLead.companyName}</h2>
              <button onClick={() => setNotesLead(null)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} placeholder="Escribe una nota..." style={{ ...inputCls, flex: 1 }} />
              <button onClick={addNote} disabled={addingNote || !noteText.trim()} style={{ padding: '8px 14px', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: addingNote || !noteText.trim() ? 0.5 : 1 }}>
                {addingNote ? '...' : 'Agregar'}
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {notesLoading && <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}><div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#f97316', animation: 'spin 0.8s linear infinite' }} /></div>}
              {!notesLoading && notesList.length === 0 && <p style={{ textAlign: 'center', color: '#334155', fontSize: '13px', padding: '16px' }}>Sin notas aún.</p>}
              {notesList.map(n => (
                <div key={n.id} style={{ ...glass.card, padding: '12px 14px' }}>
                  <p style={{ fontSize: '13px', color: '#e2e8f0', margin: '0 0 4px' }}>{n.description}</p>
                  <p style={{ fontSize: '11px', color: '#475569', margin: 0 }}>{n.user.name} · {new Date(n.createdAt).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {confirmDel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(4px)' }}>
          <div style={{ ...glass.modal, padding: '24px', width: '100%', maxWidth: '420px' }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'flex-start' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="18" height="18" fill="none" stroke="#f87171" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', margin: '0 0 4px' }}>Eliminar lead</h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>¿Seguro que deseas eliminar <strong style={{ color: '#e2e8f0' }}>{confirmDel.companyName}</strong>? Esta acción no se puede deshacer.</p>
              </div>
            </div>
            {delError && <div style={{ padding: '8px 12px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '8px', color: '#f87171', fontSize: '12px', marginBottom: '12px' }}>{delError}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => { setConfirmDel(null); setDelError(''); }} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding: '8px 16px', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '9px', color: '#f87171', fontWeight: 700, cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', opacity: deleting ? 0.6 : 1 }}>
                {deleting && <span style={{ width: '12px', height: '12px', border: '2px solid rgba(248,113,113,0.3)', borderTopColor: '#f87171', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
