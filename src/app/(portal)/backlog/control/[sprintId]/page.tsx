'use client'

import React, { useEffect, useMemo, useRef, useState, use as usePromise } from 'react'
import Link from 'next/link'

interface Task {
  id: string
  taskCode: string | null
  title: string
  status: string
  assigneeName: string | null
  dependsOnTaskId: string | null
  execId: string | null
  startedAt: string | null
  finishedAt: string | null
}
interface Sprint {
  id: string; name: string; goal: string | null; sprintCode: string | null; status: string
  epicName: string | null; solucionNombre: string | null
}
interface GraphData { sprint: Sprint; tasks: Task[] }
interface TraceEvent { id: string; kind: string; message: string; createdAt: string }

const STATUS_MAP: Record<string, { label: string; pill: string }> = {
  BACKLOG: { label: 'En cola', pill: 'pending' },
  IN_PROGRESS: { label: 'En curso', pill: 'running' },
  DONE: { label: 'Hecha', pill: 'done' },
  FAILED: { label: 'Fallida', pill: 'failed' },
  BLOCKED: { label: 'Bloqueada', pill: 'blocked' },
  CANCELLED: { label: 'Cancelada', pill: 'pending' },
}

const COL_WIDTH = 230
const NODE_WIDTH = 200
const ROW_HEIGHT = 100
const NODE_HEIGHT = 74
const STAGE_PAD = 24

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return '—'
  const start = new Date(startedAt).getTime()
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now()
  const secs = Math.max(0, Math.round((end - start) / 1000))
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function computeLayout(tasks: Task[]) {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const childrenOf = new Map<string | null, Task[]>()
  for (const t of tasks) {
    const parent = t.dependsOnTaskId && byId.has(t.dependsOnTaskId) ? t.dependsOnTaskId : null
    if (!childrenOf.has(parent)) childrenOf.set(parent, [])
    childrenOf.get(parent)!.push(t)
  }

  // Cada task depende como máximo de UNA (dependsOnTaskId es single-parent
  // en este modelo, no multi-padre) — el "grafo" real es un bosque de
  // árboles, no un DAG con convergencia. Se recorre en orden desde las
  // raíces (sin dependencia) asignando nivel = profundidad y fila =
  // siguiente lugar libre en ese nivel, agrupando ramas visualmente.
  const level = new Map<string, number>()
  const row = new Map<string, number>()
  const rowsUsedPerLevel: number[] = []

  function place(t: Task, depth: number) {
    level.set(t.id, depth)
    const r = rowsUsedPerLevel[depth] ?? 0
    row.set(t.id, r)
    rowsUsedPerLevel[depth] = r + 1
    for (const child of childrenOf.get(t.id) ?? []) place(child, depth + 1)
  }
  for (const root of childrenOf.get(null) ?? []) place(root, 0)

  const maxLevel = Math.max(0, ...Array.from(level.values()))
  const maxRow = Math.max(0, ...Array.from(row.values()))

  const pos = new Map<string, { x: number; y: number }>()
  for (const t of tasks) {
    const l = level.get(t.id) ?? 0
    const r = row.get(t.id) ?? 0
    pos.set(t.id, { x: STAGE_PAD + l * COL_WIDTH, y: STAGE_PAD + r * ROW_HEIGHT })
  }

  return {
    pos,
    width: STAGE_PAD * 2 + (maxLevel + 1) * COL_WIDTH,
    height: STAGE_PAD * 2 + (maxRow + 1) * ROW_HEIGHT,
  }
}

