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
  { id: 'cc1', nombre: 'Comercial',      codigo: 'COM', area: 'comercial',      color: '#60a5fa', activo: true },
  { id: 'cc2', nombre: 'Operaciones',    codigo: 'OPS', area: 'operacion',      color: '#a78bfa', activo: true },
  { id: 'cc3', nombre: 'Tecnología',     codigo: 'TEC', area: 'tecnologia',     color: '#22d3ee', activo: true },
  { id: 'cc4', nombre: 'RRHH',           codigo: 'RRH', area: 'rrhh',           color: '#f472b6', activo: true },
  { id: 'cc5', nombre: 'Legal',          codigo: 'LEG', area: 'legal',          color: '#fbbf24', activo: true },
  { id: 'cc6', nombre: 'Administración', codigo: 'ADM', area: 'administracion', color: '#34d399', activo: true },
];
const SEED_MOV: Movimiento[] = [
  { id: 'm1',  fecha: '2025-06-01', tipo: 'ingreso', concepto: 'Pago proyecto Smartlex',       monto: 4500000, centroCostoId: 'cc1', categoria: 'Facturación',       estado: 'confirmado', conciliado: true,  referencia: 'FAC-001' },
  { id: 'm2',  fecha: '2025-06-05', tipo: 'egreso',  concepto: 'Nómina junio',                  monto: 2100000, centroCostoId: 'cc4', categoria: 'Nómina',            estado: 'confirmado', conciliado: true,  referencia: 'NOM-06'  },
  { id: 'm3',  fecha: '2025-06-10', tipo: 'ingreso', concepto: 'Pago FB Ingenieros - Fase 1',   monto: 3200000, centroCostoId: 'cc1', categoria: 'Facturación',       estado: 'confirmado', conciliado: false, referencia: 'FAC-002' },
  { id: 'm4',  fecha: '2025-06-12', tipo: 'egreso',  concepto: 'Licencias software cloud',      monto: 450000,  centroCostoId: 'cc3', categoria: 'Software',          estado: 'confirmado', conciliado: true,  referencia: 'EGR-001' },
  { id: 'm5',  fecha: '2025-06-15', tipo: 'egreso',  concepto: 'Hosting y servidores VPS',      monto: 280000,  centroCostoId: 'cc3', categoria: 'Infraestructura',   estado: 'confirmado', conciliado: false },
  { id: 'm6',  fecha: '2025-06-18', tipo: 'ingreso', concepto: 'Retención mensual cliente A',   monto: 1800000, centroCostoId: 'cc2', categoria: 'Retención',         estado: 'pendiente',  conciliado: false },
  { id: 'm7',  fecha: '2025-06-20', tipo: 'egreso',  concepto: 'Marketing y publicidad',        monto: 350000,  centroCostoId: 'cc1', categoria: 'Marketing',         estado: 'confirmado', conciliado: true  },
  { id: 'm8',  fecha: '2025-06-22', tipo: 'egreso',  concepto: 'Asesoría legal contratos',      monto: 600000,  centroCostoId: 'cc5', categoria: 'Servicios externos',estado: 'pendiente',  conciliado: false },
  { id: 'm9',  fecha: '2025-07-01', tipo: 'ingreso', concepto: 'Pago Smartlex - Fase 2',        monto: 5200000, centroCostoId: 'cc1', categoria: 'Facturación',       estado: 'pendiente',  conciliado: false, referencia: 'FAC-003' },
  { id: 'm10', fecha: '2025-07-03', tipo: 'egreso',  concepto: 'Nómina julio',                  monto: 2100000, centroCostoId: 'cc4', categoria: 'Nómina',            estado: 'pendiente',  conciliado: false },
];
const SEED_PRES: Presupuesto[] = [
  { id: 'p1', nombre: 'Facturación Q2',   periodo: '2025-Q2', centroCostoId: 'cc1', tipo: 'ingreso', categoria: 'Facturación',     monto: 12000000 },
  { id: 'p2', nombre: 'Nómina Q2',        periodo: '2025-Q2', centroCostoId: 'cc4', tipo: 'egreso',  categoria: 'Nómina',          monto: 6300000  },
  { id: 'p3', nombre: 'Software Q2',      periodo: '2025-Q2', centroCostoId: 'cc3', tipo: 'egreso',  categoria: 'Software',        monto: 1200000  },
  { id: 'p4', nombre: 'Marketing Q2',     periodo: '2025-Q2', centroCostoId: 'cc1', tipo: 'egreso',  categoria: 'Marketing',       monto: 900000   },
  { id: 'p5', nombre: 'Infraestructura Q2',periodo:'2025-Q2', centroCostoId: 'cc3', tipo: 'egreso',  categoria: 'Infraestructura', monto: 800000   },
  { id: 'p6', nombre: 'Retenciones Q3',   periodo: '2025-Q3', centroCostoId: 'cc2', tipo: 'ingreso', categoria: 'Retención',       monto: 5400000  },
  { id: 'p7', nombre: 'Nómina Q3',        periodo: '2025-Q3', centroCostoId: 'cc4', tipo: 'egreso',  categoria: 'Nómina',          monto: 6300000  },
];

// ── Storage ────────────────────────────────────────────────────────────────
function loadLS<T>(key: string, seed: T): T {
  if (typeof window === 'undefined') return seed;
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : seed; } catch { return seed; }
}
function saveLS(key: string, val: unknown) {
  if (typeof window !== 'undefined') localStorage.setItem(key, JSON.stringify(val));
}

