'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Plus, Link2, Trash2, X, Loader2, Sparkles } from 'lucide-react'

// ── Isometric constants ───────────────────────────────────────────────────────

const TW = 80   // tile width
const TH = 40   // tile height (TW/2 → 2:1 isometric ratio)
const GRID = 6  // 6×6 grid
const SVG_W = 740
const SVG_H = 460
const OX = SVG_W / 2   // iso origin X
const OY = 90           // iso origin Y

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeType = 'server' | 'database' | 'api' | 'frontend' | 'queue' | 'cache' | 'external' | 'user'
type EdgeType = 'data' | 'control' | 'event'

interface ArchNode {
  id: string
  type: NodeType
  label: string
  description: string
  payload: string
  gridX: number
  gridY: number
}

interface ArchEdge {
  id: string
  from: string
  to: string
  label: string
  type: EdgeType
}

interface ArchData {
  title: string
  description: string
  nodes: ArchNode[]
  edges: ArchEdge[]
}

// ── Visual configs ────────────────────────────────────────────────────────────

const NODE_CFG: Record<NodeType, {
  label: string; h: number
  top: string; left: string; right: string; accent: string
}> = {
  server:   { label: 'Servidor',          h: 72, top: '#334155', left: '#1e293b', right: '#0f172a', accent: '#64748b' },
  database: { label: 'Base de datos',     h: 36, top: '#1e3a8a', left: '#1e40af', right: '#172554', accent: '#3b82f6' },
  api:      { label: 'API / Gateway',     h: 56, top: '#134e4a', left: '#0f766e', right: '#042f2e', accent: '#14b8a6' },
  frontend: { label: 'Frontend',          h: 60, top: '#4c1d95', left: '#6d28d9', right: '#2e1065', accent: '#a78bfa' },
  queue:    { label: 'Cola / Broker',     h: 44, top: '#78350f', left: '#b45309', right: '#451a03', accent: '#f59e0b' },
  cache:    { label: 'Caché',             h: 30, top: '#7f1d1d', left: '#991b1b', right: '#450a0a', accent: '#f87171' },
  external: { label: 'Servicio externo',  h: 52, top: '#312e81', left: '#4338ca', right: '#1e1b4b', accent: '#818cf8' },
  user:     { label: 'Usuario / Cliente', h: 24, top: '#052e16', left: '#065f46', right: '#031e0f', accent: '#34d399' },
}

const EDGE_CFG: Record<EdgeType, { stroke: string; dash: string; label: string }> = {
  data:    { stroke: '#38bdf8', dash: '6 3',  label: 'Datos'   },
  control: { stroke: '#fb923c', dash: '',     label: 'Control' },
  event:   { stroke: '#c084fc', dash: '2 5',  label: 'Evento'  },
}

// ── Iso math ──────────────────────────────────────────────────────────────────

function toSvg(gx: number, gy: number) {
  return { x: OX + (gx - gy) * TW / 2, y: OY + (gx + gy) * TH / 2 }
}

function geo(gx: number, gy: number, h: number) {
  const { x: cx, y: cy } = toSvg(gx, gy)

  const N = { x: cx,         y: cy }
  const E = { x: cx + TW/2,  y: cy + TH/2 }
  const S = { x: cx,         y: cy + TH }
  const W = { x: cx - TW/2,  y: cy + TH/2 }
  const Er = { x: E.x, y: E.y - h }
  const Sr = { x: S.x, y: S.y - h }
  const Wr = { x: W.x, y: W.y - h }
  const Nr = { x: N.x, y: N.y - h }

  const p = (arr: {x:number,y:number}[]) => arr.map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ')

  return {
    ground:  p([N, E, S, W]),
    left:    p([W, S, Sr, Wr]),
    right:   p([E, S, Sr, Er]),
    top:     p([Nr, Er, Sr, Wr]),
    center:  { x: cx, y: cy + TH/2 - h },
    labelX:  cx,
    labelY:  cy - h - 8,
  }
}

function uid() { return Math.random().toString(36).slice(2, 9) }

const defaultData: ArchData = { title: '', description: '', nodes: [], edges: [] }

// ── Component ─────────────────────────────────────────────────────────────────