export default function ControlSprintPage({ params }: { params: Promise<{ sprintId: string }> }) {
  const { sprintId } = usePromise(params)
  const [data, setData] = useState<GraphData | null>(null)
  const [selected, setSelected] = useState<Task | null>(null)
  const [events, setEvents] = useState<TraceEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dispatching, setDispatching] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let cancelled = false
    async function loadGraph() {
      try {
        const res = await fetch(`/api/backlog/sprint/${sprintId}/graph`)
        if (!res.ok) throw new Error(`No se pudo cargar el sprint (${res.status})`)
        const json: GraphData = await res.json()
        if (cancelled) return
        setData(json)
        setSelected((prev) => {
          if (prev) {
            const stillThere = json.tasks.find((t) => t.id === prev.id)
            if (stillThere) return stillThere
          }
          const running = json.tasks.find((t) => t.status === 'IN_PROGRESS')
          return running ?? json.tasks[0] ?? null
        })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    loadGraph()
    const graphPoll = setInterval(loadGraph, 5000)
    return () => { cancelled = true; clearInterval(graphPoll) }
  }, [sprintId])

  useEffect(() => {
    if (!selected) { setEvents([]); return }
    let cancelled = false
    async function loadEvents() {
      try {
        const res = await fetch(`/api/executor/event?taskId=${selected!.id}`)
        if (!res.ok) return
        const json: TraceEvent[] = await res.json()
        if (!cancelled) setEvents(json)
      } catch { /* silencioso — no bloquear la UI por un poll fallido */ }
    }
    loadEvents()
    if (pollRef.current) clearInterval(pollRef.current)
    if (selected.status === 'IN_PROGRESS') {
      pollRef.current = setInterval(loadEvents, 2500)
    }
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current) }
  }, [selected])

  const layout = useMemo(() => (data ? computeLayout(data.tasks) : null), [data])

  const stageRef = useRef<HTMLDivElement>(null)
  const [connectors, setConnectors] = useState<{ d: string; live: boolean }[]>([])

  useEffect(() => {
    if (!data || !layout || !stageRef.current) return
    const stageRect = stageRef.current.getBoundingClientRect()
    const next: { d: string; live: boolean }[] = []
    for (const t of data.tasks) {
      if (!t.dependsOnTaskId) continue
      const parentEl = stageRef.current.querySelector<HTMLElement>(`[data-node="${t.dependsOnTaskId}"]`)
      const childEl = stageRef.current.querySelector<HTMLElement>(`[data-node="${t.id}"]`)
      if (!parentEl || !childEl) continue
      const pr = parentEl.getBoundingClientRect()
      const cr = childEl.getBoundingClientRect()
      const x1 = pr.right - stageRect.left
      const y1 = pr.top + pr.height / 2 - stageRect.top
      const x2 = cr.left - stageRect.left
      const y2 = cr.top + cr.height / 2 - stageRect.top
      const midX = x1 + (x2 - x1) / 2
      const d = y1 === y2
        ? `M ${x1} ${y1} L ${x2} ${y2}`
        : `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`
      const parentTask = data.tasks.find((p) => p.id === t.dependsOnTaskId)
      const live = t.status === 'IN_PROGRESS' || parentTask?.status === 'IN_PROGRESS'
      next.push({ d, live })
    }
    setConnectors(next)
  }, [data, layout])

  const counts = useMemo(() => {
    const c: Record<string, number> = { done: 0, running: 0, blocked: 0, failed: 0, pending: 0 }
    for (const t of data?.tasks ?? []) {
      const pill = STATUS_MAP[t.status]?.pill ?? 'pending'
      c[pill] = (c[pill] ?? 0) + 1
    }
    return c
  }, [data])

  const backlogTaskIds = useMemo(
    () => (data?.tasks ?? []).filter((t) => t.status === 'BACKLOG').map((t) => t.id),
    [data]
  )

  // Dispara las tasks en BACKLOG de este sprint respetando dependencias
  // reales (dependsOnTaskId) — mismo motor que ya usa el resto del sistema
  // (plan/approve, dispatch-chain manual), no uno nuevo. El endpoint
  // arranca runTaskChain server-side y solo responde cuando TERMINA toda
  // la cadena (puede tardar minutos) — no se espera esa respuesta acá; el
  // fetch se lanza sin await (el server sigue procesando aunque el browser
  // no espere) y el boton se reactiva a los 2s, tiempo de sobra para que
  // el primer POST /dispatch al Harness ya haya ocurrido. El avance real
  // se ve solo, vía el polling de 5s del grafo que ya esta corriendo.
  function handleDispatch() {
    if (backlogTaskIds.length === 0 || dispatching) return
    setDispatching(true)
    fetch('/api/executor/dispatch-chain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskIds: backlogTaskIds }),
    }).catch((err) => setError(err instanceof Error ? err.message : String(err)))
    setTimeout(() => setDispatching(false), 2000)
  }

  return (
    <div className="sala-control">
      <Styles />
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" />
            <h1>Sala de Control</h1>
          </div>
          <nav className="breadcrumb">
            <Link href="/backlog/control" className="back-link">← Sprints</Link>
            <span className="sep">·</span>
            <span className="code mono">{data?.sprint.sprintCode ?? '…'}</span>
            <span className="sep">·</span>
            <span>{data?.sprint.name ?? 'Cargando…'}</span>
          </nav>
          <div className="topbar-spacer" />
          <div className="status-summary">
            <span className="chip c-done"><i className="dot" />Hechas <strong>{counts.done}</strong></span>
            <span className="chip c-running"><i className="dot" />En curso <strong>{counts.running}</strong></span>
            <span className="chip c-blocked"><i className="dot" />Bloqueadas <strong>{counts.blocked}</strong></span>
            <span className="chip c-failed"><i className="dot" />Fallidas <strong>{counts.failed}</strong></span>
            <span className="chip c-pending"><i className="dot" />En cola <strong>{counts.pending}</strong></span>
          </div>
          <button
            className="dispatch-btn"
            disabled={backlogTaskIds.length === 0 || dispatching}
            onClick={handleDispatch}
            title={backlogTaskIds.length === 0 ? 'No hay tasks en cola para disparar' : `Disparar ${backlogTaskIds.length} task${backlogTaskIds.length !== 1 ? 's' : ''} en BACKLOG`}
          >
            {dispatching ? 'Disparando…' : `▶ Disparar (${backlogTaskIds.length})`}
          </button>
        </header>

        {error && <div className="error-banner">{error}</div>}

        <section className="stage-wrap">
          <div className="stage-header">
            <span className="stage-title">Grafo de dependencias</span>
            <div className="legend">
              <span><i className="l-pending" />En cola</span>
              <span><i className="l-running" />En curso</span>
              <span><i className="l-done" />Hecha</span>
              <span><i className="l-blocked" />Bloqueada</span>
              <span><i className="l-failed" />Fallida</span>
            </div>
          </div>

          <div className="stage">
            <div
              className="stage-inner"
              ref={stageRef}
              style={{ width: layout?.width ?? 600, height: layout?.height ?? 300 }}
            >
              <svg className="connectors" width={layout?.width ?? 600} height={layout?.height ?? 300}>
                {connectors.map((c, i) => (
                  <path key={i} d={c.d} className={c.live ? 'live' : ''} />
                ))}
              </svg>

              {data?.tasks.map((t) => {
                const p = layout?.pos.get(t.id)
                const st = STATUS_MAP[t.status] ?? STATUS_MAP.BACKLOG
                const initial = (t.assigneeName ?? '?').charAt(0).toUpperCase()
                return (
                  <div
                    key={t.id}
                    data-node={t.id}
                    className={`node ${selected?.id === t.id ? 'selected' : ''}`}
                    style={{ left: p?.x ?? 0, top: p?.y ?? 0, width: NODE_WIDTH }}
                    onClick={() => setSelected(t)}
                  >
                    <div className="node-top">
                      <span className="node-code mono">{t.taskCode ?? t.id.slice(0, 8)}</span>
                      <span className={`pill ${st.pill}`}><span className="dot" />{st.label}</span>
                    </div>
                    <div className="node-title">{t.title}</div>
                    <div className="node-foot">
                      <span className="agent"><span className="avatar">{initial}</span>{t.assigneeName ?? 'Sin asignar'}</span>
                      <span className="mono">{formatDuration(t.startedAt, t.finishedAt)}</span>
                    </div>
                  </div>
                )
              })}

              {data && data.tasks.length === 0 && (
                <div className="empty-graph">Este sprint todavía no tiene tasks.</div>
              )}
            </div>
          </div>
        </section>

        <section className="trace-wrap">
          <div className="trace-panel">
            <div className="trace-head">
              <span className="t-code mono">{selected?.taskCode ?? selected?.id.slice(0, 8) ?? '—'}</span>
              <span className="t-title">{selected?.title ?? 'Elegí una tarea del grafo'}</span>
              <div className="trace-head-spacer" />
              <span className="t-dur mono">
                {selected ? `${selected.startedAt ? new Date(selected.startedAt).toLocaleTimeString('es-AR') : '—'} → ${selected.status === 'IN_PROGRESS' ? 'en curso' : (selected.finishedAt ? new Date(selected.finishedAt).toLocaleTimeString('es-AR') : '—')}` : ''}
              </span>
            </div>
            <div className="trace-body">
              {selected && events.length === 0 && (
                <div className="trace-empty-note">
                  <span>⏸</span>
                  <span>
                    {selected.status === 'BACKLOG'
                      ? 'En cola, sin actividad todavía.'
                      : selected.status === 'BLOCKED'
                        ? 'Bloqueada — depende de otra tarea que aún no cerró en DONE.'
                        : 'Sin eventos de traza registrados todavía.'}
                  </span>
                </div>
              )}
              {events.map((e) => (
                <div className="trace-line" key={e.id}>
                  <span className="t-time mono">{new Date(e.createdAt).toLocaleTimeString('es-AR')}</span>
                  <span className={`t-icon i-${e.kind}`}>{iconGlyph(e.kind)}</span>
                  <span className="t-msg" dangerouslySetInnerHTML={{ __html: e.message }} />
                </div>
              ))}
              {selected?.status === 'IN_PROGRESS' && (
                <div className="trace-line">
                  <span className="t-time mono" />
                  <span />
                  <span className="t-msg muted">en curso<span className="trace-cursor" /></span>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function iconGlyph(kind: string): string {
  switch (kind) {
    case 'write': return 'W'
    case 'check': return '✓'
    case 'run': return '▶'
    case 'fail': return '✕'
    default: return '·'
  }
}

function Styles() {
  return (
    <style>{`
      /* Usa los tokens reales del portal (globals.css) en vez de un
         sistema de color propio — sin fondo opaco para que los blobs de
         liquid glass del layout (fixed detras de <main>, que es
         transparent) se sigan viendo, y paneles en --bg-card + blur en
         vez de superficies solidas inventadas. */
      .sala-control {
        --s-pending: var(--text-muted); --s-pending-soft: rgba(100,116,139,0.14);
        --s-running: var(--cyan); --s-running-soft: var(--cyan-dim);
        --s-done: var(--success); --s-done-soft: var(--success-dim);
        --s-failed: var(--error); --s-failed-soft: rgba(239,68,68,0.14);
        --s-blocked: var(--warning); --s-blocked-soft: rgba(245,158,11,0.14);
        background: transparent; color: var(--text-primary);
        min-height: 100%; position: relative; z-index: 1;
      }
      .sala-control * { box-sizing: border-box; }
      .sala-control .mono { font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, monospace; }
      .sala-control .app { display: flex; flex-direction: column; min-height: 100%; }
      .sala-control .topbar { display: flex; align-items: center; gap: 20px; padding: 16px 24px; border-bottom: 1px solid var(--border-base); background: var(--bg-elevated); backdrop-filter: blur(20px); flex-wrap: wrap; }
      .sala-control .brand { display: flex; align-items: baseline; gap: 10px; margin-right: 4px; }
      .sala-control .brand-mark { width: 9px; height: 9px; border-radius: 2px; background: var(--primary); display: inline-block; transform: rotate(45deg); flex: none; }
      .sala-control .brand h1 { font-size: 16px; font-weight: 800; margin: 0; letter-spacing: -0.01em; }
      .sala-control .breadcrumb { display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 13px; flex-wrap: wrap; }
      .sala-control .back-link { color: var(--primary-light); text-decoration: none; font-weight: 600; }
      .sala-control .back-link:hover { text-decoration: underline; }
      .sala-control .breadcrumb .code { font-size: 12px; padding: 2px 7px; border-radius: 5px; background: var(--glass-bg); color: var(--text-primary); border: 1px solid var(--border-base); }
      .sala-control .breadcrumb .sep { color: var(--text-muted); }
      .sala-control .topbar-spacer { flex: 1; }
      .sala-control .status-summary { display: flex; gap: 6px; flex-wrap: wrap; }
      .sala-control .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; padding: 5px 10px 5px 8px; border-radius: 100px; border: 1px solid var(--border-base); background: var(--glass-bg); color: var(--text-secondary); }
      .sala-control .chip .dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }
      .sala-control .chip strong { color: var(--text-primary); font-variant-numeric: tabular-nums; }
      .sala-control .chip.c-done .dot { background: var(--s-done); }
      .sala-control .chip.c-running .dot { background: var(--s-running); }
      .sala-control .chip.c-blocked .dot { background: var(--s-blocked); }
      .sala-control .chip.c-failed .dot { background: var(--s-failed); }
      .sala-control .chip.c-pending .dot { background: var(--s-pending); }
      .sala-control .error-banner { margin: 14px 24px 0; padding: 10px 14px; border-radius: 10px; background: var(--s-failed-soft); color: var(--s-failed); font-size: 13px; }
      .sala-control .dispatch-btn { background: var(--primary); color: #fff; border: none; border-radius: 100px; padding: 8px 16px; font-size: 12.5px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: filter .12s ease, opacity .12s ease; }
      .sala-control .dispatch-btn:hover:not(:disabled) { filter: brightness(1.1); }
      .sala-control .dispatch-btn:disabled { opacity: .35; cursor: not-allowed; }
      .sala-control .stage-wrap { padding: 22px 24px 10px; }
      .sala-control .stage-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
      .sala-control .stage-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted); }
      .sala-control .legend { display: flex; gap: 14px; font-size: 12px; color: var(--text-secondary); }
      .sala-control .legend span { display: inline-flex; align-items: center; gap: 5px; }
      .sala-control .legend i { width: 7px; height: 7px; border-radius: 50%; display: inline-block; }
      .sala-control .legend .l-done { background: var(--s-done); }
      .sala-control .legend .l-running { background: var(--s-running); }
      .sala-control .legend .l-blocked { background: var(--s-blocked); }
      .sala-control .legend .l-failed { background: var(--s-failed); }
      .sala-control .legend .l-pending { background: var(--s-pending); }
      .sala-control .stage { position: relative; background: var(--glass-bg); backdrop-filter: blur(20px); border: 1px solid var(--border-base); border-radius: var(--radius); overflow: auto; background-image: linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px); background-size: 28px 28px; max-height: 60vh; }
      .sala-control .stage-inner { position: relative; }
      .sala-control .empty-graph { padding: 40px; color: var(--text-muted); font-size: 13px; }
      .sala-control svg.connectors { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
      .sala-control svg.connectors path { fill: none; stroke: var(--text-muted); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; opacity: .55; }
      .sala-control svg.connectors path.live { stroke: var(--s-running); opacity: .9; stroke-dasharray: 5 4; animation: dash 1.1s linear infinite; }
      @media (prefers-reduced-motion: reduce) { .sala-control svg.connectors path.live { animation: none; } }
      @keyframes dash { to { stroke-dashoffset: -18; } }
      .sala-control .node { position: absolute; border-radius: var(--radius); border: 1px solid var(--border-base); background: var(--bg-card); backdrop-filter: blur(20px); box-shadow: 0 4px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.02); padding: 10px 12px 11px; cursor: pointer; transition: transform .12s ease, border-color .12s ease; }
      .sala-control .node:hover { transform: translateY(-1px); }
      .sala-control .node.selected { border-color: rgba(255,90,0,0.4); box-shadow: 0 0 0 2px var(--primary-dim), 0 4px 24px rgba(0,0,0,0.45); }
      .sala-control .node-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 6px; }
      .sala-control .node-code { font-size: 10.5px; color: var(--text-muted); letter-spacing: .02em; }
      .sala-control .pill { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 2px 7px; border-radius: 100px; white-space: nowrap; }
      .sala-control .pill .dot { width: 6px; height: 6px; border-radius: 50%; flex: none; }
      .sala-control .pill.done { background: var(--s-done-soft); color: var(--s-done); }
      .sala-control .pill.done .dot { background: var(--s-done); }
      .sala-control .pill.running { background: var(--s-running-soft); color: var(--s-running); }
      .sala-control .pill.running .dot { background: var(--s-running); animation: pulse 1.4s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) { .sala-control .pill.running .dot { animation: none; } }
      @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(1.6); } }
      .sala-control .pill.blocked { background: var(--s-blocked-soft); color: var(--s-blocked); }
      .sala-control .pill.blocked .dot { background: var(--s-blocked); }
      .sala-control .pill.failed { background: var(--s-failed-soft); color: var(--s-failed); }
      .sala-control .pill.failed .dot { background: var(--s-failed); }
      .sala-control .pill.pending { background: var(--s-pending-soft); color: var(--text-secondary); }
      .sala-control .pill.pending .dot { background: var(--s-pending); }
      .sala-control .node-title { font-size: 12.5px; font-weight: 700; line-height: 1.3; margin-bottom: 6px; color: var(--text-primary); }
      .sala-control .node-foot { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-muted); gap: 6px; }
      .sala-control .node-foot .agent { display: flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sala-control .avatar { width: 15px; height: 15px; border-radius: 50%; background: var(--primary-dim); color: var(--primary-light); font-size: 8.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex: none; }
      .sala-control .trace-wrap { padding: 14px 24px 24px; flex: 1; display: flex; flex-direction: column; min-height: 260px; }
      .sala-control .trace-panel { flex: 1; display: flex; flex-direction: column; background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border-base); border-radius: var(--radius); overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.02); }
      .sala-control .trace-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border-base); background: var(--glass-bg); flex-wrap: wrap; }
      .sala-control .trace-head .t-code { font-size: 12px; color: var(--text-muted); }
      .sala-control .trace-head .t-title { font-size: 13px; font-weight: 700; color: var(--text-primary); }
      .sala-control .trace-head-spacer { flex: 1; }
      .sala-control .trace-head .t-dur { font-size: 11.5px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
      .sala-control .trace-body { flex: 1; overflow: auto; padding: 14px 18px 18px; }
      .sala-control .trace-line { display: grid; grid-template-columns: 70px 16px 1fr; gap: 10px; align-items: start; padding: 3px 0; font-size: 12.5px; line-height: 1.55; }
      .sala-control .trace-line .t-time { color: var(--text-muted); font-variant-numeric: tabular-nums; font-size: 11.5px; padding-top: 1px; }
      .sala-control .trace-line .t-icon { width: 16px; height: 16px; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; margin-top: 1px; }
      .sala-control .i-info { background: var(--glass-bg); color: var(--text-muted); border: 1px solid var(--border-base); }
      .sala-control .i-write { background: var(--primary-dim); color: var(--primary-light); }
      .sala-control .i-check { background: var(--s-done-soft); color: var(--s-done); }
      .sala-control .i-run { background: var(--s-running-soft); color: var(--s-running); }
      .sala-control .i-fail { background: var(--s-failed-soft); color: var(--s-failed); }
      .sala-control .trace-line .t-msg { color: var(--text-primary); word-break: break-word; }
      .sala-control .trace-line .t-msg .muted { color: var(--text-muted); }
      .sala-control .trace-empty-note { display: flex; gap: 10px; align-items: flex-start; padding: 14px 16px; border-radius: 10px; background: var(--glass-bg); border: 1px dashed var(--border-base); color: var(--text-secondary); font-size: 12.5px; line-height: 1.5; }
      .sala-control .trace-cursor { display: inline-block; width: 6px; height: 12px; background: var(--s-running); margin-left: 2px; vertical-align: -2px; animation: blink 1s step-end infinite; }
      @media (prefers-reduced-motion: reduce) { .sala-control .trace-cursor { animation: none; } }
      @keyframes blink { 50% { opacity: 0; } }
    `}</style>
  )
}
