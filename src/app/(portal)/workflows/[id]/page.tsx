'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  type Area, type ProcType, type StepTipo, type Proceso, type ProcStep,
  AREAS, TIPOS, STEP_META, loadProcesos, saveProcesos,
} from '@/lib/workflow-data';

/* ══════════════════════════════════════════════════════════════════════════════
   CANVAS TYPES & CONSTANTS
══════════════════════════════════════════════════════════════════════════════ */
type NodeCat = 'trigger' | 'source' | 'transform' | 'condition' | 'action' | 'output';

interface NodeTemplate { id: string; label: string; cat: NodeCat; color: string; bg: string; desc: string; hasInput: boolean; outs: string[]; }
interface WFNode { id: string; tpl: string; label: string; x: number; y: number; }
interface WFEdge { id: string; fromId: string; fromPort: string; toId: string; }

const NW = 200, NH = 80;

const TEMPLATES: NodeTemplate[] = [
  { id: 'trig-cron',    label: 'Cron Schedule', cat: 'trigger',   color: '#f97316', bg: 'rgba(249,115,22,0.10)', desc: 'Horario recurrente',     hasInput: false, outs: ['out'] },
  { id: 'trig-webhook', label: 'Webhook',        cat: 'trigger',   color: '#f97316', bg: 'rgba(249,115,22,0.10)', desc: 'Recibir petición HTTP',   hasInput: false, outs: ['out'] },
  { id: 'trig-event',   label: 'Event',          cat: 'trigger',   color: '#f97316', bg: 'rgba(249,115,22,0.10)', desc: 'Evento del sistema',      hasInput: false, outs: ['out'] },
  { id: 'src-http',     label: 'HTTP Request',   cat: 'source',    color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', desc: 'Consultar API externa',   hasInput: true,  outs: ['out'] },
  { id: 'src-db',       label: 'Query DB',       cat: 'source',    color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', desc: 'Leer de base de datos',   hasInput: true,  outs: ['out'] },
  { id: 'tr-map',       label: 'Map / Shape',    cat: 'transform', color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', desc: 'Transformar campos',     hasInput: true,  outs: ['out'] },
  { id: 'tr-filter',    label: 'Filter',         cat: 'transform', color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', desc: 'Filtrar registros',      hasInput: true,  outs: ['out'] },
  { id: 'tr-agg',       label: 'Aggregate',      cat: 'transform', color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', desc: 'Agrupar y calcular',     hasInput: true,  outs: ['out'] },
  { id: 'cond-if',      label: 'If / Else',      cat: 'condition', color: '#fbbf24', bg: 'rgba(251,191,36,0.10)', desc: 'Bifurcar por condición',  hasInput: true,  outs: ['true', 'false'] },
  { id: 'act-email',    label: 'Send Email',     cat: 'action',    color: '#34d399', bg: 'rgba(52,211,153,0.10)', desc: 'Enviar correo',           hasInput: true,  outs: ['out'] },
  { id: 'act-slack',    label: 'Slack Message',  cat: 'action',    color: '#34d399', bg: 'rgba(52,211,153,0.10)', desc: 'Mensaje en Slack',        hasInput: true,  outs: ['out'] },
  { id: 'act-http',     label: 'HTTP POST',      cat: 'action',    color: '#34d399', bg: 'rgba(52,211,153,0.10)', desc: 'Enviar datos a API',      hasInput: true,  outs: ['out'] },
  { id: 'act-code',     label: 'Run Script',     cat: 'action',    color: '#34d399', bg: 'rgba(52,211,153,0.10)', desc: 'Ejecutar código JS',      hasInput: true,  outs: ['out'] },
  { id: 'out-db',       label: 'Write to DB',    cat: 'output',    color: '#22d3ee', bg: 'rgba(34,211,238,0.10)', desc: 'Guardar en BD',           hasInput: true,  outs: [] },
  { id: 'out-file',     label: 'Export File',    cat: 'output',    color: '#22d3ee', bg: 'rgba(34,211,238,0.10)', desc: 'Exportar CSV / JSON',     hasInput: true,  outs: [] },
  { id: 'out-notif',    label: 'Notification',   cat: 'output',    color: '#22d3ee', bg: 'rgba(34,211,238,0.10)', desc: 'Enviar notificación',     hasInput: true,  outs: [] },
];

const CAT_LABELS: Record<NodeCat, string> = {
  trigger: 'Disparadores', source: 'Fuentes', transform: 'Transformación',
  condition: 'Condición', action: 'Acciones', output: 'Salida',
};

function outPortY(port: string, outs: string[]) {
  if (outs.length === 1) return NH / 2;
  return ((outs.indexOf(port) + 1) * NH) / (outs.length + 1);
}
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = Math.max(Math.abs(x2 - x1) * 0.45, 70);
  return `M${x1},${y1} C${x1 + cx},${y1} ${x2 - cx},${y2} ${x2},${y2}`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════════ */
let _uid = Date.now();
const uid = () => `n${_uid++}`;

const inputSt: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '6px', padding: '6px 10px', color: '#e2e8f0',
  fontSize: '12px', outline: 'none', width: '100%', boxSizing: 'border-box',
};
const labelSt: React.CSSProperties = { fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '5px' };

export default function ProcessDetailPage() {
  const { id } = useParams() as { id: string };
  const router  = useRouter();

  const [proceso, setProceso] = useState<Proceso | null>(null);
  const [saved,   setSaved]   = useState(false);

  /* step edit state */
  const [editMeta, setEditMeta] = useState(false);
  const [addingStep, setAddingStep]   = useState(false);
  const [newStep,    setNewStep]      = useState<Omit<ProcStep,'id'>>({ label: '', tipo: 'manual', responsable: '' });

  /* canvas state */
  const [canvasActive, setCanvasActive] = useState(false);
  const [nodes,  setNodes]  = useState<WFNode[]>([]);
  const [edges,  setEdges]  = useState<WFEdge[]>([]);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [pan,    setPan]    = useState({ x: 80, y: 60 });
  const [zoom,   setZoom]   = useState(1);
  const [panning, setPanning] = useState(false);
  const [conn,   setConn]   = useState<{ fromId: string; fromPort: string; mx: number; my: number } | null>(null);

  const canvasRef   = useRef<HTMLDivElement>(null);
  const dragNodeRef = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number } | null>(null);
  const panRef      = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  /* Load process + canvas from localStorage */
  useEffect(() => {
    const list = loadProcesos();
    const found = list.find(p => p.id === id);
    if (!found) { router.push('/workflows'); return; }
    setProceso(found);
    setCanvasActive(found.hasWorkflow);
    try {
      const raw = localStorage.getItem(`wf-canvas-${id}`);
      if (raw) { const d = JSON.parse(raw); setNodes(d.nodes ?? []); setEdges(d.edges ?? []); }
    } catch { /* empty */ }
  }, [id, router]);

  const saveAll = () => {
    if (!proceso) return;
    const list = loadProcesos().map(p => p.id === id ? proceso : p);
    saveProcesos(list);
    localStorage.setItem(`wf-canvas-${id}`, JSON.stringify({ nodes, edges }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  /* ── Process editing ── */
  const updateMeta = (patch: Partial<Proceso>) => setProceso(p => p ? { ...p, ...patch } : p);

  const addStep = () => {
    if (!newStep.label.trim()) return;
    const step: ProcStep = { ...newStep, id: uid() };
    setProceso(p => p ? { ...p, pasos: [...p.pasos, step] } : p);
    setNewStep({ label: '', tipo: 'manual', responsable: '' });
    setAddingStep(false);
  };

  const removeStep = (sid: string) => setProceso(p => p ? { ...p, pasos: p.pasos.filter(s => s.id !== sid) } : p);

  const moveStep = (sid: string, dir: -1 | 1) => {
    setProceso(p => {
      if (!p) return p;
      const idx = p.pasos.findIndex(s => s.id === sid);
      if (idx + dir < 0 || idx + dir >= p.pasos.length) return p;
      const arr = [...p.pasos];
      [arr[idx], arr[idx + dir]] = [arr[idx + dir], arr[idx]];
      return { ...p, pasos: arr };
    });
  };

  const toggleWorkflow = () => {
    const next = !canvasActive;
    setCanvasActive(next);
    setProceso(p => p ? { ...p, hasWorkflow: next } : p);
  };

  /* ── Canvas helpers ── */
  const canvasToScreen = useCallback(
    (cx: number, cy: number) => ({ x: cx * zoom + pan.x, y: cy * zoom + pan.y }),
    [pan, zoom],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const tplId = e.dataTransfer.getData('tplId');
    const tpl = TEMPLATES.find(t => t.id === tplId);
    if (!tpl || !canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - r.left - pan.x) / zoom - NW / 2;
    const y = (e.clientY - r.top  - pan.y) / zoom - NH / 2;
    setNodes(p => [...p, { id: uid(), tpl: tplId, label: tpl.label, x, y }]);
  };

  const onCanvasDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]') || (e.target as HTMLElement).closest('[data-port]')) return;
    setSelNode(null);
    panRef.current = { sx: e.clientX, sy: e.clientY, ox: pan.x, oy: pan.y };
    setPanning(true);
  };

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (panRef.current) setPan({ x: panRef.current.ox + (e.clientX - panRef.current.sx), y: panRef.current.oy + (e.clientY - panRef.current.sy) });
    if (dragNodeRef.current) {
      const dx = (e.clientX - dragNodeRef.current.sx) / zoom;
      const dy = (e.clientY - dragNodeRef.current.sy) / zoom;
      const nid = dragNodeRef.current.id;
      setNodes(p => p.map(n => n.id === nid ? { ...n, x: dragNodeRef.current!.ox + dx, y: dragNodeRef.current!.oy + dy } : n));
    }
    if (conn && canvasRef.current) {
      const r = canvasRef.current.getBoundingClientRect();
      setConn(p => p ? { ...p, mx: e.clientX - r.left, my: e.clientY - r.top } : null);
    }
  }, [zoom, conn]);

  const onMouseUp = () => { panRef.current = null; dragNodeRef.current = null; setPanning(false); if (conn) setConn(null); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const f = e.deltaY < 0 ? 1.12 : 0.9;
    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    setZoom(z => { const nz = Math.min(2.5, Math.max(0.2, z * f)); setPan(p => ({ x: mx - (mx - p.x) * nz / z, y: my - (my - p.y) * nz / z })); return nz; });
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selNode && !(e.target as HTMLElement).matches('input,textarea,select')) {
        setNodes(p => p.filter(n => n.id !== selNode));
        setEdges(p => p.filter(ed => ed.fromId !== selNode && ed.toId !== selNode));
        setSelNode(null);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selNode]);

  const startConn = (e: React.MouseEvent, fromId: string, fromPort: string) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    const r = canvasRef.current.getBoundingClientRect();
    setConn({ fromId, fromPort, mx: e.clientX - r.left, my: e.clientY - r.top });
  };

  const endConn = (e: React.MouseEvent, toId: string) => {
    e.stopPropagation();
    if (conn && conn.fromId !== toId) {
      const dup = edges.some(ed => ed.fromId === conn.fromId && ed.fromPort === conn.fromPort && ed.toId === toId);
      if (!dup) setEdges(p => [...p, { id: uid(), fromId: conn.fromId, fromPort: conn.fromPort, toId }]);
    }
    setConn(null);
  };

  const edgePaths = edges
    .map(edge => {
      const from = nodes.find(n => n.id === edge.fromId);
      const to   = nodes.find(n => n.id === edge.toId);
      if (!from || !to) return null;
      const ft = TEMPLATES.find(t => t.id === from.tpl)!;
      const py = outPortY(edge.fromPort, ft.outs);
      const fs = canvasToScreen(from.x + NW, from.y + py);
      const ts = canvasToScreen(to.x,        to.y + NH / 2);
      return { ...edge, path: bezier(fs.x, fs.y, ts.x, ts.y), color: ft.color };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  let pendingPath: string | null = null;
  if (conn) {
    const from = nodes.find(n => n.id === conn.fromId);
    if (from) {
      const ft = TEMPLATES.find(t => t.id === from.tpl)!;
      const py = outPortY(conn.fromPort, ft.outs);
      const fs = canvasToScreen(from.x + NW, from.y + py);
      pendingPath = bezier(fs.x, fs.y, conn.mx, conn.my);
    }
  }

  if (!proceso) return null;

  const ar = AREAS[proceso.area];
  const cats = [...new Set(TEMPLATES.map(t => t.cat))] as NodeCat[];
  const autoCount = proceso.pasos.filter(s => s.tipo === 'automatizado').length;

  return (
    <div style={{ height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-inter), Inter, sans-serif', background: '#070716' }}>

      {/* ── TOP BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(8,8,26,0.98)', flexShrink: 0 }}>
        <button onClick={() => router.push('/workflows')} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', padding: '5px 10px', color: '#64748b', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
          ← Procesos
        </button>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ar.color, boxShadow: `0 0 6px ${ar.color}`, flexShrink: 0 }} />
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proceso.nombre}</span>
        <span style={{ fontSize: '11px', color: '#475569', flexShrink: 0 }}>{proceso.pasos.length} pasos · {autoCount} automáticos</span>
        <button
          onClick={saveAll}
          style={{ background: saved ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${saved ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '8px', padding: '6px 14px', color: saved ? '#34d399' : '#94a3b8', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 }}
        >
          {saved ? '✓ Guardado' : 'Guardar'}
        </button>
        {canvasActive && (
          <button style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none', borderRadius: '8px', padding: '6px 14px', color: 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            Ejecutar
          </button>
        )}
      </div>

      {/* ── BODY ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT PANEL: Process definition ── */}
        <aside style={{ width: '320px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', background: 'rgba(8,8,26,0.98)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>

          {/* Metadata section */}
          <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Definición del Proceso</p>
              <button onClick={() => setEditMeta(!editMeta)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '3px 8px', color: '#64748b', fontSize: '10px', cursor: 'pointer' }}>
                {editMeta ? 'Cerrar' : 'Editar'}
              </button>
            </div>

            {editMeta ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div><label style={labelSt}>Nombre</label><input style={inputSt} value={proceso.nombre} onChange={e => updateMeta({ nombre: e.target.value })} /></div>
                <div><label style={labelSt}>Descripción</label><textarea rows={2} style={{ ...inputSt, resize: 'vertical' }} value={proceso.desc} onChange={e => updateMeta({ desc: e.target.value })} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div><label style={labelSt}>Área</label>
                    <select style={inputSt} value={proceso.area} onChange={e => updateMeta({ area: e.target.value as Area })}>
                      {(Object.keys(AREAS) as Area[]).map(a => <option key={a} value={a}>{AREAS[a].label}</option>)}
                    </select>
                  </div>
                  <div><label style={labelSt}>Tipo</label>
                    <select style={inputSt} value={proceso.tipo} onChange={e => updateMeta({ tipo: e.target.value as ProcType })}>
                      {(Object.keys(TIPOS) as ProcType[]).map(t => <option key={t} value={t}>{TIPOS[t]}</option>)}
                    </select>
                  </div>
                  <div><label style={labelSt}>Responsable</label><input style={inputSt} value={proceso.responsable} onChange={e => updateMeta({ responsable: e.target.value })} /></div>
                  <div><label style={labelSt}>SLA</label><input style={inputSt} value={proceso.sla} onChange={e => updateMeta({ sla: e.target.value })} placeholder="Ej: 24 horas" /></div>
                </div>
                <div><label style={labelSt}>Estado</label>
                  <select style={inputSt} value={proceso.estado} onChange={e => updateMeta({ estado: e.target.value as 'activo' | 'borrador' })}>
                    <option value="borrador">Borrador</option><option value="activo">Activo</option>
                  </select>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>{proceso.desc || <span style={{ color: '#334155' }}>Sin descripción</span>}</p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: ar.bg, color: ar.color, border: `1px solid ${ar.border}` }}>{ar.label}</span>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', color: '#64748b', border: '1px solid rgba(255,255,255,0.07)' }}>{TIPOS[proceso.tipo]}</span>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: proceso.estado === 'activo' ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)', color: proceso.estado === 'activo' ? '#34d399' : '#475569', border: `1px solid ${proceso.estado === 'activo' ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.07)'}` }}>{proceso.estado === 'activo' ? 'Activo' : 'Borrador'}</span>
                </div>
                {(proceso.responsable || proceso.sla) && (
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {proceso.responsable && <span style={{ fontSize: '11px', color: '#475569' }}>👤 {proceso.responsable}</span>}
                    {proceso.sla         && <span style={{ fontSize: '11px', color: '#475569' }}>⏱ {proceso.sla}</span>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Steps section */}
          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pasos del Proceso</p>
              <button onClick={() => setAddingStep(!addingStep)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '3px 8px', color: '#64748b', fontSize: '10px', cursor: 'pointer' }}>
                + Agregar
              </button>
            </div>

            {/* Add step form */}
            {addingStep && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px', marginBottom: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <input style={inputSt} placeholder="Descripción del paso" value={newStep.label} onChange={e => setNewStep(s => ({ ...s, label: e.target.value }))} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <select style={inputSt} value={newStep.tipo} onChange={e => setNewStep(s => ({ ...s, tipo: e.target.value as StepTipo }))}>
                    <option value="manual">Manual</option>
                    <option value="automatizado">Automatizado</option>
                    <option value="decision">Decisión</option>
                  </select>
                  <input style={inputSt} placeholder="Responsable" value={newStep.responsable} onChange={e => setNewStep(s => ({ ...s, responsable: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setAddingStep(false)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '4px 10px', color: '#64748b', fontSize: '11px', cursor: 'pointer' }}>Cancelar</button>
                  <button onClick={addStep} disabled={!newStep.label.trim()} style={{ background: '#f97316', border: 'none', borderRadius: '6px', padding: '4px 12px', color: 'white', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>Agregar</button>
                </div>
              </div>
            )}

            {/* Steps list */}
            {proceso.pasos.length === 0 && !addingStep && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#334155' }}>
                <p style={{ margin: 0, fontSize: '12px' }}>Sin pasos definidos</p>
                <p style={{ margin: '4px 0 0', fontSize: '11px' }}>Agregá el primer paso del proceso</p>
              </div>
            )}

            {proceso.pasos.map((step, idx) => {
              const sm = STEP_META[step.tipo];
              return (
                <div
                  key={step.id}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  {/* Number + connector */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: sm.bg, border: `1.5px solid ${sm.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: sm.color }}>
                      {idx + 1}
                    </div>
                    {idx < proceso.pasos.length - 1 && (
                      <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.06)', margin: '2px 0' }} />
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.3 }}>{step.label}</p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '20px', background: sm.bg, color: sm.color, border: `1px solid ${sm.color}30` }}>{sm.label}</span>
                      {step.responsable && <span style={{ fontSize: '10px', color: '#475569' }}>{step.responsable}</span>}
                    </div>
                  </div>

                  {/* Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
                    <button onClick={() => moveStep(step.id, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', color: idx === 0 ? '#1e293b' : '#475569', cursor: idx === 0 ? 'default' : 'pointer', fontSize: '10px', padding: '1px 4px', lineHeight: 1 }}>▲</button>
                    <button onClick={() => moveStep(step.id, 1)} disabled={idx === proceso.pasos.length - 1} style={{ background: 'none', border: 'none', color: idx === proceso.pasos.length - 1 ? '#1e293b' : '#475569', cursor: idx === proceso.pasos.length - 1 ? 'default' : 'pointer', fontSize: '10px', padding: '1px 4px', lineHeight: 1 }}>▼</button>
                    <button onClick={() => removeStep(step.id)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '12px', padding: '1px 4px', lineHeight: 1 }}>×</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Automation toggle */}
          <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: canvasActive ? '#f97316' : '#475569' }}>⚡ Automatización</p>
              <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#334155' }}>{canvasActive ? `${nodes.length} nodos configurados` : 'Sin workflow vinculado'}</p>
            </div>
            <button
              onClick={toggleWorkflow}
              style={{ position: 'relative', width: '40px', height: '22px', borderRadius: '11px', border: 'none', background: canvasActive ? '#f97316' : 'rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
            >
              <div style={{ position: 'absolute', top: '3px', left: canvasActive ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
            </button>
          </div>
        </aside>

        {/* ── RIGHT PANEL: Workflow canvas ── */}
        {canvasActive ? (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

            {/* Palette (mini) */}
            <div style={{ width: '180px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)', background: 'rgba(8,8,26,0.95)', overflowY: 'auto', padding: '8px' }}>
              <p style={{ margin: '4px 4px 8px', fontSize: '9px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Paleta</p>
              {cats.map(cat => (
                <div key={cat} style={{ marginBottom: '8px' }}>
                  <p style={{ margin: '0 0 3px 4px', fontSize: '8px', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{CAT_LABELS[cat]}</p>
                  {TEMPLATES.filter(t => t.cat === cat).map(tpl => (
                    <div
                      key={tpl.id}
                      draggable
                      onDragStart={e => e.dataTransfer.setData('tplId', tpl.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '6px', marginBottom: '2px', border: `1px solid ${tpl.color}20`, background: tpl.bg, cursor: 'grab', userSelect: 'none' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = tpl.color + '20'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = tpl.bg}
                    >
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: tpl.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.label}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Canvas */}
            <div
              ref={canvasRef}
              style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#060614', cursor: panning ? 'grabbing' : conn ? 'crosshair' : 'default' }}
              onMouseDown={onCanvasDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onWheel={onWheel}
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
            >
              {/* Grid */}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                <defs>
                  <pattern id="wf-grid-d" x={pan.x % (24 * zoom)} y={pan.y % (24 * zoom)} width={24 * zoom} height={24 * zoom} patternUnits="userSpaceOnUse">
                    <circle cx={1} cy={1} r={0.9} fill="rgba(255,255,255,0.07)" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#wf-grid-d)" />
              </svg>

              {/* Edges */}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
                {edgePaths.map(ep => (
                  <g key={ep.id}>
                    <path d={ep.path} stroke={ep.color} strokeWidth={8}   fill="none" opacity={0.12} strokeLinecap="round" />
                    <path d={ep.path} stroke={ep.color} strokeWidth={2.5} fill="none" opacity={0.8}  strokeLinecap="round" />
                  </g>
                ))}
                {pendingPath && <path d={pendingPath} stroke="rgba(255,255,255,0.4)" strokeWidth={2} fill="none" strokeDasharray="6 4" strokeLinecap="round" />}
              </svg>

              {/* Nodes */}
              {nodes.map(node => {
                const tpl  = TEMPLATES.find(t => t.id === node.tpl)!;
                const sx   = node.x * zoom + pan.x;
                const sy   = node.y * zoom + pan.y;
                const isSel = selNode === node.id;
                const w = NW * zoom, h = NH * zoom, r = 10 * zoom;
                return (
                  <div
                    key={node.id}
                    data-node
                    onMouseDown={e => { e.stopPropagation(); setSelNode(node.id); dragNodeRef.current = { id: node.id, sx: e.clientX, sy: e.clientY, ox: node.x, oy: node.y }; }}
                    style={{ position: 'absolute', left: sx, top: sy, width: w, height: h, cursor: 'grab', zIndex: isSel ? 10 : 1, userSelect: 'none' }}
                  >
                    {tpl.hasInput && (
                      <div data-port onMouseUp={e => endConn(e, node.id)} style={{ position: 'absolute', left: -6 * zoom, top: (NH / 2 - 6) * zoom, width: 12 * zoom, height: 12 * zoom, borderRadius: '50%', background: '#0d0d1f', border: `2px solid ${tpl.color}`, cursor: conn ? 'cell' : 'default', pointerEvents: 'all', zIndex: 20 }} />
                    )}
                    <div style={{ width: '100%', height: '100%', borderRadius: r, background: 'rgba(11,11,27,0.97)', border: `${isSel ? 1.5 : 1}px solid ${isSel ? tpl.color : 'rgba(255,255,255,0.09)'}`, boxShadow: isSel ? `0 0 0 2px ${tpl.color}28, 0 8px 32px rgba(0,0,0,0.7)` : '0 4px 20px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
                      <div style={{ height: 22 * zoom, background: tpl.bg, borderBottom: `1px solid ${tpl.color}22`, display: 'flex', alignItems: 'center', paddingLeft: 10 * zoom, gap: 6 * zoom }}>
                        <div style={{ width: 6 * zoom, height: 6 * zoom, borderRadius: '50%', background: tpl.color }} />
                        <span style={{ fontSize: 8.5 * zoom, fontWeight: 700, color: tpl.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{CAT_LABELS[tpl.cat]}</span>
                      </div>
                      <div style={{ padding: `${7 * zoom}px ${10 * zoom}px` }}>
                        <p style={{ margin: 0, fontSize: 11.5 * zoom, fontWeight: 600, color: '#e2e8f0' }}>{node.label}</p>
                        <p style={{ margin: `${2 * zoom}px 0 0`, fontSize: 9.5 * zoom, color: '#475569' }}>{tpl.desc}</p>
                      </div>
                    </div>
                    {tpl.outs.map(portName => {
                      const py = outPortY(portName, tpl.outs);
                      return (
                        <div key={portName} data-port onMouseDown={e => startConn(e, node.id, portName)} style={{ position: 'absolute', right: -6 * zoom, top: (py - 6) * zoom, width: 12 * zoom, height: 12 * zoom, borderRadius: '50%', background: tpl.color, border: '2px solid rgba(0,0,0,0.4)', cursor: 'crosshair', pointerEvents: 'all', zIndex: 20, boxShadow: `0 0 7px ${tpl.color}80` }} />
                      );
                    })}
                    {tpl.outs.length === 2 && tpl.outs.map(portName => {
                      const py = outPortY(portName, tpl.outs);
                      return <div key={`lbl-${portName}`} style={{ position: 'absolute', right: 16 * zoom, top: (py - 8) * zoom, fontSize: 8.5 * zoom, fontWeight: 700, color: portName === 'true' ? '#22c55e' : '#f87171', pointerEvents: 'none' }}>{portName.toUpperCase()}</div>;
                    })}
                  </div>
                );
              })}

              {/* Empty state */}
              {nodes.length === 0 && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: '12px' }}>
                  <svg width="48" height="48" viewBox="0 0 60 60" fill="none">
                    <rect x="4" y="22" width="18" height="16" rx="4" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
                    <rect x="38" y="22" width="18" height="16" rx="4" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
                    <line x1="22" y1="30" x2="38" y2="30" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeDasharray="3 3"/>
                  </svg>
                  <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: '12px', margin: 0, textAlign: 'center' }}>
                    Arrastrá nodos desde la paleta<br />para definir la automatización
                  </p>
                </div>
              )}

              {/* Toolbar */}
              <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: '8px', alignItems: 'center' }}>
                {selNode && (
                  <button onClick={() => { setNodes(p => p.filter(n => n.id !== selNode)); setEdges(p => p.filter(ed => ed.fromId !== selNode && ed.toId !== selNode)); setSelNode(null); }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '7px', padding: '4px 10px', color: '#f87171', fontSize: '11px', cursor: 'pointer' }}>
                    Eliminar nodo
                  </button>
                )}
                <div style={{ background: 'rgba(8,8,26,0.92)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', padding: '3px 8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button onClick={() => setZoom(z => Math.min(2.5, z * 1.2))} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}>+</button>
                  <span style={{ fontSize: '10px', color: '#475569', minWidth: '32px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.max(0.2, z * 0.85))} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}>−</button>
                </div>
              </div>

              {nodes.length > 0 && (
                <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(8,8,26,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '7px', padding: '4px 10px', display: 'flex', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: '#475569' }}>{nodes.length} nodos</span>
                  <span style={{ fontSize: '10px', color: '#1e293b' }}>·</span>
                  <span style={{ fontSize: '10px', color: '#475569' }}>{edges.length} conexiones</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* No workflow state */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: '#060614' }}>
            <svg width="64" height="64" viewBox="0 0 60 60" fill="none">
              <rect x="4" y="22" width="18" height="16" rx="4" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5"/>
              <rect x="38" y="22" width="18" height="16" rx="4" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5"/>
              <line x1="22" y1="30" x2="38" y2="30" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeDasharray="4 3"/>
            </svg>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.2)' }}>Sin automatización vinculada</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.1)' }}>Activá el toggle "Automatización" en el panel izquierdo para construir el workflow</p>
            </div>
            <button onClick={toggleWorkflow} style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '10px', padding: '10px 20px', color: '#f97316', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              ⚡ Activar Automatización
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
