'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface Empleado {
  id: string;
  nombre: string;
  email: string;
  cargo: string;
  departamento: string;
  tipo: string;
  estado: string;
  salarioBase: number;
  moneda: string;
  fechaIngreso: string;
  pais: string | null;
  notas: string | null;
  nominas: Nomina[];
  vacaciones: Vacacion[];
}

interface Nomina {
  id: string;
  empleadoId: string;
  empleado?: { nombre: string };
  periodo: string;
  salarioBase: number;
  bonos: number;
  deducciones: number;
  total: number;
  moneda: string;
  estado: string;
  fechaPago: string | null;
  notas: string | null;
}

interface Vacacion {
  id: string;
  empleadoId: string;
  empleado?: { nombre: string };
  desde: string;
  hasta: string;
  dias: number;
  tipo: string;
  estado: string;
  aprobadoPor: string | null;
  notas: string | null;
}

const TIPOS_EMP = ['FULL_TIME', 'PART_TIME', 'FREELANCE', 'PASANTE'];
const ESTADOS_EMP = ['ACTIVO', 'INACTIVO', 'VACACIONES', 'BAJA'];
const DEPTO_COLOR: Record<string, string> = { Tecnologia: '#60a5fa', Comercial: '#f472b6', Operaciones: '#34d399', Legal: '#a78bfa', Admin: '#fbbf24', Otro: '#94a3b8' };
const ESTADO_EMP_COLOR: Record<string, string> = { ACTIVO: '#34d399', INACTIVO: '#94a3b8', VACACIONES: '#60a5fa', BAJA: '#f87171' };
const NOM_COLOR: Record<string, string> = { PENDIENTE: '#fbbf24', PAGADO: '#34d399' };
const VAC_COLOR: Record<string, string> = { PENDIENTE: '#fbbf24', APROBADA: '#34d399', RECHAZADA: '#f87171' };

function fmt(n: number, m: string) { return new Intl.NumberFormat('es', { style: 'currency', currency: m }).format(n); }

const EMPTY_EMP = { nombre: '', email: '', cargo: '', departamento: 'Tecnologia', tipo: 'FULL_TIME', estado: 'ACTIVO', salarioBase: '', moneda: 'USD', fechaIngreso: '', pais: '', notas: '' };
const EMPTY_NOM = { empleadoId: '', periodo: new Date().toISOString().slice(0, 7), salarioBase: '', bonos: '0', deducciones: '0', moneda: 'USD', estado: 'PENDIENTE', fechaPago: '', notas: '' };
const EMPTY_VAC = { empleadoId: '', desde: '', hasta: '', tipo: 'VACACION', estado: 'PENDIENTE', aprobadoPor: '', notas: '' };

