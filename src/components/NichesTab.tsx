'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import NicheGraph from '@/components/NicheGraph';

interface NicheNode {
  id: string;
  name: string;
  color: string;
  size: number;
  x: number;
  y: number;
  industry: string;
  potential: number;
  competitors: number;
  trend: string;
  description: string | null;
  user: { id: string; name: string };
}

interface ConnEdge {
  id: string;
  fromId: string;
  toId: string;
  label: string | null;
  strength: number;
}

const COLORS = ['#f97316','#3b82f6','#22c55e','#a855f7','#ec4899','#06b6d4','#eab308','#ef4444'];
const TRENDS = ['up','down','stable'];

export default function NichesTab() {
  const { data: session } = useSession();
  const [nodes, setNodes] = useState<NicheNode[]>([]);
  const [edges, setEdges] = useState<ConnEdge[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<NicheNode | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', industry: '', color: '#f97316', size: 30, potential: 50, competitors: 3, trend: 'stable', description: '', userId: '' });
  const [saving, setSaving] = useState(false);
  const [edgeLabel, setEdgeLabel] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/niches').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ]).then(([d, u]) => { setNodes(d.niches || []); setEdges(d.connections || []); setUsers(u); setLoading(false); });
  }, []);

  const refresh = async () => {
    const res = await fetch('/api/niches');
    const d = await res.json();
    setNodes(d.niches || []);
    setEdges(d.connections || []);
  };

  const handleMoveNode = useCallback(async (id: string, x: number, y: number) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
    fetch(`/api/niches/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y }),
    });
  }, []);

  const handleConnect = useCallback(async (fromId: string, toId: string) => {
    const res = await fetch('/api/niches/connections', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromId, toId, label: edgeLabel || null, strength: 1 }),
    });
    if (res.ok) {
      const conn = await res.json();
      if (!conn.error) {
        setEdges(prev => [...prev, conn]);
        setEdgeLabel('');
      }
    }
  }, [edgeLabel]);

  const openForm = (n?: NicheNode) => {
    if (n) {
      setEditId(n.id);
      setForm({ name: n.name, industry: n.industry, color: n.color, size: n.size, potential: n.potential, competitors: n.competitors, trend: n.trend, description: n.description || '', userId: n.user.id });
    } else {
      setEditId(null);
      setForm({ name: '', industry: '', color: COLORS[Math.floor(Math.random() * COLORS.length)], size: 30, potential: 50, competitors: 3, trend: 'stable', description: '', userId: (session?.user as { id?: string })?.id || users[0]?.id || '' });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const url = editId ? `/api/niches/${editId}` : '/api/niches';
    const method = editId ? 'PUT' : 'POST';
    const body = editId ? form : { ...form, x: Math.random() * 400 + 100, y: Math.random() * 300 + 80 };
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      await refresh();
      setShowForm(false);
      if (editId) setSelected(null);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/niches/${id}`, { method: 'DELETE' });
    await refresh();
    setSelected(null);
  };

  const handleDeleteEdge = async (id: string) => {
    await fetch(`/api/niches/connections?id=${id}`, { method: 'DELETE' });
    await refresh();
  };

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
          <h1 className="text-xl font-bold text-white">Niches</h1>
          <p className="text-gray-400 text-sm mt-0.5">Orquestador de nichos de mercado — vista Neural Link</p>
        </div>
        <div className="flex gap-2">
          {selected && (
            <button onClick={() => openForm(selected)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors text-sm">
              Editar Nodo
            </button>
          )}
          <button onClick={() => openForm()} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium">
            + Nuevo Nicho
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* Graph */}
        <div className="lg:col-span-3">
          <NicheGraph
            nodes={nodes}
            edges={edges}
            onMoveNode={handleMoveNode}
            onSelectNode={setSelected}
            selectedId={selected?.id || null}
            onConnect={handleConnect}
          />
        </div>

        {/* Sidebar */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={edgeLabel}
              onChange={e => setEdgeLabel(e.target.value)}
              placeholder="Etiqueta de conexión..."
              className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-xs text-white placeholder-gray-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
            />
          </div>

          {selected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selected.color }} />
                <h3 className="font-semibold text-white text-sm">{selected.name}</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-800 rounded-lg p-2">
                  <p className="text-[#7f8a9c]">Industria</p>
                  <p className="text-white">{selected.industry}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <p className="text-[#7f8a9c]">Potencial</p>
                  <p className="text-white">{selected.potential}%</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <p className="text-[#7f8a9c]">Competidores</p>
                  <p className="text-white">{selected.competitors}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-2">
                  <p className="text-[#7f8a9c]">Tendencia</p>
                  <p className="text-white capitalize">{selected.trend === 'up' ? 'Alza' : selected.trend === 'down' ? 'Baja' : 'Estable'}</p>
                </div>
              </div>
              {selected.description && (
                <p className="text-xs text-gray-400 bg-gray-800 rounded-lg p-2">{selected.description}</p>
              )}
              <p className="text-xs text-[#7f8a9c]">Responsable: {selected.user.name}</p>
              <button onClick={() => handleDelete(selected.id)} className="w-full px-3 py-1.5 bg-red-900/30 border border-red-800/50 text-red-400 text-xs rounded-lg hover:bg-red-800/40">
                Eliminar Nodo
              </button>

              {/* Connected edges */}
              {edges.filter(e => e.fromId === selected.id || e.toId === selected.id).length > 0 && (
                <div className="border-t border-gray-800 pt-3">
                  <p className="text-xs text-[#7f8a9c] mb-2">Conexiones</p>
                  {edges.filter(e => e.fromId === selected.id || e.toId === selected.id).map(e => {
                    const otherId = e.fromId === selected.id ? e.toId : e.fromId;
                    const other = nodes.find(n => n.id === otherId);
                    return (
                      <div key={e.id} className="flex items-center justify-between py-1">
                        <span className="text-xs text-gray-400">{other?.name || '?'} {e.label && `· ${e.label}`}</span>
                        <button onClick={() => handleDeleteEdge(e.id)} className="text-red-500 hover:text-red-400 text-xs">×</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-800 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#7f8a9c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <p className="text-[#7f8a9c] text-sm">Selecciona un nodo</p>
              <p className="text-[#7f8a9c] text-xs mt-1">Shift+Click para conectar</p>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Nichos activos', value: nodes.length, color: 'text-white' },
          { label: 'Conexiones', value: edges.length, color: 'text-orange-400' },
          { label: 'Potencial promedio', value: nodes.length > 0 ? `${Math.round(nodes.reduce((a, n) => a + n.potential, 0) / nodes.length)}%` : '0%', color: 'text-blue-400' },
          { label: 'En alza', value: nodes.filter(n => n.trend === 'up').length, color: 'text-green-400' },
        ].map(k => (
          <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-lg border border-gray-700">
            <h2 className="text-lg font-bold text-white mb-4">{editId ? 'Editar Nicho' : 'Nuevo Nicho'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Nombre</label>
                  <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Industria</label>
                  <input type="text" required value={form.industry} onChange={e => setForm({...form, industry: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Color</label>
                  <div className="flex gap-1.5">
                    {COLORS.map(c => (
                      <button key={c} type="button"
                        onClick={() => setForm({...form, color: c})}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Potencial %</label>
                  <input type="number" value={form.potential} onChange={e => setForm({...form, potential: Number(e.target.value)})}
                    min={0} max={100}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tendencia</label>
                  <select value={form.trend} onChange={e => setForm({...form, trend: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm">
                    {TRENDS.map(t => <option key={t} value={t}>{t === 'up' ? '↑ Alza' : t === 'down' ? '↓ Baja' : '→ Estable'}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Competidores</label>
                  <input type="number" value={form.competitors} onChange={e => setForm({...form, competitors: Number(e.target.value)})}
                    min={0} max={50}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Responsable</label>
                  <select required value={form.userId} onChange={e => setForm({...form, userId: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm">
                    <option value="">Seleccionar...</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Descripción</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-600 rounded-lg text-gray-300 text-sm">Cancelar</button>
                <button type="submit" disabled={saving} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 text-sm font-medium">
                  {saving ? 'Guardando...' : editId ? 'Guardar' : 'Crear Nicho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
