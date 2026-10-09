'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface Prospecto {
  id: string;
  empresa: string;
  industria: string;
  nicho: string | null;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  pais: string | null;
  fuente: string;
  estado: string;
  prioridad: string;
  notas: string | null;
  userId: string;
  user: { id: string; name: string };
  createdAt: string;
}

const ESTADO_COLORS: Record<string, string> = {
  Identificado: 'bg-blue-500/20 text-blue-400',
  Contactado: 'bg-yellow-500/20 text-yellow-400',
  'En Negociación': 'bg-orange-500/20 text-orange-400',
  Convertido: 'bg-green-500/20 text-green-400',
  Descartado: 'bg-red-500/20 text-red-400',
};

const PRIORIDAD_COLORS: Record<string, string> = {
  Alta: 'bg-red-500/20 text-red-400',
  Media: 'bg-yellow-500/20 text-yellow-400',
  Baja: 'bg-gray-500/20 text-gray-400',
};

const FUENTES = ['LinkedIn', 'Web', 'Referido', 'Evento', 'Directorio', 'IA Search', 'Otro'];
const ESTADOS = ['Identificado', 'Contactado', 'En Negociación', 'Convertido', 'Descartado'];
const PRIORIDADES = ['Alta', 'Media', 'Baja'];

const EMPTY_FORM = {
  empresa: '', industria: '', nicho: '', contacto: '', email: '',
  telefono: '', pais: '', fuente: 'LinkedIn', estado: 'Identificado',
  prioridad: 'Media', notas: '', userId: '',
};