export default function ArchitectureTab({ leadId }: { leadId: string }) {
  const [arch, setArch] = useState<ArchData>(defaultData)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'add' | 'connect'>('view')
  const [addType, setAddType] = useState<NodeType>('server')
  const [selected, setSelected] = useState<string | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  // pending add-node dialog
  const [pendingCell, setPendingCell] = useState<{gx:number,gy:number}|null>(null)
  const [pendingLabel, setPendingLabel] = useState('')
  // pending edge dialog
  const [pendingEdge, setPendingEdge] = useState<{from:string,to:string}|null>(null)
  const [edgeLabel, setEdgeLabel] = useState('')
  const [edgeType, setEdgeType] = useState<EdgeType>('data')

  useEffect(() => {
    fetch(`/api/leads/architecture?leadId=${leadId}`)
      .then(r => r.ok ? r.json() : { data: null })
      .then(j => { setArch(j.data ?? defaultData); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [leadId])

  const generate = useCallback(async () => {
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch('/api/leads/architecture/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error al generar')
      setArch(j.data)
      setSelected(null)
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setGenerating(false)
    }
  }, [leadId])

  const save = useCallback(async () => {
    setSaving(true)
    await fetch('/api/leads/architecture', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, data: arch }),
    }).finally(() => setSaving(false))
  }, [leadId, arch])

  const occupied = new Set(arch.nodes.map(n => `${n.gridX},${n.gridY}`))
  const selNode  = arch.nodes.find(n => n.id === selected)

  const cancelMode = useCallback(() => {
    setMode('view'); setConnectFrom(null); setPendingCell(null); setPendingEdge(null)
  }, [])

  // ── Cell / node click ──────────────────────────────────────────────────────

  const handleClick = useCallback((gx: number, gy: number) => {
    const node = arch.nodes.find(n => n.gridX === gx && n.gridY === gy)

    if (mode === 'add') {
      if (node) return
      setPendingCell({ gx, gy }); setPendingLabel('')
      return
    }

    if (mode === 'connect') {
      if (!node) return
      if (!connectFrom) { setConnectFrom(node.id); setSelected(node.id) }
      else if (connectFrom !== node.id) {
        setPendingEdge({ from: connectFrom, to: node.id })
        setEdgeLabel(''); setEdgeType('data')
        setConnectFrom(null); setMode('view')
      }
      return
    }

    setSelected(node?.id ?? null)
  }, [arch.nodes, mode, connectFrom])

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const confirmAdd = useCallback(() => {
    if (!pendingCell || !pendingLabel.trim()) return
    const node: ArchNode = {
      id: uid(), type: addType,
      label: pendingLabel.trim(),
      description: '', payload: '',
      gridX: pendingCell.gx, gridY: pendingCell.gy,
    }
    setArch(prev => ({ ...prev, nodes: [...prev.nodes, node] }))
    setPendingCell(null); setMode('view'); setSelected(node.id)
  }, [pendingCell, pendingLabel, addType])

  const confirmEdge = useCallback(() => {
    if (!pendingEdge) return
    const edge: ArchEdge = { id: uid(), ...pendingEdge, label: edgeLabel, type: edgeType }
    setArch(prev => ({ ...prev, edges: [...prev.edges, edge] }))
    setPendingEdge(null)
    setSelected(pendingEdge.to)
  }, [pendingEdge, edgeLabel, edgeType])

  const delNode = useCallback((id: string) => {
    setArch(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== id),
      edges: prev.edges.filter(e => e.from !== id && e.to !== id),
    }))
    setSelected(null)
  }, [])

  const delEdge = useCallback((id: string) => {
    setArch(prev => ({ ...prev, edges: prev.edges.filter(e => e.id !== id) }))
  }, [])

  const patchNode = useCallback((id: string, patch: Partial<ArchNode>) => {
    setArch(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === id ? { ...n, ...patch } : n) }))
  }, [])

  const patchEdge = useCallback((id: string, patch: Partial<ArchEdge>) => {
    setArch(prev => ({ ...prev, edges: prev.edges.map(e => e.id === id ? { ...e, ...patch } : e) }))
  }, [])

  // Render order: further back (smaller gx+gy) first
  const sorted = [...arch.nodes].sort((a, b) => (a.gridX + a.gridY) - (b.gridX + b.gridY))

  if (!loaded) return (
    <div className="flex items-center justify-center h-48 text-gray-500">
      <Loader2 size={20} className="animate-spin mr-2" /> Cargando arquitectura...
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <input
          value={arch.title}
          onChange={e => setArch(p => ({ ...p, title: e.target.value }))}
          placeholder="Título del mapa de arquitectura..."
          className="flex-1 bg-transparent text-base font-semibold text-white placeholder-gray-600 border-b border-gray-700 focus:border-orange-500 focus:outline-none pb-1"
        />
        <button
          onClick={generate}
          disabled={generating || saving}
          title="Generar arquitectura automáticamente según el contexto del lead"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shrink-0"
        >
          {generating
            ? <><Loader2 size={12} className="animate-spin" /> Generando…</>
            : <><Sparkles size={12} /> Generar</>}
        </button>
        <button onClick={save} disabled={saving || generating}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors shrink-0"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
        </button>
      </div>

      {/* Generation error */}
      {genError && (
        <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 text-red-400 text-xs px-3 py-2 rounded-lg">
          <X size={12} className="shrink-0" />
          <span className="flex-1">{genError}</span>
          <button onClick={() => setGenError(null)} className="shrink-0 hover:text-red-200"><X size={11} /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => cancelMode()}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'view' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
        >
          Seleccionar
        </button>

        <div className="flex items-center gap-1">
          <button onClick={() => setMode(m => m === 'add' ? 'view' : 'add')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${mode === 'add' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
          >
            <Plus size={11} /> Nodo
          </button>
          {mode === 'add' && (
            <select value={addType} onChange={e => setAddType(e.target.value as NodeType)}
              className="bg-gray-800 border border-gray-700 text-[11px] text-white rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500"
            >
              {(Object.entries(NODE_CFG) as [NodeType, typeof NODE_CFG[NodeType]][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          )}
        </div>

        <button onClick={() => { setMode(m => m === 'connect' ? 'view' : 'connect'); setConnectFrom(null) }}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${mode === 'connect' ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
        >
          <Link2 size={11} /> {mode === 'connect' ? (connectFrom ? 'Click destino…' : 'Click origen…') : 'Conectar'}
        </button>

        {mode !== 'view' && (
          <button onClick={cancelMode} className="text-[11px] text-gray-500 hover:text-white">✕ Cancelar</button>
        )}
      </div>

      {/* Main layout */}
      <div className="flex gap-3">
        {/* SVG canvas */}
        <div className="flex-1 rounded-xl border border-gray-700 bg-gray-950 overflow-hidden relative" style={{ minWidth: 0 }}>
          {generating && (
            <div className="absolute inset-0 bg-gray-950/80 flex flex-col items-center justify-center z-10 gap-3">
              <Loader2 size={28} className="animate-spin text-violet-400" />
              <p className="text-sm text-violet-300 font-medium">Analizando contexto y generando arquitectura…</p>
              <p className="text-xs text-gray-500">Esto puede tardar unos segundos</p>
            </div>
          )}
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ width: '100%', display: 'block' }}>
            <defs>
              {Object.entries(EDGE_CFG).map(([type, c]) => (
                <marker key={type} id={`arr-${type}`} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                  <polygon points="0,0 7,3.5 0,7" fill={c.stroke} />
                </marker>
              ))}
              <filter id="glow">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Subtle ground grid */}
            {Array.from({ length: GRID }, (_, gy) =>
              Array.from({ length: GRID }, (_, gx) => {
                const { x: cx, y: cy } = toSvg(gx, gy)
                const isOcc = occupied.has(`${gx},${gy}`)
                const isClickable = mode === 'add' ? !isOcc : mode === 'connect' ? isOcc : !isOcc
                return (
                  <polygon
                    key={`g${gx}-${gy}`}
                    points={`${cx},${cy} ${cx+TW/2},${cy+TH/2} ${cx},${cy+TH} ${cx-TW/2},${cy+TH/2}`}
                    fill={mode === 'add' && !isOcc ? '#1f2937' : 'transparent'}
                    stroke="#1f2937"
                    strokeWidth="1"
                    style={{ cursor: isClickable ? 'pointer' : 'default' }}
                    onClick={() => handleClick(gx, gy)}
                  />
                )
              })
            )}

            {/* Edges */}
            {arch.edges.map(edge => {
              const fn = arch.nodes.find(n => n.id === edge.from)
              const tn = arch.nodes.find(n => n.id === edge.to)
              if (!fn || !tn) return null
              const fg = geo(fn.gridX, fn.gridY, NODE_CFG[fn.type].h)
              const tg = geo(tn.gridX, tn.gridY, NODE_CFG[tn.type].h)
              const c  = EDGE_CFG[edge.type]
              const mx = (fg.center.x + tg.center.x) / 2
              const my = (fg.center.y + tg.center.y) / 2
              return (
                <g key={edge.id} filter="url(#glow)">
                  <line
                    x1={fg.center.x} y1={fg.center.y}
                    x2={tg.center.x} y2={tg.center.y}
                    stroke={c.stroke} strokeWidth="1.5"
                    strokeDasharray={c.dash}
                    markerEnd={`url(#arr-${edge.type})`}
                    opacity="0.75"
                  />
                  {edge.label && (
                    <text x={mx} y={my - 5} fill={c.stroke} fontSize="9" textAnchor="middle"
                      style={{ fontWeight: 600, paintOrder: 'stroke', stroke: '#0a0f1a', strokeWidth: 3 }}
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Buildings (back → front) */}
            {sorted.map(node => {
              const cfg = NODE_CFG[node.type]
              const g   = geo(node.gridX, node.gridY, cfg.h)
              const sel = selected === node.id
              const cFrom = connectFrom === node.id
              return (
                <g key={node.id} style={{ cursor: 'pointer' }} onClick={() => handleClick(node.gridX, node.gridY)}>
                  {/* Walls */}
                  <polygon points={g.left}  fill={cfg.left}  />
                  <polygon points={g.right} fill={cfg.right} />
                  {/* Roof */}
                  <polygon points={g.top}   fill={cfg.top}
                    stroke={sel ? cfg.accent : cFrom ? '#38bdf8' : '#0a0f1a'}
                    strokeWidth={sel || cFrom ? 2 : 0.5}
                    filter={sel ? 'url(#glow)' : undefined}
                  />
                  {/* Accent edge on roof for selection */}
                  {(sel || cFrom) && (
                    <polygon points={g.top} fill="none"
                      stroke={cFrom ? '#38bdf8' : cfg.accent}
                      strokeWidth="2" opacity="0.9" filter="url(#glow)"
                    />
                  )}
                  {/* Label */}
                  <text
                    x={g.labelX} y={g.labelY}
                    fill={sel ? cfg.accent : '#e2e8f0'}
                    fontSize="9.5" fontWeight={sel ? 700 : 500}
                    textAnchor="middle"
                    style={{ paintOrder: 'stroke', stroke: '#030712', strokeWidth: 3, pointerEvents: 'none' }}
                  >
                    {node.label.length > 15 ? node.label.slice(0, 14) + '…' : node.label}
                  </text>
                  {/* Type badge under label */}
                  <text x={g.labelX} y={g.labelY + 11} fill={cfg.accent} fontSize="7.5"
                    textAnchor="middle" opacity="0.7"
                    style={{ paintOrder: 'stroke', stroke: '#030712', strokeWidth: 2, pointerEvents: 'none' }}
                  >
                    {cfg.label}
                  </text>
                </g>
              )
            })}

            {/* Status hint */}
            {(mode === 'add' || mode === 'connect') && (
              <text x={SVG_W / 2} y={SVG_H - 10} fill="#374151" fontSize="10" textAnchor="middle">
                {mode === 'add'
                  ? 'Click en una celda vacía del mapa para colocar el nodo'
                  : connectFrom
                    ? 'Ahora click en el nodo destino'
                    : 'Click en el nodo de origen'}
              </text>
            )}
          </svg>
        </div>

        {/* Side panel */}
        <div className="w-52 shrink-0 flex flex-col gap-2.5">
          {/* Node detail panel */}
          {selNode ? (
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: NODE_CFG[selNode.type].top + '55', color: NODE_CFG[selNode.type].accent }}
                >
                  {NODE_CFG[selNode.type].label}
                </span>
                <button onClick={() => delNode(selNode.id)} title="Eliminar nodo"
                  className="text-gray-600 hover:text-red-400 transition-colors"
                ><Trash2 size={12} /></button>
              </div>

              <input value={selNode.label} placeholder="Nombre"
                onChange={e => patchNode(selNode.id, { label: e.target.value })}
                className="bg-gray-800 text-white text-xs px-2 py-1.5 rounded-lg border border-gray-700 focus:outline-none focus:border-orange-500 w-full"
              />
              <textarea value={selNode.description} placeholder="Descripción..." rows={3}
                onChange={e => patchNode(selNode.id, { description: e.target.value })}
                className="bg-gray-800 text-white text-[11px] px-2 py-1.5 rounded-lg border border-gray-700 focus:outline-none focus:border-orange-500 w-full resize-none"
              />
              <input value={selNode.payload} placeholder="Payload / datos que maneja"
                onChange={e => patchNode(selNode.id, { payload: e.target.value })}
                className="bg-gray-800 text-white text-[11px] px-2 py-1.5 rounded-lg border border-gray-700 focus:outline-none focus:border-orange-500 w-full"
              />

              {/* Connected edges */}
              {(() => {
                const edges = arch.edges.filter(e => e.from === selNode.id || e.to === selNode.id)
                if (!edges.length) return null
                return (
                  <div>
                    <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Conexiones</p>
                    {edges.map(edge => {
                      const other = arch.nodes.find(n => n.id === (edge.from === selNode.id ? edge.to : edge.from))
                      const isOut = edge.from === selNode.id
                      const c = EDGE_CFG[edge.type]
                      return (
                        <div key={edge.id} className="flex items-start gap-1 mb-1">
                          <span style={{ color: c.stroke }} className="text-xs shrink-0 mt-0.5">{isOut ? '→' : '←'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-gray-300 truncate">{other?.label ?? '?'}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <select value={edge.type}
                                onChange={e => patchEdge(edge.id, { type: e.target.value as EdgeType })}
                                className="bg-gray-800 border border-gray-700 text-[9px] text-gray-400 rounded px-1 py-0.5 focus:outline-none"
                                style={{ color: c.stroke }}
                              >
                                {Object.entries(EDGE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </select>
                              <input value={edge.label} placeholder="payload…"
                                onChange={e => patchEdge(edge.id, { label: e.target.value })}
                                className="bg-transparent text-[9px] text-gray-500 placeholder-gray-700 border-none outline-none flex-1 min-w-0"
                              />
                            </div>
                          </div>
                          <button onClick={() => delEdge(edge.id)} className="text-gray-700 hover:text-red-400 shrink-0 mt-0.5">
                            <X size={9} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-700 p-3 text-center text-[11px] text-gray-600">
              Seleccioná un nodo para editar sus detalles
            </div>
          )}

          {/* Legend */}
          <div className="bg-gray-900 rounded-xl border border-gray-700 p-3">
            <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-2">Leyenda</p>
            <div className="flex flex-col gap-1.5">
              {(Object.entries(NODE_CFG) as [NodeType, typeof NODE_CFG[NodeType]][]).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2">
                  <div className="w-3 h-2 rounded-sm shrink-0" style={{ background: v.top, boxShadow: `inset 0 -2px 0 ${v.left}` }} />
                  <span className="text-[10px] text-gray-400">{v.label}</span>
                </div>
              ))}
              <div className="mt-2 pt-1.5 border-t border-gray-800 flex flex-col gap-1.5">
                {Object.entries(EDGE_CFG).map(([type, c]) => (
                  <div key={type} className="flex items-center gap-2">
                    <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke={c.stroke} strokeWidth="1.5" strokeDasharray={c.dash} /></svg>
                    <span className="text-[10px] text-gray-400">{c.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description input */}
      <input
        value={arch.description}
        onChange={e => setArch(p => ({ ...p, description: e.target.value }))}
        placeholder="Descripción del sistema..."
        className="bg-gray-900/50 text-gray-300 text-xs px-3 py-2 rounded-lg border border-gray-700 focus:outline-none focus:border-orange-500"
      />

      {/* ── Add node dialog ── */}
      {pendingCell && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setPendingCell(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-72 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white">Nuevo nodo</h3>
            <select value={addType} onChange={e => setAddType(e.target.value as NodeType)}
              className="bg-gray-800 border border-gray-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
            >
              {(Object.entries(NODE_CFG) as [NodeType, typeof NODE_CFG[NodeType]][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <input
              value={pendingLabel}
              onChange={e => setPendingLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmAdd()}
              placeholder="Nombre del componente"
              autoFocus
              className="bg-gray-800 border border-gray-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPendingCell(null)} className="text-gray-400 hover:text-white text-sm px-3 py-1.5">Cancelar</button>
              <button onClick={confirmAdd} disabled={!pendingLabel.trim()}
                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
              >Agregar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edge type dialog ── */}
      {pendingEdge && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setPendingEdge(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 w-72 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white">Nueva conexión</h3>
            <div className="text-xs text-gray-400">
              <span className="text-white">{arch.nodes.find(n=>n.id===pendingEdge.from)?.label}</span>
              <span className="mx-2">→</span>
              <span className="text-white">{arch.nodes.find(n=>n.id===pendingEdge.to)?.label}</span>
            </div>
            <select value={edgeType} onChange={e => setEdgeType(e.target.value as EdgeType)}
              className="bg-gray-800 border border-gray-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
            >
              {Object.entries(EDGE_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <input
              value={edgeLabel}
              onChange={e => setEdgeLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmEdge()}
              placeholder="Payload / etiqueta (opcional)"
              className="bg-gray-800 border border-gray-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-orange-500"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPendingEdge(null)} className="text-gray-400 hover:text-white text-sm px-3 py-1.5">Cancelar</button>
              <button onClick={confirmEdge}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium"
              >Conectar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
