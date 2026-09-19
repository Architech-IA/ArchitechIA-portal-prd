'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface Proveedor {
  id: string;
  nombre: string;
  tipo: string;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
  pais: string | null;
  website: string | null;
  estado: string;
  notas: string | null;
  ordenes: OrdenCompra[];
}

interface OrdenCompra {
  id: string;
  numero: string;
  concepto: string;
  descripcion: string | null;
  monto: number;
  moneda: string;
  estado: string;
  proveedorId: string;
  proveedor?: { nombre: string };
  fechaEmision: string;
  fechaVencimiento: string | null;
  fechaPago: string | null;
  categoria: string | null;
  aprobadoPor: string | null;
  notas: string | null;
}

const TIPOS_PROV = ['TECNOLOGIA', 'SERVICIOS', 'INFRAESTRUCTURA', 'FREELANCE', 'LEGAL', 'OTRO'];
const ESTADOS_OC = ['PENDIENTE', 'APROBADA', 'PAGADA', 'CANCELADA'];
const TIPO_COLOR: Record<string, string> = { TECNOLOGIA: '#60a5fa', SERVICIOS: '#a78bfa', INFRAESTRUCTURA: '#34d399', FREELANCE: '#fbbf24', LEGAL: '#f472b6', OTRO: '#94a3b8' };
const OC_COLOR: Record<string, string> = { PENDIENTE: '#fbbf24', APROBADA: '#60a5fa', PAGADA: '#34d399', CANCELADA: '#f87171' };

function fmt(n: number, m: string) { return new Intl.NumberFormat('es', { style: 'currency', currency: m }).format(n); }

const EMPTY_PROV = { nombre: '', tipo: 'TECNOLOGIA', contacto: '', email: '', telefono: '', pais: '', website: '', estado: 'ACTIVO', notas: '' };
const EMPTY_OC = { concepto: '', descripcion: '', monto: '', moneda: 'USD', estado: 'PENDIENTE', proveedorId: '', fechaEmision: '', fechaVencimiento: '', categoria: '', aprobadoPor: '', notas: '' };

