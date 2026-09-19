'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Registro {
  id: string;
  fecha: string;           // 'YYYY-MM-DD'
  tipo: 'ingreso' | 'gasto';
  categoria: string;
  concepto: string;
  monto: number;
  moneda: 'COP' | 'USD' | 'EUR';
  proyecto: string;
  estado: 'pagado' | 'pendiente' | 'cancelado';
  responsable: string;
}

const CATEGORIAS_INGRESO = ['Proyecto', 'Servicio', 'Consultoría', 'Licencia', 'Otro ingreso'];
const CATEGORIAS_GASTO   = ['Infraestructura Cloud', 'Herramientas y SaaS', 'Marketing', 'Operaciones', 'Nómina', 'Otros'];
const PROYECTOS = ['Agente de Seguridad AI – Cliente A', 'Automatización de Procesos – Cliente B', 'Dashboard BI – Cliente C', 'Integración n8n – Cliente D', 'Interno', 'N/A'];
const SOCIOS = ['Admin ArchiTechIA', 'Freddy Orozco', 'Santiago Ortega', 'Daniel Martínez'];
const MESES_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MONEDAS = ['COP', 'USD', 'EUR'];

const EMPTY_FORM = {
  fecha: new Date().toISOString().split('T')[0],
  tipo: 'ingreso' as 'ingreso' | 'gasto',
  categoria: 'Proyecto',
  concepto: '',
  monto: '',
  moneda: 'USD' as 'COP' | 'USD' | 'EUR',
  proyecto: 'N/A',
  estado: 'pagado' as 'pagado' | 'pendiente' | 'cancelado',
  responsable: SOCIOS[0],
};

const ESTADO_COLORS: Record<string, string> = {
  pagado:    'bg-green-900/30 text-green-400',
  pendiente: 'bg-yellow-900/30 text-yellow-400',
  cancelado: 'bg-red-900/30 text-red-400',
};

