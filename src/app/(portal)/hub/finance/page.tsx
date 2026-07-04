'use client';

import { useState, useMemo, useEffect } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────
type Area = 'comercial' | 'operacion' | 'tecnologia' | 'rrhh' | 'legal' | 'administracion';

interface CentroCosto {
  id: string; nombre: string; codigo: string; area: Area; color: string; activo: boolean;
}

interface Movimiento {
  id: string; fecha: string; tipo: 'ingreso' | 'egreso'; concepto: string;
  monto: number; centroCostoId: string; categoria: string;
  estado: 'confirmado' | 'pendiente'; conciliado: boolean;
  referencia?: string; notas?: string;
}

interface Presupuesto {
  id: string; nombre: string; periodo: string; centroCostoId: string;
  tipo: 'ingreso' | 'egreso'; categoria: string; monto: number;
}

// ── Seed data ──────────────────────────────────────────────────────────────
const SEED_CENTROS: CentroCosto[] = [
  { id: 'cc1', nombre: 'Comercial', codigo: 'COM', area: 'comercial', color: '#60a5fa', activo: true },
  { id: 'cc2', nombre: 'Operaciones', codigo: 'OPS', area: 'operacion', color: '#a78bfa', activo: true },
  { id: 'cc3', nombre: 'Tecnología', codigo: 'TEC', area: 'tecnologia', color: '#22d3ee', activo: true },
  { id: 'cc4', nombre: 'RRHH', codigo: 'RRH', area: 'rrhh', color: '#f472b6', activo: true },
  { id: 'cc5', nombre: 'Legal', codigo: 'LEG', area: 'legal', color: '#fbbf24', activo: true },
  { id: 'cc6', nombre: 'Administración', codigo: 'ADM', area: 'administracion', color: '#34d399', activo: true },
];

const SEED_MOV: Movimiento[] = [
  { id: 'm1', fecha: '2025-06-01', tipo: 'ingreso', concepto: 'Pago proyecto Smartlex', monto: 4500000, centroCostoId: 'cc1', categoria: 'Facturación', estado: 'confirmado', conciliado: true, referencia: 'FAC-001' },
  { id: 'm2', fecha: '2025-06-05', tipo: 'egreso', concepto: 'Nómina junio', monto: 2100000, centroCostoId: 'cc4', categoria: 'Nómina', estado: 'confirmado', conciliado: true, referencia: 'NOM-06' },
  { id: 'm3', fecha: '2025-06-10', tipo: 'ingreso', concepto: 'Pago FB Ingenieros - Fase 1', monto: 3200000, centroCostoId: 'cc1', categoria: 'Facturación', estado: 'confirmado', conciliado: false, referencia: 'FAC-002' },
  { id: 'm4', fecha: '2025-06-12', tipo: 'egreso', concepto: 'Licencias software cloud', monto: 450000, centroCostoId: 'cc3', categoria: 'Software', estado: 'confirmado', conciliado: true, referencia: 'EGR-001' },
  { id: 'm5', fecha: '2025-06-15', tipo: 'egreso', concepto: 'Hosting y servidores VPS', monto: 280000, centroCostoId: 'cc3', categoria: 'Infraestructura', estado: 'confirmado', conciliado: false },
  { id: 'm6', fecha: '2025-06-18', tipo: 'ingreso', concepto: 'Retención mensual cliente A', monto: 1800000, centroCostoId: 'cc2', categoria: 'Retención', estado: 'pendiente', conciliado: false },
  { id: 'm7', fecha: '2025-06-20', tipo: 'egreso', concepto: 'Marketing y publicidad', monto: 350000, centroCostoId: 'cc1', categoria: 'Marketing', estado: 'confirmado', conciliado: true },
  { id: 'm8', fecha: '2025-06-22', tipo: 'egreso', concepto: 'Asesoría legal contratos', monto: 600000, centroCostoId: 'cc5', categoria: 'Servicios externos', estado: 'pendiente', conciliado: false },
  { id: 'm9', fecha: '2025-07-01', tipo: 'ingreso', concepto: 'Pago Smartlex - Fase 2', monto: 5200000, centroCostoId: 'cc1', categoria: 'Facturación', estado: 'pendiente', conciliado: false, referencia: 'FAC-003' },
  { id: 'm10', fecha: '2025-07-03', tipo: 'egreso', concepto: 'Nómina julio', monto: 2100000, centroCostoId: 'cc4', categoria: 'Nómina', estado: 'pendiente', conciliado: false },
];

