'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Plus, Link2, Trash2, X, Loader2, Sparkles, MousePointer2, Layers } from 'lucide-react'

const TW = 80
const TH = 40
const GRID = 6
const SVG_W = 740
const SVG_H = 460
const OX = SVG_W / 2
const OY = 90

type NodeType = 'server' | 'database' | 'api' | 'frontend' | 'queue' | 'cache' | 'external' | 'user'
type EdgeType = 'data' | 'control' | 'event'

interface ArchNode {
  id: string; type: NodeType; label: string; description: string; payload: string
  gridX: number; gridY: number
}
interface ArchEdge {
  id: string; from: string; to: string; label: string; type: EdgeType
}
interface ArchData {
  title: string; description: string; nodes: ArchNode[]; edges: ArchEdge[]
}

const NODE_CFG: Record<NodeType, { label: string; h: number; top: string; left: string; right: string; accent: string }> = {
  server:   { label: 'Servidor',          h: 72, top: '#334155', left: '#1e293b', right: '#0f172a', accent: '#64748b' },
  database: { label: 'Base de datos',     h: 36, top: '#1e3a8a', left: '#1e40af', right: '#172554', accent: '#3b82f6' },
  api:      { label: 'API / Gateway',     h: 56, top: '#134e4a', left: '#0f766e', right: '#042f2e', accent: '#14b8a6' },
  frontend: { label: 'Frontend',          h: 60, top: '#4c1d95', left: '#6d28d9', right: '#2e1065', accent: '#a78bfa' },
  queue:    { label: 'Cola / Broker',     h: 44, top: '#78350f', left: '#b45309', right: '#451a03', accent: '#f59e0b' },
  cache:    { label: 'Cache',             h: 30, top: '#7f1d1d', left: '#991b1b', right: '#450a0a', accent: '#f87171' },
  external: { label: 'Servicio externo',  h: 52, top: '#312e81', left: '#4338ca', right: '#1e1b4b', accent: '#818cf8' },
  user:     { label: 'Usuario / Cliente', h: 24, top: '#052e16', left: '#065f46', right: '#031e0f', accent: '#34d399' },
}

const EDGE_CFG: Record<EdgeType, { stroke: string; dash: string; label: string }> = {
  data:    { stroke: '#38bdf8', dash: '6 3', label: 'Datos'   },
  control: { stroke: '#fb923c', dash: '',    label: 'Control' },
  event:   { stroke: '#c084fc', dash: '2 5', label: 'Evento'  },
}

function toSvg(gx: number, gy: number) {
  return { x: OX + (gx - gy) * TW / 2, y: OY + (gx + gy) * TH / 2 }
}

function geo(gx: number, gy: number, h: number) {
  const { x: cx, y: cy } = toSvg(gx, gy)
  const N  = { x: cx,        y: cy        }
  const E  = { x: cx + TW/2, y: cy + TH/2 }
  const S  = { x: cx,        y: cy + TH   }
  const W  = { x: cx - TW/2, y: cy + TH/2 }
  const Er = { x: E.x, y: E.y - h }
  const Sr = { x: S.x, y: S.y - h }
  const Wr = { x: W.x, y: W.y - h }
  const Nr = { x: N.x, y: N.y - h }
  const p  = (arr: {x:number;y:number}[]) => arr.map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ')
  return {
    ground: p([N, E, S, W]),
    left:   p([W, S, Sr, Wr]),
    right:  p([E, S, Sr, Er]),
    top:    p([Nr, Er, Sr, Wr]),
    center: { x: cx, y: cy + TH/2 - h },
    labelX: cx,
    labelY: cy - h - 8,
  }
}

function uid() { return Math.random().toString(36).slice(2, 9) }

const defaultData: ArchData = { title: '', description: '', nodes: [], edges: [] }

