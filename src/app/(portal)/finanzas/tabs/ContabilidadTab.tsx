'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Cuenta {
  id: string; codigo: string; nombre: string; tipo: string;
  subtipo: string | null; nivel: number; cuentaPadreId: string | null;
  activa: boolean; descripcion: string | null;
  totalDebe?: number; totalHaber?: number; saldo?: number;
}

interface LineaForm { cuentaId: string; descripcion: string; debe: string; haber: string; }

interface Asiento {
  id: string; numero: number; fecha: string; descripcion: string;
  referencia: string | null; estado: string; tipo: string;
  lineas: { id: string; cuentaId: string; cuenta: Cuenta; descripcion: string | null; debe: number; haber: number }[];
}

interface Movimiento {
  id: string; fecha: string; descripcion: string; referencia: string | null;
  monto: number; tipo: string; saldo: number | null; conciliado: boolean;
  asientoId: string | null; banco: string;
}

interface Balance {
  cuentas: (Cuenta & { totalDebe: number; totalHaber: number; saldo: number })[];
  totals: Record<string, number>;
  utilidad: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat('es', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
const TIPO_COLOR: Record<string, string> = {
  ACTIVO: '#34d399', PASIVO: '#f87171', PATRIMONIO: '#a78bfa', INGRESO: '#60a5fa', GASTO: '#fbbf24',
};
const EMPTY_CUENTA = { codigo: '', nombre: '', tipo: 'ACTIVO', subtipo: '', nivel: '1', cuentaPadreId: '', descripcion: '' };
const EMPTY_LINEA: LineaForm = { cuentaId: '', descripcion: '', debe: '', haber: '' };

// ── Tab: Plan de Cuentas ──────────────────────────────────────────────────────
function PlanCuentasTab({ isAdmin }: { isAdmin: boolean }) {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editCuenta, setEditCuenta] = useState<Cuenta | null>(null);
  const [form, setForm] = useState(EMPTY_CUENTA);
  const [filtroTipo, setFiltroTipo] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/contabilidad/cuentas');
    setCuentas(await r.json());
    setLoading(false);
  }, []);
  useEffect(() => { fetch_(); }, [fetch_]);

  const filtradas = cuentas.filter(c =>
    (!filtroTipo || c.tipo === filtroTipo) &&
    (!busqueda || c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || c.codigo.includes(busqueda))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editCuenta ? `/api/contabilidad/cuentas/${editCuenta.id}` : '/api/contabilidad/cuentas';
    await fetch(url, { method: editCuenta ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowModal(false); fetch_();
  };

  const openEdit = (c: Cuenta) => {
    setEditCuenta(c);
    setForm({ codigo: c.codigo, nombre: c.nombre, tipo: c.tipo, subtipo: c.subtipo ?? '', nivel: String(c.nivel), cuentaPadreId: c.cuentaPadreId ?? '', descripcion: c.descripcion ?? '' });
    setShowModal(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {['', 'ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO'].map(t => (
            <button key={t} onClick={() => setFiltroTipo(t)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${filtroTipo === t ? 'border-orange-500/50 bg-orange-500/10 text-orange-400' : 'border-white/10 text-gray-500 hover:text-gray-300'}`}>
              {t || 'Todas'}
            </button>
          ))}
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar cuenta..."
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none w-40" />
        </div>
        {isAdmin && (
          <button onClick={() => { setEditCuenta(null); setForm(EMPTY_CUENTA); setShowModal(true); }}
            className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors">
            + Nueva Cuenta
          </button>
        )}
      </div>

      <div className="rounded-xl border border-white/6 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/6 bg-white/2">
              {['Código', 'Nombre', 'Tipo', 'Subtipo', 'Nivel', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? [...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-white/4">
                {[...Array(6)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-3.5 bg-gray-700/40 rounded animate-pulse" /></td>)}
              </tr>
            )) : filtradas.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500 text-sm">Sin cuentas registradas</td></tr>
            ) : filtradas.map(c => (
              <tr key={c.id} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                <td className="px-4 py-2.5 text-xs font-mono text-gray-300">{c.codigo}</td>
                <td className="px-4 py-2.5 text-sm font-medium text-white" style={{ paddingLeft: `${(c.nivel - 1) * 16 + 16}px` }}>{c.nombre}</td>
                <td className="px-4 py-2.5">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ background: TIPO_COLOR[c.tipo] + '18', color: TIPO_COLOR[c.tipo] }}>{c.tipo}</span>
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{c.subtipo ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs text-gray-600">{c.nivel}</td>
                <td className="px-4 py-2.5">
                  {isAdmin && <button onClick={() => openEdit(c)} className="text-xs text-gray-500 hover:text-white transition-colors">Editar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-white/6 bg-white/1 text-xs text-gray-600">{filtradas.length} cuentas</div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md bg-[#0f1629] border border-white/8 rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-white mb-5">{editCuenta ? 'Editar Cuenta' : 'Nueva Cuenta Contable'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium">Código *</label>
                  <input required value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))}
                    placeholder="1.1.01" className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none font-mono" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Tipo *</label>
                  <select required value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 font-medium">Nombre *</label>
                  <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Subtipo</label>
                  <input value={form.subtipo} onChange={e => setForm(f => ({ ...f, subtipo: e.target.value }))}
                    placeholder="Corriente, Operacional..." className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Nivel</label>
                  <select value={form.nivel} onChange={e => setForm(f => ({ ...f, nivel: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>Nivel {n}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 font-medium">Descripción</label>
                  <textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={2}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none resize-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-white/10 text-gray-400 text-sm rounded-lg hover:bg-white/5 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">{editCuenta ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Libro Diario ─────────────────────────────────────────────────────────
function LibroDiarioTab({ isAdmin }: { isAdmin: boolean }) {
  const [asientos, setAsientos] = useState<Asiento[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0, 10), descripcion: '', referencia: '', tipo: 'MANUAL' });
  const [lineas, setLineas] = useState<LineaForm[]>([{ ...EMPTY_LINEA }, { ...EMPTY_LINEA }]);
  const [error, setError] = useState('');

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const [a, c] = await Promise.all([fetch('/api/contabilidad/asientos').then(r => r.json()), fetch('/api/contabilidad/cuentas').then(r => r.json())]);
    setAsientos(a); setCuentas(c); setLoading(false);
  }, []);
  useEffect(() => { fetch_(); }, [fetch_]);

  const addLinea = () => setLineas(l => [...l, { ...EMPTY_LINEA }]);
  const removeLinea = (i: number) => setLineas(l => l.filter((_, idx) => idx !== i));
  const updateLinea = (i: number, field: keyof LineaForm, val: string) => setLineas(l => l.map((ln, idx) => idx === i ? { ...ln, [field]: val } : ln));

  const totalDebe = lineas.reduce((s, l) => s + (parseFloat(l.debe) || 0), 0);
  const totalHaber = lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0);
  const cuadra = Math.abs(totalDebe - totalHaber) < 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!cuadra) { setError('El asiento no cuadra: Debe ≠ Haber'); return; }
    if (lineas.filter(l => l.cuentaId).length < 2) { setError('Mínimo 2 líneas con cuenta asignada'); return; }
    const res = await fetch('/api/contabilidad/asientos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, lineas: lineas.filter(l => l.cuentaId) }) });
    if (!res.ok) { const d = await res.json(); setError(d.error || 'Error'); return; }
    setShowModal(false); setLineas([{ ...EMPTY_LINEA }, { ...EMPTY_LINEA }]); fetch_();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-500">{asientos.length} asientos registrados</p>
        {isAdmin && (
          <button onClick={() => { setError(''); setShowModal(true); }}
            className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors">
            + Nuevo Asiento
          </button>
        )}
      </div>

      <div className="space-y-2">
        {loading ? [...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-700/20 animate-pulse" />) :
          asientos.length === 0 ? <p className="text-center text-gray-500 text-sm py-10">Sin asientos contables</p> :
          asientos.map(a => {
            const totalDebe = a.lineas.reduce((s, l) => s + l.debe, 0);
            const isOpen = expanded === a.id;
            return (
              <div key={a.id} className="rounded-xl border border-white/6 overflow-hidden">
                <div onClick={() => setExpanded(isOpen ? null : a.id)}
                  className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-white/2 transition-colors">
                  <span className="text-xs font-mono text-orange-400 w-12">#{a.numero}</span>
                  <span className="text-xs text-gray-500 w-24">{new Date(a.fecha).toLocaleDateString('es')}</span>
                  <span className="flex-1 text-sm font-medium text-white">{a.descripcion}</span>
                  {a.referencia && <span className="text-xs text-gray-600">{a.referencia}</span>}
                  <span className="text-sm font-bold text-white">{fmt(totalDebe)}</span>
                  <span className="text-xs text-gray-500">{isOpen ? '▲' : '▼'}</span>
                </div>
                {isOpen && (
                  <div className="border-t border-white/6 bg-black/20">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-white/6">
                          <th className="px-6 py-2 text-left text-xs text-gray-600 font-medium">Cuenta</th>
                          <th className="px-4 py-2 text-left text-xs text-gray-600 font-medium">Descripción</th>
                          <th className="px-4 py-2 text-right text-xs text-gray-600 font-medium">Debe</th>
                          <th className="px-4 py-2 text-right text-xs text-gray-600 font-medium">Haber</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.lineas.map(l => (
                          <tr key={l.id} className="border-b border-white/4">
                            <td className="px-6 py-2 text-xs text-gray-300"><span className="font-mono text-gray-500 mr-2">{l.cuenta.codigo}</span>{l.cuenta.nombre}</td>
                            <td className="px-4 py-2 text-xs text-gray-500">{l.descripcion ?? '—'}</td>
                            <td className="px-4 py-2 text-right text-xs font-mono text-green-400">{l.debe > 0 ? fmt(l.debe) : '—'}</td>
                            <td className="px-4 py-2 text-right text-xs font-mono text-red-400">{l.haber > 0 ? fmt(l.haber) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-white/6">
                          <td colSpan={2} className="px-6 py-2 text-xs text-gray-500 font-bold">TOTAL</td>
                          <td className="px-4 py-2 text-right text-xs font-bold font-mono text-green-400">{fmt(a.lineas.reduce((s, l) => s + l.debe, 0))}</td>
                          <td className="px-4 py-2 text-right text-xs font-bold font-mono text-red-400">{fmt(a.lineas.reduce((s, l) => s + l.haber, 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-2xl bg-[#0f1629] border border-white/8 rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-white mb-5">Nuevo Asiento Contable</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium">Fecha *</label>
                  <input required type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 font-medium">Descripción *</label>
                  <input required value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Referencia</label>
                  <input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                    placeholder="Factura, doc..." className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {['MANUAL', 'APERTURA', 'CIERRE', 'AJUSTE'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {/* Lines */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs text-gray-400 font-medium">Líneas del asiento</label>
                  <button type="button" onClick={addLinea} className="text-xs text-orange-400 hover:text-orange-300">+ Línea</button>
                </div>
                <div className="rounded-xl border border-white/6 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/6 bg-white/2">
                        <th className="px-3 py-2 text-left text-xs text-gray-500">Cuenta</th>
                        <th className="px-3 py-2 text-left text-xs text-gray-500">Descripción</th>
                        <th className="px-3 py-2 text-right text-xs text-gray-500">Debe</th>
                        <th className="px-3 py-2 text-right text-xs text-gray-500">Haber</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map((l, i) => (
                        <tr key={i} className="border-b border-white/4">
                          <td className="px-2 py-1.5">
                            <select value={l.cuentaId} onChange={e => updateLinea(i, 'cuentaId', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none">
                              <option value="">Seleccionar...</option>
                              {cuentas.map(c => <option key={c.id} value={c.id}>{c.codigo} — {c.nombre}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1.5">
                            <input value={l.descripcion} onChange={e => updateLinea(i, 'descripcion', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" step="0.01" value={l.debe} onChange={e => updateLinea(i, 'debe', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none text-right font-mono" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" step="0.01" value={l.haber} onChange={e => updateLinea(i, 'haber', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none text-right font-mono" />
                          </td>
                          <td className="px-2">
                            {lineas.length > 2 && (
                              <button type="button" onClick={() => removeLinea(i)} className="text-red-500/50 hover:text-red-400 text-xs">✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/6 bg-white/1">
                        <td colSpan={2} className="px-3 py-2 text-xs text-gray-500 font-bold">TOTALES</td>
                        <td className="px-3 py-2 text-right text-xs font-bold font-mono" style={{ color: cuadra ? '#34d399' : '#f87171' }}>{fmt(totalDebe)}</td>
                        <td className="px-3 py-2 text-right text-xs font-bold font-mono" style={{ color: cuadra ? '#34d399' : '#f87171' }}>{fmt(totalHaber)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {!cuadra && totalDebe > 0 && (
                  <p className="text-xs text-red-400 mt-1">Diferencia: {fmt(Math.abs(totalDebe - totalHaber))}</p>
                )}
              </div>

              {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-white/10 text-gray-400 text-sm rounded-lg hover:bg-white/5 transition-colors">Cancelar</button>
                <button type="submit" disabled={!cuadra} className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors">Registrar Asiento</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Balance / P&L ────────────────────────────────────────────────────────
function BalanceTab() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [vista, setVista] = useState<'balance' | 'pyl'>('balance');

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (desde) q.set('desde', desde);
    if (hasta) q.set('hasta', hasta);
    const r = await fetch('/api/contabilidad/balance?' + q.toString());
    setBalance(await r.json());
    setLoading(false);
  }, [desde, hasta]);
  useEffect(() => { fetch_(); }, [fetch_]);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!balance) return null;

  const { totals, utilidad } = balance;

  const sections = vista === 'balance'
    ? [
        { label: 'ACTIVOS', tipo: 'ACTIVO', color: '#34d399', sign: 1 },
        { label: 'PASIVOS', tipo: 'PASIVO', color: '#f87171', sign: -1 },
        { label: 'PATRIMONIO', tipo: 'PATRIMONIO', color: '#a78bfa', sign: -1 },
      ]
    : [
        { label: 'INGRESOS', tipo: 'INGRESO', color: '#60a5fa', sign: 1 },
        { label: 'GASTOS', tipo: 'GASTO', color: '#fbbf24', sign: -1 },
      ];

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/8">
          {(['balance', 'pyl'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${vista === v ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-gray-300'}`}>
              {v === 'balance' ? 'Balance General' : 'Estado de Resultados'}
            </button>
          ))}
        </div>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none" />
        <span className="text-gray-600 text-xs">a</span>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
          className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(vista === 'balance' ? [
          { label: 'Total Activos', value: totals.ACTIVO, color: '#34d399' },
          { label: 'Total Pasivos', value: totals.PASIVO, color: '#f87171' },
          { label: 'Patrimonio', value: totals.PATRIMONIO, color: '#a78bfa' },
          { label: 'Activos = Pas + Pat', value: totals.PASIVO + totals.PATRIMONIO, color: Math.abs(totals.ACTIVO - (totals.PASIVO + totals.PATRIMONIO)) < 0.01 ? '#34d399' : '#fbbf24' },
        ] : [
          { label: 'Ingresos', value: totals.INGRESO, color: '#60a5fa' },
          { label: 'Gastos', value: totals.GASTO, color: '#fbbf24' },
          { label: utilidad >= 0 ? 'Utilidad' : 'Pérdida', value: Math.abs(utilidad), color: utilidad >= 0 ? '#34d399' : '#f87171' },
          { label: 'Margen', value: totals.INGRESO > 0 ? (utilidad / totals.INGRESO) * 100 : 0, color: utilidad >= 0 ? '#34d399' : '#f87171', isPercent: true },
        ]).map((s) => (
          <div key={s.label} className="p-4 rounded-xl border border-white/6 bg-white/2">
            <p className="text-lg font-bold" style={{ color: s.color }}>
              {'isPercent' in s && s.isPercent ? `${(s.value as number).toFixed(1)}%` : fmt(s.value as number)}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Detail tables */}
      {sections.map(sec => {
        const cuentasSec = balance.cuentas.filter(c => c.tipo === sec.tipo && (c.totalDebe > 0 || c.totalHaber > 0));
        return (
          <div key={sec.tipo}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: sec.color }}>{sec.label}</h3>
              <span className="text-sm font-bold text-white">{fmt(totals[sec.tipo])}</span>
            </div>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: sec.color + '20' }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b" style={{ borderColor: sec.color + '15', background: sec.color + '08' }}>
                    {['Código', 'Cuenta', 'Debe', 'Haber', 'Saldo'].map(h => (
                      <th key={h} className={`px-4 py-2 text-xs font-semibold text-gray-500 ${h === 'Código' || h === 'Cuenta' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cuentasSec.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-xs text-gray-600">Sin movimientos</td></tr>
                  ) : cuentasSec.map(c => (
                    <tr key={c.id} className="border-b border-white/4 hover:bg-white/2">
                      <td className="px-4 py-2 text-xs font-mono text-gray-500">{c.codigo}</td>
                      <td className="px-4 py-2 text-xs text-gray-300">{c.nombre}</td>
                      <td className="px-4 py-2 text-right text-xs font-mono text-gray-400">{fmt(c.totalDebe)}</td>
                      <td className="px-4 py-2 text-right text-xs font-mono text-gray-400">{fmt(c.totalHaber)}</td>
                      <td className="px-4 py-2 text-right text-xs font-bold font-mono" style={{ color: sec.color }}>{fmt(c.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {vista === 'pyl' && (
        <div className="p-4 rounded-xl border-2 flex justify-between items-center" style={{ borderColor: utilidad >= 0 ? '#34d39940' : '#f8717140', background: utilidad >= 0 ? '#34d39908' : '#f8717108' }}>
          <span className="text-sm font-bold text-white">{utilidad >= 0 ? 'UTILIDAD NETA' : 'PÉRDIDA NETA'}</span>
          <span className="text-xl font-bold" style={{ color: utilidad >= 0 ? '#34d399' : '#f87171' }}>{fmt(Math.abs(utilidad))}</span>
        </div>
      )}
    </div>
  );
}

// ── Tab: Conciliación Bancaria ────────────────────────────────────────────────
function ConciliacionTab({ isAdmin }: { isAdmin: boolean }) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filtro, setFiltro] = useState<'todos' | 'pendientes' | 'conciliados'>('todos');
  const [form, setForm] = useState({ fecha: new Date().toISOString().slice(0, 10), descripcion: '', referencia: '', monto: '', tipo: 'CREDITO', banco: 'Principal' });

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/contabilidad/movimientos');
    setMovimientos(await r.json());
    setLoading(false);
  }, []);
  useEffect(() => { fetch_(); }, [fetch_]);

  const filtrados = movimientos.filter(m =>
    filtro === 'todos' ? true : filtro === 'pendientes' ? !m.conciliado : m.conciliado
  );

  const toggleConciliado = async (m: Movimiento) => {
    await fetch(`/api/contabilidad/movimientos/${m.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conciliado: !m.conciliado, descripcion: m.descripcion, referencia: m.referencia }),
    });
    fetch_();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/contabilidad/movimientos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setShowModal(false); fetch_();
  };

  const totalCreditos = movimientos.filter(m => m.tipo === 'CREDITO').reduce((s, m) => s + m.monto, 0);
  const totalDebitos = movimientos.filter(m => m.tipo === 'DEBITO').reduce((s, m) => s + m.monto, 0);
  const pendientes = movimientos.filter(m => !m.conciliado).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Créditos', value: fmt(totalCreditos), color: '#34d399' },
          { label: 'Débitos', value: fmt(totalDebitos), color: '#f87171' },
          { label: 'Por conciliar', value: pendientes, color: pendientes > 0 ? '#fbbf24' : '#94a3b8' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl border border-white/6 bg-white/2">
            <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/8">
          {(['todos', 'pendientes', 'conciliados'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors ${filtro === f ? 'bg-orange-500 text-white' : 'text-gray-400 hover:text-gray-300'}`}>
              {f}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button onClick={() => setShowModal(true)} className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors">
            + Movimiento
          </button>
        )}
      </div>

      <div className="rounded-xl border border-white/6 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/6 bg-white/2">
              {['Fecha', 'Descripción', 'Referencia', 'Banco', 'Tipo', 'Monto', 'Estado', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? [...Array(4)].map((_, i) => (
              <tr key={i} className="border-b border-white/4">
                {[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-3.5 bg-gray-700/40 rounded animate-pulse" /></td>)}
              </tr>
            )) : filtrados.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-500 text-sm">Sin movimientos bancarios</td></tr>
            ) : filtrados.map(m => (
              <tr key={m.id} className={`border-b border-white/4 transition-colors ${m.conciliado ? 'opacity-60' : 'hover:bg-white/2'}`}>
                <td className="px-4 py-2.5 text-xs text-gray-400 whitespace-nowrap">{new Date(m.fecha).toLocaleDateString('es')}</td>
                <td className="px-4 py-2.5 text-sm text-white max-w-xs truncate">{m.descripcion}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{m.referencia ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{m.banco}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.tipo === 'CREDITO' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {m.tipo === 'CREDITO' ? '↑' : '↓'} {m.tipo}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-sm font-bold" style={{ color: m.tipo === 'CREDITO' ? '#34d399' : '#f87171' }}>
                  {m.tipo === 'DEBITO' ? '-' : '+'}{fmt(m.monto)}
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.conciliado ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                    {m.conciliado ? '✓ Conciliado' : 'Pendiente'}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  {isAdmin && (
                    <button onClick={() => toggleConciliado(m)} className={`text-xs transition-colors ${m.conciliado ? 'text-gray-500 hover:text-yellow-400' : 'text-gray-500 hover:text-green-400'}`}>
                      {m.conciliado ? 'Deshacer' : 'Conciliar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-md bg-[#0f1629] border border-white/8 rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-white mb-5">Nuevo Movimiento Bancario</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium">Fecha *</label>
                  <input required type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Tipo</label>
                  <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    <option value="CREDITO">CRÉDITO (entrada)</option>
                    <option value="DEBITO">DÉBITO (salida)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 font-medium">Descripción *</label>
                  <input required value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Monto *</label>
                  <input required type="number" step="0.01" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Banco</label>
                  <input value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 font-medium">Referencia</label>
                  <input value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-white/10 text-gray-400 text-sm rounded-lg hover:bg-white/5">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ContabilidadPage() {
  const { data: session } = useSession();
  const isAdmin = ['ADMIN', 'SUPERADMIN', 'GERENTE_ADMINISTRATIVO'].includes((session?.user as { role?: string })?.role ?? '');
  const [tab, setTab] = useState<'plan' | 'diario' | 'balance' | 'conciliacion'>('balance');

  const tabs = [
    { id: 'balance', label: 'Balance / P&L' },
    { id: 'diario', label: 'Libro Diario' },
    { id: 'plan', label: 'Plan de Cuentas' },
    { id: 'conciliacion', label: 'Conciliación' },
  ] as const;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Contabilidad</h1>
        <p className="text-sm text-gray-400 mt-0.5">Plan de cuentas · Libro diario · Balance · Conciliación bancaria</p>
      </div>

      <div className="flex gap-1 border-b border-white/6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${tab === t.id ? 'text-orange-400 border-orange-400' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plan' && <PlanCuentasTab isAdmin={isAdmin} />}
      {tab === 'diario' && <LibroDiarioTab isAdmin={isAdmin} />}
      {tab === 'balance' && <BalanceTab />}
      {tab === 'conciliacion' && <ConciliacionTab isAdmin={isAdmin} />}
    </div>
  );
}