const SEED_PRES: Presupuesto[] = [
  { id: 'p1', nombre: 'Facturación Q2', periodo: '2025-Q2', centroCostoId: 'cc1', tipo: 'ingreso', categoria: 'Facturación', monto: 12000000 },
  { id: 'p2', nombre: 'Nómina Q2', periodo: '2025-Q2', centroCostoId: 'cc4', tipo: 'egreso', categoria: 'Nómina', monto: 6300000 },
  { id: 'p3', nombre: 'Software Q2', periodo: '2025-Q2', centroCostoId: 'cc3', tipo: 'egreso', categoria: 'Software', monto: 1200000 },
  { id: 'p4', nombre: 'Marketing Q2', periodo: '2025-Q2', centroCostoId: 'cc1', tipo: 'egreso', categoria: 'Marketing', monto: 900000 },
  { id: 'p5', nombre: 'Infraestructura Q2', periodo: '2025-Q2', centroCostoId: 'cc3', tipo: 'egreso', categoria: 'Infraestructura', monto: 800000 },
  { id: 'p6', nombre: 'Retenciones Q3', periodo: '2025-Q3', centroCostoId: 'cc2', tipo: 'ingreso', categoria: 'Retención', monto: 5400000 },
  { id: 'p7', nombre: 'Nómina Q3', periodo: '2025-Q3', centroCostoId: 'cc4', tipo: 'egreso', categoria: 'Nómina', monto: 6300000 },
];

// ── Storage ────────────────────────────────────────────────────────────────
function loadLS<T>(key: string, seed: T): T {
  if (typeof window === 'undefined') return seed;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : seed; } catch { return seed; }
}
function saveLS(key: string, val: unknown) {
  if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(val));
}

// ── Style constants ────────────────────────────────────────────────────────
const glass = {
  card:  { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px' } as React.CSSProperties,
  panel: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '14px', backdropFilter: 'blur(12px)' } as React.CSSProperties,
  modal: { background: 'rgba(8,8,26,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', backdropFilter: 'blur(24px)' } as React.CSSProperties,
  input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', outline: 'none', width: '100%', padding: '8px 12px', fontSize: '13px' } as React.CSSProperties,
};
const label: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' };
const fmt = (n: number) => `$${n.toLocaleString('es-CO')}`;

const TABS = ['Flujo de Caja', 'Centros de Costo', 'Presupuestos', 'Conciliación'];
const PERIODOS = ['2025-Q1','2025-Q2','2025-Q3','2025-Q4','2026-Q1'];
const CATEGORIAS_ING = ['Facturación','Retención','Anticipo','Otro ingreso'];
const CATEGORIAS_EGR = ['Nómina','Software','Infraestructura','Marketing','Servicios externos','Impuestos','Otro egreso'];

function uid() { return Math.random().toString(36).slice(2, 10); }