export default function ArchitectureTab({ leadId }: { leadId: string }) {
  const [arch, setArch]             = useState<ArchData>(defaultData)
  const [loaded, setLoaded]         = useState(false)
  const [saving, setSaving]         = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState<string | null>(null)
  const [mode, setMode]             = useState<'view' | 'add' | 'connect'>('view')
  const [addType, setAddType]       = useState<NodeType>('server')
  const [selected, setSelected]     = useState<string | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  const [pendingCell, setPendingCell]   = useState<{gx:number;gy:number} | null>(null)
  const [pendingLabel, setPendingLabel] = useState('')
  const [pendingEdge, setPendingEdge]   = useState<{from:string;to:string} | null>(null)
  const [edgeLabel, setEdgeLabel]   = useState('')
  const [edgeType, setEdgeType]     = useState<EdgeType>('data')
  const [hoveredCell, setHoveredCell] = useState<{gx:number;gy:number} | null>(null)

  useEffect(() => {
    fetch(`/api/leads/architecture?leadId=${leadId}`)
      .then(r => r.ok ? r.json() : { data: null })
      .then(j => { setArch(j.data ?? defaultData); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [leadId])

  const generate = useCallback(async () => {
    setGenerating(true); setGenError(null)
    try {
      const res = await fetch('/api/leads/architecture/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Error al generar')
      setArch(j.data); setSelected(null)
    } catch (e: unknown) {
      setGenError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setGenerating(false)
    }
  }, [leadId])

  const save = useCallback(async () => {
    setSaving(true)
    await fetch('/api/leads/architecture', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId, data: arch }),
    }).finally(() => setSaving(false))
  }, [leadId, arch])

  const occupied = new Set(arch.nodes.map(n => `${n.gridX},${n.gridY}`))
  const selNode  = arch.nodes.find(n => n.id === selected)

  const cancelMode = useCallback(() => {
    setMode('view'); setConnectFrom(null); setPendingCell(null); setPendingEdge(null)
  }, [])

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

  const confirmAdd = useCallback(() => {
    if (!pendingCell || !pendingLabel.trim()) return
    const node: ArchNode = {
      id: uid(), type: addType, label: pendingLabel.trim(),
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
    setPendingEdge(null); setSelected(pendingEdge.to)
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

  const sorted = [...arch.nodes].sort((a, b) => (a.gridX + a.gridY) - (b.gridX + b.gridY))

  if (!loaded) return (
    <div className="flex items-center justify-center h-64 text-gray-600 gap-2">
      <Loader2 size={18} className="animate-spin" /> Cargando arquitectura
    </div>
  )

  return (
    <div className="flex flex-col gap-4">

      <div className="flex items-start gap-3">
        <div className="flex-1 flex flex-col gap-1.5">
          <input
            value={arch.title}
            onChange={e => setArch(p => ({ ...p, title: e.target.value }))}
            placeholder="Nombre del sistema..."
            className="bg-gray-900 text-white text-base font-semibold px-3.5 py-2.5 rounded-xl border border-gray-800 focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/10 placeholder-gray-700 w-full transition-all"
          />
          <input
            value={arch.description}
            onChange={e => setArch(p => ({ ...p, description: e.target.value }))}
            placeholder="Descripcion del sistema y su proposito..."
            className="bg-transparent text-gray-500 text-sm px-3.5 py-1.5 rounded-xl border border-transparent hover:border-gray-800 focus:border-gray-700 focus:outline-none focus:bg-gray-900/50 placeholder-gray-700 w-full transition-all"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-1">
          <button
            onClick={generate} disabled={generating || saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-500 active:bg-violet-700 disabled:opacity-50 text-white shadow-lg shadow-violet-900/30 transition-all active:scale-95"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? 'Generando...' : 'Generar'}
          </button>
          <button
            onClick={save} disabled={saving || generating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-orange-600 hover:bg-orange-500 active:bg-orange-700 disabled:opacity-50 text-white shadow-lg shadow-orange-900/30 transition-all active:scale-95"
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

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-0.5 shrink-0">
          <button onClick={cancelMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === 'view' ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60'}`}
          >
            <MousePointer2 size={12} /> Seleccionar
          </button>
          <button onClick={() => setMode(m => m === 'add' ? 'view' : 'add')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === 'add' ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60'}`}
          >
            <Plus size={12} /> Nodo
          </button>
          <button onClick={() => { setMode(m => m === 'connect' ? 'view' : 'connect'); setConnectFrom(null) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mode === 'connect' ? 'bg-sky-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/60'}`}
          >
            <Link2 size={12} />
            {mode === 'connect' ? (connectFrom ? 'Click destino...' : 'Click origen...') : 'Conectar'}
          </button>
        </div>

        {mode === 'add' && (
          <div className="flex gap-1.5 flex-wrap">
            {(Object.entries(NODE_CFG) as [NodeType, typeof NODE_CFG[NodeType]][]).map(([k, v]) => (
              <button key={k} onClick={() => setAddType(k)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${addType === k ? 'shadow-sm border-transparent' : 'border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700'}`}
                style={addType === k ? { background: v.top, borderColor: v.accent + '55', color: v.accent } : {}}
              >
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: v.accent }} />
                {v.label}
              </button>
            ))}
          </div>
        )}

        {mode === 'connect' && (
          <div className="flex items-center gap-2 text-xs text-sky-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
            </span>
            {connectFrom ? `Origen: ${arch.nodes.find(n => n.id === connectFrom)?.label} - click destino` : 'Click en el nodo de origen'}
          </div>
        )}

        {mode !== 'view' && (
          <button onClick={cancelMode} className="ml-auto flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors">
            <X size={11} /> Cancelar
          </button>
        )}
      </div>

      <div className="flex gap-4">
        <div className="flex-1 rounded-2xl border border-gray-800 bg-gray-950 overflow-hidden relative" style={{ minHeight: 430 }}>
          {generating && (
            <div className="absolute inset-0 bg-gray-950/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-4">
              <div className="w-12 h-12 rounded-full border border-violet-500/30 flex items-center justify-center">
                <Loader2 size={20} className="animate-spin text-violet-400" />
              </div>
              <div className="text-center">
                <p className="text-sm text-violet-300 font-medium">Analizando contexto del lead...</p>
                <p className="text-xs text-gray-600 mt-1">Claude esta disenando la arquitectura del sistema</p>
              </div>
            </div>
          )}

          {!generating && arch.nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
              <Layers size={36} className="text-gray-800" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Sin arquitectura definida</p>
                <p className="text-xs text-gray-800 mt-1 max-w-xs leading-relaxed">
                  Usa Generar para crear automaticamente, o activa + Nodo para disenar manualmente
                </p>
              </div>
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
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-soft">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {Array.from({ length: GRID }, (_, gy) =>
              Array.from({ length: GRID }, (_, gx) => {
                const { x: cx, y: cy } = toSvg(gx, gy)
                const isOcc = occupied.has(`${gx},${gy}`)
                const isHov = hoveredCell?.gx === gx && hoveredCell?.gy === gy
                const showHover = isHov && !isOcc && mode !== 'connect'
                const isClickable = mode === 'add' ? !isOcc : mode === 'connect' ? isOcc : true
                return (
                  <polygon key={`g${gx}-${gy}`}
                    points={`${cx},${cy} ${cx+TW/2},${cy+TH/2} ${cx},${cy+TH} ${cx-TW/2},${cy+TH/2}`}
                    fill={showHover ? (mode === 'add' ? '#1e3a5f30' : '#1e293b15') : (mode === 'add' && !isOcc ? '#0f1929' : 'transparent')}
                    stroke={showHover ? '#334155' : '#1e293b'}
                    strokeWidth={showHover ? '1.5' : '0.8'}
                    style={{ cursor: isClickable ? 'pointer' : 'default' }}
                    onClick={() => handleClick(gx, gy)}
                    onMouseEnter={() => setHoveredCell({ gx, gy })}
                    onMouseLeave={() => setHoveredCell(null)}
                  />
                )
              })
            )}

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
                <g key={edge.id} filter="url(#glow-soft)">
                  <line x1={fg.center.x} y1={fg.center.y} x2={tg.center.x} y2={tg.center.y}
                    stroke={c.stroke} strokeWidth="1.5" strokeDasharray={c.dash}
                    markerEnd={`url(#arr-${edge.type})`} opacity="0.85"
                  />
                  {edge.label && (
                    <text x={mx} y={my - 5} fill={c.stroke} fontSize="9" textAnchor="middle"
                      style={{ fontWeight: 600, paintOrder: 'stroke', stroke: '#030712', strokeWidth: 3 }}>
                      {edge.label}
                    </text>
                  )}
                </g>
              )
            })}

            {sorted.map(node => {
              const cfg = NODE_CFG[node.type]
              const g   = geo(node.gridX, node.gridY, cfg.h)
              const sel   = selected === node.id
              const cFrom = connectFrom === node.id
              return (
                <g key={node.id} style={{ cursor: 'pointer' }} onClick={() => handleClick(node.gridX, node.gridY)}>
                  <polygon points={g.left}  fill={cfg.left} />
                  <polygon points={g.right} fill={cfg.right} />
                  <polygon points={g.top} fill={cfg.top}
                    stroke={sel ? cfg.accent : cFrom ? '#38bdf8' : '#0a0f1a'}
                    strokeWidth={sel || cFrom ? 2 : 0.5}
                    filter={sel || cFrom ? 'url(#glow)' : undefined}
                  />
                  {(sel || cFrom) && (
                    <polygon points={g.top} fill="none"
                      stroke={cFrom ? '#38bdf8' : cfg.accent}
                      strokeWidth="2" opacity="0.9" filter="url(#glow)"
                    />
                  )}
                  <text x={g.labelX} y={g.labelY}
                    fill={sel ? cfg.accent : '#cbd5e1'}
                    fontSize="9.5" fontWeight={sel ? 700 : 500}
                    textAnchor="middle"
                    style={{ paintOrder: 'stroke', stroke: '#030712', strokeWidth: 3, pointerEvents: 'none' }}>
                    {node.label.length > 15 ? node.label.slice(0, 14) + '...' : node.label}
                  </text>
                  <text x={g.labelX} y={g.labelY + 11} fill={cfg.accent} fontSize="7.5"
                    textAnchor="middle" opacity="0.7"
                    style={{ paintOrder: 'stroke', stroke: '#030712', strokeWidth: 2, pointerEvents: 'none' }}>
                    {cfg.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

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
                    className="bg-gray-800 text-white text-sm px-2.5 py-2 rounded-lg border border-gray-700/50 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/10 w-full transition-all"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider font-medium px-0.5">Descripcion</label>
                  <textarea value={selNode.description} placeholder="Rol y responsabilidades..." rows={3}
                    onChange={e => patchNode(selNode.id, { description: e.target.value })}
                    className="bg-gray-800 text-white text-xs px-2.5 py-2 rounded-lg border border-gray-700/50 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/10 w-full resize-none transition-all leading-relaxed"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-600 uppercase tracking-wider font-medium px-0.5">Payload</label>
                  <input value={selNode.payload} placeholder="Datos que maneja..."
                    onChange={e => patchNode(selNode.id, { payload: e.target.value })}
                    className="bg-gray-800 text-white text-xs px-2.5 py-2 rounded-lg border border-gray-700/50 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/10 w-full transition-all"
                  />
                </div>
              </div>

              {(() => {
                const edges = arch.edges.filter(e => e.from === selNode.id || e.to === selNode.id)
                if (!edges.length) return null
                return (
                  <div className="flex flex-col gap-2 pt-2 border-t border-gray-800">
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Conexiones ({edges.length})</p>
                    <div className="flex flex-col gap-1.5">
                      {edges.map(edge => {
                        const other = arch.nodes.find(n => n.id === (edge.from === selNode.id ? edge.to : edge.from))
                        const isOut = edge.from === selNode.id
                        const c = EDGE_CFG[edge.type]
                        return (
                          <div key={edge.id} className="flex items-start gap-1.5 group">
                            <span style={{ color: c.stroke }} className="text-sm shrink-0 leading-none mt-0.5 font-bold">{isOut ? '→' : '←'}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-gray-300 truncate leading-tight font-medium">{other?.label ?? '?'}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ background: c.stroke + '20', color: c.stroke }}>{c.label}</span>
                                {edge.label && <span className="text-[9px] text-gray-600 truncate">{edge.label}</span>}
                              </div>
                            </div>
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
                <Trash2 size={11} /> Eliminar nodo
              </button>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5 flex flex-col items-center gap-2 text-center">
              <MousePointer2 size={22} className="text-gray-800" />
              <p className="text-xs text-gray-600 leading-relaxed">Selecciona un nodo para editar sus propiedades</p>
            </div>
          )}

          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider font-medium mb-2.5">Leyenda</p>
            <div className="flex flex-col gap-0.5 mb-3">
              {(Object.entries(NODE_CFG) as [NodeType, typeof NODE_CFG[NodeType]][]).map(([k, v]) => (
                <button key={k}
                  onClick={() => { setMode('add'); setAddType(k) }}
                  title="Click para agregar este tipo"
                  className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-800 transition-colors text-left group w-full ${addType === k && mode === 'add' ? 'bg-gray-800' : ''}`}
                >
                  <div className="w-5 h-3.5 rounded-sm shrink-0"
                    style={{ background: v.top, boxShadow: `inset -2px -2px 0 ${v.left}, inset 2px -2px 0 ${v.right}` }}
                  />
                  <span className="text-[11px] text-gray-400 group-hover:text-gray-200 transition-colors flex-1">{v.label}</span>
                </button>
              ))}
            </div>
            <div className="pt-3 border-t border-gray-800 flex flex-col gap-2">
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
          </div>
        </div>
      </div>

      {pendingCell && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setPendingCell(null)}>
          <div className="bg-gray-900 border border-gray-700/80 rounded-2xl p-6 w-80 flex flex-col gap-4 shadow-2xl shadow-black/60" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-sm font-semibold text-white">Nuevo nodo</h3>
              <p className="text-xs text-gray-600 mt-0.5">Posicion ({pendingCell.gx}, {pendingCell.gy}) en el mapa</p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(NODE_CFG) as [NodeType, typeof NODE_CFG[NodeType]][]).map(([k, v]) => (
                <button key={k} onClick={() => setAddType(k)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium transition-all border ${addType === k ? 'border-transparent shadow-sm' : 'border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700'}`}
                  style={addType === k ? { background: v.top, borderColor: v.accent + '55', color: v.accent } : {}}
                >
                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: v.accent }} />
                  <span className="leading-tight text-left">{v.label}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Nombre</label>
              <input value={pendingLabel} onChange={e => setPendingLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmAdd()}
                placeholder="Nombre del componente" autoFocus
                className="bg-gray-800 border border-gray-700 text-sm text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/10 w-full"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPendingCell(null)} className="text-gray-500 hover:text-white text-sm px-3 py-2 rounded-xl hover:bg-gray-800 transition-colors">Cancelar</button>
              <button onClick={confirmAdd} disabled={!pendingLabel.trim()}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-all active:scale-95">
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingEdge && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setPendingEdge(null)}>
          <div className="bg-gray-900 border border-gray-700/80 rounded-2xl p-6 w-80 flex flex-col gap-4 shadow-2xl shadow-black/60" onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-sm font-semibold text-white">Nueva conexion</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-white font-medium">{arch.nodes.find(n => n.id === pendingEdge.from)?.label}</span>
                <span className="text-xs text-gray-600">{'→'}</span>
                <span className="text-xs text-white font-medium">{arch.nodes.find(n => n.id === pendingEdge.to)?.label}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.entries(EDGE_CFG) as [EdgeType, typeof EDGE_CFG[EdgeType]][]).map(([k, v]) => (
                <button key={k} onClick={() => setEdgeType(k)}
                  className={`flex flex-col items-center gap-2 px-2 py-3 rounded-xl text-xs font-medium transition-all border ${edgeType === k ? 'border-transparent' : 'border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700'}`}
                  style={edgeType === k ? { background: v.stroke + '1a', borderColor: v.stroke + '55', color: v.stroke } : {}}
                >
                  <svg width="24" height="8">
                    <line x1="1" y1="4" x2="18" y2="4" stroke={v.stroke} strokeWidth="1.5" strokeDasharray={v.dash} />
                    <polygon points="15,1.5 21,4 15,6.5" fill={v.stroke} />
                  </svg>
                  {v.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-gray-600 uppercase tracking-wider font-medium">Payload / etiqueta (opcional)</label>
              <input value={edgeLabel} onChange={e => setEdgeLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmEdge()}
                placeholder="ej: JWT, eventos, queries SQL..." autoFocus
                className="bg-gray-800 border border-gray-700 text-sm text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/10 w-full"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setPendingEdge(null)} className="text-gray-500 hover:text-white text-sm px-3 py-2 rounded-xl hover:bg-gray-800 transition-colors">Cancelar</button>
              <button onClick={confirmEdge}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-medium transition-all active:scale-95">
                Conectar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
