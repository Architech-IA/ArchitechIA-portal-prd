'use client'

import React, { useEffect, useMemo, useRef, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { usePageActions } from '@/lib/pageActionsContext'
import { Rocket, Layers, Map as MapIcon, Play } from 'lucide-react'

interface ChecklistItem { criterion: string; passed: boolean; reason: string }
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
  resultado: string | null
  checklist: ChecklistItem[] | null
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
  DONE: { label: 'DONE', pill: 'done' },
  FAILED: { label: 'Fallida', pill: 'failed' },
  BLOCKED: { label: 'Bloqueada', pill: 'blocked' },
  CANCELLED: { label: 'Cancelada', pill: 'pending' },
}

const COL_WIDTH = 280
const NODE_WIDTH = 200
const ROW_HEIGHT = 132
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
  const { setActions } = usePageActions()

  // Barra de pestañas Backlog/Sprint/Épicas/Solution/Sala de Control —
  // ver comentario equivalente en /backlog/control/page.tsx.
  useEffect(() => {
    setActions(
      <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <Link href="/backlog" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(249,115,22,0.08)'; (e.currentTarget as HTMLElement).style.color = '#d1d5db' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          Backlog
        </Link>
        <Link href="/backlog/sprint" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.08)'; (e.currentTarget as HTMLElement).style.color = '#d1d5db' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          <Rocket size={10}/> Sprint
        </Link>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }}/>
        <Link href="/backlog/epics" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(29,147,117,0.08)'; (e.currentTarget as HTMLElement).style.color = '#1D9375' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          <Layers size={10}/> Épicas
        </Link>
        <Link href="/backlog/solution" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1" style={{ color: '#6b7280' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(127,119,221,0.08)'; (e.currentTarget as HTMLElement).style.color = '#7F77DD' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6b7280' }}>
          <MapIcon size={10}/> Solution
        </Link>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }}/>
        <Link href="/backlog/control" className="px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1"
          style={{ background: 'rgba(59,130,246,0.2)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
          <Play size={10}/> Sala de Control
        </Link>
      </div>
    )
    return () => setActions(null)
  }, [])

  // Posiciones movidas a mano (drag) — pisan la posicion calculada por el
  // layout automatico solo para esa card. No se persiste: es puramente para
  // acomodar la vista mientras la mirás, se pierde al recargar.
  const [manualPos, setManualPos] = useState<Record<string, { x: number; y: number }>>({})
  const [selectedConnector, setSelectedConnector] = useState<number | null>(null)
  const dragState = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number; dragged: boolean } | null>(null)

  // refreshNonce: permite forzar un refresh inmediato del grafo (en vez de
  // esperar hasta 5s del poll normal) cuando "Ejecutar plan" dispara una
  // ejecucion real — asi el usuario ve de inmediato que la tarea paso a
  // IN_PROGRESS y el panel de traza en vivo, en vez de quedar mirando el
  // mensaje estatico "se disparo" sin ninguna confirmacion visible de que
  // algo realmente esta pasando.
  const [refreshNonce, setRefreshNonce] = useState(0)
  const forceRefresh = () => setRefreshNonce((n) => n + 1)

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
  }, [sprintId, refreshNonce])

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
  const [connectors, setConnectors] = useState<{ id: string; d: string; live: boolean }[]>([])

  useEffect(() => {
    if (!data || !layout || !stageRef.current) return
    const stageRect = stageRef.current.getBoundingClientRect()
    const next: { id: string; d: string; live: boolean }[] = []
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
      // El tronco vertical va cerca del padre (offset fijo, no el punto
      // medio geometrico) para dejar espacio de sobra antes de llegar a la
      // columna de los hijos — con el punto medio exacto, cuando dos
      // hermanos comparten padre, la linea vertical quedaba pegada al borde
      // de las cards y daba la falsa impresion de que estaban unidas entre
      // si (en vez de ambas colgando del mismo padre).
      const midX = x1 + Math.min(24, (x2 - x1) / 2)
      const r = Math.min(8, Math.abs(y2 - y1) / 2, midX - x1, x2 - midX)
      const d = y1 === y2
        ? `M ${x1} ${y1} L ${x2} ${y2}`
        : y2 > y1
          ? `M ${x1} ${y1} L ${midX - r} ${y1} Q ${midX} ${y1} ${midX} ${y1 + r} L ${midX} ${y2 - r} Q ${midX} ${y2} ${midX + r} ${y2} L ${x2} ${y2}`
          : `M ${x1} ${y1} L ${midX - r} ${y1} Q ${midX} ${y1} ${midX} ${y1 - r} L ${midX} ${y2 + r} Q ${midX} ${y2} ${midX + r} ${y2} L ${x2} ${y2}`
      const parentTask = data.tasks.find((p) => p.id === t.dependsOnTaskId)
      const live = t.status === 'IN_PROGRESS' || parentTask?.status === 'IN_PROGRESS'
      next.push({ id: t.id, d, live })
    }
    setConnectors(next)
  }, [data, layout, manualPos])

  // --- Drag de cards: reposiciona solo visualmente (manualPos), nunca
  // dispara la seleccion de la task ni toca el panel de traza. Distingue
  // "hubo drag real" de "fue un click" por umbral de movimiento — si el
  // mouse se movio mas de 4px, el click que sigue al soltar se ignora.
  function startDrag(e: React.MouseEvent, task: Task, current: { x: number; y: number }) {
    if (e.button !== 0) return
    dragState.current = { id: task.id, startX: e.clientX, startY: e.clientY, origX: current.x, origY: current.y, dragged: false }
    const onMove = (ev: MouseEvent) => {
      const ds = dragState.current
      if (!ds) return
      const dx = ev.clientX - ds.startX
      const dy = ev.clientY - ds.startY
      if (!ds.dragged && Math.hypot(dx, dy) > 4) ds.dragged = true
      if (ds.dragged) {
        setManualPos((prev) => ({ ...prev, [ds.id]: { x: ds.origX + dx, y: ds.origY + dy } }))
      }
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      // El dragState se limpia en el proximo tick, despues de que el click
      // sintetico del mouseup ya paso por handleNodeClick.
      setTimeout(() => { dragState.current = null }, 0)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function handleNodeClick(task: Task) {
    if (dragState.current?.dragged) return
    setSelected(task)
  }

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
            <span className="chip c-done"><i className="dot" /><strong>{counts.done}</strong></span>
            <span className="chip c-running"><i className="dot" /><strong>{counts.running}</strong></span>
            <span className="chip c-blocked"><i className="dot" /><strong>{counts.blocked}</strong></span>
            <span className="chip c-failed"><i className="dot" /><strong>{counts.failed}</strong></span>
            <span className="chip c-pending"><i className="dot" /><strong>{counts.pending}</strong></span>
          </div>
          <button
            className="dispatch-btn"
            disabled={backlogTaskIds.length === 0 || dispatching}
            onClick={handleDispatch}
            title={backlogTaskIds.length === 0 ? 'No hay tasks en cola para disparar' : `Disparar ${backlogTaskIds.length} task${backlogTaskIds.length !== 1 ? 's' : ''} en BACKLOG`}
          >
            {dispatching ? '…' : `▶ ${backlogTaskIds.length}`}
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
                  <g key={c.id}>
                    <path
                      d={c.d}
                      className="connector-hit"
                      onClick={(e) => { e.stopPropagation(); setSelectedConnector((prev) => (prev === i ? null : i)) }}
                    />
                    <path d={c.d} className={[c.live ? 'live' : '', selectedConnector === i ? 'selected' : ''].filter(Boolean).join(' ')} />
                  </g>
                ))}
              </svg>

              {data?.tasks.map((t) => {
                const manual = manualPos[t.id]
                const p = manual ?? layout?.pos.get(t.id)
                const st = STATUS_MAP[t.status] ?? STATUS_MAP.BACKLOG
                const initial = (t.assigneeName ?? '?').charAt(0).toUpperCase()
                return (
                  <div
                    key={t.id}
                    data-node={t.id}
                    className={`node ${selected?.id === t.id ? 'selected' : ''}`}
                    style={{ left: p?.x ?? 0, top: p?.y ?? 0, width: NODE_WIDTH }}
                    onMouseDown={(e) => startDrag(e, t, p ?? { x: 0, y: 0 })}
                    onClick={() => handleNodeClick(t)}
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
              {selected && (selected.status === 'FAILED' || selected.status === 'BLOCKED') && (
                <DiagnosisBlock task={selected} onApplied={forceRefresh} />
              )}
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

// Informe/diagnostico real de por que una task quedo FAILED o BLOCKED —
// el motivo completo (errores de tsc, por que el verificador la rechazo,
// que archivos chocaron en el merge) ya se guardaba en BacklogItem.resultado
// y TaskExecution.artifacts.checklist, pero antes no se mostraba en ningun
// lado de la Sala de Control: solo se veian lineas cortas de traza. Este
// bloque muestra el detalle completo, no un resumen recortado.
// "Explicar" dispara un mini-agente investigador (masd_worker.py, task
// type=explain_task) con acceso REAL y completo al repositorio (las mismas
// 7 herramientas que un agente CODE: read_file/write_file/grep_files/
// list_files/find_symbol/get_file_summary/get_dependents) para que el
// usuario no tenga que interpretar el error crudo el mismo — el agente lee
// el codigo real y explica causa raiz + remediacion. Polling simple cada
// 2s hasta DONE/FAILED, igual que el resto de la Sala de Control.
function ExplainButton({ taskId }: { taskId: string }) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [texto, setTexto] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  async function poll(execId: string) {
    try {
      const res = await fetch(`/api/backlog/task/${taskId}/explain?execId=${execId}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.status === 'DONE') {
        setTexto(data.resultado ?? '(sin contenido)')
        setState('done')
        if (pollRef.current) clearInterval(pollRef.current)
      } else if (data.status === 'FAILED') {
        setTexto(data.resultado ?? 'El agente de explicación falló.')
        setState('error')
        if (pollRef.current) clearInterval(pollRef.current)
      }
    } catch { /* reintenta en el proximo tick */ }
  }

  async function start() {
    setState('running')
    setTexto(null)
    try {
      const res = await fetch(`/api/backlog/task/${taskId}/explain`, { method: 'POST' })
      if (!res.ok) { setState('error'); setTexto('No se pudo iniciar la explicación.'); return }
      const { execId } = await res.json()
      pollRef.current = setInterval(() => poll(execId), 2000)
    } catch {
      setState('error')
      setTexto('No se pudo iniciar la explicación.')
    }
  }

  if (state === 'idle') {
    return <button className="explain-btn" onClick={start}>✨ Explicar</button>
  }
  if (state === 'running') {
    return (
      <div className="explain-box explain-running">
        <span className="explain-spinner" /> Investigando el repositorio real…
      </div>
    )
  }
  return (
    <div className={`explain-box ${state === 'error' ? 'explain-error' : 'explain-ok'}`}>
      <div className="explain-box-title">{state === 'error' ? '✕ No se pudo explicar' : '✨ Explicación'}</div>
      <pre className="diagnosis-text">{texto}</pre>
      <button className="explain-btn explain-retry" onClick={start}>Volver a explicar</button>
    </div>
  )
}

interface PlanStep { titulo: string; descripcion: string; archivos?: string[]; riesgo?: string }
interface PlanJson { resumen?: string; pasos: PlanStep[]; automatizable?: boolean; motivoNoAutomatizable?: string | null }

// "Proponer plan" (mismo mini-agente investigador que Explicar, pero le pide
// un JSON de pasos en vez de un parrafo) → una vez el usuario lo revisa,
// "Ejecutar plan" dispara una ejecucion REAL (dispatchTask real: worktree
// aislado, agente CODE, verificador, merge — el mismo mecanismo del boton
// "Disparar" manual) pasandole el plan aprobado como guia. Esto SI puede
// modificar codigo — a diferencia de Explicar/Proponer plan, que son de
// solo lectura.
//
// onApplied: fuerza un refresh inmediato del grafo/traza en el padre en vez
// de esperar hasta 5s del poll normal — asi el usuario ve de una la tarea
// pasar a IN_PROGRESS y el panel de traza en vivo, no un mensaje estatico
// sin ninguna confirmacion visible de que algo realmente esta pasando.
function PlanButton({ taskId, onApplied }: { taskId: string; onApplied: () => void }) {
  const [state, setState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [plan, setPlan] = useState<PlanJson | null>(null)
  const [texto, setTexto] = useState<string | null>(null)
  const [execId, setExecId] = useState<string | null>(null)
  const [applyState, setApplyState] = useState<'idle' | 'applying' | 'applied' | 'error'>('idle')
  const [applyMsg, setApplyMsg] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  async function poll(id: string) {
    try {
      const res = await fetch(`/api/backlog/task/${taskId}/plan?execId=${id}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.status === 'DONE') {
        setPlan(data.planJson ?? null)
        setTexto(data.resultado ?? '(sin contenido)')
        setState('done')
        if (pollRef.current) clearInterval(pollRef.current)
      } else if (data.status === 'FAILED') {
        setTexto(data.resultado ?? 'El agente de planificación falló.')
        setState('error')
        if (pollRef.current) clearInterval(pollRef.current)
      }
    } catch { /* reintenta en el proximo tick */ }
  }

  async function start() {
    setState('running')
    setPlan(null)
    setTexto(null)
    setApplyState('idle')
    setApplyMsg(null)
    try {
      const res = await fetch(`/api/backlog/task/${taskId}/plan`, { method: 'POST' })
      if (!res.ok) { setState('error'); setTexto('No se pudo iniciar la propuesta de plan.'); return }
      const { execId: id } = await res.json()
      setExecId(id)
      pollRef.current = setInterval(() => poll(id), 2000)
    } catch {
      setState('error')
      setTexto('No se pudo iniciar la propuesta de plan.')
    }
  }

  async function applyPlan() {
    if (!execId) return
    setApplyState('applying')
    setApplyMsg(null)
    try {
      const res = await fetch(`/api/backlog/task/${taskId}/apply-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ execId }),
      })
      const data = await res.json()
      if (!res.ok) { setApplyState('error'); setApplyMsg(data.error ?? 'No se pudo ejecutar el plan.'); return }
      setApplyState('applied')
      setApplyMsg('Ejecución real disparada — mirá la traza de la tarea, se está actualizando.')
      onApplied()
    } catch {
      setApplyState('error')
      setApplyMsg('No se pudo ejecutar el plan.')
    }
  }

  if (state === 'idle') {
    return <button className="explain-btn" onClick={start}>📋 Proponer plan</button>
  }
  if (state === 'running') {
    return (
      <div className="explain-box explain-running">
        <span className="explain-spinner" /> Armando el plan de remediación…
      </div>
    )
  }
  if (state === 'error') {
    return (
      <div className="explain-box explain-error">
        <div className="explain-box-title">✕ No se pudo proponer un plan</div>
        <pre className="diagnosis-text">{texto}</pre>
        <button className="explain-btn explain-retry" onClick={start}>Reintentar</button>
      </div>
    )
  }
  // Si el propio agente investigador determinó que esto requiere una acción
  // humana (reunión, aprobación de negocio, otra tarea que depende de una
  // persona), no se ofrece el botón de auto-ejecución — mostrarlo igual
  // invitaría a gastar una corrida real completa (varios minutos, cientos
  // de miles de tokens) para terminar en el mismo bloqueo. El backend
  // (apply-plan) también lo rechaza si se lo llama igual por otra vía.
  const noAutomatizable = plan?.automatizable === false
  return (
    <div className="explain-box explain-ok">
      <div className="explain-box-title">📋 Plan propuesto</div>
      {plan?.resumen && <p className="plan-resumen">{plan.resumen}</p>}
      {noAutomatizable && (
        <div className="plan-manual-notice">
          🖐 Requiere una acción humana — no se puede auto-ejecutar. {plan?.motivoNoAutomatizable}
        </div>
      )}
      {plan && plan.pasos.length > 0 ? (
        <ol className="plan-steps">
          {plan.pasos.map((p, i) => (
            <li key={i} className={`plan-step risk-${p.riesgo ?? 'bajo'}`}>
              <div className="plan-step-head">
                <span className="plan-step-num">{i + 1}</span>
                <span className="plan-step-title">{p.titulo}</span>
                {p.riesgo && <span className={`plan-risk-pill r-${p.riesgo}`}>{p.riesgo}</span>}
              </div>
              <div className="plan-step-desc">{p.descripcion}</div>
              {p.archivos && p.archivos.length > 0 && (
                <div className="plan-step-files mono">{p.archivos.join(' · ')}</div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <pre className="diagnosis-text">{texto}</pre>
      )}
      <div className="plan-actions">
        <button className="explain-btn explain-retry" onClick={start}>Volver a proponer</button>
        {!noAutomatizable && (
          <button
            className="apply-plan-btn"
            onClick={applyPlan}
            disabled={applyState === 'applying' || applyState === 'applied'}
          >
            {applyState === 'applying' ? 'Ejecutando…' : applyState === 'applied' ? '✓ Ejecución disparada' : '▶ Ejecutar este plan'}
          </button>
        )}
      </div>
      {applyMsg && (
        <div className={`apply-msg ${applyState === 'error' ? 'apply-msg-error' : 'apply-msg-ok'}`}>{applyMsg}</div>
      )}
    </div>
  )
}

function DiagnosisBlock({ task, onApplied }: { task: Task; onApplied: () => void }) {
  if (!task.resultado && !task.checklist) return null
  const kind = task.status === 'FAILED' ? 'failed' : 'blocked'
  return (
    <div className={`diagnosis diagnosis-${kind}`}>
      <div className="diagnosis-title">
        {task.status === 'FAILED' ? '✕ Diagnóstico de la falla' : '⚠ Diagnóstico del bloqueo'}
      </div>
      {task.checklist && task.checklist.length > 0 && (
        <ul className="diagnosis-checklist">
          {task.checklist.map((c, i) => (
            <li key={i} className={c.passed ? 'ok' : 'bad'}>
              <span className="ck-icon">{c.passed ? '✓' : '✕'}</span>
              <span>
                <span className="ck-criterion">{c.criterion}</span>
                {!c.passed && c.reason && <div className="ck-reason">{c.reason}</div>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {task.resultado && <pre className="diagnosis-text">{task.resultado}</pre>}
      <div className="diagnosis-actions">
        <ExplainButton taskId={task.id} />
        <PlanButton taskId={task.id} onApplied={onApplied} />
      </div>
    </div>
  )
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
      .sala-control .topbar { height: 30px; display: flex; align-items: center; gap: 20px; padding: 0 20px; border-bottom: 1px solid var(--border-base); background: var(--bg-elevated); backdrop-filter: blur(20px); flex-wrap: nowrap; overflow: hidden; }
      .sala-control .brand { display: flex; align-items: baseline; gap: 10px; margin-right: 4px; }
      .sala-control .brand-mark { width: 7px; height: 7px; border-radius: 2px; background: var(--primary); display: inline-block; transform: rotate(45deg); flex: none; }
      .sala-control .brand h1 { font-size: 12px; font-weight: 800; margin: 0; letter-spacing: -0.01em; }
      .sala-control .breadcrumb { display: flex; align-items: center; gap: 6px; color: var(--text-secondary); font-size: 11px; flex-wrap: nowrap; overflow: hidden; }
      .sala-control .back-link { color: var(--primary-light); text-decoration: none; font-weight: 600; }
      .sala-control .back-link:hover { text-decoration: underline; }
      .sala-control .breadcrumb .code { font-size: 10px; padding: 2px 6px; border-radius: 5px; background: var(--glass-bg); color: var(--text-primary); border: 1px solid var(--border-base); }
      .sala-control .breadcrumb .sep { color: var(--text-muted); }
      .sala-control .topbar-spacer { flex: 1; }
      .sala-control .status-summary { display: flex; gap: 4px; flex-wrap: nowrap; overflow: hidden; }
      .sala-control .chip { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; padding: 3px 7px 3px 6px; border-radius: 100px; border: 1px solid var(--border-base); background: var(--glass-bg); color: var(--text-secondary); line-height: 1; }
      .sala-control .chip .dot { width: 6px; height: 6px; border-radius: 50%; flex: none; }
      .sala-control .chip strong { color: var(--text-primary); font-variant-numeric: tabular-nums; }
      .sala-control .chip.c-done .dot { background: var(--s-done); }
      .sala-control .chip.c-running .dot { background: var(--s-running); }
      .sala-control .chip.c-blocked .dot { background: var(--s-blocked); }
      .sala-control .chip.c-failed .dot { background: var(--s-failed); }
      .sala-control .chip.c-pending .dot { background: var(--s-pending); }
      .sala-control .error-banner { margin: 14px 24px 0; padding: 10px 14px; border-radius: 10px; background: var(--s-failed-soft); color: var(--s-failed); font-size: 13px; }
      .sala-control .dispatch-btn { background: var(--primary); color: #fff; border: none; border-radius: 100px; padding: 4px 10px; font-size: 10.5px; font-weight: 700; cursor: pointer; white-space: nowrap; flex: none; transition: filter .12s ease, opacity .12s ease; }
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
      .sala-control .stage { user-select: none; }
      .sala-control svg.connectors { position: absolute; inset: 0; overflow: visible; pointer-events: none; user-select: none; }
      .sala-control svg.connectors path { fill: none; stroke: var(--text-muted); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; opacity: .55; }
      .sala-control svg.connectors path.connector-hit { stroke: transparent; stroke-width: 14; pointer-events: stroke; cursor: pointer; opacity: 1; }
      .sala-control svg.connectors path.live { stroke: var(--s-running); opacity: .9; stroke-dasharray: 5 4; animation: dash 1.1s linear infinite; }
      .sala-control svg.connectors path.selected { stroke: var(--primary-light); opacity: 1; stroke-width: 2.6; }
      @media (prefers-reduced-motion: reduce) { .sala-control svg.connectors path.live { animation: none; } }
      @keyframes dash { to { stroke-dashoffset: -18; } }
      .sala-control .node { position: absolute; border-radius: var(--radius); border: 1px solid var(--border-base); background: var(--bg-card); backdrop-filter: blur(20px); box-shadow: 0 4px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.02); padding: 10px 12px 11px; cursor: grab; transition: border-color .12s ease; }
      .sala-control .node:active { cursor: grabbing; }
      .sala-control .node:hover { border-color: var(--glass-border-md); }
      .sala-control .node.selected { border-color: rgba(255,90,0,0.4); box-shadow: 0 0 0 2px var(--primary-dim), 0 4px 24px rgba(0,0,0,0.45); }
      .sala-control .node-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 6px; }
      .sala-control .node-code { font-size: 10.5px; color: var(--text-muted); letter-spacing: .02em; }
      .sala-control .pill { display: inline-flex; align-items: center; gap: 5px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 2px 7px; border-radius: 100px; white-space: nowrap; }
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
      .sala-control .node-title { font-size: 12.5px; font-weight: 700; line-height: 1.3; margin-bottom: 6px; color: var(--text-primary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .sala-control .node-foot { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-muted); gap: 6px; }
      .sala-control .node-foot .agent { display: flex; align-items: center; gap: 5px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .sala-control .avatar { width: 15px; height: 15px; border-radius: 50%; background: var(--primary-dim); color: var(--primary-light); font-size: 8.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex: none; }
      .sala-control .trace-wrap { padding: 14px 24px 24px; flex: 1; display: flex; flex-direction: column; min-height: 260px; }
      .sala-control .trace-panel { flex: 1; display: flex; flex-direction: column; background: var(--bg-card); backdrop-filter: blur(20px); border: 1px solid var(--border-base); border-radius: var(--radius); overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.02); }
      .sala-control .trace-head { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border-base); background: var(--glass-bg); flex-wrap: nowrap; overflow: hidden; }
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
      .sala-control .diagnosis { border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; border: 1px solid; }
      .sala-control .diagnosis-failed { background: var(--s-failed-soft); border-color: rgba(239,68,68,0.35); }
      .sala-control .diagnosis-blocked { background: var(--s-blocked-soft); border-color: rgba(245,158,11,0.35); }
      .sala-control .diagnosis-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 8px; }
      .sala-control .diagnosis-failed .diagnosis-title { color: var(--s-failed); }
      .sala-control .diagnosis-blocked .diagnosis-title { color: var(--s-blocked); }
      .sala-control .diagnosis-checklist { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 6px; }
      .sala-control .diagnosis-checklist li { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; }
      .sala-control .diagnosis-checklist .ck-icon { flex: none; font-weight: 800; margin-top: 1px; }
      .sala-control .diagnosis-checklist li.ok .ck-icon { color: var(--s-done); }
      .sala-control .diagnosis-checklist li.bad .ck-icon { color: var(--s-failed); }
      .sala-control .diagnosis-checklist .ck-criterion { color: var(--text-primary); font-weight: 600; }
      .sala-control .diagnosis-checklist .ck-reason { color: var(--text-secondary); margin-top: 2px; line-height: 1.5; }
      .sala-control .diagnosis-text { white-space: pre-wrap; word-break: break-word; font-family: ui-monospace, 'SF Mono', 'Cascadia Code', Menlo, monospace; font-size: 11.5px; line-height: 1.6; color: var(--text-primary); background: rgba(0,0,0,0.15); border-radius: 8px; padding: 10px 12px; margin: 0; max-height: 260px; overflow: auto; }
      .sala-control .explain-btn { margin-top: 4px; background: var(--glass-bg); border: 1px solid var(--glass-border-md); color: var(--text-primary); border-radius: 100px; padding: 6px 14px; font-size: 12px; font-weight: 700; cursor: pointer; transition: filter .12s ease; }
      .sala-control .explain-btn:hover { filter: brightness(1.15); border-color: var(--primary-light); }
      .sala-control .explain-retry { margin-top: 10px; }
      .sala-control .explain-box { margin-top: 4px; border-radius: 10px; padding: 12px 14px; }
      .sala-control .explain-running { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-secondary); padding: 8px 2px; }
      .sala-control .explain-spinner { width: 12px; height: 12px; border-radius: 50%; border: 2px solid var(--border-base); border-top-color: var(--cyan); animation: explain-spin .7s linear infinite; flex: none; }
      @media (prefers-reduced-motion: reduce) { .sala-control .explain-spinner { animation: none; } }
      @keyframes explain-spin { to { transform: rotate(360deg); } }
      .sala-control .explain-ok { background: rgba(2,201,154,0.08); border: 1px solid rgba(2,201,154,0.3); }
      .sala-control .explain-error { background: var(--s-failed-soft); border: 1px solid rgba(239,68,68,0.35); }
      .sala-control .explain-box-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 8px; color: var(--text-primary); }
      .sala-control .explain-error .explain-box-title { color: var(--s-failed); }
      .sala-control .diagnosis-actions { display: flex; gap: 8px; margin-top: 4px; }
      .sala-control .plan-resumen { font-size: 12.5px; color: var(--text-secondary); margin: 0 0 10px; line-height: 1.5; }
      .sala-control .plan-manual-notice { font-size: 12px; color: var(--s-blocked); background: var(--s-blocked-soft); border: 1px solid rgba(245,158,11,0.35); border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; line-height: 1.5; }
      .sala-control .plan-steps { list-style: none; margin: 0 0 10px; padding: 0; display: grid; gap: 8px; }
      .sala-control .plan-step { border: 1px solid var(--border-base); border-radius: 8px; padding: 8px 10px; background: rgba(0,0,0,0.12); }
      .sala-control .plan-step-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
      .sala-control .plan-step-num { width: 18px; height: 18px; border-radius: 50%; background: var(--glass-bg); border: 1px solid var(--border-base); font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex: none; }
      .sala-control .plan-step-title { font-size: 12.5px; font-weight: 700; color: var(--text-primary); flex: 1; }
      .sala-control .plan-risk-pill { font-size: 9.5px; font-weight: 700; text-transform: uppercase; padding: 2px 7px; border-radius: 100px; letter-spacing: .03em; }
      .sala-control .plan-risk-pill.r-bajo { background: var(--s-done-soft); color: var(--s-done); }
      .sala-control .plan-risk-pill.r-medio { background: var(--s-blocked-soft); color: var(--s-blocked); }
      .sala-control .plan-risk-pill.r-alto { background: var(--s-failed-soft); color: var(--s-failed); }
      .sala-control .plan-step-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.55; }
      .sala-control .plan-step-files { font-size: 10.5px; color: var(--text-muted); margin-top: 5px; }
      .sala-control .plan-actions { display: flex; gap: 8px; align-items: center; }
      .sala-control .apply-plan-btn { background: var(--primary); color: #fff; border: none; border-radius: 100px; padding: 6px 14px; font-size: 12px; font-weight: 700; cursor: pointer; transition: filter .12s ease, opacity .12s ease; }
      .sala-control .apply-plan-btn:hover:not(:disabled) { filter: brightness(1.1); }
      .sala-control .apply-plan-btn:disabled { opacity: .6; cursor: not-allowed; }
      .sala-control .apply-msg { margin-top: 8px; font-size: 11.5px; padding: 6px 10px; border-radius: 8px; }
      .sala-control .apply-msg-ok { background: var(--s-done-soft); color: var(--s-done); }
      .sala-control .apply-msg-error { background: var(--s-failed-soft); color: var(--s-failed); }
      .sala-control .trace-cursor { display: inline-block; width: 6px; height: 12px; background: var(--s-running); margin-left: 2px; vertical-align: -2px; animation: blink 1s step-end infinite; }
      @media (prefers-reduced-motion: reduce) { .sala-control .trace-cursor { animation: none; } }
      @keyframes blink { 50% { opacity: 0; } }
    `}</style>
  )
}
