'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/* ─── Types ──────────────────────────────────────────────────────── */
interface AgentInfo { id: string; name: string; area: string; port: number; color: string; status: 'online'|'offline'|'degraded'|'loading'; latency: number|null; }
interface Trace { id: number; run_id: string; ts: number; sender: string; recipient: string; message: string; pattern: string|null; phase: string|null; }
interface PendingAction { id: number; ts: number; trigger_id: string; task: string; pattern: string; agents: string[]; status: string; }
interface TriggerDef { id: string; label: string; cron: string; task: string; pattern: string; agents: string[]; }
type Pattern = 'solo'|'debate'|'pipeline'|'auto';

const PAGE_SIZE = 12;

/* ─── Agent identity ─────────────────────────────────────────────── */
const AGENT_META: Record<string, { color: string; area: string; icon: string }> = {
  orion: { color: '#7F77DD', area: 'Admin',      icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  ares:  { color: '#E2562A', area: 'Sales',      icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
  atlas: { color: '#1D9375', area: 'Operations', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  vesta: { color: '#C0655A', area: 'Finance',    icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  iris:  { color: '#3A9E42', area: 'Marketing',  icon: 'M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z' },
};

const PATTERN_INFO: Record<Pattern, { label: string; desc: string; icon: string }> = {
  solo:     { label: 'Solo',     desc: 'Un agente ejecuta la tarea',                  icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  debate:   { label: 'Debate',   desc: 'Múltiples agentes debaten y Orion sintetiza', icon: 'M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2V6a2 2 0 012-2h8z' },
  pipeline: { label: 'Pipeline', desc: 'Los agentes se pasan el resultado en cadena', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  auto:     { label: 'Auto',     desc: 'Orion clasifica la tarea y elige el patrón',  icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z' },
};

const PHASE_LABELS: Record<string, string> = { dispatch:'Dispatch', response:'Respuesta', round1:'Ronda 1', round2:'Ronda 2', synthesis:'Síntesis', classify:'Clasificación' };
const PHASE_COLORS: Record<string, string> = { dispatch:'#3d4e62', response:'#1D9375', round1:'#7F77DD', round2:'#C0655A', synthesis:'#E2562A', classify:'#9b96e8' };

/* ─── Helpers ────────────────────────────────────────────────────── */
function timeAgo(ts: number) { const s=Math.floor(Date.now()/1000-ts); if(s<60) return `${s}s`; if(s<3600) return `${Math.floor(s/60)}m`; return `${Math.floor(s/3600)}h`; }

/* ─── AgentAvatar ────────────────────────────────────────────────── */
function AgentAvatar({ id, size=28 }: { id: string; size?: number }) {
  const m = AGENT_META[id] || { color:'#9aa6b8', icon:'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0' };
  return (
    <div style={{ width:size, height:size, borderRadius:size*0.28, flexShrink:0, background:`${m.color}1a`, border:`1.5px solid ${m.color}40`, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <svg width={size*0.52} height={size*0.52} viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={m.icon}/></svg>
    </div>
  );
}

/* ─── RunDivider ─────────────────────────────────────────────────── */
function RunDivider({ pattern, ts }: { pattern: string|null; ts: number }) {
  const label = pattern ? (PATTERN_INFO[pattern as Pattern]?.label || pattern) : 'Tarea';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, margin:'4px 0 2px' }}>
      <div style={{ flex:1, height:1, background:'rgba(40,50,70,0.4)' }}/>
      <span style={{ fontSize:9, fontWeight:700, color:'#3d4e62', padding:'3px 10px', borderRadius:20, background:'rgba(16,22,32,0.9)', border:'1px solid rgba(40,50,70,0.35)', textTransform:'uppercase', letterSpacing:0.8, userSelect:'none' }}>
        {label} · {timeAgo(ts)}
      </span>
      <div style={{ flex:1, height:1, background:'rgba(40,50,70,0.4)' }}/>
    </div>
  );
}

/* ─── TraceBubble ────────────────────────────────────────────────── */
function TraceBubble({ trace }: { trace: Trace }) {
  const [exp, setExp] = useState(false);
  const m = AGENT_META[trace.sender] || { color:'#9aa6b8', area:'', icon:'' };
  const rm = AGENT_META[trace.recipient];
  const isSystem = trace.phase === 'dispatch' || trace.phase === 'classify';
  const PREVIEW = 220;
  const long = trace.message.length > PREVIEW;
  const text = !long || exp ? trace.message : trace.message.slice(0, PREVIEW) + '…';
  const phaseColor = PHASE_COLORS[trace.phase || ''] || '#3d4e62';

  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:9 }}>
      <AgentAvatar id={trace.sender} size={30}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, fontWeight:700, color:m.color }}>{trace.sender.charAt(0).toUpperCase()+trace.sender.slice(1)}</span>
          <span style={{ fontSize:10, color:'#283246' }}>{m.area}</span>
          {trace.phase && (
            <span style={{ fontSize:9, fontWeight:700, letterSpacing:0.6, textTransform:'uppercase', padding:'2px 6px', borderRadius:4, color:phaseColor, background:`${phaseColor}18`, border:`1px solid ${phaseColor}28` }}>
              {PHASE_LABELS[trace.phase] || trace.phase}
            </span>
          )}
          {trace.recipient && trace.recipient !== 'council' && !isSystem && rm && (
            <span style={{ fontSize:10, color:'#283246' }}>→ <span style={{ color:`${rm.color}bb` }}>{trace.recipient}</span></span>
          )}
          <span style={{ marginLeft:'auto', fontSize:10, color:'#283246', flexShrink:0, fontVariantNumeric:'tabular-nums' }}>{timeAgo(trace.ts)}</span>
        </div>
        <div
          onClick={() => long && setExp(!exp)}
          style={{
            background: isSystem ? 'rgba(14,20,30,0.6)' : `linear-gradient(135deg,${m.color}0c 0%,rgba(14,20,30,0.8) 100%)`,
            border: isSystem ? '1px solid rgba(40,50,70,0.35)' : `1px solid ${m.color}25`,
            borderLeft: `2.5px solid ${isSystem ? '#283246' : m.color}`,
            borderRadius:'0 9px 9px 9px', padding:'10px 13px',
            cursor: long ? 'pointer' : 'default',
          }}
        >
          <p style={{ fontSize:12, color: isSystem ? '#5a6679' : '#c8d0dc', lineHeight:1.7, margin:0, fontStyle: isSystem ? 'italic' : 'normal', whiteSpace: exp ? 'pre-wrap' : 'normal' }}>
            {text}
          </p>
          {long && (
            <button onClick={e=>{e.stopPropagation();setExp(!exp);}} style={{ marginTop:6, fontSize:10, color:`${m.color}bb`, background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:3, fontWeight:600 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d={exp?'M5 15l7-7 7 7':'M19 9l-7 7-7-7'}/></svg>
              {exp ? 'Colapsar' : 'Ver completo'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── AgentCard ──────────────────────────────────────────────────── */
function AgentCard({ agent, selected, onToggle }: { agent: AgentInfo; selected: boolean; onToggle: ()=>void }) {
  const m = AGENT_META[agent.id] || { color:'#9aa6b8', area:'', icon:'' };
  const sc = agent.status==='online' ? '#34d399' : agent.status==='degraded' ? '#fbbf24' : '#f87171';
  return (
    <button onClick={onToggle} aria-pressed={selected} style={{ background:selected?`${m.color}15`:'rgba(14,20,30,0.8)', border:selected?`1px solid ${m.color}48`:'1px solid rgba(40,50,70,0.6)', borderRadius:10, padding:'10px 12px', cursor:'pointer', textAlign:'left', transition:'all 0.14s', width:'100%', minHeight:44 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <AgentAvatar id={agent.id} size={32}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontWeight:600, color:'#dde3ed', fontSize:12 }}>{agent.name}</span>
            <span style={{ width:5, height:5, borderRadius:'50%', background:sc, boxShadow:agent.status==='online'?`0 0 4px ${sc}80`:'none' }}/>
          </div>
          <div style={{ fontSize:10, color:'#283246', marginTop:1 }}>{m.area}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:2 }}>
          {agent.latency!==null && <span style={{ fontSize:9, color:'#283246', fontVariantNumeric:'tabular-nums' }}>{agent.latency}ms</span>}
          {selected && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>}
        </div>
      </div>
    </button>
  );
}

/* ─── Pagination ─────────────────────────────────────────────────── */
function Pagination({ page, total, pageSize, onChange }: { page:number; total:number; pageSize:number; onChange:(p:number)=>void }) {
  const tp = Math.ceil(total/pageSize);
  if (tp<=1) return null;
  const from=(page-1)*pageSize+1, to=Math.min(page*pageSize,total);
  const getPages=():( number|'…')[]=>{ if(tp<=7) return Array.from({length:tp},(_,i)=>i+1); const p:(number|'…')[]=[1]; if(page>3) p.push('…'); for(let i=Math.max(2,page-1);i<=Math.min(tp-1,page+1);i++) p.push(i); if(page<tp-2) p.push('…'); p.push(tp); return p; };
  const base:React.CSSProperties={ minWidth:32,height:32,borderRadius:6,border:'1px solid rgba(40,50,70,0.5)',background:'rgba(14,20,30,0.8)',color:'#5a6679',fontSize:11,fontWeight:500,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.13s',fontVariantNumeric:'tabular-nums',padding:'0 6px' };
  const active:React.CSSProperties={ ...base,background:'rgba(127,119,221,0.15)',border:'1px solid rgba(127,119,221,0.4)',color:'#b4b0f0',fontWeight:700 };
  const dis:React.CSSProperties={ ...base,opacity:0.3,cursor:'not-allowed',pointerEvents:'none' };
  return (
    <div style={{ borderTop:'1px solid rgba(40,50,70,0.35)',padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,flexShrink:0 }}>
      <span style={{ fontSize:10,color:'#283246',fontVariantNumeric:'tabular-nums' }}>{from}–{to} de {total}</span>
      <div style={{ display:'flex',gap:3,alignItems:'center' }}>
        <button onClick={()=>onChange(page-1)} disabled={page===1} aria-label="Anterior" style={page===1?dis:base}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>
        {getPages().map((p,i)=>p==='…'
          ?<span key={`e${i}`} style={{fontSize:11,color:'#283246',padding:'0 2px'}}>…</span>
          :<button key={p} onClick={()=>onChange(p as number)} style={p===page?active:base}
              onMouseEnter={e=>{if(p!==page){(e.currentTarget as HTMLButtonElement).style.background='rgba(30,40,55,0.9)';(e.currentTarget as HTMLButtonElement).style.color='#c8d0dc';}}}
              onMouseLeave={e=>{if(p!==page){(e.currentTarget as HTMLButtonElement).style.background='rgba(14,20,30,0.8)';(e.currentTarget as HTMLButtonElement).style.color='#5a6679';}}}>{p}</button>
        )}
        <button onClick={()=>onChange(page+1)} disabled={page===tp} aria-label="Siguiente" style={page===tp?dis:base}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg></button>
      </div>
      <span style={{ fontSize:10,color:'#1e2a3a' }}>{pageSize}/pág</span>
    </div>
  );
}

/* ─── PendingModal ───────────────────────────────────────────────── */
function PendingModal({ actions, onClose, onApprove, onReject }: { actions: PendingAction[]; onClose:()=>void; onApprove:(id:number)=>void; onReject:(id:number)=>void }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(5,8,14,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000 }} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{ background:'rgba(14,20,30,0.98)',border:'1px solid rgba(40,50,70,0.7)',borderRadius:14,padding:24,width:520,maxWidth:'95vw',maxHeight:'80vh',overflowY:'auto',boxShadow:'0 24px 80px rgba(0,0,0,0.7)' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18 }}>
          <h2 style={{ margin:0,fontSize:15,fontWeight:700,color:'#e8ecf4' }}>Acciones pendientes</h2>
          <button onClick={onClose} style={{ background:'none',border:'none',color:'#5a6679',cursor:'pointer',fontSize:18,lineHeight:1 }}>✕</button>
        </div>
        {actions.length===0
          ? <p style={{ color:'#3d4e62',fontSize:13,textAlign:'center',padding:'24px 0' }}>No hay acciones pendientes.</p>
          : actions.map(a=>(
            <div key={a.id} style={{ background:'rgba(20,28,40,0.9)',border:'1px solid rgba(40,50,70,0.5)',borderRadius:10,padding:'14px 16px',marginBottom:10 }}>
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
                <span style={{ fontSize:11,fontWeight:700,color:'#9b96e8',textTransform:'uppercase',letterSpacing:0.6 }}>{a.pattern}</span>
                <span style={{ fontSize:10,color:'#3d4e62' }}>·</span>
                <span style={{ fontSize:10,color:'#3d4e62' }}>{a.agents.join(', ')}</span>
                <span style={{ marginLeft:'auto',fontSize:10,color:'#283246',fontVariantNumeric:'tabular-nums' }}>{timeAgo(a.ts)}</span>
              </div>
              <p style={{ fontSize:12,color:'#9aa6b8',margin:'0 0 12px',lineHeight:1.6 }}>{a.task}</p>
              <div style={{ display:'flex',gap:8 }}>
                <button onClick={()=>onApprove(a.id)} style={{ flex:1,padding:'8px',borderRadius:7,background:'rgba(52,211,153,0.12)',border:'1px solid rgba(52,211,153,0.3)',color:'#34d399',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all 0.13s',minHeight:36 }}>
                  ✓ Aprobar
                </button>
                <button onClick={()=>onReject(a.id)} style={{ flex:1,padding:'8px',borderRadius:7,background:'rgba(248,113,113,0.10)',border:'1px solid rgba(248,113,113,0.25)',color:'#f87171',fontSize:11,fontWeight:700,cursor:'pointer',transition:'all 0.13s',minHeight:36 }}>
                  ✕ Rechazar
                </button>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────────── */
export default function CouncilPage() {
  const [agents, setAgents]           = useState<AgentInfo[]>([]);
  const [traces, setTraces]           = useState<Trace[]>([]);
  const [triggers, setTriggers]       = useState<TriggerDef[]>([]);
  const [pending, setPending]         = useState<PendingAction[]>([]);
  const [showPending, setShowPending] = useState(false);
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [task, setTask]               = useState('');
  const [pattern, setPattern]         = useState<Pattern>('solo');
  const [selectedAgents, setSelectedAgents] = useState<string[]>(['ares']);
  const [running, setRunning]         = useState(false);
  const [runMsg, setRunMsg]           = useState('');
  const [triggerMsg, setTriggerMsg]   = useState('');
  const feedRef   = useRef<HTMLDivElement>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval>|undefined>(undefined);
  const prevCount = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);

  const loadStatus = useCallback(async () => {
    try { const r=await fetch('/api/council/status'); if(r.ok) setAgents((await r.json()).agents); } catch { /**/ }
  }, []);

  const loadTraces = useCallback(async (q='') => {
    try {
      const url = q ? `/api/council/traces?limit=200&q=${encodeURIComponent(q)}` : '/api/council/traces?limit=200';
      const r = await fetch(url);
      if (!r.ok) return;
      const { traces: t } = await r.json();
      if (!q && t.length!==prevCount.current) { if(t.length>prevCount.current) setPage(1); prevCount.current=t.length; }
      setTraces(t||[]);
    } catch { /**/ }
  }, []);

  const loadTriggers = useCallback(async () => {
    try { const r=await fetch('/api/council/triggers'); if(r.ok) setTriggers((await r.json()).triggers||[]); } catch { /**/ }
  }, []);

  const loadPending = useCallback(async () => {
    try { const r=await fetch('/api/council/actions?status=pending'); if(r.ok) setPending((await r.json()).actions||[]); } catch { /**/ }
  }, []);

  useEffect(() => {
    loadStatus(); loadTraces(); loadTriggers(); loadPending();
    const si = setInterval(loadStatus, 15000);
    pollRef.current = setInterval(()=>{ loadTraces(search); loadPending(); }, 4000);
    return () => { clearInterval(si); if(pollRef.current) clearInterval(pollRef.current); };
  }, [loadStatus, loadTraces, loadTriggers, loadPending, search]);

  useEffect(() => { if(feedRef.current) feedRef.current.scrollTop=0; }, [page, traces]);

  // Debounce search
  const handleSearchInput = (v: string) => {
    setSearchInput(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(v); setPage(1); loadTraces(v); }, 320);
  };

  const paginated = traces.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const toggleAgent = (id: string) =>
    setSelectedAgents(prev => prev.includes(id) ? prev.filter(a=>a!==id) : [...prev, id]);

  const handleRun = async () => {
    if (!task.trim()) return;
    setRunning(true); setRunMsg('');
    try {
      const agentList = pattern!=='solo' && pattern!=='auto' ? selectedAgents : (pattern==='solo' ? [selectedAgents[0]||'ares'] : []);
      const r = await fetch('/api/council/run', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({task,pattern,agents:agentList}) });
      const d = await r.json();
      if(d.ok) { setRunMsg('Tarea enviada. Trazas aparecerán en segundos…'); setTask(''); }
      else setRunMsg(d.error||'Error');
    } catch { setRunMsg('Error de conexión'); }
    finally { setRunning(false); setTimeout(()=>setRunMsg(''),5000); }
  };

  const handleTrigger = async (triggerId: string) => {
    setTriggerMsg('Creando acción pendiente…');
    try {
      const r = await fetch('/api/council/actions', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({trigger_id:triggerId}) });
      const d = await r.json();
      if(d.ok) { setTriggerMsg('Acción pendiente creada. Revisá Aprobaciones.'); loadPending(); }
      else setTriggerMsg(d.error||'Error');
    } catch { setTriggerMsg('Error de conexión'); }
    finally { setTimeout(()=>setTriggerMsg(''),4000); }
  };

  const handleApprove = async (id: number) => {
    await fetch(`/api/council/actions/${id}/approve`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
    setPending(prev=>prev.filter(a=>a.id!==id));
  };
  const handleReject = async (id: number) => {
    await fetch(`/api/council/actions/${id}/reject`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' });
    setPending(prev=>prev.filter(a=>a.id!==id));
  };

  const onlineCount = agents.filter(a=>a.status==='online').length;

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(160deg,#080c12 0%,#0c1118 50%,#0e131d 100%)', color:'#eef1f6', fontFamily:"'Plus Jakarta Sans',Inter,system-ui,sans-serif", display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <header style={{ padding:'17px 24px', borderBottom:'1px solid rgba(40,50,70,0.4)', display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:38,height:38,borderRadius:9,flexShrink:0,background:'rgba(127,119,221,0.09)',border:'1px solid rgba(127,119,221,0.22)',display:'flex',alignItems:'center',justifyContent:'center' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9b96e8" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </div>
        <div>
          <h1 style={{ fontSize:16,fontWeight:700,margin:0,letterSpacing:'-0.4px',color:'#e8ecf4' }}>Council</h1>
          <p style={{ fontSize:10,color:'#3d4e62',margin:0,marginTop:1 }}>
            Multi-agente ArchiTechIA <span style={{margin:'0 4px'}}>·</span>
            <span style={{ color:onlineCount>0?'#34d399':'#f87171',fontWeight:600 }}>{onlineCount}/{agents.length||5} online</span>
          </p>
        </div>

        {/* Pending badge */}
        <button onClick={()=>setShowPending(true)} style={{ marginLeft:16,display:'flex',alignItems:'center',gap:7,padding:'6px 12px',borderRadius:8,background:pending.length>0?'rgba(251,191,36,0.10)':'rgba(14,20,30,0.7)',border:pending.length>0?'1px solid rgba(251,191,36,0.28)':'1px solid rgba(40,50,70,0.4)',cursor:'pointer',transition:'all 0.14s',minHeight:34 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={pending.length>0?'#fbbf24':'#3d4e62'} strokeWidth="2"><path d="M12 22c1.1 0 2-.9 2-2H10c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>
          <span style={{ fontSize:11,fontWeight:600,color:pending.length>0?'#fbbf24':'#3d4e62' }}>
            {pending.length>0 ? `${pending.length} pendiente${pending.length>1?'s':''}` : 'Aprobaciones'}
          </span>
          {pending.length>0 && <span style={{ width:6,height:6,borderRadius:'50%',background:'#fbbf24',animation:'livePulse 1.8s ease-in-out infinite' }}/>}
        </button>

        <div style={{ marginLeft:'auto',display:'flex',alignItems:'center',gap:5 }}>
          <span style={{ width:6,height:6,borderRadius:'50%',background:'#34d399',animation:'livePulse 2.4s ease-in-out infinite',boxShadow:'0 0 6px rgba(52,211,153,.4)' }}/>
          <span style={{ fontSize:10,color:'#283246',letterSpacing:0.8,fontWeight:600 }}>LIVE</span>
        </div>
      </header>

      {/* Body */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'218px 1fr 296px', overflow:'hidden', height:'calc(100vh - 72px)' }}>

        {/* Left */}
        <aside style={{ borderRight:'1px solid rgba(40,50,70,0.4)',padding:'15px 11px',overflowY:'auto',display:'flex',flexDirection:'column',gap:5 }}>
          <p style={{ fontSize:9,fontWeight:700,color:'#1e2a3a',textTransform:'uppercase',letterSpacing:1.4,margin:'0 0 8px 2px' }}>Agentes</p>
          {agents.length===0
            ?Array.from({length:5}).map((_,i)=><div key={i} style={{height:54,borderRadius:10,background:'rgba(14,20,30,0.6)',animation:'shimmer 1.6s ease-in-out infinite',animationDelay:`${i*0.1}s`}}/>)
            :agents.map(a=><AgentCard key={a.id} agent={a} selected={selectedAgents.includes(a.id)} onToggle={()=>toggleAgent(a.id)}/>)
          }
        </aside>

        {/* Center */}
        <main style={{ display:'flex',flexDirection:'column',overflow:'hidden' }}>
          {/* Search header */}
          <div style={{ padding:'10px 16px',borderBottom:'1px solid rgba(40,50,70,0.35)',display:'flex',alignItems:'center',gap:10,flexShrink:0 }}>
            <div style={{ flex:1,position:'relative',display:'flex',alignItems:'center' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3d4e62" strokeWidth="2" style={{position:'absolute',left:10,pointerEvents:'none'}}>
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                value={searchInput}
                onChange={e=>handleSearchInput(e.target.value)}
                placeholder="Buscar en conversaciones…"
                aria-label="Buscar trazas"
                style={{ width:'100%',padding:'7px 10px 7px 32px',background:'rgba(10,15,22,0.8)',border:'1px solid rgba(40,50,70,0.5)',borderRadius:7,color:'#c8d0dc',fontSize:12,fontFamily:'inherit',outline:'none',boxSizing:'border-box',transition:'border-color 0.14s' }}
                onFocus={e=>(e.currentTarget.style.borderColor='rgba(127,119,221,0.4)')}
                onBlur={e=>(e.currentTarget.style.borderColor='rgba(40,50,70,0.5)')}
              />
              {searchInput && (
                <button onClick={()=>{setSearchInput('');setSearch('');loadTraces('');}} style={{ position:'absolute',right:8,background:'none',border:'none',color:'#3d4e62',cursor:'pointer',fontSize:14,lineHeight:1 }}>✕</button>
              )}
            </div>
            <span style={{ fontSize:10,color:'#283246',flexShrink:0,fontVariantNumeric:'tabular-nums' }}>
              {search ? `${traces.length} resultados` : `${traces.length} trazas`}
            </span>
            <button onClick={()=>loadTraces(search)} style={{ fontSize:11,color:'#3d4e62',background:'none',border:'1px solid rgba(40,50,70,0.4)',borderRadius:6,cursor:'pointer',padding:'5px 9px',display:'flex',alignItems:'center',gap:4,transition:'all 0.13s',minHeight:30 }}
              onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.color='#9aa6b8'}
              onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.color='#3d4e62'}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
          </div>

          {/* Bubbles */}
          <div ref={feedRef} style={{ flex:1,overflowY:'auto',padding:'14px 18px',display:'flex',flexDirection:'column',gap:9 }}>
            {traces.length===0 ? (
              <div style={{ textAlign:'center',color:'#283246',padding:'52px 24px',display:'flex',flexDirection:'column',alignItems:'center',gap:11 }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1a2432" strokeWidth="1.3"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 01-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 011-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 011.52 0C14.51 3.81 17 5 19 5a1 1 0 011 1z"/></svg>
                <div>
                  <p style={{ fontSize:13,color:'#3d4e62',margin:0,fontWeight:500 }}>{search ? 'Sin resultados para esa búsqueda' : 'Sin conversaciones todavía'}</p>
                  <p style={{ fontSize:11,color:'#1e2a3a',margin:'4px 0 0' }}>{search ? 'Probá con otros términos.' : 'Lanzá una tarea desde el panel derecho.'}</p>
                </div>
              </div>
            ) : (() => {
              const items: React.ReactNode[] = [];
              let lastRun = '';
              paginated.forEach(t => {
                if (t.run_id!==lastRun) { items.push(<RunDivider key={`d-${t.run_id}`} pattern={t.pattern} ts={t.ts}/>); lastRun=t.run_id; }
                items.push(<TraceBubble key={t.id} trace={t}/>);
              });
              return items;
            })()}
          </div>

          <Pagination page={page} total={traces.length} pageSize={PAGE_SIZE} onChange={p=>setPage(p)}/>
        </main>

        {/* Right */}
        <aside style={{ borderLeft:'1px solid rgba(40,50,70,0.4)',padding:'15px 14px',overflowY:'auto',display:'flex',flexDirection:'column',gap:19 }}>

          {/* Pattern */}
          <section>
            <p style={{ fontSize:9,fontWeight:700,color:'#1e2a3a',textTransform:'uppercase',letterSpacing:1.4,margin:'0 0 8px' }}>Patrón</p>
            <div style={{ display:'flex',flexDirection:'column',gap:4 }}>
              {(Object.entries(PATTERN_INFO) as [Pattern,typeof PATTERN_INFO[Pattern]][]).map(([key,info])=>(
                <button key={key} onClick={()=>setPattern(key)} aria-pressed={pattern===key} style={{ display:'flex',alignItems:'center',gap:8,padding:'8px 10px',borderRadius:8,cursor:'pointer',minHeight:44,textAlign:'left',transition:'all 0.12s', background:pattern===key?'rgba(127,119,221,0.08)':'rgba(12,18,28,0.7)', border:pattern===key?'1px solid rgba(127,119,221,0.32)':'1px solid rgba(40,50,70,0.4)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={pattern===key?'#9b96e8':'#283246'} strokeWidth="2" strokeLinecap="round"><path d={info.icon}/></svg>
                  <div>
                    <div style={{ fontSize:11,fontWeight:600,color:pattern===key?'#c0bdf5':'#5a6679' }}>{info.label}</div>
                    <div style={{ fontSize:9,color:'#1e2a3a',marginTop:1 }}>{info.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Participants (hidden for auto) */}
          {pattern!=='auto' && (
            <section>
              <p style={{ fontSize:9,fontWeight:700,color:'#1e2a3a',textTransform:'uppercase',letterSpacing:1.4,margin:'0 0 5px' }}>{pattern==='solo'?'Agente':'Participantes'}</p>
              <p style={{ fontSize:10,color:'#1e2a3a',margin:'0 0 7px',lineHeight:1.5 }}>{pattern==='solo'?'Seleccioná uno del panel izq.':'Seleccioná 2+ del panel izq.'}</p>
              {selectedAgents.length>0&&(
                <div style={{ display:'flex',flexWrap:'wrap',gap:4 }}>
                  {selectedAgents.map(id=>{ const m=AGENT_META[id]||{color:'#9aa6b8',area:'',icon:''}; return(
                    <span key={id} style={{ fontSize:10,padding:'2px 8px',borderRadius:5,fontWeight:600,background:`${m.color}14`,border:`1px solid ${m.color}28`,color:m.color,display:'flex',alignItems:'center',gap:4 }}>
                      <AgentAvatar id={id} size={12}/>{id}
                    </span>
                  );})}
                </div>
              )}
            </section>
          )}

          {/* Task */}
          <section style={{ display:'flex',flexDirection:'column',gap:7 }}>
            <p style={{ fontSize:9,fontWeight:700,color:'#1e2a3a',textTransform:'uppercase',letterSpacing:1.4,margin:0 }}>Tarea</p>
            <textarea value={task} onChange={e=>setTask(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&e.metaKey)handleRun();}} placeholder="Describí la tarea…" rows={3} aria-label="Tarea"
              style={{ width:'100%',resize:'vertical',padding:'8px 10px',background:'rgba(8,13,20,0.9)',border:'1px solid rgba(40,50,70,0.55)',borderRadius:7,color:'#c8d0dc',fontSize:11,lineHeight:1.6,fontFamily:'inherit',outline:'none',boxSizing:'border-box',minHeight:76,transition:'border-color 0.13s' }}
              onFocus={e=>(e.currentTarget.style.borderColor='rgba(127,119,221,0.38)')}
              onBlur={e=>(e.currentTarget.style.borderColor='rgba(40,50,70,0.55)')}
            />
            <button onClick={handleRun} disabled={running||!task.trim()||(pattern!=='auto'&&selectedAgents.length===0)} style={{ padding:'9px 12px',borderRadius:7,fontWeight:600,fontSize:11,border:'none',transition:'all 0.13s',minHeight:42,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,
              background:running||!task.trim()||(pattern!=='auto'&&selectedAgents.length===0)?'rgba(20,28,40,0.8)':'rgba(127,119,221,0.78)',
              color:running||!task.trim()||(pattern!=='auto'&&selectedAgents.length===0)?'#1e2a3a':'#fff',
              opacity:running||!task.trim()||(pattern!=='auto'&&selectedAgents.length===0)?0.45:1 }}>
              {running?<><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{animation:'spin 1s linear infinite'}}><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>Enviando…</>
                :<><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 3l14 9-14 9V3z"/></svg>Ejecutar {pattern}</>}
            </button>
            {runMsg&&<p style={{ fontSize:10,margin:0,textAlign:'center',color:runMsg.includes('Error')?'#f87171':'#34d399' }}>{runMsg}</p>}
          </section>

          {/* Triggers */}
          <section>
            <p style={{ fontSize:9,fontWeight:700,color:'#1e2a3a',textTransform:'uppercase',letterSpacing:1.4,margin:'0 0 8px' }}>Triggers autónomos</p>
            <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
              {triggers.length===0
                ?<div style={{height:36,borderRadius:7,background:'rgba(14,20,30,0.5)',animation:'shimmer 1.6s ease-in-out infinite'}}/>
                :triggers.map(t=>(
                  <div key={t.id} style={{ background:'rgba(12,18,28,0.7)',border:'1px solid rgba(40,50,70,0.38)',borderRadius:8,padding:'9px 11px',display:'flex',alignItems:'center',gap:8 }}>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ fontSize:11,fontWeight:600,color:'#9aa6b8' }}>{t.label}</div>
                      <div style={{ fontSize:9,color:'#283246',marginTop:1 }}>{t.cron}</div>
                    </div>
                    <button onClick={()=>handleTrigger(t.id)} style={{ flexShrink:0,padding:'5px 9px',borderRadius:6,background:'rgba(127,119,221,0.10)',border:'1px solid rgba(127,119,221,0.25)',color:'#9b96e8',fontSize:10,fontWeight:700,cursor:'pointer',transition:'all 0.12s',minHeight:30 }}>
                      ▶
                    </button>
                  </div>
                ))
              }
            </div>
            {triggerMsg&&<p style={{ fontSize:10,margin:'6px 0 0',color:triggerMsg.includes('Error')?'#f87171':'#34d399' }}>{triggerMsg}</p>}
          </section>

          {/* Examples */}
          <section>
            <p style={{ fontSize:9,fontWeight:700,color:'#1e2a3a',textTransform:'uppercase',letterSpacing:1.4,margin:'0 0 6px' }}>Ejemplos</p>
            <div style={{ display:'flex',flexDirection:'column',gap:3 }}>
              {['Presentate al consejo brevemente','Cuál debería ser nuestra prioridad este trimestre?','Analizá el estado actual del negocio','Proponé un plan de acción para Q3'].map(s=>(
                <button key={s} onClick={()=>setTask(s)} style={{ textAlign:'left',fontSize:10,color:'#283246',padding:'7px 9px',background:'rgba(12,18,28,0.7)',border:'1px solid rgba(40,50,70,0.3)',borderRadius:6,cursor:'pointer',lineHeight:1.4,transition:'all 0.12s',minHeight:32 }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color='#9aa6b8';(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(55,70,95,0.5)';}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color='#283246';(e.currentTarget as HTMLButtonElement).style.borderColor='rgba(40,50,70,0.3)';}}>
                  {s}
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {showPending && <PendingModal actions={pending} onClose={()=>setShowPending(false)} onApprove={handleApprove} onReject={handleReject}/>}

      <style>{`
        @keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.78)}}
        @keyframes shimmer{0%,100%{opacity:.3}50%{opacity:.55}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(35,48,65,.7);border-radius:3px}
        button:focus-visible{outline:2px solid rgba(127,119,221,.55);outline-offset:2px}
      `}</style>
    </div>
  );
}
