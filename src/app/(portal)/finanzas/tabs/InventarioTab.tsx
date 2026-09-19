'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface Activo {
  id: string;
  nombre: string;
  tipo: string;
  categoria: string | null;
  estado: string;
  valor: number;
  moneda: string;
  fechaAdquisicion: string | null;
  fechaVencimiento: string | null;
  proveedorNombre: string | null;
  responsable: string | null;
  ubicacion: string | null;
  serial: string | null;
  notas: string | null;
}

const TIPOS = ['HARDWARE', 'SOFTWARE', 'LICENCIA', 'MODELO_IA', 'INFRAESTRUCTURA'];
const ESTADOS = ['ACTIVO', 'EN_MANTENIMIENTO', 'DEPRECADO', 'DADO_DE_BAJA'];

const TIPO_COLOR: Record<string, string> = {
  HARDWARE: '#60a5fa',
  SOFTWARE: '#a78bfa',
  LICENCIA: '#fbbf24',
  MODELO_IA: '#f472b6',
  INFRAESTRUCTURA: '#34d399',
};

const ESTADO_COLOR: Record<string, string> = {
  ACTIVO: '#34d399',
  EN_MANTENIMIENTO: '#fbbf24',
  DEPRECADO: '#94a3b8',
  DADO_DE_BAJA: '#f87171',
};

const EMPTY: Omit<Activo, 'id'> = {
  nombre: '', tipo: 'SOFTWARE', categoria: '', estado: 'ACTIVO',
  valor: 0, moneda: 'USD', fechaAdquisicion: '', fechaVencimiento: '',
  proveedorNombre: '', responsable: '', ubicacion: '', serial: '', notas: '',
};

function fmt(n: number, moneda: string) {
  return new Intl.NumberFormat('es', { style: 'currency', currency: moneda }).format(n);
}

