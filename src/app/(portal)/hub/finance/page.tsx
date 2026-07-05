'use client';

import React, { useState, useMemo, useEffect } from 'react';

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
interface Factura {
  id: string; numero: string; cliente: string; concepto: string;
  monto: number; emitida: string; vencimiento: string;
  estado: 'pendiente' | 'pagada' | 'vencida' | 'anulada';
  pagado: number;
}
interface FacturaProv {
  id: string; numero: string; proveedor: string; concepto: string;
  monto: number; recibida: string; vencimiento: string;
  estado: 'pendiente' | 'pagada' | 'vencida';
  pagado: number; prioridad: 'alta' | 'media' | 'baja';
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
const SEED_FACTURAS: Factura[] = [
  { id: 'f1', numero:'FAC-2026-001', cliente:'Smartlex',          concepto:'Desarrollo plataforma - Fase 1', monto:4500000, emitida:'2026-01-15', vencimiento:'2026-03-01', estado:'vencida',   pagado:0       },
  { id: 'f2', numero:'FAC-2026-002', cliente:'FB Ingenieros',     concepto:'Consultoría BIM - Módulo 2',     monto:8200000, emitida:'2026-03-01', vencimiento:'2026-05-05', estado:'vencida',   pagado:0       },
  { id: 'f3', numero:'FAC-2026-003', cliente:'Grupo ABC',         concepto:'Retención mensual mayo',         monto:2100000, emitida:'2026-05-01', vencimiento:'2026-06-10', estado:'vencida',   pagado:0       },
  { id: 'f4', numero:'FAC-2026-004', cliente:'Constructora Norte',concepto:'Desarrollo app interna',         monto:6500000, emitida:'2026-06-01', vencimiento:'2026-07-15', estado:'pendiente', pagado:0       },
  { id: 'f5', numero:'FAC-2026-005', cliente:'Smartlex',          concepto:'Desarrollo plataforma - Fase 2', monto:3800000, emitida:'2026-06-15', vencimiento:'2026-08-01', estado:'pendiente', pagado:0       },
  { id: 'f6', numero:'FAC-2026-006', cliente:'Distribuidora Sur', concepto:'Análisis de datos Q1',           monto:1900000, emitida:'2026-02-01', vencimiento:'2026-03-15', estado:'pagada',    pagado:1900000 },
  { id: 'f7', numero:'FAC-2026-007', cliente:'Tech Solutions',    concepto:'Integración API pagos',          monto:5100000, emitida:'2026-02-20', vencimiento:'2026-04-20', estado:'vencida',   pagado:2500000 },
];
const SEED_PROV: FacturaProv[] = [
  { id: 'p1', numero:'PROV-001', proveedor:'AWS / Cloud',           concepto:'Infraestructura cloud junio',  monto:780000,  recibida:'2026-05-28', vencimiento:'2026-06-20', estado:'vencida',   pagado:0,       prioridad:'alta'  },
  { id: 'p2', numero:'PROV-002', proveedor:'Stack Software',        concepto:'Licencias suite desarrollo',   monto:1200000, recibida:'2026-06-01', vencimiento:'2026-07-10', estado:'pendiente', pagado:0,       prioridad:'alta'  },
  { id: 'p3', numero:'PROV-003', proveedor:'Contadores & Asociados',concepto:'Honorarios contabilidad mayo', monto:450000,  recibida:'2026-04-30', vencimiento:'2026-05-15', estado:'vencida',   pagado:0,       prioridad:'media' },
  { id: 'p4', numero:'PROV-004', proveedor:'Inmobiliaria Central',  concepto:'Arriendo oficina julio',       monto:2800000, recibida:'2026-06-25', vencimiento:'2026-07-15', estado:'pendiente', pagado:0,       prioridad:'alta'  },
  { id: 'p5', numero:'PROV-005', proveedor:'Estudio Jurídico Mora', concepto:'Asesoría contratos Q1',        monto:1600000, recibida:'2026-01-15', vencimiento:'2026-03-30', estado:'vencida',   pagado:0,       prioridad:'media' },
  { id: 'p6', numero:'PROV-006', proveedor:'Office Supplies Co.',   concepto:'Material oficina julio',       monto:380000,  recibida:'2026-06-28', vencimiento:'2026-08-05', estado:'pendiente', pagado:0,       prioridad:'baja'  },
  { id: 'p7', numero:'PROV-007', proveedor:'Hostinger VPS',         concepto:'Servidores VPS sem. anual',    monto:960000,  recibida:'2026-01-01', vencimiento:'2026-01-31', estado:'pagada',    pagado:960000,  prioridad:'alta'  },
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
  5: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z',
  6: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z',
  7: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
};
const TABS = ['Flujo de Caja','Centros de Costo','Presupuestos','Conciliación','Reportes','Forecast','CxC','CxP'];

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
  const [centros, setCentros]   = useState<CentroCosto[]>([]);
  const [movs, setMovs]         = useState<Movimiento[]>([]);
  const [presups, setPresups]   = useState<Presupuesto[]>([]);
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [provs, setProvs]       = useState<FacturaProv[]>([]);
  const [ready, setReady]     = useState(false);

  useEffect(() => {
    setCentros(loadLS('fin-centros-v1', SEED_CENTROS));
    setMovs(loadLS('fin-movs-v1', SEED_MOV));
    setPresups(loadLS('fin-pres-v1', SEED_PRES));
    setFacturas(loadLS('fin-facturas-v1', SEED_FACTURAS));
    setProvs(loadLS('fin-provs-v1', SEED_PROV));
    setReady(true);
  }, []);

  const saveCentros  = (v: CentroCosto[])  => { setCentros(v);  saveLS('fin-centros-v1', v); };
  const saveMovs     = (v: Movimiento[])   => { setMovs(v);     saveLS('fin-movs-v1', v); };
  const savePresups  = (v: Presupuesto[])  => { setPresups(v);  saveLS('fin-pres-v1', v); };
  const saveFacturas = (v: Factura[])      => { setFacturas(v); saveLS('fin-facturas-v1', v); };
  const saveProvs    = (v: FacturaProv[])  => { setProvs(v);    saveLS('fin-provs-v1', v); };

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
      {tab === 5 && <Forecast    movs={movs} />}
      {tab === 6 && <CxC facturas={facturas} onSave={saveFacturas} />}
      {tab === 7 && <CxP provs={provs} onSave={saveProvs} />}
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
function deltaBadge(v: number | null): React.ReactNode {
  if (v === null) return null;
  const up = v >= 0;
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '5px', background: up ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', color: up ? '#34d399' : '#f87171', display: 'inline-flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
      {up ? '▲' : '▼'} {Math.abs(v).toFixed(1)}%
    </span>
  );
}