// ── Componente principal ────────────────────────────────────────────────────────
export default function FinanzasPage() {
  const { data: session } = useSession();
  const isAdmin = ['ADMIN','SUPERADMIN'].includes((session?.user as { role?: string })?.role ?? '');

  const [registros, setRegistros]   = useState<Registro[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<'resumen' | 'registros'>('resumen');
  const [mesActivo, setMesActivo]   = useState(5);
  const [showModal, setShowModal]   = useState(false);
  const [editReg, setEditReg]       = useState<Registro | null>(null);
  const [confirmDel, setConfirmDel] = useState<Registro | null>(null);
  const [formData, setFormData]     = useState(EMPTY_FORM);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ingreso' | 'gasto'>('todos');
  const [filtroBusq, setFiltroBusq] = useState('');
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear());

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/finanzas');
    const data = await res.json();
    setRegistros(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  // ── Exportar CSV ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Fecha','Tipo','Categoría','Concepto','Proyecto','Monto','Moneda','Estado','Responsable'];
    const rows = registrosFiltrados.map(r => [r.fecha, r.tipo, r.categoria, r.concepto, r.proyecto, r.monto, r.moneda, r.estado, r.responsable]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `finanzas_${filtroAnio}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Cálculos derivados ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const solo2025 = registros.filter(r => r.fecha.startsWith(String(filtroAnio)) && r.estado !== 'cancelado');

    const totalIngresos = solo2025.filter(r => r.tipo === 'ingreso').reduce((s, r) => s + r.monto, 0);
    const totalGastos   = solo2025.filter(r => r.tipo === 'gasto').reduce((s, r) => s + r.monto, 0);
    const utilidad      = totalIngresos - totalGastos;
    const margen        = totalIngresos > 0 ? Math.round((utilidad / totalIngresos) * 100) : 0;

    // Flujo por mes
    const ingPorMes = MESES_LABELS.map((_, i) =>
      solo2025.filter(r => r.tipo === 'ingreso' && new Date(r.fecha).getMonth() === i).reduce((s, r) => s + r.monto, 0)
    );
    const gastPorMes = MESES_LABELS.map((_, i) =>
      solo2025.filter(r => r.tipo === 'gasto' && new Date(r.fecha).getMonth() === i).reduce((s, r) => s + r.monto, 0)
    );

    // Gastos por categoría
    const catMap: Record<string, number> = {};
    solo2025.filter(r => r.tipo === 'gasto').forEach(r => {
      catMap[r.categoria] = (catMap[r.categoria] || 0) + r.monto;
    });
    const categorias = Object.entries(catMap)
      .map(([categoria, monto]) => ({ categoria, monto }))
      .sort((a, b) => b.monto - a.monto);

    // Rentabilidad por proyecto
    const proyMap: Record<string, { ingreso: number; gasto: number }> = {};
    solo2025.filter(r => r.proyecto !== 'Interno' && r.proyecto !== 'N/A').forEach(r => {
      if (!proyMap[r.proyecto]) proyMap[r.proyecto] = { ingreso: 0, gasto: 0 };
      if (r.tipo === 'ingreso') proyMap[r.proyecto].ingreso += r.monto;
      else proyMap[r.proyecto].gasto += r.monto;
    });
    const proyectos = Object.entries(proyMap).map(([nombre, v]) => ({ nombre, ...v }));

    return { totalIngresos, totalGastos, utilidad, margen, ingPorMes, gastPorMes, categorias, proyectos };
  }, [registros, filtroAnio]);

  const mesesConDatos = MESES_LABELS.map((label, i) => ({
    label, i,
    ing: stats.ingPorMes[i],
    gast: stats.gastPorMes[i],
    activo: stats.ingPorMes[i] > 0 || stats.gastPorMes[i] > 0,
  })).filter(m => m.activo || m.i <= mesActivo);

  const maxVal = Math.max(...stats.ingPorMes, ...stats.gastPorMes, 1);

  // ── Filtros tabla ────────────────────────────────────────────────────────────
  const registrosFiltrados = useMemo(() => {
    return registros
      .filter(r => filtroTipo === 'todos' || r.tipo === filtroTipo)
      .filter(r =>
        r.concepto.toLowerCase().includes(filtroBusq.toLowerCase()) ||
        r.categoria.toLowerCase().includes(filtroBusq.toLowerCase()) ||
        r.proyecto.toLowerCase().includes(filtroBusq.toLowerCase())
      )
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [registros, filtroTipo, filtroBusq]);

  // ── CRUD ─────────────────────────────────────────────────────────────────────
  const openNew = () => {
    setEditReg(null);
    setFormData(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (r: Registro) => {
    setEditReg(r);
    setFormData({ fecha: r.fecha, tipo: r.tipo, categoria: r.categoria, concepto: r.concepto, monto: String(r.monto), moneda: r.moneda, proyecto: r.proyecto, estado: r.estado, responsable: r.responsable });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      fecha: formData.fecha, tipo: formData.tipo, categoria: formData.categoria,
      concepto: formData.concepto, monto: parseFloat(formData.monto.replace(/[^0-9.]/g, '')) || 0,
      moneda: formData.moneda, proyecto: formData.proyecto, estado: formData.estado, responsable: formData.responsable,
    };
    if (editReg) {
      await fetch(`/api/finanzas/${editReg.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } else {
      await fetch('/api/finanzas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    setShowModal(false);
    fetchRegistros();
  };

  const handleDelete = async () => {
    if (!confirmDel) return;
    await fetch(`/api/finanzas/${confirmDel.id}`, { method: 'DELETE' });
    setConfirmDel(null);
    fetchRegistros();
  };

  const categoriasForForm = formData.tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_GASTO;

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <p className="text-gray-400 mt-1">Ingresos, gastos y rentabilidad de ArchiTechIA</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors text-sm font-medium">
          + Nuevo Registro
        </button>
      </div>

      {/* Tabs + filtro año */}
      <div className="flex items-center justify-between border-b border-gray-700 mb-6">
        <div className="flex">
          {(['resumen', 'registros'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium capitalize transition-colors ${tab === t ? 'text-orange-400 border-b-2 border-orange-500' : 'text-gray-400 hover:text-white'}`}>
              {t === 'resumen' ? 'Resumen' : `Registros (${registros.length})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-1">
          <select value={filtroAnio} onChange={e => setFiltroAnio(Number(e.target.value))}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none">
            {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {tab === 'registros' && (
            <button onClick={exportCSV}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 hover:border-orange-500 rounded-lg text-gray-300 hover:text-orange-400 text-sm transition-colors flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV
            </button>
          )}
        </div>
      </div>

      {/* ── TAB: RESUMEN ──────────────────────────────────────────────────────── */}
      {tab === 'resumen' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Ingresos totales', valor: stats.totalIngresos, color: 'text-green-400',  bg: 'bg-green-900/20 border-green-800' },
              { label: 'Gastos totales',   valor: stats.totalGastos,   color: 'text-red-400',    bg: 'bg-red-900/20 border-red-800' },
              { label: 'Utilidad neta',    valor: stats.utilidad,      color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-800' },
              { label: 'Margen',           valor: null,                color: 'text-blue-400',   bg: 'bg-blue-900/20 border-blue-800', extra: `${stats.margen}%` },
            ].map(k => (
              <div key={k.label} className={`rounded-xl p-5 border ${k.bg}`}>
                <p className="text-xs text-gray-400 mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>
                  {k.extra ?? `$${k.valor!.toLocaleString()}`}
                </p>
              </div>
            ))}
          </div>

          {/* Gráfica de barras */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold text-white mb-6">Flujo de Caja — {filtroAnio}</h2>
            <div className="flex items-end gap-2 md:gap-4 h-48">
              {MESES_LABELS.map((mes, i) => {
                if (stats.ingPorMes[i] === 0 && stats.gastPorMes[i] === 0) return null;
                return (
                  <div key={mes} className="flex-1 flex flex-col items-center gap-1 cursor-pointer min-w-0" onClick={() => setMesActivo(i)}>
                    <div className="w-full flex gap-0.5 md:gap-1 items-end justify-center" style={{ height: '160px' }}>
                      <div className={`flex-1 rounded-t transition-all ${i === mesActivo ? 'bg-green-400' : 'bg-green-700/60'}`}
                        style={{ height: `${(stats.ingPorMes[i] / maxVal) * 160}px` }}
                        title={`Ingreso: $${stats.ingPorMes[i].toLocaleString()}`} />
                      <div className={`flex-1 rounded-t transition-all ${i === mesActivo ? 'bg-red-400' : 'bg-red-700/60'}`}
                        style={{ height: `${(stats.gastPorMes[i] / maxVal) * 160}px` }}
                        title={`Gasto: $${stats.gastPorMes[i].toLocaleString()}`} />
                    </div>
                    <span className={`text-xs truncate ${i === mesActivo ? 'text-orange-400 font-semibold' : 'text-gray-500'}`}>{mes}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700 flex flex-wrap items-center gap-4 md:gap-8 text-sm">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-green-400 inline-block" /> Ingreso <span className="text-green-400 font-semibold">${stats.ingPorMes[mesActivo].toLocaleString()}</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Gasto <span className="text-red-400 font-semibold">${stats.gastPorMes[mesActivo].toLocaleString()}</span></div>
              <div className="flex items-center gap-2 md:ml-auto">Utilidad <span className="text-orange-400 font-semibold">${(stats.ingPorMes[mesActivo] - stats.gastPorMes[mesActivo]).toLocaleString()}</span></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Gastos por categoría */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Gastos por Categoría</h2>
              <div className="space-y-3">
                {stats.categorias.map(g => {
                  const pct = stats.totalGastos > 0 ? Math.round((g.monto / stats.totalGastos) * 100) : 0;
                  return (
                    <div key={g.categoria}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{g.categoria}</span>
                        <span className="text-gray-400">${g.monto.toLocaleString()} <span className="text-orange-400">({pct}%)</span></span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div className="bg-orange-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rentabilidad por proyecto */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Rentabilidad por Proyecto</h2>
              <div className="space-y-3">
                {stats.proyectos.map(p => {
                  const util = p.ingreso - p.gasto;
                  const mrg  = p.ingreso > 0 ? Math.round((util / p.ingreso) * 100) : 0;
                  return (
                    <div key={p.nombre} className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                      <p className="text-sm font-medium text-white mb-1 leading-tight">{p.nombre}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                        <span>Ingreso: <span className="text-green-400">${p.ingreso.toLocaleString()}</span></span>
                        <span>Gasto: <span className="text-red-400">${p.gasto.toLocaleString()}</span></span>
                        <span>Margen: <span className="text-orange-400">{mrg}%</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── TAB: REGISTROS ────────────────────────────────────────────────────── */}
      {tab === 'registros' && (
        <>
          {/* Filtros */}
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              type="text" placeholder="Buscar concepto, categoría, proyecto..."
              value={filtroBusq} onChange={e => setFiltroBusq(e.target.value)}
              className="flex-1 min-w-48 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:outline-none"
            />
            <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
              {(['todos', 'ingreso', 'gasto'] as const).map(t => (
                <button key={t} onClick={() => setFiltroTipo(t)}
                  className={`px-3 py-1 rounded-md text-sm transition-colors capitalize ${filtroTipo === t ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Resumen rápido */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400">Registros</p>
              <p className="text-lg font-bold text-white">{registrosFiltrados.length}</p>
            </div>
            <div className="bg-green-900/20 border border-green-800 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400">Ingresos</p>
              <p className="text-lg font-bold text-green-400">${registrosFiltrados.filter(r => r.tipo === 'ingreso').reduce((s, r) => s + r.monto, 0).toLocaleString()}</p>
            </div>
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400">Gastos</p>
              <p className="text-lg font-bold text-red-400">${registrosFiltrados.filter(r => r.tipo === 'gasto').reduce((s, r) => s + r.monto, 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 border-b border-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Concepto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Proyecto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Moneda</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Monto</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Responsable</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {registrosFiltrados.map(r => (
                    <tr key={r.id} className="hover:bg-gray-700/40 transition-colors">
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{r.fecha}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.tipo === 'ingreso' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                          {r.tipo === 'ingreso' ? '↑ Ingreso' : '↓ Gasto'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{r.categoria}</td>
                      <td className="px-4 py-3 text-white max-w-xs truncate">{r.concepto}</td>
                      <td className="px-4 py-3 text-gray-400 max-w-xs truncate whitespace-nowrap">{r.proyecto}</td>
                      <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-400">
                          {r.moneda}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${r.tipo === 'ingreso' ? 'text-green-400' : 'text-red-400'}`}>
                        {r.tipo === 'ingreso' ? '+' : '-'}{r.moneda === 'COP' ? '$' : r.moneda === 'USD' ? '$' : '€'}{r.monto.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${ESTADO_COLORS[r.estado]}`}>{r.estado}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{r.responsable}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(r)}
                            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors">
                            Editar
                          </button>
                          {isAdmin && (
                            <button onClick={() => setConfirmDel(r)}
                              className="px-2 py-1 text-xs bg-red-900/40 hover:bg-red-800/60 text-red-400 rounded transition-colors">
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {registrosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <svg className="w-8 h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-gray-500 text-sm">
                            {registros.length === 0 ? 'Aún no hay registros financieros. Agrega el primero.' : 'Sin registros con los filtros aplicados.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Modal crear / editar ─────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-white">{editReg ? 'Editar Registro' : 'Nuevo Registro'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Fecha</label>
                  <input required type="date" value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
                  <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value as 'ingreso'|'gasto', categoria: e.target.value === 'ingreso' ? CATEGORIAS_INGRESO[0] : CATEGORIAS_GASTO[0]})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none">
                    <option value="ingreso">Ingreso</option>
                    <option value="gasto">Gasto</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Categoría</label>
                  <select value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none">
                    {categoriasForForm.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Concepto</label>
                  <input required type="text" value={formData.concepto} onChange={e => setFormData({...formData, concepto: e.target.value})}
                    placeholder="Descripción del movimiento"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Moneda</label>
                  <select value={formData.moneda} onChange={e => setFormData({...formData, moneda: e.target.value as 'COP'|'USD'|'EUR'})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none">
                    {MONEDAS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Monto</label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-gray-400 text-sm select-none pointer-events-none">
                      {formData.moneda === 'EUR' ? '€' : '$'}
                    </span>
                    <input
                      required
                      type="text"
                      inputMode="decimal"
                      value={formData.monto}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9.]/g, '');
                        setFormData({...formData, monto: raw});
                      }}
                      onBlur={() => {
                        const num = parseFloat(formData.monto.replace(/[^0-9.]/g, ''));
                        if (!isNaN(num) && num > 0) {
                          setFormData({...formData, monto: num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })});
                        }
                      }}
                      onFocus={() => {
                        const raw = formData.monto.replace(/[^0-9.]/g, '');
                        setFormData({...formData, monto: raw});
                      }}
                      placeholder="0"
                      className="w-full pl-8 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Proyecto</label>
                  <select value={formData.proyecto} onChange={e => setFormData({...formData, proyecto: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none">
                    {PROYECTOS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Estado</label>
                  <select value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value as 'pagado'|'pendiente'|'cancelado'})}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none">
                    <option value="pagado">Pagado</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Responsable</label>
                <select value={formData.responsable} onChange={e => setFormData({...formData, responsable: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none">
                  {SOCIOS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 text-sm">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium">{editReg ? 'Guardar Cambios' : 'Agregar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal confirmar eliminación ──────────────────────────────────────── */}
      {confirmDel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl shadow-xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">Eliminar registro</h3>
                <p className="text-gray-400 text-sm">¿Eliminar <span className="text-white font-medium">"{confirmDel.concepto}"</span>? Esto actualizará todos los paneles.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 text-sm">Cancelar</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
