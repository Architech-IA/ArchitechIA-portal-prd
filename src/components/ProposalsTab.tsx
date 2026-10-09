'use client';

import { useEffect, useState } from 'react';

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: string;
  amount: number;
  sentDate: string | null;
  acceptedDate: string | null;
  createdAt: string;
  lead: { id: string; companyName: string; contactName: string } | null;
  user: { id: string; name: string; email: string };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:        'bg-gray-800 text-gray-400',
  SENT:         'bg-orange-500/20 text-orange-400',
  UNDER_REVIEW: 'bg-yellow-500/20 text-yellow-400',
  ACCEPTED:     'bg-green-500/20 text-green-400',
  REJECTED:     'bg-red-500/20 text-red-400',
};

function translateStatus(status: string): string {
  const t: Record<string, string> = {
    DRAFT: 'Borrador', SENT: 'Enviado', UNDER_REVIEW: 'En Revisión',
    ACCEPTED: 'Aceptado', REJECTED: 'Rechazado',
  };
  return t[status] || status;
}

const STATUS_OPTIONS = [
  { value: '',            label: 'Todos' },
  { value: 'DRAFT',       label: 'Borrador' },
  { value: 'SENT',        label: 'Enviado' },
  { value: 'UNDER_REVIEW', label: 'En Revisión' },
  { value: 'ACCEPTED',    label: 'Aceptado' },
  { value: 'REJECTED',    label: 'Rechazado' },
];

const EMPTY_FORM = { title: '', description: '', status: 'DRAFT', amount: '', leadId: '', userId: '', sentDate: '' };