function Reportes({ movs, centros, presups }: { movs: Movimiento[]; centros: CentroCosto[]; presups: Presupuesto[] }) {
  const [periodo, setPeriodo] = useState('2025-Q2');
  const [plView, setPlView] = useState<'tabla' | 'waterfall'>('tabla');

  // ── Range helpers ──
  const periodoToRange = (p: string) => {
    const [y, q] = p.split('-Q');
    const qn = Number(q);
    const start = (qn - 1) * 3 + 1;
    return { year: Number(y), meses: [start, start + 1, start + 2] };
  };

  const prevPeriodo = (p: string) => {
    const [y, q] = p.split('-Q');
    const qn = Number(q);
    return qn === 1 ? `${Number(y) - 1}-Q4` : `${y}-Q${qn - 1}`;
  };

  const movsEnPeriodo = (meses: number[], year: number) =>
    movs.filter(m => {
      const d = new Date(m.fecha + 'T12:00:00');
      return d.getFullYear() === year && meses.includes(d.getMonth() + 1);
    });

  const { year, meses } = periodoToRange(periodo);
  const prev = prevPeriodo(periodo);
  const { year: pyear, meses: pmeses } = periodoToRange(prev);

  const movsP  = movsEnPeriodo(meses, year);
  const movsAnt = movsEnPeriodo(pmeses, pyear);

  // ── Totales período actual y anterior ──────────────────────────────────────
  const totalIng  = movsP.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
  const totalEgr  = movsP.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
  const resultado = totalIng - totalEgr;
  const margen    = totalIng > 0 ? (resultado / totalIng) * 100 : 0;

  const prevIng     = movsAnt.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
  const prevEgr     = movsAnt.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
  const prevRes     = prevIng - prevEgr;
  const prevMargen  = prevIng > 0 ? (prevRes / prevIng) * 100 : 0;

  const calcDelta = (curr: number, p: number) => p === 0 ? null : ((curr - p) / Math.abs(p)) * 100;
  const deltaIng = calcDelta(totalIng, prevIng);
  const deltaEgr = calcDelta(totalEgr, prevEgr);
  const deltaRes = calcDelta(resultado, prevRes);
  const deltaMar: number | null = prevMargen !== 0 ? margen - prevMargen : null;

  // ── Burn rate & runway ──────────────────────────────────────────────────────
  const burnRate = totalEgr / 3;
  const runway   = burnRate > 0 ? resultado / burnRate : Infinity;

  // ── P&L estructurado ────────────────────────────────────────────────────────
  const COGS_CATS = ['produccion', 'operacion', 'proveedor', 'servicio'];
  const costoVentas = movsP.filter(m => m.tipo === 'egreso' && COGS_CATS.some(c => m.categoria.toLowerCase().includes(c))).reduce((s, m) => s + m.monto, 0);
  const gastosOp    = movsP.filter(m => m.tipo === 'egreso' && !COGS_CATS.some(c => m.categoria.toLowerCase().includes(c))).reduce((s, m) => s + m.monto, 0);
  const utilBruta   = totalIng - costoVentas;
  const ebitda      = utilBruta - gastosOp;
  const margenBruto = totalIng > 0 ? (utilBruta / totalIng) * 100 : 0;

  const prevCostoV  = movsAnt.filter(m => m.tipo === 'egreso' && COGS_CATS.some(c => m.categoria.toLowerCase().includes(c))).reduce((s, m) => s + m.monto, 0);
  const prevGastOp  = movsAnt.filter(m => m.tipo === 'egreso' && !COGS_CATS.some(c => m.categoria.toLowerCase().includes(c))).reduce((s, m) => s + m.monto, 0);
  const prevUtilB   = prevIng - prevCostoV;
  const prevEbitda  = prevUtilB - prevGastOp;

  // ── Desglose mensual dentro del trimestre ────────────────────────────────────
  const MESES_LABEL = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthlyData = meses.map(mes => {
    const mm = movs.filter(m => { const d = new Date(m.fecha + 'T12:00:00'); return d.getFullYear() === year && d.getMonth() + 1 === mes; });
    const ing = mm.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
    const egr = mm.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0);
    return { mes, ing, egr, neto: ing - egr };
  });

  // ── SVG grouped bar chart ────────────────────────────────────────────────────
  const GW = 500, GH = 150, GPAD = 28;
  const maxBar  = Math.max(1, ...monthlyData.flatMap(d => [d.ing, d.egr]));
  const barW    = 26, barGap = 5, groupW = barW * 2 + barGap;
  const groups  = monthlyData.length;
  const totalGW = GW - GPAD * 2;
  const groupSp = groups > 1 ? (totalGW - groupW * groups) / (groups - 1) : 0;
  const bH      = (v: number) => Math.max(2, (v / maxBar) * (GH - GPAD * 2));
  const gX      = (i: number) => GPAD + i * (groupW + groupSp);

  // ── SVG waterfall chart ──────────────────────────────────────────────────────
  const WFW = 500, WFH = 150, WFPAD = 28;
  const wfCols = [
    { label: 'Ingresos',    value: totalIng,    isTotal: false, positive: true },
    { label: 'Costo Vtas',  value: costoVentas, isTotal: false, positive: false },
    { label: 'Util. Bruta', value: utilBruta,   isTotal: true,  positive: utilBruta >= 0 },
    { label: 'Gastos Op.',  value: gastosOp,    isTotal: false, positive: false },
    { label: 'EBITDA',      value: ebitda,      isTotal: true,  positive: ebitda >= 0 },
  ];
  const wfMax = Math.max(1, totalIng);
  const wfAvH = WFH - WFPAD * 2;
  const wfColW = Math.floor((WFW - WFPAD * 2) / wfCols.length) - 10;
  const wfXi  = (i: number) => WFPAD + i * ((WFW - WFPAD * 2) / wfCols.length) + 5;
  const wfHv  = (v: number) => Math.max(2, (Math.abs(v) / wfMax) * wfAvH);
  const BOTTOM = WFH - WFPAD;

  let wfRun = 0;
  const wfBars = wfCols.map((col, i) => {
    let barY: number, barH: number;
    if (col.isTotal) {
      barH = wfHv(col.value);
      barY = col.value >= 0 ? BOTTOM - barH : BOTTOM;
    } else if (col.positive) {
      barH = wfHv(col.value);
      barY = BOTTOM - wfHv(wfRun) - barH;
      wfRun += col.value;
    } else {
      barH = wfHv(col.value);
      barY = BOTTOM - wfHv(wfRun);
      wfRun -= col.value;
    }
    const color = col.isTotal
      ? (col.positive ? '#34d399' : '#f87171')
      : (col.positive ? 'rgba(52,211,153,0.8)' : 'rgba(248,113,113,0.8)');
    return { ...col, x: wfXi(i), y: barY, h: barH, color };
  });

  // ── Presupuesto vs Real ──────────────────────────────────────────────────────
  const presupPeriodo = presups.filter(p => p.periodo === periodo);
  const totPresupEgr  = presupPeriodo.filter(p => p.tipo === 'egreso').reduce((s, p) => s + p.monto, 0);
  const totPresupIng  = presupPeriodo.filter(p => p.tipo === 'ingreso').reduce((s, p) => s + p.monto, 0);

  return (
    <>
      {/* ── Header: selector + semáforos de salud ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ ...G.input, width: 'auto', padding: '7px 14px', fontSize: '13px', fontWeight: 700 }}>
            {PERIODOS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <span style={{ fontSize: '11px', color: '#334155' }}>vs {prev}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { label: 'Margen neto', ok: margen >= 15, warn: margen >= 5, val: `${margen.toFixed(1)}%` },
            { label: 'Burn rate',   ok: burnRate < totalIng / 3, warn: burnRate < totalIng / 2, val: `${fmt(burnRate)}/mes` },
            { label: 'Runway',      ok: runway > 6, warn: runway > 2, val: runway === Infinity ? '∞ meses' : `${runway.toFixed(1)} m` },
            { label: 'Mg. bruto',   ok: margenBruto >= 40, warn: margenBruto >= 20, val: `${margenBruto.toFixed(1)}%` },
          ].map(s => (
            <div key={s.label} style={{ ...G.panel, padding: '5px 11px', display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0, background: s.ok ? '#34d399' : s.warn ? '#fbbf24' : '#f87171', boxShadow: `0 0 5px ${s.ok ? '#34d399' : s.warn ? '#fbbf24' : '#f87171'}60` }} />
              <span style={{ fontSize: '10px', color: '#475569' }}>{s.label}</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8' }}>{s.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPIs con delta QoQ ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '14px' }}>
        {[
          { label: 'Ingresos',    val: fmt(totalIng),            prev_: fmt(prevIng),            delta: deltaIng, color: '#34d399', icon: 'M7 11l5-5m0 0l5 5m-5-5v12' },
          { label: 'Egresos',     val: fmt(totalEgr),            prev_: fmt(prevEgr),            delta: deltaEgr !== null ? -deltaEgr : null, color: '#f87171', icon: 'M17 13l-5 5m0 0l-5-5m5 5V6' },
          { label: 'Resultado',   val: `${resultado >= 0 ? '+' : ''}${fmt(resultado)}`, prev_: `${prevRes >= 0 ? '+' : ''}${fmt(prevRes)}`, delta: deltaRes, color: resultado >= 0 ? '#34d399' : '#f87171', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01' },
          { label: 'Margen neto', val: `${margen.toFixed(1)}%`,  prev_: `${prevMargen.toFixed(1)}%`, delta: deltaMar, color: margen >= 15 ? '#34d399' : margen >= 5 ? '#fbbf24' : '#f87171', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
        ].map(k => (
          <div key={k.label} style={{ ...G.card, padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 100% 0%, ${k.color}10, transparent 55%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</p>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={k.color} strokeWidth={2} opacity={0.5}><path strokeLinecap="round" strokeLinejoin="round" d={k.icon} /></svg>
              </div>
              <p style={{ margin: 0, fontSize: '23px', fontWeight: 800, color: k.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{k.val}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <span style={{ fontSize: '10px', color: '#334155' }}>{k.prev_}</span>
                {deltaBadge(k.delta)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Estado de Resultados (P&L statement) ── */}
      <div style={{ ...G.card, padding: '20px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Estado de Resultados</p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#475569' }}>Formato P&L · {periodo} vs {prev}</p>
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            {(['tabla', 'waterfall'] as const).map(v => (
              <button key={v} onClick={() => setPlView(v)} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', border: 'none', cursor: 'pointer', background: plView === v ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)', color: plView === v ? '#34d399' : '#475569', transition: 'all 0.15s' }}>
                {v === 'tabla' ? 'Tabla' : 'Waterfall'}
              </button>
            ))}
          </div>
        </div>

        {plView === 'tabla' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Concepto', periodo, prev, 'Δ QoQ', '% s/Ingresos'].map((h, i) => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: i === 0 ? 'left' : 'right', fontWeight: 700, fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([
                { label: '(+) Ingresos Brutos',    curr: totalIng,   prev_: prevIng,   bold: false, color: '#34d399' },
                { label: '(−) Costo de Ventas',    curr: costoVentas, prev_: prevCostoV, bold: false, color: '#f87171', neg: true },
                { label: 'Utilidad Bruta',          curr: utilBruta,  prev_: prevUtilB, bold: true,  color: utilBruta >= 0 ? '#34d399' : '#f87171', divider: true },
                { label: '(−) Gastos Operativos',  curr: gastosOp,   prev_: prevGastOp, bold: false, color: '#f87171', neg: true },
                { label: 'EBITDA',                  curr: ebitda,     prev_: prevEbitda, bold: true,  color: ebitda >= 0 ? '#34d399' : '#f87171', divider: true },
              ] as { label: string; curr: number; prev_: number; bold: boolean; color: string; neg?: boolean; divider?: boolean }[]).map((row) => (
                <React.Fragment key={row.label}>
                  {row.divider && (
                    <tr><td colSpan={5} style={{ padding: '1px 0' }}><div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} /></td></tr>
                  )}
                  <tr style={{ background: row.bold ? 'rgba(255,255,255,0.025)' : 'transparent' }}>
                    <td style={{ padding: '8px 10px', color: row.bold ? '#e2e8f0' : '#94a3b8', fontWeight: row.bold ? 700 : 400, fontSize: row.bold ? '12px' : '11px' }}>{row.label}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: row.bold ? 700 : 500, color: row.color, fontVariantNumeric: 'tabular-nums' }}>{row.neg ? '− ' : ''}{fmt(row.curr)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{row.neg ? '− ' : ''}{fmt(row.prev_)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{deltaBadge(calcDelta(row.curr, row.prev_))}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#334155', fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}>
                      {totalIng > 0 ? `${((row.curr / totalIng) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        ) : (
          /* Waterfall SVG */
          <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${WFW} ${WFH + 30}`} style={{ width: '100%', minWidth: '380px', display: 'block' }}>
              <defs>
                <linearGradient id="wfGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="wfRed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity="0.9" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75, 1].map(f => (
                <line key={f} x1={WFPAD} y1={BOTTOM - f * wfAvH} x2={WFW - WFPAD} y2={BOTTOM - f * wfAvH} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
              ))}
              <line x1={WFPAD} y1={BOTTOM} x2={WFW - WFPAD} y2={BOTTOM} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
              {wfBars.map((bar, i) => {
                const isPos = bar.positive;
                const fill = bar.isTotal ? (isPos ? 'url(#wfGreen)' : 'url(#wfRed)') : (isPos ? 'rgba(52,211,153,0.7)' : 'rgba(248,113,113,0.7)');
                return (
                  <g key={i}>
                    {/* connector line to next */}
                    {!bar.isTotal && i < wfBars.length - 1 && (
                      <line x1={bar.x + wfColW} y1={bar.positive ? bar.y : bar.y + bar.h} x2={wfBars[i + 1].x} y2={bar.positive ? bar.y : bar.y + bar.h} stroke="rgba(255,255,255,0.1)" strokeWidth={1} strokeDasharray="3,2" />
                    )}
                    <rect x={bar.x} y={bar.y} width={wfColW} height={bar.h} rx={3} fill={fill} />
                    <text x={bar.x + wfColW / 2} y={bar.y - 5} textAnchor="middle" fontSize={9} fill="#94a3b8">
                      {bar.positive ? '' : '−'}{fmt(bar.value).replace('$', '')}
                    </text>
                    <text x={bar.x + wfColW / 2} y={WFH + 13} textAnchor="middle" fontSize={9} fill="#475569">{bar.label}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* ── Fila: Flujo mensual + Composición por categoría ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>

        {/* Grouped bar chart mensual */}
        <div style={{ ...G.card, padding: '20px' }}>
          <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Flujo Mensual</p>
          <p style={{ margin: '0 0 12px', fontSize: '11px', color: '#475569' }}>Ingresos vs Egresos dentro del trimestre</p>
          <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${GW} ${GH + 30}`} style={{ width: '100%', minWidth: '240px', display: 'block' }}>
              <defs>
                <linearGradient id="barIng" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.7" />
                </linearGradient>
                <linearGradient id="barEgr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity="0.7" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75, 1].map(f => (
                <line key={f} x1={GPAD} y1={GH - GPAD - f * (GH - GPAD * 2)} x2={GW - GPAD} y2={GH - GPAD - f * (GH - GPAD * 2)} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
              ))}
              <line x1={GPAD} y1={GH - GPAD} x2={GW - GPAD} y2={GH - GPAD} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
              {monthlyData.map((d, i) => {
                const x = gX(i);
                const ingH = bH(d.ing), egrH = bH(d.egr);
                return (
                  <g key={i}>
                    <rect x={x} y={GH - GPAD - ingH} width={barW} height={ingH} rx={3} fill="url(#barIng)" />
                    <rect x={x + barW + barGap} y={GH - GPAD - egrH} width={barW} height={egrH} rx={3} fill="url(#barEgr)" />
                    <text x={x + groupW / 2} y={GH + 13} textAnchor="middle" fontSize={9} fill="#475569">{MESES_LABEL[d.mes]}</text>
                  </g>
                );
              })}
              <g>
                <rect x={GW - 85} y={8} width={7} height={7} rx={1} fill="#34d399" opacity={0.8} />
                <text x={GW - 74} y={15} fontSize={9} fill="#475569">Ingresos</text>
                <rect x={GW - 85} y={21} width={7} height={7} rx={1} fill="#f87171" opacity={0.8} />
                <text x={GW - 74} y={28} fontSize={9} fill="#475569">Egresos</text>
              </g>
            </svg>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            {monthlyData.map(d => (
              <div key={d.mes} style={{ flex: 1, ...G.panel, padding: '7px 8px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '9px', color: '#475569', fontWeight: 700, textTransform: 'uppercase' }}>{MESES_LABEL[d.mes]}</p>
                <p style={{ margin: '3px 0 0', fontSize: '11px', fontWeight: 800, color: d.neto >= 0 ? '#34d399' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>{d.neto >= 0 ? '+' : ''}{fmt(d.neto)}</p>
                <p style={{ margin: '1px 0 0', fontSize: '9px', color: '#334155' }}>{d.neto >= 0 ? 'superávit' : 'déficit'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Composición por categoría con % participación */}
        <div style={{ ...G.card, padding: '20px' }}>
          <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Composición por Categoría</p>
          <p style={{ margin: '0 0 14px', fontSize: '11px', color: '#475569' }}>Participación sobre ingresos totales</p>
          {(() => {
            const catMap2: Record<string, { ing: number; egr: number }> = {};
            movsP.forEach(m => {
              if (!catMap2[m.categoria]) catMap2[m.categoria] = { ing: 0, egr: 0 };
              catMap2[m.categoria][m.tipo === 'ingreso' ? 'ing' : 'egr'] += m.monto;
            });
            const items2 = Object.entries(catMap2).sort((a, b) => (b[1].ing + b[1].egr) - (a[1].ing + a[1].egr)).slice(0, 7);
            if (items2.length === 0) return <p style={{ color: '#334155', fontSize: '12px' }}>Sin datos</p>;
            return items2.map(([cat, v]) => {
              const neto = v.ing - v.egr;
              const pctIng = totalIng > 0 ? ((v.ing + v.egr) / totalIng) * 100 : 0;
              return (
                <div key={cat} style={{ marginBottom: '9px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>{cat}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '10px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{pctIng.toFixed(1)}%</span>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: neto >= 0 ? '#34d399' : '#f87171', fontVariantNumeric: 'tabular-nums' }}>{neto >= 0 ? '+' : ''}{fmt(neto)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', height: '5px', borderRadius: '3px', overflow: 'hidden', background: 'rgba(255,255,255,0.04)' }}>
                    {v.ing > 0 && <div style={{ flex: v.ing, background: 'linear-gradient(90deg,rgba(52,211,153,0.4),rgba(52,211,153,0.75))' }} />}
                    {v.egr > 0 && <div style={{ flex: v.egr, background: 'linear-gradient(90deg,rgba(248,113,113,0.5),rgba(248,113,113,0.8))' }} />}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                    {v.ing > 0 && <span style={{ fontSize: '9px', color: '#34d399', fontVariantNumeric: 'tabular-nums' }}>+{fmt(v.ing)}</span>}
                    {v.egr > 0 && <span style={{ fontSize: '9px', color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>−{fmt(v.egr)}</span>}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* ── Fila: Distribución egresos + Presupuesto vs Real ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>

        {/* Gastos por centro con % */}
        <div style={{ ...G.card, padding: '20px' }}>
          <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Distribución de Egresos</p>
          <p style={{ margin: '0 0 14px', fontSize: '11px', color: '#475569' }}>Por centro de costo — participación y monto</p>
          {(() => {
            const items3 = centros.map(c => ({
              c,
              total: movsP.filter(m => m.centroCostoId === c.id && m.tipo === 'egreso').reduce((s, m) => s + m.monto, 0),
            })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
            const maxT = items3[0]?.total ?? 1;
            const totalE = items3.reduce((s, x) => s + x.total, 0);
            if (items3.length === 0) return <p style={{ color: '#334155', fontSize: '12px' }}>Sin egresos en este período</p>;
            return items3.map(({ c, total }) => (
              <div key={c.id} style={{ marginBottom: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.color, boxShadow: `0 0 5px ${c.color}80`, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>{c.nombre}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{totalE > 0 ? ((total / totalE) * 100).toFixed(1) : 0}%</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#f87171', fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</span>
                  </div>
                </div>
                <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(total / maxT) * 100}%`, borderRadius: '3px', background: `linear-gradient(90deg,${c.color}60,${c.color})`, transition: 'width 0.5s' }} />
                </div>
              </div>
            ));
          })()}
        </div>

        {/* Presupuesto vs Real por línea */}
        <div style={{ ...G.card, padding: '20px' }}>
          <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Presupuesto vs Real</p>
          <p style={{ margin: '0 0 14px', fontSize: '11px', color: '#475569' }}>{periodo} · ejecución por línea presupuestal</p>
          {presupPeriodo.length === 0
            ? <p style={{ color: '#334155', fontSize: '12px' }}>Sin presupuesto definido para {periodo}</p>
            : (
              <>
                {presupPeriodo.map(p => {
                  const real = movsP.filter(m => m.tipo === p.tipo && m.categoria === p.categoria).reduce((s, m) => s + m.monto, 0);
                  const exec = p.monto > 0 ? (real / p.monto) * 100 : 0;
                  const over = exec > 100;
                  const barColor = over ? '#f97316' : p.tipo === 'ingreso' ? '#34d399' : '#60a5fa';
                  return (
                    <div key={p.id} style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: p.tipo === 'ingreso' ? '#34d399' : '#60a5fa', flexShrink: 0 }} />
                          <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>{p.categoria}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{fmt(real)} / {fmt(p.monto)}</span>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: over ? '#f97316' : '#64748b', fontVariantNumeric: 'tabular-nums' }}>{exec.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div style={{ height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(exec, 100)}%`, borderRadius: '3px', background: `linear-gradient(90deg,${barColor}60,${barColor})`, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#475569' }}>Ejecución total</span>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', fontVariantNumeric: 'tabular-nums' }}>Ing: {totPresupIng > 0 ? ((totalIng / totPresupIng) * 100).toFixed(0) : 0}%</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#60a5fa', fontVariantNumeric: 'tabular-nums' }}>Egr: {totPresupEgr > 0 ? ((totalEgr / totPresupEgr) * 100).toFixed(0) : 0}%</span>
                  </div>
                </div>
              </>
            )
          }
        </div>
      </div>
    </>
  );
}

// ── Tab 6: Forecast ───────────────────────────────────────────────────────
const MONTH_LABEL = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

type FcastScenario = 'conservador' | 'base' | 'optimista';
type FcastPoint = { key: string; label: string; year: number; mes: number; ing: number; egr: number; acum: number; isForecast: boolean };

function linReg(pts: number[]): { m: number; b: number } {
  const n = pts.length;
  if (n < 2) return { m: 0, b: pts[0] ?? 0 };
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  pts.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sx2 += x * x; });
  const m = (n * sxy - sx * sy) / (n * sx2 - sx * sx);
  const b = (sy - m * sx) / n;
  return { m, b };
}

const SCENARIO_PARAMS: Record<FcastScenario, { ingMult: number; egrMult: number; label: string; color: string }> = {
  conservador: { ingMult: 0.97, egrMult: 1.03, label: 'Conservador', color: '#f87171' },
  base:        { ingMult: 1.00, egrMult: 1.00, label: 'Base',        color: '#fbbf24' },
  optimista:   { ingMult: 1.04, egrMult: 0.97, label: 'Optimista',   color: '#34d399' },
};

function Forecast({ movs }: { movs: Movimiento[] }) {
  const [horizonte, setHorizonte] = useState(6);
  const [scenario, setScenario]   = useState<FcastScenario>('base');
  const [editando, setEditando]   = useState(false);
  const [overrides, setOverrides] = useState<Record<string, { ing?: number; egr?: number }>>({});

  // ── Construir serie mensual histórica (últimos 12 meses con datos) ──────────
  const hoy = new Date();
  const histPts: { key: string; label: string; year: number; mes: number; ing: number; egr: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const mm = movs.filter(mv => { const dd = new Date(mv.fecha + 'T12:00:00'); return dd.getFullYear() === y && dd.getMonth() + 1 === m; });
    const ing = mm.filter(mv => mv.tipo === 'ingreso').reduce((s, mv) => s + mv.monto, 0);
    const egr = mm.filter(mv => mv.tipo === 'egreso').reduce((s, mv) => s + mv.monto, 0);
    histPts.push({ key, label: `${MONTH_LABEL[m]} ${String(y).slice(2)}`, year: y, mes: m, ing, egr });
  }

  // Usar solo los meses con datos para la regresión
  const withData = histPts.filter(p => p.ing > 0 || p.egr > 0);

  // ── Regresión lineal ─────────────────────────────────────────────────────────
  const ingArr = withData.map(p => p.ing);
  const egrArr = withData.map(p => p.egr);
  const regIng = linReg(ingArr);
  const regEgr = linReg(egrArr);

  const scParam = SCENARIO_PARAMS[scenario];

  // ── Proyectar N meses ─────────────────────────────────────────────────────────
  const fcastPts: { key: string; label: string; year: number; mes: number; ing: number; egr: number }[] = [];
  for (let i = 1; i <= horizonte; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    const y = d.getFullYear(), m = d.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const idx  = withData.length + i - 1;
    const rawIng = Math.max(0, regIng.m * idx + regIng.b) * Math.pow(scParam.ingMult, i);
    const rawEgr = Math.max(0, regEgr.m * idx + regEgr.b) * Math.pow(scParam.egrMult, i);
    fcastPts.push({
      key,
      label: `${MONTH_LABEL[m]} ${String(y).slice(2)}`,
      year: y, mes: m,
      ing: overrides[key]?.ing ?? rawIng,
      egr: overrides[key]?.egr ?? rawEgr,
    });
  }

  // ── Serie completa (hist + forecast) ─────────────────────────────────────────
  let acum = 0;
  const allPts: FcastPoint[] = [
    ...histPts.map(p => ({ ...p, acum: 0, isForecast: false })),
    ...fcastPts.map(p => ({ ...p, acum: 0, isForecast: true })),
  ].map(p => { acum += p.ing - p.egr; return { ...p, acum }; });

  // ── KPIs de forecast ─────────────────────────────────────────────────────────
  const fPts = allPts.filter(p => p.isForecast);
  const fTotalIng = fPts.reduce((s, p) => s + p.ing, 0);
  const fTotalEgr = fPts.reduce((s, p) => s + p.egr, 0);
  const fResultado = fTotalIng - fTotalEgr;
  const fMargen    = fTotalIng > 0 ? (fResultado / fTotalIng) * 100 : 0;
  const breakEven  = fPts.findIndex(p => p.acum >= 0);

  // Comparar promedio histórico vs promedio proyectado
  const hAvgIng = withData.length > 0 ? withData.reduce((s, p) => s + p.ing, 0) / withData.length : 0;
  const hAvgEgr = withData.length > 0 ? withData.reduce((s, p) => s + p.egr, 0) / withData.length : 0;
  const fAvgIng = fPts.length > 0 ? fTotalIng / fPts.length : 0;
  const fAvgEgr = fPts.length > 0 ? fTotalEgr / fPts.length : 0;
  const growIng = hAvgIng > 0 ? ((fAvgIng - hAvgIng) / hAvgIng) * 100 : 0;
  const growEgr = hAvgEgr > 0 ? ((fAvgEgr - hAvgEgr) / hAvgEgr) * 100 : 0;

  // ── SVG dual-line chart ──────────────────────────────────────────────────────
  const W = 640, H = 180, PAD = { t: 16, r: 20, b: 32, l: 20 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  const allIng = allPts.map(p => p.ing);
  const allEgr = allPts.map(p => p.egr);
  const yMax   = Math.max(1, ...allIng, ...allEgr) * 1.1;
  const xStep  = allPts.length > 1 ? chartW / (allPts.length - 1) : chartW;
  const xOf    = (i: number) => PAD.l + i * xStep;
  const yOf    = (v: number) => PAD.t + chartH - (v / yMax) * chartH;

  const ingLine = allPts.map((p, i) => `${xOf(i)},${yOf(p.ing)}`).join(' ');
  const egrLine = allPts.map((p, i) => `${xOf(i)},${yOf(p.egr)}`).join(' ');

  // Split into hist/forecast segments
  const hCount  = histPts.length;
  const ingHist = allPts.slice(0, hCount).map((p, i) => `${xOf(i)},${yOf(p.ing)}`).join(' ');
  const egrHist = allPts.slice(0, hCount).map((p, i) => `${xOf(i)},${yOf(p.egr)}`).join(' ');
  const ingFcast = allPts.slice(hCount - 1).map((p, i) => `${xOf(hCount - 1 + i)},${yOf(p.ing)}`).join(' ');
  const egrFcast = allPts.slice(hCount - 1).map((p, i) => `${xOf(hCount - 1 + i)},${yOf(p.egr)}`).join(' ');

  // Confidence band (±15% of projected)
  const bandTop = fPts.map((p, i) => `${xOf(hCount + i)},${yOf(p.ing * 1.15)}`);
  const bandBot = fPts.map((p, i) => `${xOf(hCount + i)},${yOf(p.ing * 0.85)}`).reverse();
  const bandPath = bandTop.length > 0 ? `${xOf(hCount - 1)},${yOf(fPts[0]?.ing ?? 0)} ` + bandTop.join(' ') + ' ' + bandBot.join(' ') + ` ${xOf(hCount - 1)},${yOf(fPts[0]?.ing ?? 0)}` : '';

  // Divide line x position
  const divX = xOf(hCount - 1);

  const setOverride = (key: string, field: 'ing' | 'egr', raw: string) => {
    const v = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (isNaN(v)) return;
    setOverrides(prev => ({ ...prev, [key]: { ...prev[key], [field]: v } }));
  };

  return (
    <>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Forecasting Financiero</p>
          <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#475569' }}>Tendencia histórica + proyección con regresión lineal</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Horizonte */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {[3, 6, 12].map(h => (
              <button key={h} onClick={() => setHorizonte(h)} style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 700, borderRadius: '7px', border: 'none', cursor: 'pointer', background: horizonte === h ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)', color: horizonte === h ? '#34d399' : '#475569', transition: 'all 0.15s' }}>
                {h}m
              </button>
            ))}
          </div>
          {/* Scenario */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {(Object.keys(SCENARIO_PARAMS) as FcastScenario[]).map(s => (
              <button key={s} onClick={() => setScenario(s)} style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 700, borderRadius: '7px', border: 'none', cursor: 'pointer', background: scenario === s ? `${SCENARIO_PARAMS[s].color}22` : 'rgba(255,255,255,0.05)', color: scenario === s ? SCENARIO_PARAMS[s].color : '#475569', transition: 'all 0.15s' }}>
                {SCENARIO_PARAMS[s].label}
              </button>
            ))}
          </div>
          <button onClick={() => setEditando(e => !e)} style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 700, borderRadius: '7px', border: `1px solid ${editando ? '#34d399' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', background: editando ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.03)', color: editando ? '#34d399' : '#475569', transition: 'all 0.15s' }}>
            {editando ? '✓ Editando' : 'Editar supuestos'}
          </button>
        </div>
      </div>

      {/* ── KPIs proyectados ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '14px' }}>
        {[
          { label: `Ingresos (${horizonte}m)`, val: fmt(fTotalIng), sub: `Promedio ${fmt(fAvgIng)}/mes`, delta: growIng, color: '#34d399' },
          { label: `Egresos (${horizonte}m)`,  val: fmt(fTotalEgr), sub: `Promedio ${fmt(fAvgEgr)}/mes`, delta: -growEgr, color: '#f87171' },
          { label: 'Resultado proyectado', val: `${fResultado >= 0 ? '+' : ''}${fmt(fResultado)}`, sub: `Margen ${fMargen.toFixed(1)}%`, delta: fMargen >= 15 ? null : null, color: fResultado >= 0 ? '#34d399' : '#f87171' },
          { label: 'Tendencia ingresos', val: regIng.m >= 0 ? `+${fmt(regIng.m)}/mes` : `${fmt(regIng.m)}/mes`, sub: regIng.m >= 0 ? 'creciendo' : 'decreciendo', color: regIng.m >= 0 ? '#34d399' : '#f87171' },
        ].map(k => (
          <div key={k.label} style={{ ...G.card, padding: '15px 17px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 100% 0%, ${k.color}0e, transparent 55%)`, pointerEvents: 'none' }} />
            <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</p>
            <p style={{ margin: 0, fontSize: '21px', fontWeight: 800, color: k.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{k.val}</p>
            <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#334155' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Gráfico dual: Ingresos vs Egresos (histórico + proyección) ── */}
      <div style={{ ...G.card, padding: '20px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Ingresos vs Egresos · Histórico + Proyección</p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#475569' }}>Línea sólida = histórico · Punteada = proyectado · Banda = rango de confianza</p>
          </div>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
            {[{ color: '#34d399', label: 'Ingresos' }, { color: '#f87171', label: 'Egresos' }].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '16px', height: '2px', background: l.color, borderRadius: '1px' }} />
                <span style={{ fontSize: '10px', color: '#475569' }}>{l.label}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '16px', height: '7px', background: 'rgba(52,211,153,0.12)', borderRadius: '2px' }} />
              <span style={{ fontSize: '10px', color: '#475569' }}>Confianza ±15%</span>
            </div>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${W} ${H + 4}`} style={{ width: '100%', minWidth: '520px', display: 'block' }}>
            <defs>
              <linearGradient id="fcBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.04" />
              </linearGradient>
            </defs>

            {/* Grid */}
            {[0.25, 0.5, 0.75, 1].map(f => (
              <line key={f} x1={PAD.l} y1={PAD.t + chartH * (1 - f)} x2={W - PAD.r} y2={PAD.t + chartH * (1 - f)} stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
            ))}

            {/* Divider: histórico vs forecast */}
            <line x1={divX} y1={PAD.t} x2={divX} y2={PAD.t + chartH} stroke="rgba(255,255,255,0.12)" strokeWidth={1} strokeDasharray="4,3" />
            <text x={divX + 4} y={PAD.t + 10} fontSize={8} fill="#334155">hoy →</text>

            {/* Confidence band */}
            {bandPath && <polygon points={bandPath} fill="url(#fcBand)" />}

            {/* Líneas históricas (sólidas) */}
            <polyline points={ingHist} fill="none" stroke="#34d399" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={egrHist} fill="none" stroke="#f87171" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {/* Líneas forecast (punteadas) */}
            <polyline points={ingFcast} fill="none" stroke="#34d399" strokeWidth={1.5} strokeDasharray="5,3" strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />
            <polyline points={egrFcast} fill="none" stroke="#f87171" strokeWidth={1.5} strokeDasharray="5,3" strokeLinejoin="round" strokeLinecap="round" opacity={0.85} />

            {/* Dots + labels eje X */}
            {allPts.map((p, i) => {
              const x = xOf(i), showLabel = i % 2 === 0 || allPts.length <= 10;
              return (
                <g key={p.key}>
                  <circle cx={x} cy={yOf(p.ing)} r={p.isForecast ? 2.5 : 3.5} fill={p.isForecast ? '#1e3a2e' : '#34d399'} stroke="#34d399" strokeWidth={1.2} />
                  <circle cx={x} cy={yOf(p.egr)} r={p.isForecast ? 2.5 : 3.5} fill={p.isForecast ? '#3a1e1e' : '#f87171'} stroke="#f87171" strokeWidth={1.2} />
                  {showLabel && <text x={x} y={H - 4} textAnchor="middle" fontSize={8} fill={p.isForecast ? '#475569' : '#334155'}>{p.label}</text>}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ── Tabla de proyección mensual ── */}
      <div style={{ ...G.card, padding: '20px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Proyección Mensual · Escenario {SCENARIO_PARAMS[scenario].label}</p>
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#475569' }}>
              {editando ? 'Hacé clic en un valor para editarlo — los cambios sobreescriben el modelo' : 'Los valores se calculan por regresión lineal + multiplicador de escenario'}
            </p>
          </div>
          {Object.keys(overrides).length > 0 && (
            <button onClick={() => setOverrides({})} style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 600, borderRadius: '7px', border: '1px solid rgba(248,113,113,0.3)', cursor: 'pointer', background: 'rgba(248,113,113,0.08)', color: '#f87171' }}>
              Resetear overrides ({Object.keys(overrides).length})
            </button>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                {['Mes', 'Ingresos proy.', 'Egresos proy.', 'Neto', 'Saldo acum.', 'Estado'].map((h, i) => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: i === 0 ? 'left' : 'right', fontWeight: 700, fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fPts.map((p, i) => {
                const neto = p.ing - p.egr;
                const isOverridden = overrides[p.key];
                return (
                  <tr key={p.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                    <td style={{ padding: '8px 10px', color: '#e2e8f0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {p.label}
                      {isOverridden && <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>editado</span>}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {editando ? (
                        <input type="number" defaultValue={Math.round(p.ing)} onBlur={e => setOverride(p.key, 'ing', e.target.value)} style={{ ...G.input, width: '100px', textAlign: 'right', fontSize: '12px', padding: '3px 8px', color: '#34d399' }} />
                      ) : (
                        <span style={{ color: '#34d399', fontWeight: 600 }}>{fmt(p.ing)}</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {editando ? (
                        <input type="number" defaultValue={Math.round(p.egr)} onBlur={e => setOverride(p.key, 'egr', e.target.value)} style={{ ...G.input, width: '100px', textAlign: 'right', fontSize: '12px', padding: '3px 8px', color: '#f87171' }} />
                      ) : (
                        <span style={{ color: '#f87171', fontWeight: 600 }}>{fmt(p.egr)}</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: neto >= 0 ? '#34d399' : '#f87171' }}>
                      {neto >= 0 ? '+' : ''}{fmt(neto)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: p.acum >= 0 ? '#94a3b8' : '#f87171', fontWeight: p.acum < 0 ? 700 : 400 }}>
                      {p.acum >= 0 ? '' : '−'}{fmt(Math.abs(p.acum))}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '5px', fontWeight: 700, background: neto >= 0 ? 'rgba(52,211,153,0.1)' : 'rgba(248,113,113,0.1)', color: neto >= 0 ? '#34d399' : '#f87171' }}>
                        {neto >= 0 ? 'superávit' : 'déficit'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: '12px', color: '#e2e8f0' }}>TOTAL {horizonte}m</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#34d399' }}>{fmt(fTotalIng)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#f87171' }}>{fmt(fTotalEgr)}</td>
                <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: fResultado >= 0 ? '#34d399' : '#f87171' }}>{fResultado >= 0 ? '+' : ''}{fmt(fResultado)}</td>
                <td colSpan={2} style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px', color: '#475569' }}>
                  Margen proyectado: <strong style={{ color: scParam.color }}>{fMargen.toFixed(1)}%</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Comparativo escenarios ── */}
      <div style={{ ...G.card, padding: '20px' }}>
        <p style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>Comparativo de Escenarios · {horizonte} meses</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
          {(Object.entries(SCENARIO_PARAMS) as [FcastScenario, typeof SCENARIO_PARAMS.base][]).map(([key, sc]) => {
            // Recalcular para cada escenario
            let sTotalIng = 0, sTotalEgr = 0;
            for (let i = 1; i <= horizonte; i++) {
              const idx = withData.length + i - 1;
              sTotalIng += Math.max(0, regIng.m * idx + regIng.b) * Math.pow(sc.ingMult, i);
              sTotalEgr += Math.max(0, regEgr.m * idx + regEgr.b) * Math.pow(sc.egrMult, i);
            }
            const sRes = sTotalIng - sTotalEgr;
            const sMar = sTotalIng > 0 ? (sRes / sTotalIng) * 100 : 0;
            const isActive = key === scenario;
            return (
              <div key={key} onClick={() => setScenario(key)} style={{ ...G.panel, padding: '16px 18px', cursor: 'pointer', border: `1px solid ${isActive ? sc.color + '40' : 'rgba(255,255,255,0.07)'}`, background: isActive ? `${sc.color}08` : 'rgba(255,255,255,0.02)', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: sc.color }}>{sc.label}</p>
                  {isActive && <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: `${sc.color}20`, color: sc.color, fontWeight: 700 }}>ACTIVO</span>}
                </div>
                <p style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 800, color: sRes >= 0 ? sc.color : '#f87171', letterSpacing: '-0.02em' }}>{sRes >= 0 ? '+' : ''}{fmt(sRes)}</p>
                <p style={{ margin: '0 0 10px', fontSize: '10px', color: '#475569' }}>resultado proyectado</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#34d399' }}>Ing: {fmt(sTotalIng)}</span>
                  <span style={{ color: '#f87171' }}>Egr: {fmt(sTotalEgr)}</span>
                </div>
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', color: '#475569' }}>Margen</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: sMar >= 15 ? '#34d399' : sMar >= 5 ? '#fbbf24' : '#f87171' }}>{sMar.toFixed(1)}%</span>
                </div>
                <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', color: '#475569' }}>Crecimiento ing.</span>
                  <span style={{ fontSize: '10px', color: sc.ingMult >= 1 ? '#34d399' : '#f87171' }}>{sc.ingMult >= 1 ? '+' : ''}{((sc.ingMult - 1) * 100).toFixed(0)}%/mes</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Helpers compartidos CxC / CxP ─────────────────────────────────────────
const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function diasDesde(fechaISO: string): number {
  const d = new Date(fechaISO + 'T00:00:00');
  return Math.floor((TODAY.getTime() - d.getTime()) / 86400000);
}

type AgingBucket = 'corriente' | '0-30' | '31-60' | '61-90' | '+90';
const AGING_BUCKETS: { key: AgingBucket; label: string; color: string; bg: string }[] = [
  { key: 'corriente', label: 'En plazo',  color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  { key: '0-30',      label: '0–30 días', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
  { key: '31-60',     label: '31–60 días',color: '#fb923c', bg: 'rgba(251,146,60,0.1)'  },
  { key: '61-90',     label: '61–90 días',color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  { key: '+90',       label: '+90 días',  color: '#dc2626', bg: 'rgba(220,38,38,0.1)'   },
];

function agingOf(vencimientoISO: string): AgingBucket {
  const dias = diasDesde(vencimientoISO);
  if (dias < 0)  return 'corriente';
  if (dias <= 30) return '0-30';
  if (dias <= 60) return '31-60';
  if (dias <= 90) return '61-90';
  return '+90';
}

function AgingChip({ bucket }: { bucket: AgingBucket }) {
  const b = AGING_BUCKETS.find(x => x.key === bucket)!;
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: b.bg, color: b.color, whiteSpace: 'nowrap' }}>
      {b.label}
    </span>
  );
}

function SemaforoCliente({ facturas }: { facturas: Factura[] }) {
  const worst = facturas.reduce<AgingBucket>((acc, f) => {
    if (f.estado === 'pagada' || f.estado === 'anulada') return acc;
    const a = agingOf(f.vencimiento);
    const order: AgingBucket[] = ['corriente', '0-30', '31-60', '61-90', '+90'];
    return order.indexOf(a) > order.indexOf(acc) ? a : acc;
  }, 'corriente');
  const b = AGING_BUCKETS.find(x => x.key === worst)!;
  return <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: b.color, boxShadow: `0 0 6px ${b.color}80`, flexShrink: 0 }} title={b.label} />;
}

const EMPTY_FAC: Omit<Factura, 'id'> = {
  numero: '', cliente: '', concepto: '', monto: 0,
  emitida: new Date().toISOString().slice(0, 10),
  vencimiento: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  estado: 'pendiente', pagado: 0,
};
const EMPTY_PROV: Omit<FacturaProv, 'id'> = {
  numero: '', proveedor: '', concepto: '', monto: 0,
  recibida: new Date().toISOString().slice(0, 10),
  vencimiento: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  estado: 'pendiente', pagado: 0, prioridad: 'media',
};

// ── Tab 7: Cuentas por Cobrar (CxC) ──────────────────────────────────────
function CxC({ facturas, onSave }: { facturas: Factura[]; onSave: (v: Factura[]) => void }) {
  const [filtro, setFiltro]     = useState<'todas' | 'pendientes' | 'vencidas' | 'pagadas'>('todas');
  const [showModal, setShow]    = useState(false);
  const [editing, setEditing]   = useState<Factura | null>(null);
  const [form, setForm]         = useState<Omit<Factura, 'id'>>(EMPTY_FAC);
  const [search, setSearch]     = useState('');

  const saldo = (f: Factura) => f.monto - f.pagado;

  // ── Aging buckets ──────────────────────────────────────────────────────────
  const activas = facturas.filter(f => f.estado !== 'anulada');
  const pendientes = activas.filter(f => f.estado !== 'pagada');

  const bucketTotals = AGING_BUCKETS.map(b => ({
    ...b,
    total:  pendientes.filter(f => agingOf(f.vencimiento) === b.key).reduce((s, f) => s + saldo(f), 0),
    count:  pendientes.filter(f => agingOf(f.vencimiento) === b.key).length,
  }));

  const totalCxC     = pendientes.reduce((s, f) => s + saldo(f), 0);
  const totalVencido = pendientes.filter(f => agingOf(f.vencimiento) !== 'corriente').reduce((s, f) => s + saldo(f), 0);
  const totalCorriente = totalCxC - totalVencido;

  // DSO: saldo total / (total facturado últimos 90d / 90) — simplificado
  const hoy90 = new Date(TODAY.getTime() - 90 * 86400000).toISOString().slice(0, 10);
  const facturado90 = activas.filter(f => f.emitida >= hoy90).reduce((s, f) => s + f.monto, 0);
  const dso = facturado90 > 0 ? Math.round((totalCxC / (facturado90 / 90))) : null;

  // ── Semáforo por cliente ───────────────────────────────────────────────────
  const clientes = [...new Set(pendientes.map(f => f.cliente))];

  // ── Tabla filtrada ─────────────────────────────────────────────────────────
  const visible = facturas.filter(f => {
    if (search && !f.cliente.toLowerCase().includes(search.toLowerCase()) && !f.numero.toLowerCase().includes(search.toLowerCase())) return false;
    if (filtro === 'pendientes') return f.estado === 'pendiente';
    if (filtro === 'vencidas')   return f.estado === 'vencida';
    if (filtro === 'pagadas')    return f.estado === 'pagada';
    return true;
  }).sort((a, b) => {
    if (a.estado === 'pagada' && b.estado !== 'pagada') return 1;
    if (b.estado === 'pagada' && a.estado !== 'pagada') return -1;
    return new Date(a.vencimiento).getTime() - new Date(b.vencimiento).getTime();
  });

  const openNew    = () => { setEditing(null); setForm(EMPTY_FAC); setShow(true); };
  const openEdit   = (f: Factura) => { setEditing(f); setForm({ numero: f.numero, cliente: f.cliente, concepto: f.concepto, monto: f.monto, emitida: f.emitida, vencimiento: f.vencimiento, estado: f.estado, pagado: f.pagado }); setShow(true); };
  const save       = () => {
    if (!form.numero || !form.cliente || !form.monto) return;
    if (editing) onSave(facturas.map(f => f.id === editing.id ? { ...form, id: editing.id } : f));
    else         onSave([{ ...form, id: uid() }, ...facturas]);
    setShow(false);
  };
  const marcarPagada = (f: Factura) => onSave(facturas.map(x => x.id === f.id ? { ...x, estado: 'pagada', pagado: x.monto } : x));
  const eliminar     = (f: Factura) => onSave(facturas.filter(x => x.id !== f.id));

  return (
    <>
      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '14px' }}>
        {[
          { label: 'Total CxC',      val: fmt(totalCxC),       sub: `${pendientes.length} facturas abiertas`,          color: '#34d399' },
          { label: 'Vencido',        val: fmt(totalVencido),   sub: `${pendientes.filter(f => agingOf(f.vencimiento) !== 'corriente').length} facturas vencidas`, color: totalVencido > 0 ? '#f87171' : '#34d399' },
          { label: 'En plazo',       val: fmt(totalCorriente), sub: 'dentro del vencimiento',                            color: '#60a5fa' },
          { label: 'DSO',            val: dso !== null ? `${dso} días` : 'N/A', sub: 'días promedio de cobro',          color: dso && dso > 60 ? '#f87171' : dso && dso > 30 ? '#fbbf24' : '#34d399' },
        ].map(k => (
          <div key={k.label} style={{ ...G.card, padding: '15px 17px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 100% 0%, ${k.color}0e, transparent 55%)`, pointerEvents: 'none' }} />
            <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</p>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: k.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{k.val}</p>
            <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#334155' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Aging buckets ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px', marginBottom: '14px' }}>
        {bucketTotals.map(b => (
          <div key={b.key} style={{ ...G.panel, padding: '12px 14px', borderLeft: `3px solid ${b.color}`, cursor: 'pointer' }} onClick={() => setFiltro(b.key === 'corriente' ? 'pendientes' : 'vencidas')}>
            <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700, color: b.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{b.label}</p>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: b.count > 0 ? b.color : '#334155' }}>{fmt(b.total)}</p>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#475569' }}>{b.count} factura{b.count !== 1 ? 's' : ''}</p>
            {b.total > 0 && totalCxC > 0 && (
              <div style={{ marginTop: '7px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ height: '100%', width: `${(b.total / totalCxC) * 100}%`, background: b.color, borderRadius: '2px' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Semáforo por cliente + controles ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          {clientes.map(cliente => {
            const facsCli = pendientes.filter(f => f.cliente === cliente);
            const totalCli = facsCli.reduce((s, f) => s + saldo(f), 0);
            return (
              <div key={cliente} style={{ ...G.panel, padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SemaforoCliente facturas={facsCli} />
                <div>
                  <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#e2e8f0' }}>{cliente}</p>
                  <p style={{ margin: 0, fontSize: '10px', color: '#475569' }}>{facsCli.length} factura{facsCli.length !== 1 ? 's' : ''} · {fmt(totalCli)}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente / n°..." style={{ ...G.input, width: '180px', fontSize: '12px', padding: '6px 10px' }} />
          {(['todas','pendientes','vencidas','pagadas'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '7px', border: 'none', cursor: 'pointer', background: filtro === f ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)', color: filtro === f ? '#34d399' : '#475569', textTransform: 'capitalize', transition: 'all 0.15s' }}>
              {f}
            </button>
          ))}
          <button onClick={openNew} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#34d399,#059669)', color: '#fff' }}>
            + Factura
          </button>
        </div>
      </div>

      {/* ── Tabla de facturas ── */}
      <div style={{ ...G.card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                {['N° Factura','Cliente','Concepto','Emitida','Vencimiento','Monto','Cobrado','Saldo','Aging','Estado',''].map((h, i) => (
                  <th key={h+i} style={{ padding: '9px 12px', textAlign: i >= 5 ? 'right' : 'left', fontWeight: 700, fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={11} style={{ padding: '32px', textAlign: 'center', color: '#334155', fontSize: '13px' }}>Sin facturas para mostrar</td></tr>
              )}
              {visible.map((f, i) => {
                const sal = saldo(f);
                const bucket = agingOf(f.vencimiento);
                const estadoColor = f.estado === 'pagada' ? '#34d399' : f.estado === 'vencida' ? '#f87171' : '#fbbf24';
                return (
                  <tr key={f.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent', opacity: f.estado === 'anulada' ? 0.4 : 1 }}>
                    <td style={{ padding: '9px 12px', color: '#94a3b8', fontWeight: 600, fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>{f.numero}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <SemaforoCliente facturas={[f]} />
                        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{f.cliente}</span>
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#94a3b8', maxWidth: '180px' }}>
                      <p style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.concepto}</p>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{f.emitida}</td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ color: bucket === 'corriente' ? '#94a3b8' : AGING_BUCKETS.find(b => b.key === bucket)!.color, fontWeight: bucket !== 'corriente' ? 700 : 400 }}>{f.vencimiento}</span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#e2e8f0', fontWeight: 600 }}>{fmt(f.monto)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#34d399' }}>{f.pagado > 0 ? fmt(f.pagado) : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: sal > 0 ? (bucket !== 'corriente' ? '#f87171' : '#e2e8f0') : '#334155' }}>{sal > 0 ? fmt(sal) : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>{f.estado !== 'pagada' && <AgingChip bucket={bucket} />}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: `${estadoColor}18`, color: estadoColor, textTransform: 'capitalize' }}>{f.estado}</span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                        {f.estado !== 'pagada' && f.estado !== 'anulada' && (
                          <button onClick={() => marcarPagada(f)} title="Marcar como pagada" style={{ padding: '3px 8px', fontSize: '10px', fontWeight: 700, borderRadius: '5px', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', color: '#34d399', cursor: 'pointer' }}>✓ Cobrada</button>
                        )}
                        <button onClick={() => openEdit(f)} style={{ padding: '3px 7px', fontSize: '10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', cursor: 'pointer' }}>Editar</button>
                        <button onClick={() => eliminar(f)} style={{ padding: '3px 7px', fontSize: '10px', borderRadius: '5px', border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.06)', color: '#f87171', cursor: 'pointer' }}>×</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                <td colSpan={5} style={{ padding: '8px 12px', fontWeight: 700, fontSize: '11px', color: '#475569' }}>TOTAL VISIBLE ({visible.length})</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#e2e8f0' }}>{fmt(visible.reduce((s, f) => s + f.monto, 0))}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>{fmt(visible.reduce((s, f) => s + f.pagado, 0))}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#f87171' }}>{fmt(visible.reduce((s, f) => s + saldo(f), 0))}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Modal nueva/editar factura ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(4px)' }}>
          <div style={{ ...G.modal, width: '100%', maxWidth: '500px', padding: '0' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>{editing ? 'Editar factura' : 'Nueva factura CxC'}</p>
              <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={lbl}>N° Factura</label><input value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} placeholder="FAC-2026-001" style={G.input} /></div>
                <div><label style={lbl}>Cliente</label><input value={form.cliente} onChange={e => setForm({...form, cliente: e.target.value})} placeholder="Nombre del cliente" style={G.input} /></div>
              </div>
              <div><label style={lbl}>Concepto</label><input value={form.concepto} onChange={e => setForm({...form, concepto: e.target.value})} placeholder="Descripción del servicio" style={G.input} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div><label style={lbl}>Monto</label><input type="number" value={form.monto} onChange={e => setForm({...form, monto: Number(e.target.value)})} style={G.input} /></div>
                <div><label style={lbl}>Cobrado</label><input type="number" value={form.pagado} onChange={e => setForm({...form, pagado: Number(e.target.value)})} style={G.input} /></div>
                <div><label style={lbl}>Estado</label>
                  <select value={form.estado} onChange={e => setForm({...form, estado: e.target.value as Factura['estado']})} style={G.input}>
                    {(['pendiente','pagada','vencida','anulada'] as const).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={lbl}>Fecha emisión</label><input type="date" value={form.emitida} onChange={e => setForm({...form, emitida: e.target.value})} style={G.input} /></div>
                <div><label style={lbl}>Vencimiento</label><input type="date" value={form.vencimiento} onChange={e => setForm({...form, vencimiento: e.target.value})} style={G.input} /></div>
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShow(false)} style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
              <button onClick={save} style={{ padding: '7px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#34d399,#059669)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
                {editing ? 'Guardar' : 'Crear factura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Tab 8: Cuentas por Pagar (CxP) ───────────────────────────────────────
const PRIORIDAD_COLORS: Record<'alta' | 'media' | 'baja', { color: string; bg: string }> = {
  alta:  { color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
  media: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
  baja:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)'  },
};

function CxP({ provs, onSave }: { provs: FacturaProv[]; onSave: (v: FacturaProv[]) => void }) {
  const [filtro, setFiltro]   = useState<'todas' | 'pendientes' | 'vencidas' | 'pagadas'>('todas');
  const [showModal, setShow]  = useState(false);
  const [editing, setEditing] = useState<FacturaProv | null>(null);
  const [form, setForm]       = useState<Omit<FacturaProv, 'id'>>(EMPTY_PROV);
  const [search, setSearch]   = useState('');

  const saldo = (p: FacturaProv) => p.monto - p.pagado;

  const pendientes = provs.filter(p => p.estado !== 'pagada');

  const bucketTotals = AGING_BUCKETS.map(b => ({
    ...b,
    total: pendientes.filter(p => agingOf(p.vencimiento) === b.key).reduce((s, p) => s + saldo(p), 0),
    count: pendientes.filter(p => agingOf(p.vencimiento) === b.key).length,
  }));

  const totalCxP      = pendientes.reduce((s, p) => s + saldo(p), 0);
  const totalVencido  = pendientes.filter(p => agingOf(p.vencimiento) !== 'corriente').reduce((s, p) => s + saldo(p), 0);
  const totalCorriente = totalCxP - totalVencido;

  // Próximos a vencer en 15 días
  const proximos15 = pendientes.filter(p => {
    const dias = diasDesde(p.vencimiento);
    return dias >= -15 && dias <= 0;
  });
  const totalProximos = proximos15.reduce((s, p) => s + saldo(p), 0);

  // DPO simplificado
  const hoy90 = new Date(TODAY.getTime() - 90 * 86400000).toISOString().slice(0, 10);
  const compras90 = provs.filter(p => p.recibida >= hoy90).reduce((s, p) => s + p.monto, 0);
  const dpo = compras90 > 0 ? Math.round(totalCxP / (compras90 / 90)) : null;

  // Tabla filtrada + ordenada (alta prioridad vencidas primero)
  const visible = provs.filter(p => {
    if (search && !p.proveedor.toLowerCase().includes(search.toLowerCase()) && !p.numero.toLowerCase().includes(search.toLowerCase())) return false;
    if (filtro === 'pendientes') return p.estado === 'pendiente';
    if (filtro === 'vencidas')   return p.estado === 'vencida';
    if (filtro === 'pagadas')    return p.estado === 'pagada';
    return true;
  }).sort((a, b) => {
    if (a.estado === 'pagada' && b.estado !== 'pagada') return 1;
    if (b.estado === 'pagada' && a.estado !== 'pagada') return -1;
    const prioOrd = { alta: 0, media: 1, baja: 2 };
    if (prioOrd[a.prioridad] !== prioOrd[b.prioridad]) return prioOrd[a.prioridad] - prioOrd[b.prioridad];
    return new Date(a.vencimiento).getTime() - new Date(b.vencimiento).getTime();
  });

  const openNew  = () => { setEditing(null); setForm(EMPTY_PROV); setShow(true); };
  const openEdit = (p: FacturaProv) => { setEditing(p); setForm({ numero: p.numero, proveedor: p.proveedor, concepto: p.concepto, monto: p.monto, recibida: p.recibida, vencimiento: p.vencimiento, estado: p.estado, pagado: p.pagado, prioridad: p.prioridad }); setShow(true); };
  const save     = () => {
    if (!form.numero || !form.proveedor || !form.monto) return;
    if (editing) onSave(provs.map(p => p.id === editing.id ? { ...form, id: editing.id } : p));
    else         onSave([{ ...form, id: uid() }, ...provs]);
    setShow(false);
  };
  const marcarPagada = (p: FacturaProv) => onSave(provs.map(x => x.id === p.id ? { ...x, estado: 'pagada', pagado: x.monto } : x));
  const eliminar     = (p: FacturaProv) => onSave(provs.filter(x => x.id !== p.id));

  return (
    <>
      {/* ── KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '14px' }}>
        {[
          { label: 'Total CxP',        val: fmt(totalCxP),       sub: `${pendientes.length} facturas abiertas`,              color: '#f87171' },
          { label: 'Vencido',          val: fmt(totalVencido),   sub: `${pendientes.filter(p => agingOf(p.vencimiento) !== 'corriente').length} facturas vencidas`, color: totalVencido > 0 ? '#dc2626' : '#34d399' },
          { label: 'Vence en 15 días', val: fmt(totalProximos),  sub: `${proximos15.length} facturas por vencer`,             color: '#fbbf24' },
          { label: 'DPO',              val: dpo !== null ? `${dpo} días` : 'N/A', sub: 'días promedio de pago',               color: dpo && dpo > 60 ? '#34d399' : dpo && dpo > 30 ? '#fbbf24' : '#60a5fa' },
        ].map(k => (
          <div key={k.label} style={{ ...G.card, padding: '15px 17px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 100% 0%, ${k.color}0e, transparent 55%)`, pointerEvents: 'none' }} />
            <p style={{ margin: '0 0 8px', fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</p>
            <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: k.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{k.val}</p>
            <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#334155' }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Aging buckets ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px', marginBottom: '14px' }}>
        {bucketTotals.map(b => (
          <div key={b.key} style={{ ...G.panel, padding: '12px 14px', borderLeft: `3px solid ${b.color}`, cursor: 'pointer' }} onClick={() => setFiltro(b.key === 'corriente' ? 'pendientes' : 'vencidas')}>
            <p style={{ margin: '0 0 6px', fontSize: '10px', fontWeight: 700, color: b.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{b.label}</p>
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: b.count > 0 ? b.color : '#334155' }}>{fmt(b.total)}</p>
            <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#475569' }}>{b.count} factura{b.count !== 1 ? 's' : ''}</p>
            {b.total > 0 && totalCxP > 0 && (
              <div style={{ marginTop: '7px', height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)' }}>
                <div style={{ height: '100%', width: `${(b.total / totalCxP) * 100}%`, background: b.color, borderRadius: '2px' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Alertas de vencimientos próximos ── */}
      {proximos15.length > 0 && (
        <div style={{ ...G.panel, padding: '14px 18px', marginBottom: '14px', borderLeft: '3px solid #fbbf24', background: 'rgba(251,191,36,0.04)' }}>
          <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, color: '#fbbf24' }}>⚠ Próximos vencimientos — próximos 15 días</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {proximos15.map(p => {
              const diasV = -diasDesde(p.vencimiento);
              const pc = PRIORIDAD_COLORS[p.prioridad];
              return (
                <div key={p.id} style={{ ...G.panel, padding: '8px 12px', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: pc.bg, color: pc.color }}>{p.prioridad}</span>
                    <span style={{ fontSize: '10px', color: '#475569' }}>vence en {diasV}d</span>
                  </div>
                  <p style={{ margin: '0 0 2px', fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>{p.proveedor}</p>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 800, color: '#fbbf24' }}>{fmt(saldo(p))}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Controles tabla ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['todas','pendientes','vencidas','pagadas'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{ padding: '5px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '7px', border: 'none', cursor: 'pointer', background: filtro === f ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)', color: filtro === f ? '#f87171' : '#475569', textTransform: 'capitalize', transition: 'all 0.15s' }}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar proveedor / n°..." style={{ ...G.input, width: '190px', fontSize: '12px', padding: '6px 10px' }} />
          <button onClick={openNew} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '8px', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#f87171,#dc2626)', color: '#fff' }}>
            + Factura proveedor
          </button>
        </div>
      </div>

      {/* ── Tabla ── */}
      <div style={{ ...G.card, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                {['N° Doc.','Prioridad','Proveedor','Concepto','Recibida','Vencimiento','Monto','Pagado','Saldo','Aging','Estado',''].map((h, i) => (
                  <th key={h+i} style={{ padding: '9px 12px', textAlign: i >= 6 ? 'right' : 'left', fontWeight: 700, fontSize: '10px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={12} style={{ padding: '32px', textAlign: 'center', color: '#334155', fontSize: '13px' }}>Sin facturas para mostrar</td></tr>
              )}
              {visible.map((p, i) => {
                const sal = saldo(p);
                const bucket = agingOf(p.vencimiento);
                const pc = PRIORIDAD_COLORS[p.prioridad];
                const estadoColor = p.estado === 'pagada' ? '#34d399' : p.estado === 'vencida' ? '#f87171' : '#fbbf24';
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                    <td style={{ padding: '9px 12px', color: '#94a3b8', fontWeight: 600, fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'nowrap' }}>{p.numero}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: pc.bg, color: pc.color }}>{p.prioridad}</span>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#e2e8f0', fontWeight: 600 }}>{p.proveedor}</td>
                    <td style={{ padding: '9px 12px', color: '#94a3b8', maxWidth: '160px' }}>
                      <p style={{ margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.concepto}</p>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#475569', whiteSpace: 'nowrap' }}>{p.recibida}</td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ color: bucket === 'corriente' ? '#94a3b8' : AGING_BUCKETS.find(b => b.key === bucket)!.color, fontWeight: bucket !== 'corriente' ? 700 : 400 }}>{p.vencimiento}</span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#e2e8f0', fontWeight: 600 }}>{fmt(p.monto)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', color: '#34d399' }}>{p.pagado > 0 ? fmt(p.pagado) : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: sal > 0 ? (bucket !== 'corriente' ? '#f87171' : '#e2e8f0') : '#334155' }}>{sal > 0 ? fmt(sal) : '—'}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>{p.estado !== 'pagada' && <AgingChip bucket={bucket} />}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: `${estadoColor}18`, color: estadoColor, textTransform: 'capitalize' }}>{p.estado}</span>
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                        {p.estado !== 'pagada' && (
                          <button onClick={() => marcarPagada(p)} title="Marcar como pagada" style={{ padding: '3px 8px', fontSize: '10px', fontWeight: 700, borderRadius: '5px', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', color: '#34d399', cursor: 'pointer' }}>✓ Pagada</button>
                        )}
                        <button onClick={() => openEdit(p)} style={{ padding: '3px 7px', fontSize: '10px', borderRadius: '5px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', cursor: 'pointer' }}>Editar</button>
                        <button onClick={() => eliminar(p)} style={{ padding: '3px 7px', fontSize: '10px', borderRadius: '5px', border: '1px solid rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.06)', color: '#f87171', cursor: 'pointer' }}>×</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                <td colSpan={6} style={{ padding: '8px 12px', fontWeight: 700, fontSize: '11px', color: '#475569' }}>TOTAL VISIBLE ({visible.length})</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#e2e8f0' }}>{fmt(visible.reduce((s, p) => s + p.monto, 0))}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#34d399' }}>{fmt(visible.reduce((s, p) => s + p.pagado, 0))}</td>
                <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#f87171' }}>{fmt(visible.reduce((s, p) => s + saldo(p), 0))}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Modal nueva/editar factura proveedor ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(4px)' }}>
          <div style={{ ...G.modal, width: '100%', maxWidth: '500px', padding: '0' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>{editing ? 'Editar factura proveedor' : 'Nueva factura CxP'}</p>
              <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={lbl}>N° Documento</label><input value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} placeholder="PROV-001" style={G.input} /></div>
                <div><label style={lbl}>Proveedor</label><input value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})} placeholder="Nombre del proveedor" style={G.input} /></div>
              </div>
              <div><label style={lbl}>Concepto</label><input value={form.concepto} onChange={e => setForm({...form, concepto: e.target.value})} placeholder="Descripción del gasto" style={G.input} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div><label style={lbl}>Monto</label><input type="number" value={form.monto} onChange={e => setForm({...form, monto: Number(e.target.value)})} style={G.input} /></div>
                <div><label style={lbl}>Pagado</label><input type="number" value={form.pagado} onChange={e => setForm({...form, pagado: Number(e.target.value)})} style={G.input} /></div>
                <div><label style={lbl}>Prioridad</label>
                  <select value={form.prioridad} onChange={e => setForm({...form, prioridad: e.target.value as FacturaProv['prioridad']})} style={G.input}>
                    {(['alta','media','baja'] as const).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div><label style={lbl}>Recibida</label><input type="date" value={form.recibida} onChange={e => setForm({...form, recibida: e.target.value})} style={G.input} /></div>
                <div><label style={lbl}>Vencimiento</label><input type="date" value={form.vencimiento} onChange={e => setForm({...form, vencimiento: e.target.value})} style={G.input} /></div>
                <div><label style={lbl}>Estado</label>
                  <select value={form.estado} onChange={e => setForm({...form, estado: e.target.value as FacturaProv['estado']})} style={G.input}>
                    {(['pendiente','pagada','vencida'] as const).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setShow(false)} style={{ padding: '7px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
              <button onClick={save} style={{ padding: '7px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg,#f87171,#dc2626)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13px' }}>
                {editing ? 'Guardar' : 'Registrar factura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