export default function ProspeccionTab() {
  const { data: session } = useSession();
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDel, setConfirmDel] = useState<Prospecto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [fPrioridad, setFPrioridad] = useState('');
  const [fIndustria, setFIndustria] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/prospectos').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([p, u]) => { setProspectos(p); setUsers(u); setLoading(false); });
  }, []);

  const openNew = () => {
    setEditId(null);
    setFormError('');
    setForm({ ...EMPTY_FORM, userId: (session?.user as { id?: string })?.id || users[0]?.id || '' });
    setShowModal(true);
  };

  const openEdit = (p: Prospecto) => {
    setEditId(p.id);
    setFormError('');
    setForm({
      empresa: p.empresa, industria: p.industria, nicho: p.nicho || '',
      contacto: p.contacto || '', email: p.email || '', telefono: p.telefono || '',
      pais: p.pais || '', fuente: p.fuente, estado: p.estado,
      prioridad: p.prioridad, notas: p.notas || '', userId: p.userId,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      const url = editId ? `/api/prospectos/${editId}` : '/api/prospectos';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) {
        const saved = await res.json();
        setProspectos(prev => editId ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev]);
        setShowModal(false);
      } else {
        const d = await res.json();
        setFormError(d.error || `Error ${res.status}`);
      }
    } catch {
      setFormError('Error de conexión.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await fetch(`/api/prospectos/${confirmDel.id}`, { method: 'DELETE' });
      setProspectos(prev => prev.filter(p => p.id !== confirmDel.id));
      setConfirmDel(null);
    } finally { setDeleting(false); }
  };

  const handleConvertir = async (p: Prospecto) => {
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyName: p.empresa,
        contactName: p.contacto || '',
        email: p.email || '',
        phone: p.telefono || '',
        source: p.fuente,
        estimatedValue: 0,
        scope: p.nicho || p.industria,
        userId: p.userId,
        status: 'NEW',
      }),
    });
    await fetch(`/api/prospectos/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Convertido' }),
    });
    setProspectos(prev => prev.map(x => x.id === p.id ? { ...x, estado: 'Convertido' } : x));
  };

  const filtered = prospectos.filter(p => {
    if (search) {
      const q = search.toLowerCase();
      if (!p.empresa.toLowerCase().includes(q) && !(p.nicho || '').toLowerCase().includes(q) && !(p.contacto || '').toLowerCase().includes(q)) return false;
    }
    if (fEstado && p.estado !== fEstado) return false;
    if (fPrioridad && p.prioridad !== fPrioridad) return false;
    if (fIndustria && !p.industria.toLowerCase().includes(fIndustria.toLowerCase())) return false;
    return true;
  });

  const kpis = [
    { label: 'Total Prospectos', value: prospectos.length, color: 'text-white' },
    { label: 'Contactados', value: prospectos.filter(p => p.estado === 'Contactado').length, color: 'text-yellow-400' },
    { label: 'En Negociación', value: prospectos.filter(p => p.estado === 'En Negociación').length, color: 'text-orange-400' },
    { label: 'Convertidos', value: prospectos.filter(p => p.estado === 'Convertido').length, color: 'text-green-400' },
  ];

  const industrias = [...new Set(prospectos.map(p => p.industria).filter(Boolean))].sort();

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Prospección</h1>
          <p className="text-gray-400 text-sm mt-0.5">Identificación de nuevos clientes y nichos de mercado</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium">
          + Nuevo Prospecto
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpis.map(k => (
          <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-6 flex gap-3 flex-wrap items-center">
        <input
          type="text"
          placeholder="Buscar empresa, nicho o contacto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500" />
        <select value={fEstado} onChange={e => setFEstado(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-orange-500">
          <option value="">Todos estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select value={fPrioridad} onChange={e => setFPrioridad(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-orange-500">
          <option value="">Toda prioridad</option>
          {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={fIndustria} onChange={e => setFIndustria(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:ring-2 focus:ring-orange-500">
          <option value="">Toda industria</option>
          {industrias.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Empresa</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Industria / Nicho</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Contacto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">País</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Fuente</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Prioridad</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-sm font-medium text-white">{p.empresa}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    <p>{p.industria}</p>
                    {p.nicho && <p className="text-xs text-[#7f8a9c]">{p.nicho}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">
                    {p.contacto && <p>{p.contacto}</p>}
                    {p.email && <p className="text-xs text-[#7f8a9c]">{p.email}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{p.pais || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{p.fuente}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${PRIORIDAD_COLORS[p.prioridad] || 'bg-gray-700 text-gray-400'}`}>{p.prioridad}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${ESTADO_COLORS[p.estado] || 'bg-gray-700 text-gray-400'}`}>{p.estado}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => openEdit(p)} className="px-2.5 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg">Editar</button>
                      {p.estado !== 'Convertido' && (
                        <button onClick={() => handleConvertir(p)} className="px-2.5 py-1 text-xs bg-green-900/40 hover:bg-green-800/60 text-green-400 rounded-lg">→ Lead</button>
                      )}
                      <button onClick={() => setConfirmDel(p)} className="px-2.5 py-1 text-xs bg-red-900/40 hover:bg-red-800/60 text-red-400 rounded-lg">×</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-16 text-center text-[#7f8a9c]">
                  {prospectos.length === 0 ? 'Sin prospectos. Agrega el primero.' : 'Sin resultados con estos filtros.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-white">{editId ? 'Editar Prospecto' : 'Nuevo Prospecto'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Empresa *</label>
                  <input type="text" required value={form.empresa} onChange={e => setForm({...form, empresa: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Industria *</label>
                  <input type="text" required value={form.industria} onChange={e => setForm({...form, industria: e.target.value})}
                    placeholder="Fintech, HealthTech, Retail..."
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm placeholder-gray-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nicho / Especialidad</label>
                <input type="text" value={form.nicho} onChange={e => setForm({...form, nicho: e.target.value})}
                  placeholder="Automatización de procesos, IA generativa..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm placeholder-gray-500" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Contacto</label>
                  <input type="text" value={form.contacto} onChange={e => setForm({...form, contacto: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Teléfono</label>
                  <input type="text" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">País</label>
                  <input type="text" value={form.pais} onChange={e => setForm({...form, pais: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Fuente</label>
                  <select value={form.fuente} onChange={e => setForm({...form, fuente: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm">
                    {FUENTES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Prioridad</label>
                  <select value={form.prioridad} onChange={e => setForm({...form, prioridad: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm">
                    {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Estado</label>
                  <select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm">
                    {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Responsable</label>
                <select required value={form.userId} onChange={e => setForm({...form, userId: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm">
                  <option value="">Seleccionar...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Notas</label>
                <textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} rows={2}
                  placeholder="Observaciones, por qué es buen prospecto..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm placeholder-gray-500" />
              </div>
              {formError && (
                <div className="px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-lg text-red-400 text-sm">{formError}</div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-600 rounded-lg hover:bg-gray-700 text-gray-300 text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 text-sm font-medium flex items-center gap-2">
                  {saving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {editId ? 'Guardar Cambios' : 'Crear Prospecto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-md border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">Eliminar prospecto</h3>
                <p className="text-gray-400 text-sm">¿Eliminar <span className="text-white font-medium">{confirmDel.empresa}</span>?</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60 flex items-center gap-2">
                {deleting && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