export default function ProposalsTab({ isAdmin }: { isAdmin: boolean }) {
  const [proposals, setProposals]   = useState<Proposal[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editProposal, setEditProposal] = useState<Proposal | null>(null);
  const [confirmDel, setConfirmDel] = useState<Proposal | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [filter, setFilter]         = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [leads, setLeads]           = useState<{ id: string; companyName: string }[]>([]);
  const [users, setUsers]           = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData]     = useState(EMPTY_FORM);
  const [formError, setFormError]   = useState('');
  const [convertModal, setConvertModal] = useState<Proposal | null>(null);
  const [convertForm, setConvertForm]   = useState({ name: '', userId: '' });
  const [converting, setConverting]     = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/proposals').then(r => r.json()),
      fetch('/api/leads').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([p, l, u]) => { setProposals(p); setLeads(l); setUsers(u); setLoading(false); });
  }, []);

  const openNew = () => {
    setEditProposal(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (p: Proposal) => {
    setEditProposal(p);
    setFormError('');
    setFormData({
      title:       p.title,
      description: p.description,
      status:      p.status,
      amount:      String(p.amount),
      leadId:      p.lead?.id || '',
      userId:      p.user.id,
      sentDate:    p.sentDate ? p.sentDate.split('T')[0] : '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const url    = editProposal ? `/api/proposals/${editProposal.id}` : '/api/proposals';
      const method = editProposal ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const saved = await res.json();
        setProposals(prev => editProposal
          ? prev.map(p => p.id === saved.id ? saved : p)
          : [saved, ...prev]);
        setShowModal(false);
      } else {
        const d = await res.json();
        setFormError(d.error || `Error ${res.status}`);
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
    try {
      const res = await fetch(`/api/proposals/${confirmDel.id}`, { method: 'DELETE' });
      if (res.ok) {
        setProposals(prev => prev.filter(p => p.id !== confirmDel.id));
        setConfirmDel(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleConvert = async () => {
    if (!convertModal || !convertForm.name || !convertForm.userId) return;
    setConverting(true);
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:        convertForm.name,
        description: convertModal.description || '',
        status:      'PLANNING',
        priority:    'MEDIUM',
        progress:    '0',
        userId:      convertForm.userId,
        proposalId:  convertModal.id,
      }),
    });
    setConverting(false);
    setConvertModal(null);
    setConvertForm({ name: '', userId: '' });
  };

  const exportCSV = () => {
    const headers = ['Título', 'Cliente', 'Estado', 'Monto', 'Fecha Envío', 'Responsable', 'Creado'];
    const rows = filtered.map(p => [
      p.title, p.lead?.companyName ?? '', p.status, p.amount,
      p.sentDate ? new Date(p.sentDate).toLocaleDateString('es-ES') : '',
      p.user.name, new Date(p.createdAt).toLocaleDateString('es-ES'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'propuestas.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = proposals.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(filter.toLowerCase()) ||
      p.lead?.companyName.toLowerCase().includes(filter.toLowerCase());
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const kpis = [
    { label: 'Total',      value: proposals.length,                                             color: 'text-white' },
    { label: 'En proceso', value: proposals.filter(p => ['SENT','UNDER_REVIEW'].includes(p.status)).length, color: 'text-orange-400' },
    { label: 'Aceptadas',  value: proposals.filter(p => p.status === 'ACCEPTED').length,        color: 'text-green-400' },
    { label: 'Valor total', value: `$${proposals.reduce((a, p) => a + p.amount, 0).toLocaleString()}`, color: 'text-blue-400' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 rounded-xl shadow border border-gray-800 mb-6">
        {/* Filtros */}
        <div className="p-4 border-b border-gray-800 flex gap-3 flex-wrap items-center">
          <input
            type="text"
            placeholder="Buscar por título o cliente..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="flex-1 min-w-48 px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white text-sm"
          />
          <div className="flex gap-2">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${statusFilter === opt.value ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Título</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Monto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Fecha Envío</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Responsable</th>
                {isAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="bg-gray-900 divide-y divide-gray-800">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-800/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{p.title}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{p.lead?.companyName || '—'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[p.status] || 'bg-gray-800 text-gray-400'}`}>
                      {translateStatus(p.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-white">${p.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {p.sentDate ? new Date(p.sentDate).toLocaleDateString('es-ES') : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{p.user.name}</td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => openEdit(p)} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors">Editar</button>
                        {p.status === 'ACCEPTED' && (
                          <button onClick={() => { setConvertModal(p); setConvertForm({ name: p.title, userId: '' }); }} className="px-3 py-1 text-xs bg-green-900/40 hover:bg-green-800/60 text-green-400 rounded-lg transition-colors">→ Proyecto</button>
                        )}
                        <button onClick={() => setConfirmDel(p)} className="px-3 py-1 text-xs bg-red-900/40 hover:bg-red-800/60 text-red-400 rounded-lg transition-colors">Eliminar</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-6 py-12 text-center text-[#7f8a9c]">
                    No hay propuestas que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear / editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">{editProposal ? 'Editar Propuesta' : 'Nueva Propuesta'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Título</label>
                <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Descripción</label>
                <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Estado</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white">
                    <option value="DRAFT">Borrador</option>
                    <option value="SENT">Enviado</option>
                    <option value="UNDER_REVIEW">En Revisión</option>
                    <option value="ACCEPTED">Aceptado</option>
                    <option value="REJECTED">Rechazado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Monto</label>
                  <input type="number" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Fecha Envío</label>
                  <input type="date" value={formData.sentDate} onChange={e => setFormData({...formData, sentDate: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-sm font-medium text-gray-300 mb-1">Lead Asociado *</label>
                   <select required value={formData.leadId} onChange={e => setFormData({...formData, leadId: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white">
                     <option value="">Seleccionar lead...</option>
                    {leads.map(l => <option key={l.id} value={l.id}>{l.companyName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Responsable</label>
                  <select required value={formData.userId} onChange={e => setFormData({...formData, userId: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 bg-gray-800 text-white">
                    <option value="">Seleccionar...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              {formError && (
                <div className="px-4 py-2 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">{formError}</div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800/50 text-gray-300">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 flex items-center gap-2">
                  {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {editProposal ? 'Guardar Cambios' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal convertir a proyecto */}
      {convertModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-white mb-1">Crear Proyecto desde Propuesta</h2>
            <p className="text-gray-400 text-sm mb-5">Propuesta: <span className="text-white">{convertModal.title}</span></p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre del proyecto</label>
                <input type="text" value={convertForm.name} onChange={e => setConvertForm({...convertForm, name: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Owner del proyecto</label>
                <select value={convertForm.userId} onChange={e => setConvertForm({...convertForm, userId: e.target.value})} className="w-full px-4 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white focus:ring-2 focus:ring-orange-500">
                  <option value="">Seleccionar...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setConvertModal(null)} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800">Cancelar</button>
                <button onClick={handleConvert} disabled={converting || !convertForm.name || !convertForm.userId} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-60 flex items-center gap-2">
                  {converting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Crear Proyecto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminación */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-md border border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">Eliminar propuesta</h3>
                <p className="text-gray-400 text-sm">¿Seguro que deseas eliminar <span className="text-white font-medium">{confirmDel.title}</span>? Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-60 flex items-center gap-2">
                {deleting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