export default function InventarioPage() {
  const { data: session } = useSession();
  const isAdmin = ['ADMIN', 'SUPERADMIN', 'GERENTE_ADMINISTRATIVO'].includes((session?.user as { role?: string })?.role ?? '');

  const [activos, setActivos] = useState<Activo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editActivo, setEditActivo] = useState<Activo | null>(null);
  const [form, setForm] = useState<Omit<Activo, 'id'>>(EMPTY);
  const [confirmDel, setConfirmDel] = useState<Activo | null>(null);

  const fetchActivos = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/inventario');
    setActivos(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchActivos(); }, [fetchActivos]);

  const filtrados = activos.filter(a => {
    const q = busqueda.toLowerCase();
    const matchQ = !q || a.nombre.toLowerCase().includes(q) || (a.categoria ?? '').toLowerCase().includes(q) || (a.responsable ?? '').toLowerCase().includes(q);
    const matchT = !filtroTipo || a.tipo === filtroTipo;
    const matchE = !filtroEstado || a.estado === filtroEstado;
    return matchQ && matchT && matchE;
  });

  const totalValor = filtrados.reduce((s, a) => s + a.valor, 0);

  const openNew = () => { setEditActivo(null); setForm({ ...EMPTY }); setShowModal(true); };
  const openEdit = (a: Activo, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditActivo(a);
    setForm({ nombre: a.nombre, tipo: a.tipo, categoria: a.categoria ?? '', estado: a.estado, valor: a.valor, moneda: a.moneda, fechaAdquisicion: a.fechaAdquisicion?.slice(0, 10) ?? '', fechaVencimiento: a.fechaVencimiento?.slice(0, 10) ?? '', proveedorNombre: a.proveedorNombre ?? '', responsable: a.responsable ?? '', ubicacion: a.ubicacion ?? '', serial: a.serial ?? '', notas: a.notas ?? '' });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editActivo ? `/api/inventario/${editActivo.id}` : '/api/inventario';
    await fetch(url, { method: editActivo ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowModal(false);
    fetchActivos();
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    await fetch(`/api/inventario/${confirmDel.id}`, { method: 'DELETE' });
    setConfirmDel(null);
    fetchActivos();
  };

  const byTipo = TIPOS.map(t => ({ tipo: t, count: activos.filter(a => a.tipo === t).length, valor: activos.filter(a => a.tipo === t).reduce((s, a) => s + a.valor, 0) }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Inventario de Activos</h1>
          <p className="text-sm text-gray-400 mt-0.5">{activos.length} activos registrados · Valor total: {fmt(activos.reduce((s, a) => s + a.valor, 0), 'USD')}</p>
        </div>
        {isAdmin && (
          <button onClick={openNew} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">
            + Nuevo Activo
          </button>
        )}
      </div>

      {/* Stats por tipo */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {byTipo.map(t => (
          <div key={t.tipo} onClick={() => setFiltroTipo(filtroTipo === t.tipo ? '' : t.tipo)}
            className="cursor-pointer p-3 rounded-xl border transition-all"
            style={{ background: filtroTipo === t.tipo ? TIPO_COLOR[t.tipo] + '18' : 'rgba(255,255,255,0.02)', borderColor: filtroTipo === t.tipo ? TIPO_COLOR[t.tipo] + '40' : 'rgba(255,255,255,0.06)' }}>
            <p className="text-lg font-bold" style={{ color: TIPO_COLOR[t.tipo] }}>{t.count}</p>
            <p className="text-xs text-gray-500 font-medium">{t.tipo.replace('_', ' ')}</p>
            <p className="text-xs text-gray-600">{fmt(t.valor, 'USD')}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar activo..."
          className="flex-1 min-w-48 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50" />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-white/6 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/6 bg-white/2">
              {['Activo', 'Tipo', 'Estado', 'Valor', 'Proveedor', 'Responsable', 'Vencimiento', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i} className="border-b border-white/4">
                  {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-700/50 rounded animate-pulse" /></td>)}
                </tr>
              ))
            ) : filtrados.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500 text-sm">Sin activos registrados</td></tr>
            ) : filtrados.map(a => (
              <tr key={a.id} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-semibold text-white">{a.nombre}</p>
                  {a.serial && <p className="text-xs text-gray-500">S/N: {a.serial}</p>}
                  {a.ubicacion && <p className="text-xs text-gray-600">{a.ubicacion}</p>}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ background: TIPO_COLOR[a.tipo] + '18', color: TIPO_COLOR[a.tipo] }}>{a.tipo.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: ESTADO_COLOR[a.estado] + '18', color: ESTADO_COLOR[a.estado] }}>● {a.estado.replace('_', ' ')}</span>
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-white">{fmt(a.valor, a.moneda)}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{a.proveedorNombre ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{a.responsable ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{a.fechaVencimiento ? new Date(a.fechaVencimiento).toLocaleDateString('es') : '—'}</td>
                <td className="px-4 py-3">
                  {isAdmin && (
                    <div className="flex gap-2">
                      <button onClick={e => openEdit(a, e)} className="text-xs text-gray-500 hover:text-white transition-colors">Editar</button>
                      <button onClick={e => { e.stopPropagation(); setConfirmDel(a); }} className="text-xs text-red-500/60 hover:text-red-400 transition-colors">Eliminar</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtrados.length > 0 && (
          <div className="px-4 py-3 border-t border-white/6 flex justify-between items-center bg-white/1">
            <span className="text-xs text-gray-500">{filtrados.length} activos</span>
            <span className="text-sm font-bold text-white">Total: {fmt(totalValor, 'USD')}</span>
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg bg-[#0f1629] border border-white/8 rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-white mb-5">{editActivo ? 'Editar Activo' : 'Nuevo Activo'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 font-medium">Nombre *</label>
                  <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500/50" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Tipo *</label>
                  <select required value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {TIPOS.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Estado</label>
                  <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {ESTADOS.map(e => <option key={e} value={e}>{e.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Valor</label>
                  <input type="number" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: parseFloat(e.target.value) || 0 }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Moneda</label>
                  <select value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {['USD', 'EUR', 'COP', 'MXN', 'ARS'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {[
                  { label: 'Categoría', key: 'categoria' },
                  { label: 'Proveedor', key: 'proveedorNombre' },
                  { label: 'Responsable', key: 'responsable' },
                  { label: 'Ubicación', key: 'ubicacion' },
                  { label: 'Serial / Clave', key: 'serial' },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-400 font-medium">{label}</label>
                    <input value={(form as Record<string, unknown>)[key] as string ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-400 font-medium">Fecha adquisición</label>
                  <input type="date" value={form.fechaAdquisicion ?? ''} onChange={e => setForm(f => ({ ...f, fechaAdquisicion: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Fecha vencimiento</label>
                  <input type="date" value={form.fechaVencimiento ?? ''} onChange={e => setForm(f => ({ ...f, fechaVencimiento: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 font-medium">Notas</label>
                  <textarea value={form.notas ?? ''} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} rows={2}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none resize-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-white/10 text-gray-400 text-sm rounded-lg hover:bg-white/5 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">{editActivo ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f1629] border border-white/8 rounded-2xl p-6 w-full max-w-sm">
            <p className="text-sm text-white font-semibold mb-2">¿Eliminar activo?</p>
            <p className="text-xs text-gray-400 mb-5">{confirmDel.nombre} será eliminado permanentemente.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)} className="flex-1 px-4 py-2 border border-white/10 text-gray-400 text-sm rounded-lg hover:bg-white/5 transition-colors">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
