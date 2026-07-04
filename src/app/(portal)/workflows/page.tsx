'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  type Area, type ProcType, type Proceso,
  AREAS, TIPOS, loadProcesos, saveProcesos,
} from '@/lib/workflow-data';

/* ─── helpers ───────────────────────────────────────────────────────────────── */
let _uid = Date.now();
const uid = () => `p${_uid++}`;

function pct(pasos: Proceso['pasos'], tipo: 'automatizado' | 'manual' | 'decision') {
  if (!pasos.length) return 0;
  return Math.round((pasos.filter(s => s.tipo === tipo).length / pasos.length) * 100);
}

/* ─── shared styles ─────────────────────────────────────────────────────────── */
const inputSt: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '7px', padding: '7px 11px', color: '#e2e8f0',
  fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box',
};
const labelSt: React.CSSProperties = { fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '5px' };

/* ─── Component ─────────────────────────────────────────────────────────────── */
export default function WorkflowsPage() {
  const router = useRouter();
  const [procesos, setProcesos] = useState<Proceso[]>([]);
  const [areaFilter, setAreaFilter] = useState<Area | ''>('');
  const [search, setSearch]         = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // form state for new process
  const [form, setForm] = useState<Omit<Proceso, 'id' | 'pasos' | 'hasWorkflow'>>({
    nombre: '', desc: '', area: 'operacion', tipo: 'sop',
    responsable: '', sla: '', estado: 'borrador',
  });

  useEffect(() => { setProcesos(loadProcesos()); }, []);

  const filtered = procesos.filter(p => {
    const q = search.trim().toLowerCase();
    return (!areaFilter || p.area === areaFilter)
      && (!q || p.nombre.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
  });

  /* group by area for display */
  const byArea = Object.keys(AREAS).reduce<Record<string, Proceso[]>>((acc, a) => {
    const items = filtered.filter(p => p.area === a);
    if (items.length) acc[a] = items;
    return acc;
  }, {});

  const handleCreate = () => {
    if (!form.nombre.trim()) return;
    const nuevo: Proceso = { ...form, id: uid(), pasos: [], hasWorkflow: false };
    const updated = [...procesos, nuevo];
    setProcesos(updated);
    saveProcesos(updated);
    setShowCreate(false);
    setForm({ nombre: '', desc: '', area: 'operacion', tipo: 'sop', responsable: '', sla: '', estado: 'borrador' });
    router.push(`/workflows/${nuevo.id}`);
  };

  const totalAuto = procesos.filter(p => p.hasWorkflow).length;
  const areas     = Object.keys(AREAS) as Area[];

  return (
    <div style={{ minHeight: 'calc(100vh - 52px)', background: '#070716', padding: '5px 20px 20px' }}>

      {/* ── Filter + action row ── */}
      <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Search */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth={2}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar proceso..."
              style={{ ...inputSt, paddingLeft: '30px', width: '200px', fontSize: '12px', padding: '6px 10px 6px 30px' }}
            />
          </div>

          {/* Area pills */}
          <button
            onClick={() => setAreaFilter('')}
            style={{ padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${!areaFilter ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.07)'}`, background: !areaFilter ? 'rgba(255,255,255,0.1)' : 'transparent', color: !areaFilter ? '#f1f5f9' : '#64748b' }}
          >
            Todas
          </button>
          {areas.map(a => {
            const ar = AREAS[a];
            const active = areaFilter === a;
            return (
              <button
                key={a}
                onClick={() => setAreaFilter(active ? '' : a)}
                style={{ padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: `1px solid ${active ? ar.border : 'rgba(255,255,255,0.07)'}`, background: active ? ar.bg : 'transparent', color: active ? ar.color : '#64748b', transition: 'all 0.15s' }}
              >
                {ar.label}
              </button>
            );
          })}
          <button
            onClick={() => setShowCreate(true)}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: '9px', padding: '8px 16px', color: 'white', fontSize: '13px', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nuevo Proceso
          </button>
      </div>

      {/* ── Process groups ── */}
      {Object.entries(byArea).map(([area, items]) => {
        const ar = AREAS[area as Area];
        return (
          <div key={area} style={{ marginBottom: '32px' }}>
            {/* Area header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ar.color, boxShadow: `0 0 6px ${ar.color}` }} />
              <h2 style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: ar.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{ar.label}</h2>
              <span style={{ fontSize: '11px', color: '#334155', marginLeft: '4px' }}>{items.length} proceso{items.length !== 1 ? 's' : ''}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
              {items.map(p => <ProcessCard key={p.id} p={p} onClick={() => router.push(`/workflows/${p.id}`)} />)}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#334155' }}>
          <p style={{ fontSize: '14px' }}>No hay procesos que coincidan</p>
        </div>
      )}

      {/* ── Create modal ── */}
      {showCreate && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
        >
          <div style={{ background: 'rgba(10,10,28,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '28px', width: '500px', maxWidth: '95vw', boxShadow: '0 32px 80px rgba(0,0,0,0.7)', backdropFilter: 'blur(24px)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#f1f5f9' }}>Nuevo Proceso</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelSt}>Nombre del proceso *</label>
                <input style={inputSt} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Revisión de propuestas" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelSt}>Descripción</label>
                <textarea rows={2} style={{ ...inputSt, resize: 'vertical' }} value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="Describe el objetivo del proceso..." />
              </div>
              <div>
                <label style={labelSt}>Área</label>
                <select style={inputSt} value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value as Area }))}>
                  {(Object.keys(AREAS) as Area[]).map(a => <option key={a} value={a}>{AREAS[a].label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Tipo</label>
                <select style={inputSt} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as ProcType }))}>
                  {(Object.keys(TIPOS) as ProcType[]).map(t => <option key={t} value={t}>{TIPOS[t]}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Responsable</label>
                <input style={inputSt} value={form.responsable} onChange={e => setForm(f => ({ ...f, responsable: e.target.value }))} placeholder="Equipo o persona" />
              </div>
              <div>
                <label style={labelSt}>SLA</label>
                <input style={inputSt} value={form.sla} onChange={e => setForm(f => ({ ...f, sla: e.target.value }))} placeholder="Ej: 24 horas" />
              </div>
              <div>
                <label style={labelSt}>Estado</label>
                <select style={inputSt} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value as 'activo' | 'borrador' }))}>
                  <option value="borrador">Borrador</option>
                  <option value="activo">Activo</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '8px 18px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#64748b', fontSize: '13px', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={!form.nombre.trim()} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: form.nombre.trim() ? 'linear-gradient(135deg,#f97316,#ea580c)' : 'rgba(255,255,255,0.06)', color: form.nombre.trim() ? 'white' : '#334155', fontSize: '13px', fontWeight: 700, cursor: form.nombre.trim() ? 'pointer' : 'default' }}>
                Crear y Editar →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Process card ──────────────────────────────────────────────────────────── */
function ProcessCard({ p, onClick }: { p: Proceso; onClick: () => void }) {
  const ar = AREAS[p.area];
  const autoCount = p.pasos.filter(s => s.tipo === 'automatizado').length;
  const autoRatio = p.pasos.length ? autoCount / p.pasos.length : 0;

  return (
    <div
      onClick={onClick}
      style={{ borderRadius: '14px', padding: '16px', background: 'rgba(11,11,27,0.9)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = ar.border;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px ${ar.border}`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: ar.bg, color: ar.color, border: `1px solid ${ar.border}` }}>
            {ar.label}
          </span>
          <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}>
            {TIPOS[p.tipo]}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          {p.hasWorkflow && (
            <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.25)', letterSpacing: '0.04em' }}>⚡ AUTO</span>
          )}
          <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: p.estado === 'activo' ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)', color: p.estado === 'activo' ? '#34d399' : '#475569', border: `1px solid ${p.estado === 'activo' ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.07)'}` }}>
            {p.estado === 'activo' ? 'Activo' : 'Borrador'}
          </span>
        </div>
      </div>

      {/* Name */}
      <h3 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3 }}>{p.nombre}</h3>
      <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#475569', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.desc}</p>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: '14px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: '#475569' }}>👤 {p.responsable || '—'}</span>
        {p.sla && <span style={{ fontSize: '11px', color: '#475569' }}>⏱ {p.sla}</span>}
        <span style={{ fontSize: '11px', color: '#475569' }}>{p.pasos.length} pasos</span>
      </div>

      {/* Steps breakdown bar */}
      {p.pasos.length > 0 && (
        <div>
          <div style={{ display: 'flex', borderRadius: '4px', overflow: 'hidden', height: '4px', marginBottom: '6px' }}>
            {p.pasos.map(s => (
              <div key={s.id} style={{ flex: 1, background: s.tipo === 'automatizado' ? '#60a5fa' : s.tipo === 'decision' ? '#fbbf24' : 'rgba(255,255,255,0.1)', marginRight: '1px' }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {['automatizado', 'manual', 'decision'].map(tipo => {
              const count = p.pasos.filter(s => s.tipo === tipo).length;
              if (!count) return null;
              const colors: Record<string, string> = { automatizado: '#60a5fa', manual: '#64748b', decision: '#fbbf24' };
              const labels: Record<string, string> = { automatizado: 'Auto', manual: 'Manual', decision: 'Decisión' };
              return (
                <span key={tipo} style={{ fontSize: '10px', color: colors[tipo] }}>{count} {labels[tipo]}</span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
