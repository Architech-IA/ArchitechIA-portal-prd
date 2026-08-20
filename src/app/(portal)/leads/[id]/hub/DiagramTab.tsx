'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Save, Loader2, Sparkles, X, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

interface DiagNode {
  id: string
  label: string
  description?: string
  x: number
  y: number
}
interface DiagEdge { id: string; from: string; to: string }
interface DiagData { title: string; description: string; nodes: DiagNode[]; edges: DiagEdge[] }

const CELL = 130
const W = 190
const H = 68
const PAD = 50
const GRID_COLS = 12
const GRID_ROWS = 6

function snap(v: number) { return Math.round(v) }
function svgPos(n: DiagNode) {
  return { cx: PAD + snap(n.x) * CELL + W / 2, cy: PAD + snap(n.y) * CELL + H / 2 }
}
function nodeRect(n: DiagNode) {
  return { x: PAD + snap(n.x) * CELL, y: PAD + snap(n.y) * CELL }
}

// SVG coords → grid cell (integer)
function svgToGrid(svgX: number, svgY: number): { gx: number; gy: number } | null {
  const gx = Math.round((svgX - PAD - W / 2) / CELL)
  const gy = Math.round((svgY - PAD - H / 2) / CELL)
  if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return null
  return { gx, gy }
}

const defaultData: DiagData = { title: '', description: '', nodes: [], edges: [] }

