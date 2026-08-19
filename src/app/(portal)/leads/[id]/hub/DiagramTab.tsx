'use client'

import { useState, useEffect, useCallback, useRef, WheelEvent } from 'react'
import { Save, Loader2, Sparkles, X, MousePointer2, Layers, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

type NodeType = 'server' | 'database' | 'api' | 'frontend' | 'queue' | 'cache' | 'external' | 'user'
type EdgeType = 'data' | 'control' | 'event'

interface DiagNode {
  id: string; type: NodeType; label: string; description: string
  layer: number; row: number
}
interface DiagEdge {
  id: string; from: string; to: string; label: string; type: EdgeType
}
interface DiagData {
  title: string; description: string; nodes: DiagNode[]; edges: DiagEdge[]
}

const NODE_CFG: Record<NodeType, { label: string; accent: string; bg: string; icon: string }> = {
  server:   { label: 'Servidor',        accent: '#64748b', bg: '#1e293b', icon: '⬡' },
  database: { label: 'Base de datos',   accent: '#3b82f6', bg: '#1e3a5f', icon: '◈' },
  api:      { label: 'API / Gateway',   accent: '#14b8a6', bg: '#0f3832', icon: '⬡' },
  frontend: { label: 'Frontend',        accent: '#a78bfa', bg: '#2e1a4a', icon: '▣' },
  queue:    { label: 'Cola / Broker',   accent: '#f59e0b', bg: '#3a2a0a', icon: '⬡' },
  cache:    { label: 'Cache',           accent: '#f87171', bg: '#3a1010', icon: '◈' },
  external: { label: 'Externo',         accent: '#818cf8', bg: '#1e1e4a', icon: '⬡' },
  user:     { label: 'Usuario',         accent: '#34d399', bg: '#0a2a1e', icon: '◉' },
}

const EDGE_CFG: Record<EdgeType, { stroke: string; dash: string; label: string }> = {
  data:    { stroke: '#38bdf8', dash: '',    label: 'Datos'   },
  control: { stroke: '#fb923c', dash: '5 3', label: 'Control' },
  event:   { stroke: '#c084fc', dash: '2 4', label: 'Evento'  },
}

// Layout constants
const CARD_W  = 164
const CARD_H  = 72
const ROW_H   = 100
const LAYER_W = 210
const PAD_X   = 60
const PAD_Y   = 50

function nodePos(n: DiagNode) {
  return {
    x: PAD_X + n.layer * LAYER_W,
    y: PAD_Y + n.row * ROW_H,
  }
}

function uid() { return Math.random().toString(36).slice(2, 9) }
const defaultData: DiagData = { title: '', description: '', nodes: [], edges: [] }

export default function DiagramTab({ leadId }: { leadId: string }) {
  const [diag, setDiag]             = useState<DiagData>(defaultData)
  const [loaded, setLoaded]         = useState(false)
  const [saving, setSaving]         = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState<string | null>(null)
  const [selected, setSelected]     = useState<string | null>(null)

  // Viewport: pan + zoom
  const [vp, setVp] = useState({ x: 40, y: 20, scale: 1 })
  const svgRef      = useRef<SVGSVGElement>(null)
  const isPanning   = useRef(false)
  const panStart    = useRef({ mx: 0, my: 0, vx: 0, vy: 0 })
  const didDrag     = useRef(false)

  useEffect(() => {
    fetch(`/api/leads/diagram?leadId=${leadId}`)
      .then(r => r.ok ? r.json() : { data: null })
      .then(j => { setDiag(j.data ?? defaultData); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [leadId])

  const generate = useCallback(async () => {
    setGenerating(true); setGenError(null)
    try {
      const res = await fetch('/api/leads/diagram/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error al generar')
      setDiag(j.data); setSelected(null)
      setVp({ x: 40, y: 20, scale: 1 })
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setGenerating(false)
    }
  }, [leadId])

  const save = useCallback(async () => {
    setSaving(true)
    await fetch('/api/leads/diagram', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, data: diag }),
    }).finally(() => setSaving(false))
  }, [leadId, diag])

  const patchNode = useCallback((id: string, patch: Partial<DiagNode>) => {
    setDiag(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === id ? { ...n, ...patch } : n) }))
  }, [])

  const delNode = useCallback((id: string) => {
    setDiag(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== id),
      edges: prev.edges.filter(e => e.from !== id && e.to !== id),
    }))
    setSelected(null)
  }, [])

  const delEdge = useCallback((id: string) => {
    setDiag(prev => ({ ...prev, edges: prev.edges.filter(e => e.id !== id) }))
  }, [])

  // Zoom on wheel
  const onWheel = useCallback((e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const rect = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const delta = e.deltaY < 0 ? 1.12 : 0.89
    setVp(v => {
      const ns = Math.min(3, Math.max(0.3, v.scale * delta))
      return {
        x: mx - (mx - v.x) * (ns / v.scale),
        y: my - (my - v.y) * (ns / v.scale),
        scale: ns,
      }
    })
  }, [])

  const onSvgMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if ((e.target as Element).closest('[data-node]')) return
    isPanning.current = true
    didDrag.current = false
    panStart.current = { mx: e.clientX, my: e.clientY, vx: vp.x, vy: vp.y }
  }, [vp])

  const onSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning.current) return
    const dx = e.clientX - panStart.current.mx
    const dy = e.clientY - panStart.current.my
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag.current = true
    setVp(v => ({ ...v, x: panStart.current.vx + dx, y: panStart.current.vy + dy }))
  }, [])

  const onSvgMouseUp = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    isPanning.current = false
    if (!didDrag.current && !(e.target as Element).closest('[data-node]')) setSelected(null)
  }, [])

  const resetView = () => setVp({ x: 40, y: 20, scale: 1 })
  const zoom = (d: number) => setVp(v => ({ ...v, scale: Math.min(3, Math.max(0.3, v.scale * d)) }))

  const selNode = diag.nodes.find(n => n.id === selected)

  if (!loaded) return (
    <div className="flex items-center justify-center h-64 text-gray-600 gap-2">
      <Loader2 size={18} className="animate-spin" /> Cargando diagrama
    </div>
  )

  // Compute canvas bounds
  const maxLayer = diag.nodes.reduce((m, n) => Math.max(m, n.layer), 5)
  const maxRow   = diag.nodes.reduce((m, n) => Math.max(m, n.row), 3)
  const CANVAS_W = PAD_X * 2 + (maxLayer + 1) * LAYER_W + CARD_W
  const CANVAS_H = PAD_Y * 2 + (maxRow + 1) * ROW_H + CARD_H

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <input
            value={diag.title}
            onChange={e => setDiag(p => ({ ...p, title: e.target.value }))}
            placeholder="Nombre del diagrama..."
            className="bg-gray-900 text-white text-sm font-semibold px-3 py-2 rounded-xl border border-gray-800 focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/10 placeholder-gray-700 w-full transition-all"
          />
          <input
            value={diag.description}
            onChange={e => setDiag(p => ({ ...p, description: e.target.value }))}
            placeholder="Descripcion del diagrama..."
            className="bg-transparent text-gray-500 text-xs px-3 py-1.5 rounded-xl border border-transparent hover:border-gray-800 focus:border-gray-700 focus:outline-none focus:bg-gray-900/50 placeholder-gray-700 w-full transition-all"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <button
            onClick={generate} disabled={generating || saving}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-orange-600 hover:bg-orange-500 active:bg-orange-700 disabled:opacity-50 text-white shadow-md shadow-orange-900/20 transition-all active:scale-95"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? 'Generando...' : 'Generar'}
          </button>
          <button
            onClick={save} disabled={saving || generating}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-orange-600 hover:bg-orange-500 active:bg-orange-700 disabled:opacity-50 text-white shadow-md shadow-orange-900/20 transition-all active:scale-95"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </button>
        </div>
      </div>

      {genError && (
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-900/50 text-red-400 text-xs px-4 py-2.5 rounded-xl">
          <X size={13} className="shrink-0" />
          <span className="flex-1">{genError}</span>
          <button onClick={() => setGenError(null)} className="shrink-0 hover:text-red-200 p-0.5 rounded"><X size={12} /></button>
        </div>
      )}

      <div className="flex gap-4">
        {/* Canvas */}
        <div className="flex-1 rounded-2xl border border-gray-800 bg-gray-950 overflow-hidden relative" style={{ minHeight: 440 }}>

          {/* Zoom controls */}
          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
            <button onClick={() => zoom(1.25)} className="w-7 h-7 flex items-center justify-center bg-gray-900 border border-gray-800 rounded-lg text-gray-500 hover:text-white hover:border-gray-600 transition-all">
              <ZoomIn size={13} />
            </button>
            <button onClick={() => zoom(0.8)} className="w-7 h-7 flex items-center justify-center bg-gray-900 border border-gray-800 rounded-lg text-gray-500 hover:text-white hover:border-gray-600 transition-all">
              <ZoomOut size={13} />
            </button>
            <button onClick={resetView} className="w-7 h-7 flex items-center justify-center bg-gray-900 border border-gray-800 rounded-lg text-gray-500 hover:text-white hover:border-gray-600 transition-all">
              <Maximize2 size={12} />
            </button>
          </div>

          {generating && (
            <div className="absolute inset-0 bg-gray-950/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-4">
              <div className="w-12 h-12 rounded-full border border-violet-500/30 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-violet-400" />
              </div>
              <div className="text-center">
                <p className="text-sm text-violet-300 font-medium">Analizando componentes del sistema...</p>
                <p className="text-xs text-gray-600 mt-1">Claude está diseñando el diagrama de componentes</p>
              </div>
            </div>
          )}

          {!generating && diag.nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
              <Layers size={36} className="text-gray-800" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Sin diagrama definido</p>
                <p className="text-xs text-gray-800 mt-1 max-w-xs leading-relaxed">
                  Usa Generar para crear el diagrama de componentes automáticamente
                </p>
              </div>
            </div>
          )}

          <svg
            ref={svgRef}
            style={{ width: '100%', height: '100%', minHeight: 440, display: 'block', cursor: isPanning.current ? 'grabbing' : 'grab', userSelect: 'none' }}
            onWheel={onWheel}
            onMouseDown={onSvgMouseDown}
            onMouseMove={onSvgMouseMove}
            onMouseUp={onSvgMouseUp}
            onMouseLeave={() => { isPanning.current = false }}
          >
            <defs>
              {Object.entries(EDGE_CFG).map(([type, c]) => (
                <marker key={type} id={`d-arr-${type}`} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                  <polygon points="0,0 7,3.5 0,7" fill={c.stroke} opacity="0.9" />
                </marker>
              ))}
              <filter id="d-glow">
                <feGaussianBlur stdDeviation="2" result="cb" />
                <feMerge><feMergeNode in="cb" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            <g transform={`translate(${vp.x},${vp.y}) scale(${vp.scale})`}>

              {/* Layer header labels */}
              {['Usuario', 'Frontend', 'API', 'Servidor', 'Datos', 'Externo'].map((lbl, i) => {
                const x = PAD_X + i * LAYER_W + CARD_W / 2
                const hasNodes = diag.nodes.some(n => n.layer === i)
                if (!hasNodes) return null
                return (
                  <text key={i} x={x} y={24} textAnchor="middle"
                    fill="#334155" fontSize="10" fontWeight="700" letterSpacing="1.5"
                    style={{ textTransform: 'uppercase', pointerEvents: 'none' }}>
                    {lbl}
                  </text>
                )
              })}

              {/* Vertical layer dividers */}
              {Array.from({ length: maxLayer }, (_, i) => {
                const x = PAD_X + (i + 1) * LAYER_W - LAYER_W / 2 + CARD_W / 2
                return (
                  <line key={i} x1={x} y1={35} x2={x} y2={CANVAS_H}
                    stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
                )
              })}

              {/* Edges — drawn below nodes */}
              {diag.edges.map(edge => {
                const fn = diag.nodes.find(n => n.id === edge.from)
                const tn = diag.nodes.find(n => n.id === edge.to)
                if (!fn || !tn) return null
                const fp = nodePos(fn)
                const tp = nodePos(tn)
                const c  = EDGE_CFG[edge.type]
                const isSel = selected === fn.id || selected === tn.id
                const opacity = selected && !isSel ? 0.2 : 0.85

                // Connection points
                const sx = fp.x + CARD_W     // right of source
                const sy = fp.y + CARD_H / 2
                const tx = tp.x              // left of target
                const ty = tp.y + CARD_H / 2

                const goLeft = tx < sx
                let path: string

                if (!goLeft) {
                  // Simple horizontal bezier
                  const cx1 = sx + (tx - sx) * 0.5
                  const cx2 = tx - (tx - sx) * 0.5
                  path = `M ${sx} ${sy} C ${cx1} ${sy} ${cx2} ${ty} ${tx} ${ty}`
                } else {
                  // Route around: go down/up then left
                  const midY = Math.max(fp.y, tp.y) + CARD_H + 20
                  path = `M ${sx} ${sy} C ${sx+40} ${sy} ${sx+40} ${midY} ${(sx+tx)/2} ${midY} S ${tx-40} ${midY} ${tx-40} ${ty} L ${tx} ${ty}`
                }

                const midT = 0.5
                // approximate midpoint for label
                const lx = (sx + tx) / 2
                const ly = !goLeft ? (sy + ty) / 2 - 10 : fp.y + CARD_H + 26

                return (
                  <g key={edge.id} opacity={opacity} style={{ cursor: 'pointer' }}
                    onClick={e => { e.stopPropagation(); delEdge(edge.id) }}>
                    <path d={path} fill="none" stroke={c.stroke} strokeWidth={isSel ? 2 : 1.5}
                      strokeDasharray={c.dash} markerEnd={`url(#d-arr-${edge.type})`}
                      filter={isSel ? 'url(#d-glow)' : undefined}
                    />
                    {/* wider invisible hit area */}
                    <path d={path} fill="none" stroke="transparent" strokeWidth="10" />
                    {edge.label && (
                      <text x={lx} y={ly} textAnchor="middle" fill={c.stroke} fontSize="9" fontWeight="600"
                        style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: '#060c16', strokeWidth: 3 }}>
                        {edge.label}
                      </text>
                    )}
                  </g>
                )
              })}

              {/* Nodes */}
              {diag.nodes.map(node => {
                const cfg = NODE_CFG[node.type]
                const { x, y } = nodePos(node)
                const sel = selected === node.id
                const dimmed = selected && !sel && !diag.edges.some(e => e.from === node.id || e.to === node.id || e.from === selected || e.to === selected)
                const isConnected = selected && !sel && diag.edges.some(
                  e => (e.from === selected && e.to === node.id) || (e.to === selected && e.from === node.id)
                )

                return (
                  <g key={node.id} data-node="1"
                    style={{ cursor: 'pointer', opacity: selected && !sel && !isConnected ? 0.35 : 1, transition: 'opacity 0.15s' }}
                    onClick={e => { e.stopPropagation(); setSelected(sel ? null : node.id) }}
                  >
                    {/* Card shadow */}
                    <rect x={x+3} y={y+4} width={CARD_W} height={CARD_H} rx="10" fill="black" opacity="0.35" />

                    {/* Card body */}
                    <rect x={x} y={y} width={CARD_W} height={CARD_H} rx="9"
                      fill={cfg.bg}
                      stroke={sel ? cfg.accent : isConnected ? cfg.accent + '88' : '#1e293b'}
                      strokeWidth={sel ? 2 : 1}
                      filter={sel ? 'url(#d-glow)' : undefined}
                    />

                    {/* Left accent stripe */}
                    <rect x={x} y={y + 8} width="3" height={CARD_H - 16} rx="2" fill={cfg.accent} opacity="0.9" />

                    {/* Type badge */}
                    <rect x={x + 12} y={y + 10} width={68} height={16} rx="4"
                      fill={cfg.accent + '22'} />
                    <text x={x + 16} y={y + 21} fill={cfg.accent} fontSize="9" fontWeight="700"
                      style={{ pointerEvents: 'none', letterSpacing: '0.5px' }}>
                      {cfg.label.toUpperCase().slice(0, 12)}
                    </text>

                    {/* Label */}
                    <text x={x + 12} y={y + 43} fill={sel ? '#ffffff' : '#e2e8f0'} fontSize="12" fontWeight={sel ? 700 : 600}
                      style={{ pointerEvents: 'none' }}>
                      {node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label}
                    </text>

                    {/* Description */}
                    {node.description && (
                      <text x={x + 12} y={y + 57} fill="#475569" fontSize="9"
                        style={{ pointerEvents: 'none' }}>
                        {node.description.length > 22 ? node.description.slice(0, 21) + '…' : node.description}
                      </text>
                    )}

                    {/* Connection dots */}
                    <circle cx={x} cy={y + CARD_H/2} r="4" fill={cfg.accent} opacity={sel ? 1 : 0.4} />
                    <circle cx={x + CARD_W} cy={y + CARD_H/2} r="4" fill={cfg.accent} opacity={sel ? 1 : 0.4} />
                  </g>
                )
              })}
            </g>
          </svg>
        </div>

        {/* Sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-3">
          {selNode ? (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: NODE_CFG[selNode.type].accent }} />
                <span className="text-xs font-semibold flex-1 truncate" style={{ color: NODE_CFG[selNode.type].accent }}>
                  {NODE_CFG[selNode.type].label}
                </span>
                <button onClick={() => setSelected(null)}
                  className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-300 hover:bg-gray-800 transition-all">
                  <X size={11} />
                </button>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider font-medium px-0.5">Nombre</label>
                  <input value={selNode.label} placeholder="Nombre del componente"
                    onChange={e => patchNode(selNode.id, { label: e.target.value })}
                    className="bg-gray-800 text-white text-sm px-2.5 py-2 rounded-lg border border-gray-700/50 focus:outline-none focus:border-orange-500/50 w-full transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider font-medium px-0.5">Descripción</label>
                  <textarea value={selNode.description} placeholder="Rol y responsabilidades..." rows={3}
                    onChange={e => patchNode(selNode.id, { description: e.target.value })}
                    className="bg-gray-800 text-white text-xs px-2.5 py-2 rounded-lg border border-gray-700/50 focus:outline-none focus:border-orange-500/50 w-full resize-none transition-all leading-relaxed"
                  />
                </div>
              </div>

              {(() => {
                const edges = diag.edges.filter(e => e.from === selNode.id || e.to === selNode.id)
                if (!edges.length) return null
                return (
                  <div className="flex flex-col gap-2 pt-2 border-t border-gray-800">
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Conexiones ({edges.length})</p>
                    <div className="flex flex-col gap-1.5">
                      {edges.map(edge => {
                        const other = diag.nodes.find(n => n.id === (edge.from === selNode.id ? edge.to : edge.from))
                        const isOut = edge.from === selNode.id
                        const c = EDGE_CFG[edge.type]
                        return (
                          <div key={edge.id} className="flex items-center gap-1.5 group">
                            <span style={{ color: c.stroke }} className="text-sm shrink-0 font-bold">{isOut ? '→' : '←'}</span>
                            <p className="text-[11px] text-gray-300 truncate flex-1 font-medium">{other?.label ?? '?'}</p>
                            <button onClick={() => delEdge(edge.id)}
                              className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/10 text-gray-700 hover:text-red-400 transition-all shrink-0">
                              <X size={10} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              <button onClick={() => delNode(selNode.id)}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs text-red-500 border border-red-500/20 hover:bg-red-500/10 hover:border-red-500/40 transition-all mt-1">
                Eliminar componente
              </button>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 flex flex-col items-center gap-2 text-center">
              <MousePointer2 size={22} className="text-gray-800" />
              <p className="text-xs text-gray-600 leading-relaxed">Click en un componente para ver sus detalles</p>
              <p className="text-[10px] text-gray-700">Click en una conexión para eliminarla</p>
            </div>
          )}

          {/* Legend */}
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium mb-2.5">Componentes</p>
            <div className="flex flex-col gap-1">
              {(Object.entries(NODE_CFG) as [NodeType, typeof NODE_CFG[NodeType]][]).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 px-1 py-1">
                  <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: v.accent }} />
                  <span className="text-[11px] text-gray-500">{v.label}</span>
                </div>
              ))}
            </div>
            <div className="pt-3 mt-2 border-t border-gray-800 flex flex-col gap-2">
              <p className="text-[10px] text-gray-700 uppercase tracking-wider font-medium mb-0.5">Conexiones</p>
              {Object.entries(EDGE_CFG).map(([type, c]) => (
                <div key={type} className="flex items-center gap-2.5">
                  <svg width="28" height="8" className="shrink-0">
                    <line x1="1" y1="4" x2="22" y2="4" stroke={c.stroke} strokeWidth="1.5" strokeDasharray={c.dash} />
                    <polygon points="18,1.5 24,4 18,6.5" fill={c.stroke} />
                  </svg>
                  <span className="text-[11px] text-gray-500">{c.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-700 mt-3">Scroll para zoom · Drag para mover · Click conexión para eliminar</p>
          </div>
        </div>
      </div>
    </div>
  )
}