export default function RRHHPage() {
  const { data: session } = useSession();
  const isAdmin = ['ADMIN', 'SUPERADMIN', 'GERENTE_ADMINISTRATIVO'].includes((session?.user as { role?: string })?.role ?? '');

  const [tab, setTab] = useState<'equipo' | 'nomina' | 'vacaciones'>('equipo');
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [nominas, setNominas] = useState<Nomina[]>([]);
  const [vacaciones, setVacaciones] = useState<Vacacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const [showEmpModal, setShowEmpModal] = useState(false);
  const [showNomModal, setShowNomModal] = useState(false);
  const [showVacModal, setShowVacModal] = useState(false);
  const [editEmp, setEditEmp] = useState<Empleado | null>(null);
  const [formEmp, setFormEmp] = useState(EMPTY_EMP);
  const [formNom, setFormNom] = useState(EMPTY_NOM);
  const [formVac, setFormVac] = useState(EMPTY_VAC);
  const [confirmDel, setConfirmDel] = useState<{ id: string; name: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [e, n, v] = await Promise.all([
      fetch('/api/rrhh/empleados').then(r => r.json()),
      fetch('/api/rrhh/nomina').then(r => r.json()),
      fetch('/api/rrhh/vacaciones').then(r => r.json()),
    ]);
    setEmpleados(e);
    setNominas(n);
    setVacaciones(v);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtEmpleados = empleados.filter(e => !busqueda || e.nombre.toLowerCase().includes(busqueda.toLowerCase()) || e.cargo.toLowerCase().includes(busqueda.toLowerCase()) || e.departamento.toLowerCase().includes(busqueda.toLowerCase()));
  const filtNominas = nominas.filter(n => !busqueda || n.empleado?.nombre.toLowerCase().includes(busqueda.toLowerCase()) || n.periodo.includes(busqueda));
  const filtVacaciones = vacaciones.filter(v => !busqueda || v.empleado?.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  const totalMasaNominal = empleados.filter(e => e.estado === 'ACTIVO').reduce((s, e) => s + e.salarioBase, 0);
  const pendientesVac = vacaciones.filter(v => v.estado === 'PENDIENTE').length;

  const handleSubmitEmp = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editEmp ? `/api/rrhh/empleados/${editEmp.id}` : '/api/rrhh/empleados';
    await fetch(url, { method: editEmp ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formEmp) });
    setShowEmpModal(false);
    fetchAll();
  };

  const handleSubmitNom = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/rrhh/nomina', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formNom) });
    setShowNomModal(false);
    fetchAll();
  };

  const handleSubmitVac = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/rrhh/vacaciones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formVac) });
    setShowVacModal(false);
    fetchAll();
  };

  const handleApproveVac = async (id: string, estado: 'APROBADA' | 'RECHAZADA') => {
    await fetch(`/api/rrhh/vacaciones/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado, aprobadoPor: (session?.user as { name?: string })?.name ?? 'Admin' }) });
    fetchAll();
  };

  const handleDeleteEmp = async () => {
    if (!confirmDel) return;
    await fetch(`/api/rrhh/empleados/${confirmDel.id}`, { method: 'DELETE' });
    setConfirmDel(null);
    fetchAll();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Recursos Humanos</h1>
          <p className="text-sm text-gray-400 mt-0.5">{empleados.filter(e => e.estado === 'ACTIVO').length} activos · Masa salarial: {fmt(totalMasaNominal, 'USD')}/mes{pendientesVac > 0 ? ` · ${pendientesVac} vacaciones pendientes` : ''}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {tab === 'equipo' && <button onClick={() => { setEditEmp(null); setFormEmp({ ...EMPTY_EMP, fechaIngreso: new Date().toISOString().slice(0, 10) }); setShowEmpModal(true); }} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">+ Empleado</button>}
            {tab === 'nomina' && <button onClick={() => { setFormNom({ ...EMPTY_NOM }); setShowNomModal(true); }} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">+ Registro Nómina</button>}
            {tab === 'vacaciones' && <button onClick={() => { setFormVac({ ...EMPTY_VAC }); setShowVacModal(true); }} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">+ Solicitud</button>}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Empleados activos', value: empleados.filter(e => e.estado === 'ACTIVO').length, color: '#34d399' },
          { label: 'Freelancers', value: empleados.filter(e => e.tipo === 'FREELANCE').length, color: '#fbbf24' },
          { label: 'Nóminas este mes', value: nominas.filter(n => n.periodo === new Date().toISOString().slice(0, 7)).length, color: '#60a5fa' },
          { label: 'Vacaciones pendientes', value: pendientesVac, color: pendientesVac > 0 ? '#f87171' : '#94a3b8' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl border border-white/6 bg-white/2">
            <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/6">
        {([['equipo', 'Equipo'], ['nomina', 'Nómina'], ['vacaciones', 'Vacaciones']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === t ? 'text-orange-400 border-orange-400' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>{label}</button>
        ))}
      </div>

      <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..."
        className="w-full max-w-sm px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50" />

      {/* Equipo tab */}
      {tab === 'equipo' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? [...Array(4)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-gray-700/20 animate-pulse" />) :
            filtEmpleados.length === 0 ? <p className="text-gray-500 text-sm col-span-3 py-12 text-center">Sin empleados registrados</p> :
            filtEmpleados.map(emp => {
              const dColor = DEPTO_COLOR[emp.departamento] ?? '#94a3b8';
              return (
                <div key={emp.id} className="p-4 rounded-xl border border-white/6 bg-white/2 hover:bg-white/4 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: dColor + '30', border: '1px solid ' + dColor + '40' }}>{emp.nombre.charAt(0).toUpperCase()}</div>
                      <div>
                        <p className="text-sm font-bold text-white">{emp.nombre}</p>
                        <p className="text-xs text-gray-400">{emp.cargo}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: ESTADO_EMP_COLOR[emp.estado] + '18', color: ESTADO_EMP_COLOR[emp.estado] }}>● {emp.estado}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Departamento</span>
                      <span className="font-medium" style={{ color: dColor }}>{emp.departamento}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Tipo</span>
                      <span className="text-gray-300">{emp.tipo.replace('_', ' ')}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Salario base</span>
                      <span className="text-white font-semibold">{fmt(emp.salarioBase, emp.moneda)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Ingreso</span>
                      <span className="text-gray-400">{new Date(emp.fechaIngreso).toLocaleDateString('es')}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-white/5">
                      <button onClick={() => { setEditEmp(emp); setFormEmp({ nombre: emp.nombre, email: emp.email, cargo: emp.cargo, departamento: emp.departamento, tipo: emp.tipo, estado: emp.estado, salarioBase: String(emp.salarioBase), moneda: emp.moneda, fechaIngreso: emp.fechaIngreso.slice(0, 10), pais: emp.pais ?? '', notas: emp.notas ?? '' }); setShowEmpModal(true); }} className="flex-1 text-xs text-gray-500 hover:text-white transition-colors text-center">Editar</button>
                      <button onClick={() => setConfirmDel({ id: emp.id, name: emp.nombre })} className="flex-1 text-xs text-red-500/60 hover:text-red-400 transition-colors text-center">Eliminar</button>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* Nómina tab */}
      {tab === 'nomina' && (
        <div className="rounded-xl border border-white/6 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/6 bg-white/2">
                {['Empleado', 'Período', 'Base', 'Bonos', 'Deducciones', 'Total', 'Estado', 'Fecha Pago'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? [...Array(3)].map((_, i) => (
                <tr key={i} className="border-b border-white/4">{[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-700/50 rounded animate-pulse" /></td>)}</tr>
              )) : filtNominas.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500 text-sm">Sin registros de nómina</td></tr>
              ) : filtNominas.map(n => (
                <tr key={n.id} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-white">{n.empleado?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-300">{n.periodo}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{fmt(n.salarioBase, n.moneda)}</td>
                  <td className="px-4 py-3 text-sm text-green-400">+{fmt(n.bonos, n.moneda)}</td>
                  <td className="px-4 py-3 text-sm text-red-400">-{fmt(n.deducciones, n.moneda)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-white">{fmt(n.total, n.moneda)}</td>
                  <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: NOM_COLOR[n.estado] + '18', color: NOM_COLOR[n.estado] }}>● {n.estado}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{n.fechaPago ? new Date(n.fechaPago).toLocaleDateString('es') : '—'}</td>
                </tr>
              ))}
            </tbody>
            {filtNominas.length > 0 && (
              <tfoot>
                <tr className="border-t border-white/6 bg-white/1">
                  <td colSpan={5} className="px-4 py-3 text-xs text-gray-500 font-semibold">Total nómina</td>
                  <td className="px-4 py-3 text-sm font-bold text-white">{fmt(filtNominas.reduce((s, n) => s + n.total, 0), 'USD')}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Vacaciones tab */}
      {tab === 'vacaciones' && (
        <div className="rounded-xl border border-white/6 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/6 bg-white/2">
                {['Empleado', 'Desde', 'Hasta', 'Días', 'Tipo', 'Estado', 'Aprobado por', isAdmin ? 'Acciones' : ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? [...Array(3)].map((_, i) => (
                <tr key={i} className="border-b border-white/4">{[...Array(8)].map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-700/50 rounded animate-pulse" /></td>)}</tr>
              )) : filtVacaciones.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500 text-sm">Sin solicitudes de vacaciones</td></tr>
              ) : filtVacaciones.map(v => (
                <tr key={v.id} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-white">{v.empleado?.nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(v.desde).toLocaleDateString('es')}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{new Date(v.hasta).toLocaleDateString('es')}</td>
                  <td className="px-4 py-3 text-sm font-bold text-white">{v.dias}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{v.tipo}</td>
                  <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: VAC_COLOR[v.estado] + '18', color: VAC_COLOR[v.estado] }}>● {v.estado}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{v.aprobadoPor ?? '—'}</td>
                  <td className="px-4 py-3">
                    {isAdmin && v.estado === 'PENDIENTE' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveVac(v.id, 'APROBADA')} className="text-xs text-green-400/70 hover:text-green-400 transition-colors font-semibold">Aprobar</button>
                        <button onClick={() => handleApproveVac(v.id, 'RECHAZADA')} className="text-xs text-red-400/70 hover:text-red-400 transition-colors">Rechazar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Empleado */}
      {showEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowEmpModal(false)}>
          <div className="w-full max-w-lg bg-[#0f1629] border border-white/8 rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-white mb-5">{editEmp ? 'Editar Empleado' : 'Nuevo Empleado'}</h2>
            <form onSubmit={handleSubmitEmp} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 font-medium">Nombre *</label>
                  <input required value={formEmp.nombre} onChange={e => setFormEmp(f => ({ ...f, nombre: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 font-medium">Email *</label>
                  <input required type="email" value={formEmp.email} onChange={e => setFormEmp(f => ({ ...f, email: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Cargo *</label>
                  <input required value={formEmp.cargo} onChange={e => setFormEmp(f => ({ ...f, cargo: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Departamento *</label>
                  <input required value={formEmp.departamento} onChange={e => setFormEmp(f => ({ ...f, departamento: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Tipo</label>
                  <select value={formEmp.tipo} onChange={e => setFormEmp(f => ({ ...f, tipo: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {TIPOS_EMP.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Estado</label>
                  <select value={formEmp.estado} onChange={e => setFormEmp(f => ({ ...f, estado: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {ESTADOS_EMP.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Salario base</label>
                  <input type="number" step="0.01" value={formEmp.salarioBase} onChange={e => setFormEmp(f => ({ ...f, salarioBase: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Moneda</label>
                  <select value={formEmp.moneda} onChange={e => setFormEmp(f => ({ ...f, moneda: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {['USD', 'EUR', 'COP', 'MXN', 'ARS'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Fecha ingreso *</label>
                  <input required type="date" value={formEmp.fechaIngreso} onChange={e => setFormEmp(f => ({ ...f, fechaIngreso: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">País</label>
                  <input value={formEmp.pais} onChange={e => setFormEmp(f => ({ ...f, pais: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 font-medium">Notas</label>
                  <textarea value={formEmp.notas} onChange={e => setFormEmp(f => ({ ...f, notas: e.target.value }))} rows={2} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none resize-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEmpModal(false)} className="flex-1 px-4 py-2 border border-white/10 text-gray-400 text-sm rounded-lg hover:bg-white/5 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">{editEmp ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Nómina */}
      {showNomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowNomModal(false)}>
          <div className="w-full max-w-md bg-[#0f1629] border border-white/8 rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-white mb-5">Registrar Nómina</h2>
            <form onSubmit={handleSubmitNom} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 font-medium">Empleado *</label>
                <select required value={formNom.empleadoId} onChange={e => { const emp = empleados.find(em => em.id === e.target.value); setFormNom(f => ({ ...f, empleadoId: e.target.value, salarioBase: emp ? String(emp.salarioBase) : f.salarioBase, moneda: emp?.moneda ?? f.moneda })); }}
                  className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                  <option value="">Seleccionar...</option>
                  {empleados.filter(e => e.estado === 'ACTIVO').map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium">Período *</label>
                  <input required type="month" value={formNom.periodo} onChange={e => setFormNom(f => ({ ...f, periodo: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Moneda</label>
                  <select value={formNom.moneda} onChange={e => setFormNom(f => ({ ...f, moneda: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {['USD', 'EUR', 'COP', 'MXN', 'ARS'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                {[{ label: 'Salario base', key: 'salarioBase' }, { label: 'Bonos', key: 'bonos' }, { label: 'Deducciones', key: 'deducciones' }].map(({ label, key }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-400 font-medium">{label}</label>
                    <input type="number" step="0.01" value={(formNom as Record<string, string>)[key]} onChange={e => setFormNom(f => ({ ...f, [key]: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-400 font-medium">Estado</label>
                  <select value={formNom.estado} onChange={e => setFormNom(f => ({ ...f, estado: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {['PENDIENTE', 'PAGADO'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Fecha pago</label>
                  <input type="date" value={formNom.fechaPago} onChange={e => setFormNom(f => ({ ...f, fechaPago: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
              </div>
              <div className="p-3 rounded-lg bg-white/3 border border-white/5 text-xs text-gray-400">
                Total: <span className="text-white font-bold">{fmt((parseFloat(formNom.salarioBase) || 0) + (parseFloat(formNom.bonos) || 0) - (parseFloat(formNom.deducciones) || 0), formNom.moneda)}</span>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowNomModal(false)} className="flex-1 px-4 py-2 border border-white/10 text-gray-400 text-sm rounded-lg hover:bg-white/5 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">Registrar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Vacaciones */}
      {showVacModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowVacModal(false)}>
          <div className="w-full max-w-md bg-[#0f1629] border border-white/8 rounded-2xl p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-white mb-5">Solicitud de Vacaciones</h2>
            <form onSubmit={handleSubmitVac} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 font-medium">Empleado *</label>
                <select required value={formVac.empleadoId} onChange={e => setFormVac(f => ({ ...f, empleadoId: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                  <option value="">Seleccionar...</option>
                  {empleados.filter(e => e.estado === 'ACTIVO').map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 font-medium">Desde *</label>
                  <input required type="date" value={formVac.desde} onChange={e => setFormVac(f => ({ ...f, desde: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Hasta *</label>
                  <input required type="date" value={formVac.hasta} onChange={e => setFormVac(f => ({ ...f, hasta: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-medium">Tipo</label>
                  <select value={formVac.tipo} onChange={e => setFormVac(f => ({ ...f, tipo: e.target.value }))} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none">
                    {['VACACION', 'PERMISO', 'ENFERMEDAD'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium">Notas</label>
                <textarea value={formVac.notas} onChange={e => setFormVac(f => ({ ...f, notas: e.target.value }))} rows={2} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowVacModal(false)} className="flex-1 px-4 py-2 border border-white/10 text-gray-400 text-sm rounded-lg hover:bg-white/5 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">Solicitar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0f1629] border border-white/8 rounded-2xl p-6 w-full max-w-sm">
            <p className="text-sm text-white font-semibold mb-2">¿Eliminar empleado?</p>
            <p className="text-xs text-gray-400 mb-5">{confirmDel.name} y todos sus registros serán eliminados.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDel(null)} className="flex-1 px-4 py-2 border border-white/10 text-gray-400 text-sm rounded-lg hover:bg-white/5 transition-colors">Cancelar</button>
              <button onClick={handleDeleteEmp} className="flex-1 px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