export default function DiagramTab({ leadId }: { leadId: string }) {
  const [diag, setDiag]             = useState<DiagData>(defaultData)
  const [loaded, setLoaded]         = useState(false)
  const [saving, setSaving]         = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState<string | null>(null)
  const [selected, setSelected]     = useState<string | null>(null)
  const [vp, setVp]                 = useState({ x: 0, y: 0, scale: 1 })
  const [dragTarget, setDragTarget]     = useState<{ gx: number; gy: number } | null>(null)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode]   = useState<string | null>(null)

  const svgRef    = useRef<SVGSVGElement>(null)
  const vpRef     = useRef(vp)
  const panning   = useRef(false)
  const origin    = useRef({ mx: 0, my: 0, vx: 0, vy: 0 })
  const panMoved  = useRef(false)
  const hasDragged = useRef(false)

  useEffect(() => { vpRef.current = vp }, [vp])

  useEffect(() => {
    fetch(`/api/leads/diagram?leadId=${leadId}`)
      .then(r => r.ok ? r.json() : { data: null })
      .then(j => { setDiag(j.data ?? defaultData); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [leadId])

  // Convert client coords → SVG content coords (accounts for pan/zoom)
  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const el = svgRef.current; if (!el) return null
    const rect = el.getBoundingClientRect()
    const px = (clientX - rect.left)
    const py = (clientY - rect.top)
    const { x, y, scale } = vpRef.current
    return { svgX: (px - x) / scale, svgY: (py - y) / scale }
  }, [])

  // Document-level listeners — only active while dragging a node
  useEffect(() => {
    if (!draggingNodeId) return

    const onMove = (e: MouseEvent) => {
      hasDragged.current = true
      const c = clientToSvg(e.clientX, e.clientY)
      setDragTarget(c ? svgToGrid(c.svgX, c.svgY) : null)
    }

    const onUp = (e: MouseEvent) => {
      const id = draggingNodeId
      setDraggingNodeId(null)
      setDragTarget(null)

      if (!hasDragged.current) return
      const c = clientToSvg(e.clientX, e.clientY)
      if (!c) return
      const cell = svgToGrid(c.svgX, c.svgY)
      if (!cell) return

      setDiag(prev => {
        const occupied = prev.nodes.some(n => n.id !== id && snap(n.x) === cell.gx && snap(n.y) === cell.gy)
        if (occupied) return prev
        return { ...prev, nodes: prev.nodes.map(n => n.id === id ? { ...n, x: cell.gx, y: cell.gy } : n) }
      })
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [draggingNodeId, clientToSvg])

  const startNodeDrag = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    e.preventDefault()
    hasDragged.current = false
    setDraggingNodeId(nodeId)
  }

  const generate = useCallback(async () => {
    setGenerating(true); setGenError(null)
    try {
      const res = await fetch('/api/leads/diagram/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error al generar')
      setDiag(j.data); setSelected(null); setTimeout(fitView, 50)
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Error desconocido')
    } finally { setGenerating(false) }
  }, [leadId])

  const save = useCallback(async () => {
    setSaving(true)
    await fetch('/api/leads/diagram', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, data: diag }),
    }).finally(() => setSaving(false))
  }, [leadId, diag])

  const fitView = useCallback(() => {
    if (!svgRef.current || diag.nodes.length === 0) { setVp({ x: 0, y: 0, scale: 1 }); return }
    const rect = svgRef.current.getBoundingClientRect()
    const cW = rect.width, cH = rect.height
    const margin = 48

    const xs = diag.nodes.map(n => snap(n.x) * CELL + PAD)
    const ys = diag.nodes.map(n => snap(n.y) * CELL + PAD)
    const minX = Math.min(...xs)
    const minY = Math.min(...ys)
    const maxX = Math.max(...xs) + W
    const maxY = Math.max(...ys) + H

    const contentW = maxX - minX
    const contentH = maxY - minY
    const scale = Math.min(
      (cW - margin * 2) / contentW,
      (cH - margin * 2) / contentH,
      1.5
    )
    const x = (cW - contentW * scale) / 2 - minX * scale
    const y = (cH - contentH * scale) / 2 - minY * scale
    setVp({ x, y, scale })
  }, [diag.nodes])

  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const rect = svgRef.current!.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const d = e.deltaY < 0 ? 1.12 : 0.89
    setVp(v => {
      const ns = Math.min(3, Math.max(0.25, v.scale * d))
      return { x: mx - (mx - v.x) * (ns / v.scale), y: my - (my - v.y) * (ns / v.scale), scale: ns }
    })
  }, [])

  const onSvgDown = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-node]')) return
    panning.current = true; panMoved.current = false
    origin.current = { mx: e.clientX, my: e.clientY, vx: vp.x, vy: vp.y }
  }
  const onSvgMove = (e: React.MouseEvent) => {
    if (!panning.current) return
    panMoved.current = true
    setVp(v => ({ ...v, x: origin.current.vx + e.clientX - origin.current.mx, y: origin.current.vy + e.clientY - origin.current.my }))
  }
  const onSvgUp = (e: React.MouseEvent) => {
    panning.current = false
    if (!panMoved.current && !(e.target as Element).closest('[data-node]')) setSelected(null)
  }

  const selNode = diag.nodes.find(n => n.id === selected)

  function edgeLine(fn: DiagNode, tn: DiagNode) {
    const fa = svgPos(fn), ta = svgPos(tn)
    return { x1: fa.cx, y1: fa.cy, x2: ta.cx, y2: ta.cy }
  }

  if (!loaded) return (
    <div className="flex items-center justify-center h-64 text-gray-600 gap-2">
      <Loader2 size={18} className="animate-spin" /> Cargando...
    </div>
  )

  // Is the drag target cell occupied by another node?
  const targetOccupied = dragTarget
    ? diag.nodes.some(n => n.id !== draggingNodeId && snap(n.x) === dragTarget.gx && snap(n.y) === dragTarget.gy)
    : false

  return (
    <div className="flex flex-col gap-4">

      <div className="flex items-start gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <input value={diag.title} onChange={e => setDiag(p => ({ ...p, title: e.target.value }))}
            placeholder="Nombre del diagrama..."
            className="bg-gray-900 text-white text-sm font-semibold px-3 py-2 rounded-xl border border-gray-800 focus:border-orange-500/60 focus:outline-none w-full transition-all"
          />
          <input value={diag.description} onChange={e => setDiag(p => ({ ...p, description: e.target.value }))}
            placeholder="Descripción..."
            className="bg-transparent text-gray-500 text-xs px-3 py-1.5 rounded-xl border border-transparent hover:border-gray-800 focus:outline-none w-full transition-all"
          />
        </div>
        <div className="flex gap-2 shrink-0 pt-1">
          <button onClick={generate} disabled={generating || saving}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white transition-all active:scale-95">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? 'Generando...' : 'Generar'}
          </button>
          <button onClick={save} disabled={saving || generating}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white transition-all active:scale-95">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Guardar
          </button>
        </div>
      </div>

      {genError && (
        <div className="flex items-center gap-2 bg-red-950/40 border border-red-900/50 text-red-400 text-xs px-4 py-2.5 rounded-xl">
          <X size={13} className="shrink-0" /><span className="flex-1">{genError}</span>
          <button onClick={() => setGenError(null)}><X size={12} /></button>
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex-1 rounded-2xl border border-gray-700 bg-[#111318] overflow-hidden relative" style={{ minHeight: 480 }}>

          <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
            {[
              { icon: <ZoomIn size={13} />, fn: () => setVp(v => ({ ...v, scale: Math.min(3, v.scale * 1.2) })) },
              { icon: <ZoomOut size={13} />, fn: () => setVp(v => ({ ...v, scale: Math.max(0.25, v.scale * 0.83) })) },
              { icon: <Maximize2 size={12} />, fn: fitView },
            ].map((b, i) => (
              <button key={i} onClick={b.fn} className="w-7 h-7 flex items-center justify-center bg-gray-900/80 border border-gray-800 rounded-lg text-gray-600 hover:text-white hover:border-gray-600 transition-all">
                {b.icon}
              </button>
            ))}
          </div>

          {generating && (
            <div className="absolute inset-0 bg-gray-950/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-3">
              <Loader2 size={22} className="animate-spin text-orange-400" />
              <p className="text-sm text-gray-400">Generando diagrama de componentes...</p>
            </div>
          )}

          {!generating && diag.nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
              <p className="text-sm text-gray-700">Sin diagrama</p>
              <p className="text-xs text-gray-800">Presioná Generar para crear el diagrama de componentes</p>
            </div>
          )}

          <svg ref={svgRef}
            style={{ width: '100%', height: '100%', minHeight: 480, display: 'block', cursor: panning.current ? 'grabbing' : 'default', userSelect: 'none' }}
            onWheel={onWheel} onMouseDown={onSvgDown} onMouseMove={onSvgMove} onMouseUp={onSvgUp}
            onMouseLeave={() => { panning.current = false }}>

            <defs>
              <pattern id="dotgrid" width={CELL} height={CELL} patternUnits="userSpaceOnUse"
                patternTransform={`translate(${vp.x % CELL},${vp.y % CELL}) scale(${vp.scale})`}>
                <circle cx={CELL / 2} cy={CELL / 2} r="1" fill="#1e2127" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dotgrid)" />

            <g transform={`translate(${vp.x},${vp.y}) scale(${vp.scale})`}>

              {/* Grid lines */}
              {Array.from({ length: GRID_COLS + 1 }, (_, i) => (
                <line key={`v${i}`}
                  x1={PAD + i * CELL - W / 2} y1={PAD - CELL / 2}
                  x2={PAD + i * CELL - W / 2} y2={PAD + GRID_ROWS * CELL + CELL / 2}
                  stroke="#181b20" strokeWidth="1" />
              ))}
              {Array.from({ length: GRID_ROWS + 1 }, (_, i) => (
                <line key={`h${i}`}
                  x1={PAD - CELL / 2} y1={PAD + i * CELL - H / 2}
                  x2={PAD + GRID_COLS * CELL + CELL / 2} y2={PAD + i * CELL - H / 2}
                  stroke="#181b20" strokeWidth="1" />
              ))}

              {/* Drag target highlight */}
              {dragTarget && (
                <rect
                  x={PAD + dragTarget.gx * CELL} y={PAD + dragTarget.gy * CELL}
                  width={W} height={H} rx="7"
                  fill={targetOccupied ? '#3f0a0a' : '#0a2a10'}
                  stroke={targetOccupied ? '#ef4444' : '#22c55e'}
                  strokeWidth="2" strokeDasharray="4 3"
                />
              )}

              {/* Edges */}
              {diag.edges.map(edge => {
                const fn = diag.nodes.find(n => n.id === edge.from)
                const tn = diag.nodes.find(n => n.id === edge.to)
                if (!fn || !tn) return null
                const { x1, y1, x2, y2 } = edgeLine(fn, tn)
                const isSel = selected === fn.id || selected === tn.id
                return (
                  <line key={edge.id}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={isSel ? '#f97316' : '#2e4a6a'}
                    strokeWidth={isSel ? 2.5 : 1.5}
                    opacity={selected && !isSel ? 0.1 : 1}
                  />
                )
              })}

              {/* Nodes */}
              {diag.nodes.map(node => {
                const { x, y } = nodeRect(node)
                const sel      = selected === node.id
                const hov      = hoveredNode === node.id && !draggingNodeId
                const isDragging = draggingNodeId === node.id
                const connected = !!selected && !sel && diag.edges.some(
                  e => (e.from === selected && e.to === node.id) || (e.to === selected && e.from === node.id)
                )
                const fill   = sel ? '#1a2d40' : hov ? '#1e2a38' : '#161c27'
                const stroke = sel ? '#f97316' : hov ? '#5a8ab0' : connected ? '#4a6080' : '#2a3a50'
                const sw     = sel ? 2 : hov ? 2 : 1.5
                const labelColor = sel ? '#f97316' : hov ? '#f1f5f9' : '#e2e8f0'
                return (
                  <g key={node.id} data-node="1"
                    style={{
                      cursor: isDragging ? 'grabbing' : 'grab',
                      opacity: selected && !sel && !connected ? 0.2 : isDragging ? 0.5 : 1,
                      transition: isDragging ? 'none' : 'opacity 0.12s',
                    }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onMouseDown={e => startNodeDrag(e, node.id)}
                    onClick={e => {
                      e.stopPropagation()
                      if (hasDragged.current) return
                      setSelected(sel ? null : node.id)
                    }}>
                    {/* Glow on hover/select */}
                    {(hov || sel) && (
                      <rect x={x - 3} y={y - 3} width={W + 6} height={H + 6} rx="11"
                        fill="none"
                        stroke={sel ? '#f97316' : '#3a6a94'}
                        strokeWidth="1" opacity="0.35"
                      />
                    )}
                    <rect x={x} y={y} width={W} height={H} rx="8"
                      fill={fill} stroke={stroke} strokeWidth={sw}
                      style={{ transition: 'fill 0.12s, stroke 0.12s' }}
                    />
                    <text x={x + W / 2} y={y + (node.description ? H / 2 - 1 : H / 2 + 6)}
                      textAnchor="middle" fontSize="13" fontWeight={700}
                      fill={labelColor}
                      style={{ pointerEvents: 'none', transition: 'fill 0.12s' }}>
                      {node.label.length > 20 ? node.label.slice(0, 19) + '…' : node.label}
                    </text>
                    {node.description && (
                      <text x={x + W / 2} y={y + H / 2 + 15} textAnchor="middle" fontSize="10"
                        fill={hov ? '#94a3b8' : '#64748b'}
                        style={{ pointerEvents: 'none', transition: 'fill 0.12s' }}>
                        {node.description.length > 26 ? node.description.slice(0, 25) + '…' : node.description}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>
        </div>

        {selNode && (
          <div className="w-52 shrink-0 bg-gray-900 rounded-2xl border border-gray-800 p-4 flex flex-col gap-3 self-start">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-400 truncate">{selNode.label}</span>
              <button onClick={() => setSelected(null)} className="text-gray-600 hover:text-gray-300"><X size={12} /></button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Nombre</label>
              <input value={selNode.label}
                onChange={e => setDiag(p => ({ ...p, nodes: p.nodes.map(n => n.id === selNode.id ? { ...n, label: e.target.value } : n) }))}
                className="bg-gray-800 text-white text-sm px-2.5 py-1.5 rounded-lg border border-gray-700/50 focus:outline-none focus:border-orange-500/50 w-full"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Descripción</label>
              <input value={selNode.description ?? ''}
                onChange={e => setDiag(p => ({ ...p, nodes: p.nodes.map(n => n.id === selNode.id ? { ...n, description: e.target.value } : n) }))}
                className="bg-gray-800 text-white text-xs px-2.5 py-1.5 rounded-lg border border-gray-700/50 focus:outline-none focus:border-orange-500/50 w-full"
              />
            </div>
            {(() => {
              const edges = diag.edges.filter(e => e.from === selNode.id || e.to === selNode.id)
              if (!edges.length) return null
              return (
                <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-800">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Conectado con</p>
                  {edges.map(edge => {
                    const other = diag.nodes.find(n => n.id === (edge.from === selNode.id ? edge.to : edge.from))
                    return (
                      <div key={edge.id} className="flex items-center gap-1.5 group text-[11px] text-gray-400">
                        <span className="text-gray-700">—</span>
                        <span className="flex-1 truncate">{other?.label}</span>
                        <button onClick={() => setDiag(p => ({ ...p, edges: p.edges.filter(e2 => e2.id !== edge.id) }))}
                          className="opacity-0 group-hover:opacity-100 text-red-500"><X size={9} /></button>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
            <button onClick={() => {
              setDiag(p => ({ ...p, nodes: p.nodes.filter(n => n.id !== selNode.id), edges: p.edges.filter(e => e.from !== selNode.id && e.to !== selNode.id) }))
              setSelected(null)
            }} className="mt-1 text-xs text-red-500 border border-red-500/20 hover:bg-red-500/10 py-1.5 rounded-lg transition-all">
              Eliminar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
