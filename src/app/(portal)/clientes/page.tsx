'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import NichesTab from '@/components/NichesTab';

interface Cliente {
  id: string;
  nombre: string;
  industria: string;
  contacto: string;
  email: string;
  pais: string;
  estado: 'Activo' | 'Inactivo';
  valorTotal: number;
}

const EMPTY_FORM = {
  nombre: '', industria: '', contacto: '', email: '', pais: '', estado: 'Activo' as 'Activo' | 'Inactivo', valorTotal: '',
};

const Skeleton = () => (
  <div className="animate-pulse space-y-3">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="h-16 bg-gray-700/50 rounded-lg" />
    ))}
  </div>
);

export default function ClientesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = ['ADMIN','SUPERADMIN'].includes((session?.user as { role?: string })?.role ?? '');

  const [clientes, setClientes]       = useState<Cliente[]>([]);
  const [loading, setLoading]         = useState(true);
  const [seleccionado, setSeleccionado] = useState<Cliente | null>(null);
  const [busqueda, setBusqueda]       = useState('');
  const [showModal, setShowModal]     = useState(false);
  const [editCliente, setEditCliente] = useState<Cliente | null>(null);
  const [confirmDel, setConfirmDel]   = useState<Cliente | null>(null);
  const [formData, setFormData]       = useState(EMPTY_FORM);
  const [activeTab, setActiveTab]     = useState<'clientes' | 'niches'>('clientes');

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/clientes');
    setClientes(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  const filtrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.industria.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.pais.toLowerCase().includes(busqueda.toLowerCase())
  );

  const openNew = () => { setEditCliente(null); setFormData(EMPTY_FORM); setShowModal(true); };

  const openEdit = (c: Cliente, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditCliente(c);
    setFormData({ nombre: c.nombre, industria: c.industria, contacto: c.contacto, email: c.email, pais: c.pais, estado: c.estado, valorTotal: String(c.valorTotal) });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { ...formData, valorTotal: parseFloat(formData.valorTotal) || 0 };
    if (editCliente) {
      await fetch(`/api/clientes/${editCliente.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      await fetch('/api/clientes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    setShowModal(false);
    fetchClientes();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDel) return;
    await fetch(`/api/clientes/${confirmDel.id}`, { method: 'DELETE' });
    if (seleccionado?.id === confirmDel.id) setSeleccionado(null);
    setConfirmDel(null);
    fetchClientes();
  };

  const exportCSV = () => {
    const headers = ['Nombre', 'Industria', 'Contacto', 'Email', 'País', 'Estado', 'Valor Total'];
    const rows = clientes.map(c => [c.nombre, c.industria, c.contacto, c.email, c.pais, c.estado, c.valorTotal]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'clientes.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-gray-400 mt-1">Directorio de clientes activos y su historial</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
            className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
          <button onClick={exportCSV} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            CSV
          </button>
          <button onClick={openNew} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm whitespace-nowrap">
            + Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-800 rounded-lg p-1 w-fit">
        <button onClick={() => setActiveTab('clientes')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'clientes' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>Clientes</button>
        <button onClick={() => setActiveTab('niches')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'niches' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>Niches</button>
      </div>

      {activeTab === 'clientes' && (
        <>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Total Clientes</p>
          <p className="text-2xl font-bold text-white">{clientes.length}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Activos</p>
          <p className="text-2xl font-bold text-green-400">{clientes.filter(c => c.estado === 'Activo').length}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Valor Total</p>
          <p className="text-2xl font-bold text-orange-400">${clientes.reduce((a, c) => a + c.valorTotal, 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6"><Skeleton /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 text-left">
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Industria</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">País</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filtrados.map(c => (
                <tr key={c.id} onClick={() => setSeleccionado(c)} className="hover:bg-gray-700/50 cursor-pointer transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {c.nombre.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-white">{c.nombre}</p>
                        <p className="text-xs text-gray-500">{c.contacto}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">{c.industria}</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{c.pais}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-orange-400">${c.valorTotal.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${c.estado === 'Activo' ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                      {c.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={e => openEdit(c, e)} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors">
                        Editar
                      </button>
                      {isAdmin && (
                        <button onClick={e => { e.stopPropagation(); setConfirmDel(c); }} className="px-3 py-1 text-xs bg-red-900/40 hover:bg-red-800/60 text-red-400 rounded-lg transition-colors">
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-500">Sin clientes</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal detalle */}
      {seleccionado && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg">
            <div className="bg-gradient-to-r from-orange-500 to-orange-700 p-6 rounded-t-2xl">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold">
                    {seleccionado.nombre.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{seleccionado.nombre}</h2>
                    <p className="text-orange-100 text-sm">{seleccionado.contacto} · {seleccionado.email}</p>
                    <p className="text-orange-200 text-xs mt-0.5">{seleccionado.industria} · {seleccionado.pais}</p>
                  </div>
                </div>
                <button onClick={() => setSeleccionado(null)} className="text-white/80 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400">Estado</p>
                  <p className={`text-lg font-bold ${seleccionado.estado === 'Activo' ? 'text-green-400' : 'text-gray-400'}`}>{seleccionado.estado}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-400">Valor Total</p>
                  <p className="text-lg font-bold text-orange-400">${seleccionado.valorTotal.toLocaleString()}</p>
                </div>
              </div>
              <button onClick={() => router.push(`/leads/clientes/${seleccionado.id}`)}
                className="w-full mt-4 py-2.5 bg-orange-600/15 hover:bg-orange-600/25 border border-orange-500/30 text-orange-400 rounded-lg text-sm font-semibold transition-colors">
                Ver historial completo →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal crear / editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{editCliente ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Nombre empresa</label>
                  <input required type="text" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Industria</label>
                  <input required type="text" value={formData.industria} onChange={e => setFormData({...formData, industria: e.target.value})} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Contacto</label>
                  <input required type="text" value={formData.contacto} onChange={e => setFormData({...formData, contacto: e.target.value})} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                  <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">País</label>
                  <input required type="text" value={formData.pais} onChange={e => setFormData({...formData, pais: e.target.value})} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Valor Total ($)</label>
                  <input type="number" value={formData.valorTotal} onChange={e => setFormData({...formData, valorTotal: e.target.value})} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Estado</label>
                <select value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value as 'Activo' | 'Inactivo'})} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm">
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 text-sm">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm">{editCliente ? 'Guardar Cambios' : 'Crear Cliente'}</button>
              </div>
            </form>
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
                <h3 className="text-white font-semibold">Eliminar cliente</h3>
                <p className="text-gray-400 text-sm">¿Seguro que deseas eliminar <span className="text-white font-medium">{confirmDel.nombre}</span>?</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 text-sm">Cancelar</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">Eliminar</button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {activeTab === 'niches' && <NichesTab />}
    </div>
  );
}