export default function ProveedoresPage() {
  const { data: session } = useSession();
  const isAdmin = ['ADMIN', 'SUPERADMIN', 'GERENTE_ADMINISTRATIVO'].includes((session?.user as { role?: string })?.role ?? '');

  const [tab, setTab] = useState<'proveedores' | 'ordenes'>('proveedores');
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [showProvModal, setShowProvModal] = useState(false);
  const [showOCModal, setShowOCModal] = useState(false);
  const [editProv, setEditProv] = useState<Proveedor | null>(null);
  const [editOC, setEditOC] = useState<OrdenCompra | null>(null);
  const [formProv, setFormProv] = useState(EMPTY_PROV);
  const [formOC, setFormOC] = useState(EMPTY_OC);
  const [confirmDel, setConfirmDel] = useState<{ type: 'prov' | 'oc'; id: string; name: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [p, o] = await Promise.all([fetch('/api/proveedores').then(r => r.json()), fetch('/api/ordenes').then(r => r.json())]);
    setProveedores(p);
    setOrdenes(o);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtProvs = proveedores.filter(p => !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (p.pais ?? '').toLowerCase().includes(busqueda.toLowerCase()));
  const filtOCs = ordenes.filter(o => !busqueda || o.concepto.toLowerCase().includes(busqueda.toLowerCase()) || o.numero.toLowerCase().includes(busqueda.toLowerCase()));

  const totalPendiente = ordenes.filter(o => o.estado === 'PENDIENTE' || o.estado === 'APROBADA').reduce((s, o) => s + o.monto, 0);
  const totalPagado = ordenes.filter(o => o.estado === 'PAGADA').reduce((s, o) => s + o.monto, 0);

  const handleSubmitProv = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editProv ? `/api/proveedores/${editProv.id}` : '/api/proveedores';
    await fetch(url, { method: editProv ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formProv) });
    setShowProvModal(false);
    fetchAll();
  };

  const handleSubmitOC = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editOC ? `/api/ordenes/${editOC.id}` : '/api/ordenes';
    await fetch(url, { method: editOC ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formOC) });
    setShowOCModal(false);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    const url = confirmDel.type === 'prov' ? `/api/proveedores/${confirmDel.id}` : `/api/ordenes/${confirmDel.id}`;
    await fetch(url, { method: 'DELETE' });
    setConfirmDel(null);
    fetchAll();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Proveedores & Compras</h1>
          <p className="text-sm text-gray-400 mt-0.5">{proveedores.length} proveedores · Por pagar: {fmt(totalPendiente, 'USD')} · Pagado: {fmt(totalPagado, 'USD')}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => { setEditProv(null); setFormProv(EMPTY_PROV); setShowProvModal(true); }} className="px-3 py-2 border border-white/10 text-gray-300 text-sm rounded-lg hover:bg-white/5 transition-colors">+ Proveedor</button>
            <button onClick={() => { setEditOC(null); setFormOC({ ...EMPTY_OC, fechaEmision: new Date().toISOString().slice(0, 10) }); setShowOCModal(true); }} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">+ Orden de Compra</button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Proveedores', value: proveedores.length, color: '#60a5fa' },
          { label: 'Órdenes activas', value: ordenes.filter(o => ['PENDIENTE', 'APROBADA'].includes(o.estado)).length, color: '#fbbf24' },
          { label: 'Por pagar', value: fmt(totalPendiente, 'USD'), color: '#f87171' },
          { label: 'Pagado (total)', value: fmt(totalPagado, 'USD'), color: '#34d399' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl border border-white/6 bg-white/2">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/6">
        {(['proveedores', 'ordenes'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? 'text-orange-400 border-orange-400' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
            {t === 'ordenes' ? 'Órdenes de Compra' : 'Proveedores'}
          </button>
        ))}
      </div>

      <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder={`Buscar ${tab === 'proveedores' ? 'proveedor' : 'orden'}...`}
        className="w-full max-w-sm px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50" />

      {/* Proveedores tab */}
      {tab === 'proveedores' && (
        <div className="rounded-xl border border-white/6 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/6 bg-white/2">
                {['Proveedor', 'Tipo', 'Contacto', 'País', 'Órdenes', 'Estado', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? [...Array(3)].map((_, i) => (
                <tr key={i} className="border-b border-white/4">
                  {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-700/50 rounded animate-pulse" /></td>)}
                </tr>
              )) : filtProvs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm">Sin proveedores registrados</td></tr>
              ) : filtProvs.map(p => (
                <tr key={p.id} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-white">{p.nombre}</p>
                    {p.website && <a href={p.website} target="_blank" rel="noreferrer" className="text-xs text-orange-400/70 hover:text-orange-400">{p.website}</a>}
                  </td>
                  <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-1 rounded-md" style={{ background: TIPO_COLOR[p.tipo] + '18', color: TIPO_COLOR[p.tipo] }}>{p.tipo}</span></td>
                  <td className="px-4 py-3"><p className="text-xs text-gray-400">{p.contacto ?? '—'}</p><p className="text-xs text-gray-600">{p.email ?? ''}</p></td>
                  <td className="px-4 py-3 text-sm text-gray-400">{p.pais ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-white">{p.ordenes?.length ?? 0}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-1 rounded-full ${p.estado === 'ACTIVO' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>● {p.estado}</span></td>
                  <td className="px-4 py-3">
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button onClick={() => { setEditProv(p); setFormProv({ nombre: p.nombre, tipo: p.tipo, contacto: p.contacto ?? '', email: p.email ?? '', telefono: p.telefono ?? '', pais: p.pais ?? '', website: p.website ?? '', estado: p.estado, notas: p.notas ?? '' }); setShowProvModal(true); }} className="text-xs text-gray-500 hover:text-white transition-colors">Editar</button>
                        <button onClick={() => setConfirmDel({ type: 'prov', id: p.id, name: p.nombre })} className="text-xs text-red-500/60 hover:text-red-400 transition-colors">Eliminar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Órdenes tab */}
      {tab === 'ordenes' && (
        <div className="rounded-xl border border-white/6 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/6 bg-white/2">
                {['Número', 'Concepto', 'Proveedor', 'Monto', 'Estado', 'Vencimiento', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? [...Array(3)].map((_, i) => (
                <tr key={i} className="border-b border-white/4">
                  {[...Array(7)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-700/50 rounded animate-pulse" /></td>)}
                </tr>
              )) : filtOCs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500 text-sm">Sin órdenes registradas</td></tr>
              ) : filtOCs.map(o => (
                <tr key={o.id} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-orange-400">{o.numero}</td>
                  <td className="px-4 py-3"><p className="text-sm font-semibold text-white">{o.concepto}</p>{o.categoria && <p className="text-xs text-gray-500">{o.categoria}</p>}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{o.proveedor?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-white">{fmt(o.monto, o.moneda)}</td>
                  <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: OC_COLOR[o.estado] + '18', color: OC_COLOR[o.estado] }}>● {o.estado}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{o.fechaVencimiento ? new Date(o.fechaVencimiento).toLocaleDateString('es') : '—'}</td>
                  <td className="px-4 py-3">
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button onClick={() => { setEditOC(o); setFormOC({ concepto: o.concepto, descripcion: o.descripcion ?? '', monto: String(o.monto), moneda: o.moneda, estado: o.estado, proveedorId: o.proveedorId, fechaEmision: o.fechaEmision.slice(0, 10), fechaVencimiento: o.fechaVencimiento?.slice(0, 10) ?? '', categoria: o.categoria ?? '', aprobadoPor: o.aprobadoPor ?? '', notas: o.notas ?? '' }); setShowOCModal(true); }} className="text-xs text-gray-500 hover:text-white transition-colors">Editar</button>
                        <button onClick={() => setConfirmDel({ type: 'oc', id: o.id, name: o.numero })} className="text-xs text-red-500/60 hover:text-red-400 transition-colors">Eliminar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Proveedor */}
      {showProvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowProvModal(false)}>
          <div className="w-full max-w-md bg-[#0f1629] border border-white/8 rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-white mb-5">{editProv ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h2>
            <form onSubmit={handleSubmitProv} className="space-y-3">
              {[{ label: 'Nombre *', key: 'nombre', required: true }, { label: 'Contacto', key: 'contacto' }, { label: 'Email', key: 'email' }, { label: 'Teléfono', key: 'telefono' }, { label: 'País', key: 'pais' }, { label: 'Website', key: 'website' }].map(({ label, key, required }) => (
                <div key={key}>
                  <label className="text-xs text-gray-400 font-medium">{label}</label>
                  <input required={required} value={(formProv as Record<string, string>)[key] ?? ''} onChange={e => setFormProv(f => ({ ...f, [key]: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium">Tipo</label>
                  <select value={formProv.tipo} onChange={e => setFormProv(f => ({ ...f, tipo: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {TIPOS_PROV.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Estado</label>
                  <select value={formProv.estado} onChange={e => setFormProv(f => ({ ...f, estado: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {['ACTIVO', 'INACTIVO'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium">Notas</label>
                <textarea value={formProv.notas} onChange={e => setFormProv(f => ({ ...f, notas: e.target.value }))} rows={2}
                  className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowProvModal(false)} className="flex-1 px-4 py-2 border border-white/10 text-gray-400 text-sm rounded-lg hover:bg-white/5 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">{editProv ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Orden de Compra */}
      {showOCModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowOCModal(false)}>
          <div className="w-full max-w-md bg-[#0f1629] border border-white/8 rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-white mb-5">{editOC ? 'Editar Orden' : 'Nueva Orden de Compra'}</h2>
            <form onSubmit={handleSubmitOC} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 font-medium">Proveedor *</label>
                <select required value={formOC.proveedorId} onChange={e => setFormOC(f => ({ ...f, proveedorId: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                  <option value="">Seleccionar...</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium">Concepto *</label>
                <input required value={formOC.concepto} onChange={e => setFormOC(f => ({ ...f, concepto: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium">Monto *</label>
                  <input required type="number" step="0.01" value={formOC.monto} onChange={e => setFormOC(f => ({ ...f, monto: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Moneda</label>
                  <select value={formOC.moneda} onChange={e => setFormOC(f => ({ ...f, moneda: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {['USD', 'EUR', 'COP', 'MXN', 'ARS'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Estado</label>
                  <select value={formOC.estado} onChange={e => setFormOC(f => ({ ...f, estado: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {ESTADOS_OC.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Categoría</label>
                  <input value={formOC.categoria} onChange={e => setFormOC(f => ({ ...f, categoria: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Vencimiento</label>
                  <input type="date" value={formOC.fechaVencimiento} onChange={e => setFormOC(f => ({ ...f, fechaVencimiento: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Aprobado por</label>
                  <input value={formOC.aprobadoPor} onChange={e => setFormOC(f => ({ ...f, aprobadoPor: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium">Notas</label>
                <textarea value={formOC.notas} onChange={e => setFormOC(f => ({ ...f, notas: e.target.value }))} rows={2}
                  className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowOCModal(false)} className="flex-1 px-4 py-2 border border-white/10 text-gray-400 text-sm rounded-lg hover:bg-white/5 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">{editOC ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f1629] border border-white/8 rounded-2xl p-6 w-full max-w-sm">
            <p className="text-sm text-white font-semibold mb-2">¿Eliminar?</p>
            <p className="text-xs text-gray-400 mb-5">{confirmDel.name} será eliminado permanentemente.</p>
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