// ── Shared styles ──────────────────────────────────────────────────────────
const G = {
  card:  { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px' } as React.CSSProperties,
  panel: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', backdropFilter: 'blur(12px)' } as React.CSSProperties,
  modal: { background: 'rgba(8,8,26,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '18px', backdropFilter: 'blur(24px)' } as React.CSSProperties,
  input: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '9px', color: '#f1f5f9', outline: 'none', width: '100%', padding: '8px 12px', fontSize: '13px' } as React.CSSProperties,
};
const lbl: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' };
const fmt = (n: number) => `$${n.toLocaleString('es-CO')}`;

const PERIODOS = ['2025-Q1','2025-Q2','2025-Q3','2025-Q4','2026-Q1'];
const CAT_ING  = ['Facturación','Retención','Anticipo','Otro ingreso'];
const CAT_EGR  = ['Nómina','Software','Infraestructura','Marketing','Servicios externos','Impuestos','Otro egreso'];

function uid() { return Math.random().toString(36).slice(2,10); }

// ── Tab icons (inline SVG paths) ──────────────────────────────────────────
const TAB_ICONS: Record<number,string> = {
  0: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
  1: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  2: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  3: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  4: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
};
const TABS = ['Flujo de Caja','Centros de Costo','Presupuestos','Conciliación','Reportes'];

// ── Area icons ─────────────────────────────────────────────────────────────
const AREA_ICON: Record<Area,string> = {
  comercial:      'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  operacion:      'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
  tecnologia:     'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18',
  rrhh:           'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  legal:          'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  administracion: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
};

// ── Btn ────────────────────────────────────────────────────────────────────
function BtnPrimary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 16px', background:'linear-gradient(135deg,#34d399,#059669)', border:'none', borderRadius:'9px', color:'#fff', fontSize:'13px', fontWeight:700, cursor:'pointer', boxShadow:'0 2px 12px rgba(52,211,153,0.25)', flexShrink:0, whiteSpace:'nowrap' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      {children}
    </button>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <tr><td colSpan={99}>
      <div style={{ padding:'56px 24px', textAlign:'center' }}>
        <div style={{ width:'52px', height:'52px', borderRadius:'14px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={icon}/></svg>
        </div>
        <p style={{ margin:0, fontSize:'14px', fontWeight:600, color:'#475569' }}>{title}</p>
        <p style={{ margin:'4px 0 0', fontSize:'12px', color:'#334155' }}>{sub}</p>
      </div>
    </td></tr>
  );
}

// ── Modal wrapper ──────────────────────────────────────────────────────────
function Modal({ title, onClose, children, width = 560 }: { title: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, backdropFilter:'blur(4px)', padding:'16px' }}>
      <div style={{ ...G.modal, padding:'28px', width:'100%', maxWidth:`${width}px`, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <h2 style={{ margin:0, fontSize:'18px', fontWeight:800, color:'#f1f5f9' }}>{title}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:'22px', lineHeight:1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function FinancePage() {
  const [tab, setTab]       = useState(0);
  const [centros, setCentros] = useState<CentroCosto[]>([]);
  const [movs, setMovs]       = useState<Movimiento[]>([]);
  const [presups, setPresups] = useState<Presupuesto[]>([]);
  const [ready, setReady]     = useState(false);

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
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <div style={{ width:'36px', height:'36px', borderRadius:'50%', border:'2px solid rgba(255,255,255,0.06)', borderTopColor:'#34d399', animation:'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ padding:'10px 32px 40px', minHeight:'calc(100vh - 52px)', background:'#070716' }}>

      {/* ── Page header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'24px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
          <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:'rgba(52,211,153,0.1)', border:'1px solid rgba(52,211,153,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <div>
            <h1 style={{ margin:0, fontSize:'22px', fontWeight:800, color:'#f1f5f9', letterSpacing:'-0.01em' }}>Finance</h1>
            <p style={{ margin:'2px 0 0', fontSize:'13px', color:'#475569' }}>Control financiero · Flujo de caja · Presupuestos · Conciliación</p>
          </div>
        </div>
      </div>

      {/* ── Tab nav ── */}
      <div style={{ display:'flex', gap:'4px', marginBottom:'24px', background:'rgba(255,255,255,0.04)', borderRadius:'12px', padding:'4px', width:'fit-content', border:'1px solid rgba(255,255,255,0.07)' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'7px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:600, border:'none', cursor:'pointer', transition:'all 0.15s', background: tab===i ? 'linear-gradient(135deg,#34d399,#059669)' : 'transparent', color: tab===i ? '#fff' : '#64748b', boxShadow: tab===i ? '0 2px 8px rgba(52,211,153,0.25)' : 'none', whiteSpace:'nowrap' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={TAB_ICONS[i]}/></svg>
            {t}
          </button>
        ))}
      </div>

      {tab === 0 && <FlujoCaja  movs={movs}   centros={centros} onSave={saveMovs} />}
      {tab === 1 && <CentrosCosto centros={centros} movs={movs} presups={presups} onSave={saveCentros} />}
      {tab === 2 && <Presupuestos presups={presups} centros={centros} movs={movs} onSave={savePresups} />}
      {tab === 3 && <Conciliacion movs={movs}  centros={centros} onSave={saveMovs} />}
      {tab === 4 && <Reportes    movs={movs}   centros={centros} presups={presups} />}
    </div>
  );
}

// ── Tab 1: Flujo de Caja ──────────────────────────────────────────────────
function FlujoCaja({ movs, centros, onSave }: { movs: Movimiento[]; centros: CentroCosto[]; onSave: (v: Movimiento[]) => void }) {
  const [fPeriodo, setFPeriodo] = useState('');
  const [fTipo,    setFTipo]    = useState('');
  const [fCentro,  setFCentro]  = useState('');
  const [fEstado,  setFEstado]  = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ fecha:'', tipo:'ingreso', concepto:'', monto:'', centroCostoId:'', categoria:'', estado:'confirmado', referencia:'', notas:'' });

  const filtered = useMemo(() => movs.filter(m => {
    if (fTipo   && m.tipo !== fTipo) return false;
    if (fCentro && m.centroCostoId !== fCentro) return false;
    if (fEstado && m.estado !== fEstado) return false;
    if (fPeriodo) {
      const [y,q] = fPeriodo.split('-Q');
      const mes = new Date(m.fecha).getMonth()+1;
      const year = new Date(m.fecha).getFullYear();
      if (year !== Number(y)) return false;
      if (q) { const qn=Number(q); if (mes<(qn-1)*3+1||mes>qn*3) return false; }
    }
    return true;
  }).sort((a,b) => b.fecha.localeCompare(a.fecha)), [movs,fTipo,fCentro,fEstado,fPeriodo]);

  const totIngresos = filtered.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0);
  const totEgresos  = filtered.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.monto,0);
  const saldo       = totIngresos - totEgresos;

  const guardar = () => {
    if (!form.fecha||!form.concepto||!form.monto||!form.centroCostoId) return;
    onSave([{ id:uid(), fecha:form.fecha, tipo:form.tipo as 'ingreso'|'egreso', concepto:form.concepto, monto:Number(form.monto), centroCostoId:form.centroCostoId, categoria:form.categoria, estado:form.estado as 'confirmado'|'pendiente', conciliado:false, referencia:form.referencia||undefined }, ...movs]);
    setShowModal(false);
    setForm({ fecha:'', tipo:'ingreso', concepto:'', monto:'', centroCostoId:'', categoria:'', estado:'confirmado', referencia:'', notas:'' });
  };

  const cc = (id:string) => centros.find(c=>c.id===id);

  const KPI_DATA = [
    { label:'Saldo neto',     value:fmt(saldo),       sub:saldo>=0?'Positivo':'Negativo',    color:saldo>=0?'#34d399':'#f87171', glow:saldo>=0?'rgba(52,211,153,0.15)':'rgba(248,113,113,0.15)', icon:'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z' },
    { label:'Total ingresos', value:fmt(totIngresos), sub:`${filtered.filter(m=>m.tipo==='ingreso').length} movimientos`, color:'#34d399', glow:'rgba(52,211,153,0.1)',  icon:'M7 11l5-5m0 0l5 5m-5-5v12' },
    { label:'Total egresos',  value:fmt(totEgresos),  sub:`${filtered.filter(m=>m.tipo==='egreso').length} movimientos`,  color:'#f87171', glow:'rgba(248,113,113,0.1)', icon:'M17 13l-5 5m0 0l-5-5m5 5V6' },
  ];

  return (
    <>
      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'20px' }}>
        {KPI_DATA.map(k => (
          <div key={k.label} style={{ ...G.card, padding:'20px', background:k.glow, boxShadow:`0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.06)`, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, right:0, width:'80px', height:'80px', background:`radial-gradient(circle at 100% 0%, ${k.color}18, transparent 70%)`, borderRadius:'14px' }} />
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'12px' }}>
              <p style={{ margin:0, fontSize:'11px', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em' }}>{k.label}</p>
              <div style={{ width:'30px', height:'30px', borderRadius:'8px', background:`${k.color}15`, border:`1px solid ${k.color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={k.color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={k.icon}/></svg>
              </div>
            </div>
            <p style={{ margin:0, fontSize:'26px', fontWeight:800, color:k.color, letterSpacing:'-0.02em', lineHeight:1 }}>{k.value}</p>
            <p style={{ margin:'6px 0 0', fontSize:'11px', color:'#334155' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Filtros + acción */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap', alignItems:'center' }}>
        {[
          { val:fPeriodo, set:setFPeriodo, opts:[['','Período'], ...PERIODOS.map(p=>[p,p])] },
          { val:fTipo,    set:setFTipo,    opts:[['','Tipo'],['ingreso','Ingresos'],['egreso','Egresos']] },
          { val:fCentro,  set:setFCentro,  opts:[['','Centro'], ...centros.map(c=>[c.id,c.nombre])] },
          { val:fEstado,  set:setFEstado,  opts:[['','Estado'],['confirmado','Confirmado'],['pendiente','Pendiente']] },
        ].map((f,i) => (
          <select key={i} value={f.val} onChange={e=>f.set(e.target.value)} style={{ ...G.input, width:'auto', padding:'7px 12px', fontSize:'12px' }}>
            {f.opts.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <div style={{ marginLeft:'auto' }}><BtnPrimary onClick={()=>setShowModal(true)}>Nuevo movimiento</BtnPrimary></div>
      </div>

      {/* Tabla */}
      <div style={{ ...G.card, overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'700px' }}>
          <thead>
            <tr style={{ background:'rgba(255,255,255,0.03)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              {['Fecha','Concepto','Centro','Categoría','Estado','Monto'].map(h=>(
                <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length===0 ? (
              <EmptyState icon="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" title="Sin movimientos" sub="Ajustá los filtros o agregá un movimiento nuevo" />
            ) : filtered.map((m,i) => {
              const c = cc(m.centroCostoId);
              return (
                <tr key={m.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', transition:'background 0.1s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.03)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
                >
                  <td style={{ padding:'12px 16px', fontSize:'12px', color:'#64748b', whiteSpace:'nowrap' }}>{new Date(m.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'})}</td>
                  <td style={{ padding:'12px 16px' }}>
                    <p style={{ margin:0, fontSize:'13px', fontWeight:600, color:'#e2e8f0' }}>{m.concepto}</p>
                    {m.referencia && <p style={{ margin:'2px 0 0', fontSize:'11px', color:'#334155', fontFamily:'monospace' }}>{m.referencia}</p>}
                  </td>
                  <td style={{ padding:'12px 16px', whiteSpace:'nowrap' }}>
                    {c && <span style={{ padding:'3px 9px', fontSize:'11px', fontWeight:600, borderRadius:'20px', background:c.color+'18', color:c.color, border:`1px solid ${c.color}35` }}>{c.nombre}</span>}
                  </td>
                  <td style={{ padding:'12px 16px', fontSize:'12px', color:'#64748b', whiteSpace:'nowrap' }}>{m.categoria}</td>
                  <td style={{ padding:'12px 16px', whiteSpace:'nowrap' }}>
                    <span style={{ padding:'3px 9px', fontSize:'10px', fontWeight:700, borderRadius:'20px', background:m.estado==='confirmado'?'rgba(52,211,153,0.1)':'rgba(251,191,36,0.1)', color:m.estado==='confirmado'?'#34d399':'#fbbf24', border:`1px solid ${m.estado==='confirmado'?'rgba(52,211,153,0.2)':'rgba(251,191,36,0.2)'}` }}>
                      {m.estado==='confirmado'?'✓ Confirmado':'⏳ Pendiente'}
                    </span>
                  </td>
                  <td style={{ padding:'12px 16px', whiteSpace:'nowrap', fontWeight:800, fontSize:'15px', color:m.tipo==='ingreso'?'#34d399':'#f87171', textAlign:'right', letterSpacing:'-0.01em' }}>
                    {m.tipo==='ingreso'?'+':'-'}{fmt(m.monto)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Nuevo Movimiento" onClose={()=>setShowModal(false)}>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div><label style={lbl}>Fecha</label><input type="date" value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} style={{...G.input,colorScheme:'dark'} as React.CSSProperties}/></div>
              <div><label style={lbl}>Tipo</label><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value,categoria:''})} style={G.input}><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select></div>
            </div>
            <div><label style={lbl}>Concepto</label><input type="text" placeholder="Descripción del movimiento..." value={form.concepto} onChange={e=>setForm({...form,concepto:e.target.value})} style={G.input}/></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div><label style={lbl}>Monto</label><input type="number" placeholder="0" value={form.monto} onChange={e=>setForm({...form,monto:e.target.value})} style={G.input}/></div>
              <div><label style={lbl}>Centro de Costo</label><select value={form.centroCostoId} onChange={e=>setForm({...form,centroCostoId:e.target.value})} style={G.input}><option value="">Seleccionar...</option>{centros.filter(c=>c.activo).map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div><label style={lbl}>Categoría</label><select value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})} style={G.input}><option value="">Seleccionar...</option>{(form.tipo==='ingreso'?CAT_ING:CAT_EGR).map(c=><option key={c} value={c}>{c}</option>)}</select></div>
              <div><label style={lbl}>Estado</label><select value={form.estado} onChange={e=>setForm({...form,estado:e.target.value})} style={G.input}><option value="confirmado">Confirmado</option><option value="pendiente">Pendiente</option></select></div>
            </div>
            <div><label style={lbl}>Referencia (opcional)</label><input type="text" placeholder="FAC-001, NOM-06..." value={form.referencia} onChange={e=>setForm({...form,referencia:e.target.value})} style={G.input}/></div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', paddingTop:'4px' }}>
              <button onClick={()=>setShowModal(false)} style={{ padding:'8px 16px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'9px', color:'#94a3b8', cursor:'pointer', fontSize:'13px' }}>Cancelar</button>
              <button onClick={guardar} style={{ padding:'8px 20px', background:'linear-gradient(135deg,#34d399,#059669)', border:'none', borderRadius:'9px', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'13px' }}>Guardar</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Tab 2: Centros de Costo ───────────────────────────────────────────────
function CentrosCosto({ centros, movs, presups, onSave }: { centros: CentroCosto[]; movs: Movimiento[]; presups: Presupuesto[]; onSave: (v: CentroCosto[]) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nombre:'', codigo:'', area:'operacion' as Area, color:'#60a5fa' });

  const COLORES = ['#60a5fa','#a78bfa','#22d3ee','#f472b6','#fbbf24','#34d399','#f97316','#f87171'];

  const guardar = () => {
    if (!form.nombre||!form.codigo) return;
    onSave([...centros,{ id:uid(), ...form, activo:true }]);
    setShowModal(false);
    setForm({ nombre:'', codigo:'', area:'operacion', color:'#60a5fa' });
  };

  const toggleActivo = (id:string) => onSave(centros.map(c=>c.id===id?{...c,activo:!c.activo}:c));

  const gastoPorCentro   = (id:string) => movs.filter(m=>m.centroCostoId===id&&m.tipo==='egreso').reduce((s,m)=>s+m.monto,0);
  const ingresoPorCentro = (id:string) => movs.filter(m=>m.centroCostoId===id&&m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0);
  const presupPorCentro  = (id:string) => presups.filter(p=>p.centroCostoId===id&&p.tipo==='egreso').reduce((s,p)=>s+p.monto,0);

  const totalIngresos = centros.reduce((s,c)=>s+ingresoPorCentro(c.id),0);
  const totalGastos   = centros.reduce((s,c)=>s+gastoPorCentro(c.id),0);

  return (
    <>
      {/* Summary strip */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'20px' }}>
        {[
          { label:'Centros activos',   value:centros.filter(c=>c.activo).length,   color:'#94a3b8', glow:'rgba(255,255,255,0.04)' },
          { label:'Ingresos totales',  value:fmt(totalIngresos),                    color:'#34d399', glow:'rgba(52,211,153,0.08)'  },
          { label:'Egresos totales',   value:fmt(totalGastos),                      color:'#f87171', glow:'rgba(248,113,113,0.08)' },
        ].map(k=>(
          <div key={k.label} style={{ ...G.card, padding:'18px 20px', background:k.glow }}>
            <p style={{ margin:'0 0 6px', fontSize:'11px', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em' }}>{k.label}</p>
            <p style={{ margin:0, fontSize:'24px', fontWeight:800, color:k.color, letterSpacing:'-0.02em' }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'16px' }}>
        <BtnPrimary onClick={()=>setShowModal(true)}>Nuevo Centro</BtnPrimary>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'14px' }}>
        {centros.map(c => {
          const gasto   = gastoPorCentro(c.id);
          const ingreso = ingresoPorCentro(c.id);
          const presup  = presupPorCentro(c.id);
          const pct     = presup>0 ? Math.min(100,Math.round((gasto/presup)*100)) : 0;
          const alerta  = pct>=90;
          return (
            <div key={c.id} style={{ ...G.card, padding:'20px', opacity:c.activo?1:0.5, position:'relative', overflow:'hidden' }}>
              {/* color accent top border */}
              <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:`linear-gradient(90deg,${c.color},${c.color}60)`, borderRadius:'14px 14px 0 0' }} />
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'16px', paddingTop:'4px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:c.color+'15', border:`1px solid ${c.color}30`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c.color} strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d={AREA_ICON[c.area]}/></svg>
                  </div>
                  <div>
                    <p style={{ margin:0, fontSize:'15px', fontWeight:700, color:'#f1f5f9' }}>{c.nombre}</p>
                    <p style={{ margin:'2px 0 0', fontSize:'11px', color:'#475569', textTransform:'capitalize' }}>{c.area} · <span style={{ fontFamily:'monospace', fontSize:'10px', color:c.color }}>{c.codigo}</span></p>
                  </div>
                </div>
                <button onClick={()=>toggleActivo(c.id)} style={{ padding:'3px 10px', fontSize:'10px', fontWeight:700, borderRadius:'20px', border:`1px solid ${c.activo?'rgba(52,211,153,0.3)':'rgba(255,255,255,0.08)'}`, background:c.activo?'rgba(52,211,153,0.08)':'rgba(255,255,255,0.04)', color:c.activo?'#34d399':'#475569', cursor:'pointer', flexShrink:0 }}>
                  {c.activo?'● Activo':'○ Inactivo'}
                </button>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'14px' }}>
                <div style={{ ...G.panel, padding:'10px 12px' }}>
                  <p style={{ margin:'0 0 4px', fontSize:'10px', color:'#334155', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:700 }}>Ingresos</p>
                  <p style={{ margin:0, fontSize:'14px', fontWeight:800, color:'#34d399' }}>{fmt(ingreso)}</p>
                </div>
                <div style={{ ...G.panel, padding:'10px 12px' }}>
                  <p style={{ margin:'0 0 4px', fontSize:'10px', color:'#334155', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:700 }}>Egresos</p>
                  <p style={{ margin:0, fontSize:'14px', fontWeight:800, color:'#f87171' }}>{fmt(gasto)}</p>
                </div>
              </div>

              {presup>0 ? (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'5px', alignItems:'center' }}>
                    <span style={{ fontSize:'11px', color:'#475569', fontWeight:600 }}>Ejecución presupuestal</span>
                    <span style={{ fontSize:'11px', fontWeight:700, color:alerta?'#f87171':pct>=70?'#fbbf24':'#64748b' }}>{pct}%</span>
                  </div>
                  <div style={{ height:'6px', borderRadius:'3px', background:'rgba(255,255,255,0.06)', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, borderRadius:'3px', background:alerta?'linear-gradient(90deg,#f97316,#f87171)':pct>=70?'linear-gradient(90deg,#fbbf24,#f97316)':`linear-gradient(90deg,${c.color},${c.color}90)`, transition:'width 0.5s ease' }} />
                  </div>
                  <p style={{ margin:'4px 0 0', fontSize:'10px', color:'#334155' }}>Presup.: {fmt(presup)}</p>
                </div>
              ) : (
                <p style={{ margin:0, fontSize:'11px', color:'#334155', fontStyle:'italic' }}>Sin presupuesto asignado</p>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <Modal title="Nuevo Centro de Costo" onClose={()=>setShowModal(false)} width={440}>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'12px' }}>
              <div><label style={lbl}>Nombre</label><input type="text" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} style={G.input}/></div>
              <div><label style={lbl}>Código</label><input type="text" maxLength={5} value={form.codigo} onChange={e=>setForm({...form,codigo:e.target.value.toUpperCase()})} style={G.input}/></div>
            </div>
            <div><label style={lbl}>Área</label>
              <select value={form.area} onChange={e=>setForm({...form,area:e.target.value as Area})} style={G.input}>
                {(['comercial','operacion','tecnologia','rrhh','legal','administracion'] as Area[]).map(a=><option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Color</label>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                {COLORES.map(c=>(
                  <button key={c} onClick={()=>setForm({...form,color:c})} style={{ width:'30px', height:'30px', borderRadius:'50%', background:c, border:form.color===c?'3px solid #fff':'3px solid transparent', cursor:'pointer', boxShadow:form.color===c?`0 0 10px ${c}88`:'none', transition:'all 0.15s' }} />
                ))}
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', paddingTop:'4px' }}>
              <button onClick={()=>setShowModal(false)} style={{ padding:'8px 16px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'9px', color:'#94a3b8', cursor:'pointer', fontSize:'13px' }}>Cancelar</button>
              <button onClick={guardar} style={{ padding:'8px 20px', background:'linear-gradient(135deg,#34d399,#059669)', border:'none', borderRadius:'9px', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'13px' }}>Guardar</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Tab 3: Presupuestos ───────────────────────────────────────────────────
function Presupuestos({ presups, centros, movs, onSave }: { presups: Presupuesto[]; centros: CentroCosto[]; movs: Movimiento[]; onSave: (v: Presupuesto[]) => void }) {
  const [periodo, setPeriodo] = useState('2025-Q2');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nombre:'', periodo:'2025-Q2', centroCostoId:'', tipo:'egreso', categoria:'', monto:'' });

  const filtrados = presups.filter(p=>p.periodo===periodo);

  const realPorPresup = (p: Presupuesto) => {
    const [y,q] = p.periodo.split('-Q');
    return movs.filter(m=>{
      if (m.centroCostoId!==p.centroCostoId||m.tipo!==p.tipo||m.categoria!==p.categoria) return false;
      const mes=new Date(m.fecha).getMonth()+1, year=new Date(m.fecha).getFullYear();
      if (year!==Number(y)) return false;
      if (q){const qn=Number(q); if(mes<(qn-1)*3+1||mes>qn*3) return false;}
      return true;
    }).reduce((s,m)=>s+m.monto,0);
  };

  const guardar = () => {
    if (!form.nombre||!form.centroCostoId||!form.monto) return;
    onSave([...presups,{ id:uid(), nombre:form.nombre, periodo:form.periodo, centroCostoId:form.centroCostoId, tipo:form.tipo as 'ingreso'|'egreso', categoria:form.categoria, monto:Number(form.monto) }]);
    setShowModal(false);
  };

  const eliminar = (id:string) => onSave(presups.filter(p=>p.id!==id));

  const totPresup  = filtrados.filter(p=>p.tipo==='egreso').reduce((s,p)=>s+p.monto,0);
  const totIngPres = filtrados.filter(p=>p.tipo==='ingreso').reduce((s,p)=>s+p.monto,0);
  const balance    = totIngPres - totPresup;

  return (
    <>
      {/* Header row */}
      <div style={{ display:'flex', gap:'10px', alignItems:'center', marginBottom:'16px', flexWrap:'wrap' }}>
        <select value={periodo} onChange={e=>setPeriodo(e.target.value)} style={{ ...G.input, width:'auto', padding:'7px 12px', fontSize:'13px', fontWeight:600 }}>
          {PERIODOS.map(p=><option key={p} value={p}>{p}</option>)}
        </select>

        <div style={{ display:'flex', gap:'10px' }}>
          {[
            { label:'Ingresos pres.',value:fmt(totIngPres),color:'#34d399' },
            { label:'Egresos pres.', value:fmt(totPresup), color:'#f87171' },
            { label:'Balance',       value:fmt(Math.abs(balance)), color:balance>=0?'#34d399':'#f87171' },
          ].map(s=>(
            <div key={s.label} style={{ ...G.card, padding:'8px 14px', display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ fontSize:'11px', color:'#475569' }}>{s.label}:</span>
              <span style={{ fontSize:'13px', fontWeight:800, color:s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        <div style={{ marginLeft:'auto' }}><BtnPrimary onClick={()=>{ setForm({...form,periodo}); setShowModal(true); }}>Nueva partida</BtnPrimary></div>
      </div>

      <div style={{ ...G.card, overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'720px' }}>
          <thead>
            <tr style={{ background:'rgba(255,255,255,0.03)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              {['Nombre','Centro','Tipo','Categoría','Presupuestado','Ejecutado','Variación',''].map(h=>(
                <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length===0 ? (
              <EmptyState icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" title="Sin partidas para este período" sub="Creá partidas presupuestarias para empezar a controlar los gastos" />
            ) : filtrados.map((p,i) => {
              const centro = centros.find(c=>c.id===p.centroCostoId);
              const real   = realPorPresup(p);
              const variacion = p.tipo==='egreso'?p.monto-real:real-p.monto;
              const pct   = p.monto>0?Math.round((real/p.monto)*100):0;
              const ok    = variacion>=0;
              return (
                <tr key={p.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', transition:'background 0.1s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.03)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
                >
                  <td style={{ padding:'12px 16px', fontSize:'13px', fontWeight:600, color:'#e2e8f0' }}>{p.nombre}</td>
                  <td style={{ padding:'12px 16px' }}>
                    {centro && <span style={{ padding:'3px 9px', fontSize:'11px', borderRadius:'20px', background:centro.color+'18', color:centro.color, border:`1px solid ${centro.color}35`, fontWeight:600 }}>{centro.nombre}</span>}
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ padding:'3px 9px', fontSize:'10px', fontWeight:700, borderRadius:'20px', background:p.tipo==='ingreso'?'rgba(52,211,153,0.1)':'rgba(248,113,113,0.1)', color:p.tipo==='ingreso'?'#34d399':'#f87171', border:`1px solid ${p.tipo==='ingreso'?'rgba(52,211,153,0.2)':'rgba(248,113,113,0.2)'}` }}>{p.tipo}</span>
                  </td>
                  <td style={{ padding:'12px 16px', fontSize:'12px', color:'#64748b' }}>{p.categoria}</td>
                  <td style={{ padding:'12px 16px', fontSize:'13px', fontWeight:700, color:'#94a3b8' }}>{fmt(p.monto)}</td>
                  <td style={{ padding:'12px 16px' }}>
                    <p style={{ margin:'0 0 5px', fontSize:'13px', fontWeight:700, color:'#f1f5f9' }}>{fmt(real)}</p>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <div style={{ height:'4px', borderRadius:'2px', background:'rgba(255,255,255,0.06)', width:'80px', overflow:'hidden', flexShrink:0 }}>
                        <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, borderRadius:'2px', background:pct>100?'#f87171':pct>70?'#fbbf24':'#34d399' }} />
                      </div>
                      <span style={{ fontSize:'10px', color:'#475569' }}>{pct}%</span>
                    </div>
                  </td>
                  <td style={{ padding:'12px 16px', whiteSpace:'nowrap' }}>
                    <span style={{ fontSize:'13px', fontWeight:700, color:ok?'#34d399':'#f87171' }}>{ok?'+':'-'}{fmt(Math.abs(variacion))}</span>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <button onClick={()=>eliminar(p.id)} title="Eliminar" style={{ background:'none', border:'none', color:'#475569', cursor:'pointer', fontSize:'16px', opacity:0.6, transition:'opacity 0.15s' }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.opacity='1'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.opacity='0.6'}
                    >×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <Modal title="Nueva Partida Presupuestaria" onClose={()=>setShowModal(false)} width={480}>
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div><label style={lbl}>Nombre</label><input type="text" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})} style={G.input}/></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div><label style={lbl}>Período</label><select value={form.periodo} onChange={e=>setForm({...form,periodo:e.target.value})} style={G.input}>{PERIODOS.map(p=><option key={p} value={p}>{p}</option>)}</select></div>
              <div><label style={lbl}>Tipo</label><select value={form.tipo} onChange={e=>setForm({...form,tipo:e.target.value,categoria:''})} style={G.input}><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div><label style={lbl}>Centro de Costo</label><select value={form.centroCostoId} onChange={e=>setForm({...form,centroCostoId:e.target.value})} style={G.input}><option value="">Seleccionar...</option>{centros.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
              <div><label style={lbl}>Categoría</label><select value={form.categoria} onChange={e=>setForm({...form,categoria:e.target.value})} style={G.input}><option value="">Seleccionar...</option>{(form.tipo==='ingreso'?CAT_ING:CAT_EGR).map(c=><option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            <div><label style={lbl}>Monto presupuestado</label><input type="number" placeholder="0" value={form.monto} onChange={e=>setForm({...form,monto:e.target.value})} style={G.input}/></div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px', paddingTop:'4px' }}>
              <button onClick={()=>setShowModal(false)} style={{ padding:'8px 16px', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'9px', color:'#94a3b8', cursor:'pointer', fontSize:'13px' }}>Cancelar</button>
              <button onClick={guardar} style={{ padding:'8px 20px', background:'linear-gradient(135deg,#34d399,#059669)', border:'none', borderRadius:'9px', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:'13px' }}>Guardar</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ── Tab 4: Conciliación ───────────────────────────────────────────────────
function Conciliacion({ movs, centros, onSave }: { movs: Movimiento[]; centros: CentroCosto[]; onSave: (v: Movimiento[]) => void }) {
  const [filtro, setFiltro] = useState<'todos'|'pendiente'|'conciliado'>('pendiente');
  const [fTipo,  setFTipo]  = useState('');

  const filtered = useMemo(()=>movs.filter(m=>{
    if (filtro==='pendiente'  && m.conciliado)  return false;
    if (filtro==='conciliado' && !m.conciliado) return false;
    if (fTipo && m.tipo!==fTipo) return false;
    return true;
  }).sort((a,b)=>b.fecha.localeCompare(a.fecha)), [movs,filtro,fTipo]);

  const toggle    = (id:string) => onSave(movs.map(m=>m.id===id?{...m,conciliado:!m.conciliado}:m));
  const marcarTodos = () => onSave(movs.map(m=>filtered.find(f=>f.id===m.id&&!m.conciliado)?{...m,conciliado:true}:m));

  const pendientes  = movs.filter(m=>!m.conciliado).length;
  const conciliados = movs.filter(m=>m.conciliado).length;
  const pct         = movs.length>0?Math.round((conciliados/movs.length)*100):0;
  const montosPend  = movs.filter(m=>!m.conciliado&&m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0)
                    - movs.filter(m=>!m.conciliado&&m.tipo==='egreso').reduce((s,m)=>s+m.monto,0);

  return (
    <>
      {/* KPIs con progress ring */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'20px' }}>
        <div style={{ ...G.card, padding:'20px', background:'rgba(251,191,36,0.06)', boxShadow:'0 0 0 1px rgba(255,255,255,0.06)' }}>
          <p style={{ margin:'0 0 6px', fontSize:'11px', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em' }}>Pendientes</p>
          <p style={{ margin:0, fontSize:'28px', fontWeight:800, color:'#fbbf24', letterSpacing:'-0.02em' }}>{pendientes}</p>
          <p style={{ margin:'4px 0 0', fontSize:'11px', color:'#334155' }}>movimientos sin conciliar</p>
        </div>
        <div style={{ ...G.card, padding:'20px', background:'rgba(52,211,153,0.06)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
            <p style={{ margin:0, fontSize:'11px', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em' }}>Conciliados</p>
            <span style={{ fontSize:'10px', fontWeight:700, color:'#34d399', background:'rgba(52,211,153,0.12)', padding:'2px 7px', borderRadius:'20px' }}>{pct}%</span>
          </div>
          <p style={{ margin:0, fontSize:'28px', fontWeight:800, color:'#34d399', letterSpacing:'-0.02em' }}>{conciliados}</p>
          <div style={{ marginTop:'8px', height:'4px', borderRadius:'2px', background:'rgba(255,255,255,0.06)' }}>
            <div style={{ height:'100%', width:`${pct}%`, borderRadius:'2px', background:'linear-gradient(90deg,#34d399,#059669)', transition:'width 0.5s' }} />
          </div>
        </div>
        <div style={{ ...G.card, padding:'20px' }}>
          <p style={{ margin:'0 0 6px', fontSize:'11px', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em' }}>Neto pendiente</p>
          <p style={{ margin:0, fontSize:'24px', fontWeight:800, color:montosPend>=0?'#34d399':'#f87171', letterSpacing:'-0.02em' }}>{fmt(Math.abs(montosPend))}</p>
          <p style={{ margin:'4px 0 0', fontSize:'11px', color:'#334155' }}>{montosPend>=0?'a favor':'a cargo'}</p>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'14px', alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:'4px', background:'rgba(255,255,255,0.04)', borderRadius:'10px', padding:'3px', border:'1px solid rgba(255,255,255,0.07)' }}>
          {(['todos','pendiente','conciliado'] as const).map(f=>(
            <button key={f} onClick={()=>setFiltro(f)} style={{ padding:'5px 14px', borderRadius:'7px', fontSize:'12px', fontWeight:600, border:'none', cursor:'pointer', background:filtro===f?'rgba(255,255,255,0.1)':'transparent', color:filtro===f?'#f1f5f9':'#475569', transition:'all 0.15s' }}>
              {f==='todos'?'Todos':f==='pendiente'?'Pendientes':'Conciliados'}
            </button>
          ))}
        </div>
        <select value={fTipo} onChange={e=>setFTipo(e.target.value)} style={{ ...G.input, width:'auto', padding:'7px 12px', fontSize:'12px' }}>
          <option value="">Ing. / Egr.</option>
          <option value="ingreso">Ingresos</option>
          <option value="egreso">Egresos</option>
        </select>
        {filtro==='pendiente' && filtered.length>0 && (
          <button onClick={marcarTodos} style={{ marginLeft:'auto', padding:'7px 14px', background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:'9px', color:'#34d399', fontSize:'12px', fontWeight:600, cursor:'pointer' }}>
            ✓ Conciliar todos
          </button>
        )}
      </div>

      <div style={{ ...G.card, overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'700px' }}>
          <thead>
            <tr style={{ background:'rgba(255,255,255,0.03)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
              {['','Fecha','Concepto','Ref.','Centro','Monto','Estado',''].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length===0 ? (
              <EmptyState icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" title="Todo conciliado" sub="No hay movimientos pendientes para este filtro" />
            ) : filtered.map((m,i)=>{
              const c = centros.find(cc=>cc.id===m.centroCostoId);
              return (
                <tr key={m.id} style={{ borderBottom:'1px solid rgba(255,255,255,0.04)', background:m.conciliado?'rgba(52,211,153,0.015)':'transparent', opacity:m.conciliado?0.7:1, transition:'all 0.1s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=m.conciliado?'rgba(52,211,153,0.04)':'rgba(255,255,255,0.03)'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=m.conciliado?'rgba(52,211,153,0.015)':'transparent'}
                >
                  <td style={{ padding:'10px 14px' }}>
                    <div style={{ width:'7px', height:'7px', borderRadius:'50%', background:m.tipo==='ingreso'?'#34d399':'#f87171', boxShadow:`0 0 5px ${m.tipo==='ingreso'?'#34d399':'#f87171'}` }} />
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:'12px', color:'#64748b', whiteSpace:'nowrap' }}>{new Date(m.fecha+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}</td>
                  <td style={{ padding:'10px 14px', fontSize:'13px', color:m.conciliado?'#475569':'#e2e8f0', fontWeight:500, maxWidth:'220px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.concepto}</td>
                  <td style={{ padding:'10px 14px', fontSize:'11px', color:'#334155', fontFamily:'monospace' }}>{m.referencia||'—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    {c && <span style={{ padding:'2px 8px', fontSize:'10px', borderRadius:'20px', background:c.color+'18', color:c.color, fontWeight:700 }}>{c.codigo}</span>}
                  </td>
                  <td style={{ padding:'10px 14px', fontSize:'13px', fontWeight:800, color:m.tipo==='ingreso'?'#34d399':'#f87171', whiteSpace:'nowrap' }}>
                    {m.tipo==='ingreso'?'+':'-'}{fmt(m.monto)}
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ padding:'2px 8px', fontSize:'10px', fontWeight:700, borderRadius:'20px', background:m.estado==='confirmado'?'rgba(52,211,153,0.1)':'rgba(251,191,36,0.1)', color:m.estado==='confirmado'?'#34d399':'#fbbf24' }}>
                      {m.estado==='confirmado'?'✓':'⏳'}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <button onClick={()=>toggle(m.id)} style={{ padding:'4px 12px', fontSize:'11px', fontWeight:700, borderRadius:'7px', border:`1px solid ${m.conciliado?'rgba(52,211,153,0.3)':'rgba(255,255,255,0.1)'}`, background:m.conciliado?'rgba(52,211,153,0.1)':'rgba(255,255,255,0.05)', color:m.conciliado?'#34d399':'#64748b', cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.15s' }}>
                      {m.conciliado?'✓ Conciliado':'Conciliar'}
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

// ── Tab 5: Reportes ───────────────────────────────────────────────────────
function Reportes({ movs, centros, presups }: { movs: Movimiento[]; centros: CentroCosto[]; presups: Presupuesto[] }) {
  const [periodo, setPeriodo] = useState('2025-Q2');

  // ── helpers ──
  const movsEnPeriodo = (meses: number[], year: number) =>
    movs.filter(m => {
      const d = new Date(m.fecha + 'T12:00:00');
      return d.getFullYear() === year && meses.includes(d.getMonth() + 1);
    });

  const periodoToRange = (p: string): { year: number; meses: number[] } => {
    const [y, q] = p.split('-Q');
    const qn = Number(q);
    const start = (qn - 1) * 3 + 1;
    return { year: Number(y), meses: [start, start + 1, start + 2] };
  };

  const { year, meses } = periodoToRange(periodo);
  const movsP = movsEnPeriodo(meses, year);

  const totalIng = movsP.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
  const totalEgr = movsP.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
  const resultado = totalIng - totalEgr;
  const margen = totalIng > 0 ? Math.round((resultado / totalIng) * 100) : 0;

  // ── P&L por categoría ──
  const catMap: Record<string, { ing: number; egr: number }> = {};
  movsP.forEach(m => {
    if (!catMap[m.categoria]) catMap[m.categoria] = { ing: 0, egr: 0 };
    catMap[m.categoria][m.tipo === 'ingreso' ? 'ing' : 'egr'] += m.monto;
  });
  const cats = Object.entries(catMap).sort((a, b) => (b[1].ing + b[1].egr) - (a[1].ing + a[1].egr));

  // ── Gastos por centro ──
  const gastosPorCentro = centros.map(c => ({
    centro: c,
    total: movsP.filter(m => m.centroCostoId === c.id && m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0),
  })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
  const maxGasto = gastosPorCentro[0]?.total ?? 1;

  // ── Proyección mensual (últimos 6 meses + 3 futuros) ──
  const hoy = new Date();
  const mesesProyeccion: { label: string; mes: number; year: number }[] = [];
  for (let i = -5; i <= 3; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    mesesProyeccion.push({ label: d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }), mes: d.getMonth() + 1, year: d.getFullYear() });
  }

  const proyData = mesesProyeccion.map(({ label, mes, year: y }) => {
    const mMovs = movs.filter(m => {
      const d = new Date(m.fecha + 'T12:00:00');
      return d.getFullYear() === y && d.getMonth() + 1 === mes;
    });
    const ing = mMovs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
    const egr = mMovs.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
    return { label, ing, egr, neto: ing - egr };
  });

  // acumular saldo
  let acum = 0;
  const proyConAcum = proyData.map(d => { acum += d.neto; return { ...d, acum }; });

  // SVG line chart
  const W = 600, H = 140, PAD = 20;
  const vals = proyConAcum.map(d => d.acum);
  const minV = Math.min(0, ...vals), maxV = Math.max(1, ...vals);
  const xStep = (W - PAD * 2) / (proyConAcum.length - 1);
  const yScale = (v: number) => PAD + (1 - (v - minV) / (maxV - minV)) * (H - PAD * 2);
  const points = proyConAcum.map((d, i) => `${PAD + i * xStep},${yScale(d.acum)}`).join(' ');
  const areaPoints = `${PAD},${H - PAD} ` + proyConAcum.map((d, i) => `${PAD + i * xStep},${yScale(d.acum)}`).join(' ') + ` ${PAD + (proyConAcum.length - 1) * xStep},${H - PAD}`;
  const zeroY = yScale(0);

  // presupuesto vs real por periodo
  const presupPeriodo = presups.filter(p => p.periodo === periodo);
  const totPresupEgr = presupPeriodo.filter(p => p.tipo === 'egreso').reduce((s, p) => s + p.monto, 0);
  const totPresupIng = presupPeriodo.filter(p => p.tipo === 'ingreso').reduce((s, p) => s + p.monto, 0);

  return (
    <>
      {/* Selector período */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ ...G.input, width: 'auto', padding: '7px 12px', fontSize: '13px', fontWeight: 600 }}>
          {PERIODOS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span style={{ fontSize: '12px', color: '#334155' }}>Mostrando datos del período seleccionado</span>
      </div>

      {/* ── KPIs P&L ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Ingresos',   value: fmt(totalIng), color: '#34d399', glow: 'rgba(52,211,153,0.08)',  icon: 'M7 11l5-5m0 0l5 5m-5-5v12', sub: `${movsP.filter(m => m.tipo === 'ingreso').length} movs` },
          { label: 'Egresos',    value: fmt(totalEgr), color: '#f87171', glow: 'rgba(248,113,113,0.08)', icon: 'M17 13l-5 5m0 0l-5-5m5 5V6',  sub: `${movsP.filter(m => m.tipo === 'egreso').length} movs` },
          { label: 'Resultado',  value: fmt(Math.abs(resultado)), color: resultado >= 0 ? '#34d399' : '#f87171', glow: resultado >= 0 ? 'rgba(52,211,153,0.08)' : 'rgba(248,113,113,0.08)', icon: resultado >= 0 ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12', sub: resultado >= 0 ? 'utilidad' : 'pérdida' },
          { label: 'Margen',     value: `${margen}%`, color: margen >= 20 ? '#34d399' : margen >= 0 ? '#fbbf24' : '#f87171', glow: 'rgba(255,255,255,0.04)', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10', sub: 'sobre ingresos' },
        ].map(k => (
          <div key={k.label} style={{ ...G.card, padding: '18px 20px', background: k.glow, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', background: `radial-gradient(circle at 100% 0%, ${k.color}18, transparent 70%)` }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</p>
              <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: `${k.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={k.color} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={k.icon}/></svg>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: k.color, letterSpacing: '-0.02em' }}>{k.value}</p>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#334155' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Fila: P&L por categoría + Gastos por centro ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>

        {/* P&L por categoría */}
        <div style={{ ...G.card, padding: '20px' }}>
          <p style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>P&L por Categoría</p>
          {cats.length === 0 ? (
            <p style={{ color: '#334155', fontSize: '13px' }}>Sin datos para este período</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {cats.map(([cat, { ing, egr }]) => {
                const neto = ing - egr;
                const maxBar = Math.max(...cats.map(([, v]) => v.ing + v.egr), 1);
                const pct = Math.round(((ing + egr) / maxBar) * 100);
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>{cat}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: neto >= 0 ? '#34d399' : '#f87171' }}>
                        {neto >= 0 ? '+' : ''}{fmt(neto)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '3px', height: '6px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                      {ing > 0 && <div style={{ flex: ing, background: 'rgba(52,211,153,0.6)', borderRadius: '3px 0 0 3px' }} />}
                      {egr > 0 && <div style={{ flex: egr, background: 'rgba(248,113,113,0.6)', borderRadius: ing > 0 ? '0 3px 3px 0' : '3px' }} />}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', marginTop: '3px' }}>
                      {ing > 0 && <span style={{ fontSize: '10px', color: '#34d399' }}>+{fmt(ing)}</span>}
                      {egr > 0 && <span style={{ fontSize: '10px', color: '#f87171' }}>-{fmt(egr)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top gastos por centro */}
        <div style={{ ...G.card, padding: '20px' }}>
          <p style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Gastos por Centro de Costo</p>
          {gastosPorCentro.length === 0 ? (
            <p style={{ color: '#334155', fontSize: '13px' }}>Sin egresos para este período</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {gastosPorCentro.map(({ centro: c, total }) => {
                const pct = Math.round((total / maxGasto) * 100);
                return (
                  <div key={c.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color, boxShadow: `0 0 4px ${c.color}` }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8' }}>{c.nombre}</span>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#f87171' }}>{fmt(total)}</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, borderRadius: '3px', background: `linear-gradient(90deg,${c.color}90,${c.color})`, transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Proyección de caja (SVG line chart) ── */}
      <div style={{ ...G.card, padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Proyección de Caja</p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#475569' }}>Saldo acumulado — últimos 6 meses + próximos 3</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '12px', height: '2px', background: '#34d399', borderRadius: '1px' }}/><span style={{ fontSize: '10px', color: '#475569' }}>Saldo acum.</span></div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${W} ${H + 30}`} style={{ width: '100%', minWidth: '500px', display: 'block' }}>
            {/* grid lines */}
            {[0.25, 0.5, 0.75].map(f => (
              <line key={f} x1={PAD} y1={PAD + f * (H - PAD * 2)} x2={W - PAD} y2={PAD + f * (H - PAD * 2)} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            ))}
            {/* zero line */}
            {minV < 0 && <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="4,3" />}

            {/* area fill */}
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            <polygon points={areaPoints} fill="url(#areaGrad)" />

            {/* line */}
            <polyline points={points} fill="none" stroke="#34d399" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {/* dots + labels */}
            {proyConAcum.map((d, i) => {
              const x = PAD + i * xStep;
              const y = yScale(d.acum);
              const isFuture = i >= 6;
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={isFuture ? 3 : 4} fill={isFuture ? '#334155' : '#34d399'} stroke={isFuture ? '#475569' : '#059669'} strokeWidth={1.5} />
                  <text x={x} y={H + 10} textAnchor="middle" fontSize={9} fill="#475569">{d.label}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* resumen debajo del gráfico */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
          {proyConAcum.slice(-3).map((d, i) => (
            <div key={i} style={{ ...G.panel, padding: '8px 14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#475569' }}>{d.label}:</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: d.acum >= 0 ? '#34d399' : '#f87171' }}>{fmt(d.acum)}</span>
              <span style={{ fontSize: '9px', color: '#334155', background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: '4px' }}>proyectado</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Presupuesto vs Real ── */}
      {presupPeriodo.length > 0 && (
        <div style={{ ...G.card, padding: '20px', marginTop: '14px' }}>
          <p style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Presupuesto vs Real · {periodo}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Ingresos presupuestados', presup: totPresupIng, real: totalIng, color: '#34d399' },
              { label: 'Egresos presupuestados',  presup: totPresupEgr, real: totalEgr, color: '#f87171' },
            ].map(r => {
              const pct = r.presup > 0 ? Math.min(120, Math.round((r.real / r.presup) * 100)) : 0;
              const over = pct > 100;
              return (
                <div key={r.label} style={{ ...G.panel, padding: '14px 16px' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{r.label}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '11px', color: '#475569' }}>Presup.</p>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#94a3b8' }}>{fmt(r.presup)}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '11px', color: '#475569' }}>Real</p>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: r.color }}>{fmt(r.real)}</p>
                    </div>
                  </div>
                  <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, borderRadius: '3px', background: over ? 'linear-gradient(90deg,#f97316,#f87171)' : `linear-gradient(90deg,${r.color}80,${r.color})` }} />
                  </div>
                  <p style={{ margin: '5px 0 0', fontSize: '10px', color: over ? '#f87171' : '#475569' }}>{pct}% ejecutado{over ? ' — por encima del presupuesto' : ''}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