// ── Main component ─────────────────────────────────────────────────────────
export default function FinancePage() {
  const [tab, setTab] = useState(0);
  const [centros, setCentros]   = useState<CentroCosto[]>([]);
  const [movs, setMovs]         = useState<Movimiento[]>([]);
  const [presups, setPresups]   = useState<Presupuesto[]>([]);
  const [ready, setReady]       = useState(false);

  useEffect(() => {
    setCentros(loadLS('fin-centros-v1', SEED_CENTROS));
    setMovs(loadLS('fin-movs-v1', SEED_MOV));
    setPresups(loadLS('fin-pres-v1', SEED_PRES));
    setReady(true);
  }, []);

  const saveCentros = (v: CentroCosto[]) => { setCentros(v); saveLS('fin-centros-v1', v); };
  const saveMovs    = (v: Movimiento[])  => { setMovs(v);    saveLS('fin-movs-v1', v); };
  const savePresups = (v: Presupuesto[]) => { setPresups(v); saveLS('fin-pres-v1', v); };

  if (!ready) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.06)', borderTopColor: '#34d399', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ padding: '10px 32px 40px', minHeight: 'calc(100vh - 52px)', background: '#070716' }}>
      {/* Nav tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '4px', width: 'fit-content', border: '1px solid rgba(255,255,255,0.07)' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{ padding: '7px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', transition: 'all 0.15s', background: tab === i ? 'linear-gradient(135deg,#34d399,#059669)' : 'transparent', color: tab === i ? '#fff' : '#64748b', boxShadow: tab === i ? '0 2px 8px rgba(52,211,153,0.25)' : 'none' }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <FlujoCaja movs={movs} centros={centros} onSave={saveMovs} />}
      {tab === 1 && <CentrosCosto centros={centros} movs={movs} presups={presups} onSave={saveCentros} />}
      {tab === 2 && <Presupuestos presups={presups} centros={centros} movs={movs} onSave={savePresups} />}
      {tab === 3 && <Conciliacion movs={movs} centros={centros} onSave={saveMovs} />}
    </div>
  );
}

// ── Tab 1: Flujo de Caja ───────────────────────────────────────────────────
function FlujoCaja({ movs, centros, onSave }: { movs: Movimiento[]; centros: CentroCosto[]; onSave: (v: Movimiento[]) => void }) {
  const [fPeriodo, setFPeriodo] = useState('');
  const [fTipo, setFTipo]       = useState('');
  const [fCentro, setFCentro]   = useState('');
  const [fEstado, setFEstado]   = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ fecha: '', tipo: 'ingreso', concepto: '', monto: '', centroCostoId: '', categoria: '', estado: 'confirmado', referencia: '', notas: '' });

  const filtered = useMemo(() => movs.filter(m => {
    if (fTipo   && m.tipo !== fTipo) return false;
    if (fCentro && m.centroCostoId !== fCentro) return false;
    if (fEstado && m.estado !== fEstado) return false;
    if (fPeriodo) {
      const [y, q] = fPeriodo.split('-Q');
      const mes = new Date(m.fecha).getMonth() + 1;
      const year = new Date(m.fecha).getFullYear();
      if (year !== Number(y)) return false;
      if (q) { const qn = Number(q); if (mes < (qn-1)*3+1 || mes > qn*3) return false; }
    }
    return true;
  }).sort((a, b) => b.fecha.localeCompare(a.fecha)), [movs, fTipo, fCentro, fEstado, fPeriodo]);

  const totIngresos = filtered.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
  const totEgresos  = filtered.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
  const saldo       = totIngresos - totEgresos;

  const guardar = () => {
    if (!form.fecha || !form.concepto || !form.monto || !form.centroCostoId) return;
    const nuevo: Movimiento = { id: uid(), fecha: form.fecha, tipo: form.tipo as 'ingreso'|'egreso', concepto: form.concepto, monto: Number(form.monto), centroCostoId: form.centroCostoId, categoria: form.categoria, estado: form.estado as 'confirmado'|'pendiente', conciliado: false, referencia: form.referencia || undefined, notas: form.notas || undefined };
    onSave([nuevo, ...movs]);
    setShowModal(false);
    setForm({ fecha: '', tipo: 'ingreso', concepto: '', monto: '', centroCostoId: '', categoria: '', estado: 'confirmado', referencia: '', notas: '' });
  };

  const centro = (id: string) => centros.find(c => c.id === id);

  return (
    <>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Saldo neto', value: fmt(saldo), color: saldo >= 0 ? '#34d399' : '#f87171', accent: saldo >= 0 ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)' },
          { label: 'Total ingresos', value: fmt(totIngresos), color: '#34d399', accent: 'rgba(52,211,153,0.06)' },
          { label: 'Total egresos',  value: fmt(totEgresos),  color: '#f87171', accent: 'rgba(248,113,113,0.06)' },
        ].map(k => (
          <div key={k.label} style={{ ...glass.card, padding: '16px 20px', background: k.accent }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{k.label}</p>
            <p style={{ fontSize: '22px', fontWeight: 800, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros + acción */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { val: fPeriodo, set: setFPeriodo, opts: [['','Todos los períodos'], ...PERIODOS.map(p => [p,p])], placeholder: 'Período' },
          { val: fTipo,    set: setFTipo,    opts: [['','Ingreso / Egreso'],['ingreso','Ingresos'],['egreso','Egresos']], placeholder: 'Tipo' },
          { val: fCentro,  set: setFCentro,  opts: [['','Todos los centros'], ...centros.map(c => [c.id, c.nombre])], placeholder: 'Centro' },
          { val: fEstado,  set: setFEstado,  opts: [['','Todos los estados'],['confirmado','Confirmado'],['pendiente','Pendiente']], placeholder: 'Estado' },
        ].map((f, i) => (
          <select key={i} value={f.val} onChange={e => f.set(e.target.value)} style={{ ...glass.input, width: 'auto', padding: '7px 12px', fontSize: '12px' }}>
            {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <button onClick={() => setShowModal(true)} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'linear-gradient(135deg,#34d399,#059669)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 12px rgba(52,211,153,0.25)', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo movimiento
        </button>
      </div>

      {/* Tabla */}
      <div style={{ ...glass.card, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Fecha','Concepto','Centro de Costo','Categoría','Estado','Monto'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: '#334155', fontSize: '13px' }}>Sin movimientos para los filtros seleccionados</td></tr>
            ) : filtered.map((m, i) => {
              const cc = centro(m.centroCostoId);
              return (
                <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                >
                  <td style={{ padding: '11px 16px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>{m.concepto}</p>
                    {m.referencia && <p style={{ fontSize: '11px', color: '#475569', margin: '2px 0 0' }}>{m.referencia}</p>}
                  </td>
                  <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                    {cc && <span style={{ padding: '2px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '20px', background: cc.color + '18', color: cc.color, border: `1px solid ${cc.color}40` }}>{cc.nombre}</span>}
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: '12px', color: '#64748b' }}>{m.categoria}</td>
                  <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                    <span style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 700, borderRadius: '20px', background: m.estado === 'confirmado' ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', color: m.estado === 'confirmado' ? '#34d399' : '#fbbf24', border: `1px solid ${m.estado === 'confirmado' ? 'rgba(52,211,153,0.25)' : 'rgba(251,191,36,0.25)'}` }}>{m.estado === 'confirmado' ? 'Confirmado' : 'Pendiente'}</span>
                  </td>
                  <td style={{ padding: '11px 16px', whiteSpace: 'nowrap', fontWeight: 700, fontSize: '14px', color: m.tipo === 'ingreso' ? '#34d399' : '#f87171', textAlign: 'right' }}>
                    {m.tipo === 'ingreso' ? '+' : '-'}{fmt(m.monto)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal nuevo movimiento */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(4px)' }}>
          <div style={{ ...glass.modal, padding: '28px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f1f5f9' }}>Nuevo Movimiento</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={label}>Fecha</label>
                  <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})} style={{ ...glass.input, colorScheme: 'dark' } as React.CSSProperties} />
                </div>
                <div>
                  <label style={label}>Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value, categoria: ''})} style={glass.input}>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={label}>Concepto</label>
                <input type="text" placeholder="Descripción del movimiento..." value={form.concepto} onChange={e => setForm({...form, concepto: e.target.value})} style={glass.input} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={label}>Monto</label>
                  <input type="number" placeholder="0" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} style={glass.input} />
                </div>
                <div>
                  <label style={label}>Centro de Costo</label>
                  <select value={form.centroCostoId} onChange={e => setForm({...form, centroCostoId: e.target.value})} style={glass.input}>
                    <option value="">Seleccionar...</option>
                    {centros.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={label}>Categoría</label>
                  <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} style={glass.input}>
                    <option value="">Seleccionar...</option>
                    {(form.tipo === 'ingreso' ? CATEGORIAS_ING : CATEGORIAS_EGR).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Estado</label>
                  <select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})} style={glass.input}>
                    <option value="confirmado">Confirmado</option>
                    <option value="pendiente">Pendiente</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={label}>Referencia (opcional)</label>
                <input type="text" placeholder="FAC-001, NOM-06..." value={form.referencia} onChange={e => setForm({...form, referencia: e.target.value})} style={glass.input} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
                <button onClick={guardar} style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#34d399,#059669)', border: 'none', borderRadius: '9px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Tab 2: Centros de Costo ────────────────────────────────────────────────
function CentrosCosto({ centros, movs, presups, onSave }: { centros: CentroCosto[]; movs: Movimiento[]; presups: Presupuesto[]; onSave: (v: CentroCosto[]) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', codigo: '', area: 'operacion' as Area, color: '#60a5fa' });

  const COLORES = ['#60a5fa','#a78bfa','#22d3ee','#f472b6','#fbbf24','#34d399','#f97316','#f87171'];

  const guardar = () => {
    if (!form.nombre || !form.codigo) return;
    const nuevo: CentroCosto = { id: uid(), ...form, activo: true };
    onSave([...centros, nuevo]);
    setShowModal(false);
    setForm({ nombre: '', codigo: '', area: 'operacion', color: '#60a5fa' });
  };

  const toggleActivo = (id: string) => onSave(centros.map(c => c.id === id ? {...c, activo: !c.activo} : c));

  const gastoPorCentro = (id: string) => movs.filter(m => m.centroCostoId === id && m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
  const ingresoPorCentro = (id: string) => movs.filter(m => m.centroCostoId === id && m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
  const presupPorCentro = (id: string) => presups.filter(p => p.centroCostoId === id && p.tipo === 'egreso').reduce((s, p) => s + p.monto, 0);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'linear-gradient(135deg,#34d399,#059669)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 12px rgba(52,211,153,0.25)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo Centro
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: '14px' }}>
        {centros.map(c => {
          const gasto = gastoPorCentro(c.id);
          const ingreso = ingresoPorCentro(c.id);
          const presup = presupPorCentro(c.id);
          const pct = presup > 0 ? Math.min(100, Math.round((gasto / presup) * 100)) : 0;
          const alerta = pct >= 90;
          return (
            <div key={c.id} style={{ ...glass.card, padding: '20px', opacity: c.activo ? 1 : 0.5 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: c.color + '20', border: `1px solid ${c.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, color: c.color }}>{c.codigo}</span>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>{c.nombre}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#475569' }}>{c.area}</p>
                  </div>
                </div>
                <button onClick={() => toggleActivo(c.id)} style={{ padding: '3px 10px', fontSize: '10px', fontWeight: 700, borderRadius: '20px', border: `1px solid ${c.activo ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`, background: c.activo ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)', color: c.activo ? '#34d399' : '#475569', cursor: 'pointer' }}>
                  {c.activo ? 'Activo' : 'Inactivo'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div style={{ ...glass.panel, padding: '10px 12px' }}>
                  <p style={{ margin: 0, fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Ingresos</p>
                  <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 800, color: '#34d399' }}>{fmt(ingreso)}</p>
                </div>
                <div style={{ ...glass.panel, padding: '10px 12px' }}>
                  <p style={{ margin: 0, fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Egresos</p>
                  <p style={{ margin: '4px 0 0', fontSize: '15px', fontWeight: 800, color: '#f87171' }}>{fmt(gasto)}</p>
                </div>
              </div>

              {presup > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>Presupuesto</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: alerta ? '#f87171' : '#64748b' }}>{pct}% ejecutado</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: '3px', background: alerta ? 'linear-gradient(90deg,#f97316,#f87171)' : `linear-gradient(90deg,${c.color},${c.color}99)`, transition: 'width 0.4s ease' }} />
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#334155' }}>Presup.: {fmt(presup)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(4px)' }}>
          <div style={{ ...glass.modal, padding: '28px', width: '100%', maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f1f5f9' }}>Nuevo Centro de Costo</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={label}>Nombre</label>
                  <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} style={glass.input} />
                </div>
                <div>
                  <label style={label}>Código</label>
                  <input type="text" maxLength={5} value={form.codigo} onChange={e => setForm({...form, codigo: e.target.value.toUpperCase()})} style={glass.input} />
                </div>
              </div>
              <div>
                <label style={label}>Área</label>
                <select value={form.area} onChange={e => setForm({...form, area: e.target.value as Area})} style={glass.input}>
                  {(['comercial','operacion','tecnologia','rrhh','legal','administracion'] as Area[]).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Color</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {COLORES.map(c => (
                    <button key={c} onClick={() => setForm({...form, color: c})} style={{ width: '28px', height: '28px', borderRadius: '50%', background: c, border: form.color === c ? '3px solid #fff' : '3px solid transparent', cursor: 'pointer', boxShadow: form.color === c ? `0 0 8px ${c}` : 'none' }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
                <button onClick={guardar} style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#34d399,#059669)', border: 'none', borderRadius: '9px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Tab 3: Presupuestos ────────────────────────────────────────────────────
function Presupuestos({ presups, centros, movs, onSave }: { presups: Presupuesto[]; centros: CentroCosto[]; movs: Movimiento[]; onSave: (v: Presupuesto[]) => void }) {
  const [periodo, setPeriodo] = useState('2025-Q2');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nombre: '', periodo: '2025-Q2', centroCostoId: '', tipo: 'egreso', categoria: '', monto: '' });

  const filtrados = presups.filter(p => p.periodo === periodo);

  const realPorPresup = (p: Presupuesto) => {
    const [y, q] = p.periodo.split('-Q');
    return movs.filter(m => {
      if (m.centroCostoId !== p.centroCostoId || m.tipo !== p.tipo || m.categoria !== p.categoria) return false;
      const mes = new Date(m.fecha).getMonth() + 1;
      const year = new Date(m.fecha).getFullYear();
      if (year !== Number(y)) return false;
      if (q) { const qn = Number(q); if (mes < (qn-1)*3+1 || mes > qn*3) return false; }
      return true;
    }).reduce((s, m) => s + m.monto, 0);
  };

  const guardar = () => {
    if (!form.nombre || !form.centroCostoId || !form.monto) return;
    const nuevo: Presupuesto = { id: uid(), nombre: form.nombre, periodo: form.periodo, centroCostoId: form.centroCostoId, tipo: form.tipo as 'ingreso'|'egreso', categoria: form.categoria, monto: Number(form.monto) };
    onSave([...presups, nuevo]);
    setShowModal(false);
  };

  const eliminar = (id: string) => onSave(presups.filter(p => p.id !== id));

  const totPresup = filtrados.reduce((s, p) => p.tipo === 'egreso' ? s - p.monto : s + p.monto, 0);

  return (
    <>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ ...glass.input, width: 'auto', padding: '7px 12px', fontSize: '13px' }}>
          {PERIODOS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div style={{ ...glass.card, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#475569' }}>Balance presupuestado:</span>
          <span style={{ fontSize: '14px', fontWeight: 800, color: totPresup >= 0 ? '#34d399' : '#f87171' }}>{fmt(Math.abs(totPresup))}</span>
        </div>
        <button onClick={() => { setForm({...form, periodo}); setShowModal(true); }} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'linear-gradient(135deg,#34d399,#059669)', border: 'none', borderRadius: '9px', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 12px rgba(52,211,153,0.25)', flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva partida
        </button>
      </div>

      <div style={{ ...glass.card, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Nombre','Centro','Tipo','Categoría','Presupuestado','Real','Variación',''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#334155', fontSize: '13px' }}>No hay partidas presupuestarias para este período</td></tr>
            ) : filtrados.map((p, i) => {
              const cc = centros.find(c => c.id === p.centroCostoId);
              const real = realPorPresup(p);
              const variacion = p.tipo === 'egreso' ? p.monto - real : real - p.monto;
              const pct = p.monto > 0 ? Math.round((real / p.monto) * 100) : 0;
              const ok = variacion >= 0;
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={{ padding: '11px 16px', fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{p.nombre}</td>
                  <td style={{ padding: '11px 16px' }}>
                    {cc && <span style={{ padding: '2px 8px', fontSize: '11px', borderRadius: '20px', background: cc.color + '18', color: cc.color, border: `1px solid ${cc.color}40`, fontWeight: 600 }}>{cc.nombre}</span>}
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 700, borderRadius: '20px', background: p.tipo === 'ingreso' ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: p.tipo === 'ingreso' ? '#34d399' : '#f87171', border: `1px solid ${p.tipo === 'ingreso' ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}` }}>{p.tipo}</span>
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: '12px', color: '#64748b' }}>{p.categoria}</td>
                  <td style={{ padding: '11px 16px', fontSize: '13px', fontWeight: 700, color: '#94a3b8' }}>{fmt(p.monto)}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>{fmt(real)}</span>
                      <div style={{ marginTop: '4px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', width: '80px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(pct,100)}%`, borderRadius: '2px', background: pct > 100 ? '#f87171' : '#34d399' }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: ok ? '#34d399' : '#f87171' }}>{ok ? '+' : '-'}{fmt(Math.abs(variacion))}</span>
                  </td>
                  <td style={{ padding: '11px 16px' }}>
                    <button onClick={() => eliminar(p.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', opacity: 0.5, fontSize: '16px' }}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, backdropFilter: 'blur(4px)' }}>
          <div style={{ ...glass.modal, padding: '28px', width: '100%', maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#f1f5f9' }}>Nueva Partida Presupuestaria</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={label}>Nombre</label>
                <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} style={glass.input} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={label}>Período</label>
                  <select value={form.periodo} onChange={e => setForm({...form, periodo: e.target.value})} style={glass.input}>
                    {PERIODOS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Tipo</label>
                  <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value, categoria: ''})} style={glass.input}>
                    <option value="ingreso">Ingreso</option>
                    <option value="egreso">Egreso</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={label}>Centro de Costo</label>
                  <select value={form.centroCostoId} onChange={e => setForm({...form, centroCostoId: e.target.value})} style={glass.input}>
                    <option value="">Seleccionar...</option>
                    {centros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Categoría</label>
                  <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})} style={glass.input}>
                    <option value="">Seleccionar...</option>
                    {(form.tipo === 'ingreso' ? CATEGORIAS_ING : CATEGORIAS_EGR).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={label}>Monto presupuestado</label>
                <input type="number" placeholder="0" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})} style={glass.input} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                <button onClick={() => setShowModal(false)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
                <button onClick={guardar} style={{ padding: '8px 20px', background: 'linear-gradient(135deg,#34d399,#059669)', border: 'none', borderRadius: '9px', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Tab 4: Conciliación ────────────────────────────────────────────────────
function Conciliacion({ movs, centros, onSave }: { movs: Movimiento[]; centros: CentroCosto[]; onSave: (v: Movimiento[]) => void }) {
  const [filtro, setFiltro] = useState<'todos'|'pendiente'|'conciliado'>('pendiente');
  const [fTipo, setFTipo]   = useState('');

  const filtered = useMemo(() => movs.filter(m => {
    if (filtro === 'pendiente'  && m.conciliado) return false;
    if (filtro === 'conciliado' && !m.conciliado) return false;
    if (fTipo && m.tipo !== fTipo) return false;
    return true;
  }).sort((a, b) => b.fecha.localeCompare(a.fecha)), [movs, filtro, fTipo]);

  const toggle = (id: string) => onSave(movs.map(m => m.id === id ? {...m, conciliado: !m.conciliado} : m));
  const marcarTodos = () => onSave(movs.map(m => filtered.find(f => f.id === m.id && !m.conciliado) ? {...m, conciliado: true} : m));

  const pendientes = movs.filter(m => !m.conciliado).length;
  const conciliados = movs.filter(m => m.conciliado).length;
  const montosPend = movs.filter(m => !m.conciliado && m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0)
                  - movs.filter(m => !m.conciliado && m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);

  return (
    <>
      {/* KPIs conciliación */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Pendientes de conciliar', value: pendientes, color: '#fbbf24', accent: 'rgba(251,191,36,0.08)' },
          { label: 'Conciliados', value: conciliados, color: '#34d399', accent: 'rgba(52,211,153,0.06)' },
          { label: 'Neto pendiente', value: fmt(Math.abs(montosPend)), color: montosPend >= 0 ? '#34d399' : '#f87171', accent: 'rgba(255,255,255,0.04)' },
        ].map(k => (
          <div key={k.label} style={{ ...glass.card, padding: '16px 20px', background: k.accent }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{k.label}</p>
            <p style={{ fontSize: '22px', fontWeight: 800, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '3px', border: '1px solid rgba(255,255,255,0.07)' }}>
          {(['todos','pendiente','conciliado'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{ padding: '5px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: filtro === f ? 'rgba(255,255,255,0.1)' : 'transparent', color: filtro === f ? '#f1f5f9' : '#475569' }}>
              {f === 'todos' ? 'Todos' : f === 'pendiente' ? 'Pendientes' : 'Conciliados'}
            </button>
          ))}
        </div>
        <select value={fTipo} onChange={e => setFTipo(e.target.value)} style={{ ...glass.input, width: 'auto', padding: '7px 12px', fontSize: '12px' }}>
          <option value="">Ingreso / Egreso</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
        </select>
        {filtro === 'pendiente' && filtered.length > 0 && (
          <button onClick={marcarTodos} style={{ marginLeft: 'auto', padding: '7px 14px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: '9px', color: '#34d399', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
            Conciliar todos
          </button>
        )}
      </div>

      {/* Tabla */}
      <div style={{ ...glass.card, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['','Fecha','Concepto','Referencia','Centro','Monto','Estado','Conciliación'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: '#334155', fontSize: '13px' }}>Sin movimientos para este filtro</td></tr>
            ) : filtered.map((m, i) => {
              const cc = centros.find(c => c.id === m.centroCostoId);
              return (
                <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: m.conciliado ? 'rgba(52,211,153,0.02)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', opacity: m.conciliado ? 0.7 : 1 }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: m.tipo === 'ingreso' ? '#34d399' : '#f87171', boxShadow: `0 0 4px ${m.tipo === 'ingreso' ? '#34d399' : '#f87171'}` }} />
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</td>
                  <td style={{ padding: '10px 14px', fontSize: '13px', color: m.conciliado ? '#475569' : '#e2e8f0', fontWeight: 500, maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.concepto}</td>
                  <td style={{ padding: '10px 14px', fontSize: '11px', color: '#475569' }}>{m.referencia || '—'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {cc && <span style={{ padding: '2px 8px', fontSize: '10px', borderRadius: '20px', background: cc.color + '18', color: cc.color, fontWeight: 600 }}>{cc.codigo}</span>}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 700, color: m.tipo === 'ingreso' ? '#34d399' : '#f87171', whiteSpace: 'nowrap' }}>
                    {m.tipo === 'ingreso' ? '+' : '-'}{fmt(m.monto)}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 700, borderRadius: '20px', background: m.estado === 'confirmado' ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', color: m.estado === 'confirmado' ? '#34d399' : '#fbbf24' }}>{m.estado === 'confirmado' ? '✓' : '⏳'}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <button onClick={() => toggle(m.id)} style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '7px', border: `1px solid ${m.conciliado ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.12)'}`, background: m.conciliado ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)', color: m.conciliado ? '#34d399' : '#94a3b8', cursor: 'pointer' }}>
                      {m.conciliado ? '✓ Conciliado' : 'Conciliar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
