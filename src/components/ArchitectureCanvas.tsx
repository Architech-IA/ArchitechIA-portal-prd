'use client'

import { useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Monitor, Server, Database, Workflow, Brain, Clock, Zap, Globe2, Trash2, Plus, Upload, X, Wand2,
} from 'lucide-react'

export interface ArchNode {
  id: string
  label: string
  type: ArchNodeType
  x: number
  y: number
}

export interface ArchConnection {
  id: string
  from: string
  to: string
}

type ArchNodeType = 'frontend' | 'backend' | 'database' | 'api' | 'ia' | 'queue' | 'cache' | 'externo'

const NODE_TYPES: Record<ArchNodeType, { label: string; icon: typeof Monitor; color: string }> = {
  frontend: { label: 'Frontend', icon: Monitor, color: '#3B82F6' },
  backend:  { label: 'Backend',  icon: Server,   color: '#8B5CF6' },
  database: { label: 'Base de datos', icon: Database, color: '#10B981' },
  api:      { label: 'API',      icon: Workflow, color: '#06B6D4' },
  ia:       { label: 'IA / LLM', icon: Brain,    color: '#FF5A00' },
  queue:    { label: 'Cola/Job', icon: Clock,     color: '#F59E0B' },
  cache:    { label: 'Cache',    icon: Zap,       color: '#EAB308' },
  externo:  { label: 'Servicio externo', icon: Globe2, color: '#64748B' },
}

const NODE_W = 140
const NODE_H = 64

function makeId() {
  return Math.random().toString(36).slice(2, 10)
}

/** Adivina el tipo de componente a partir del label, para imports que no traen el tipo explícito. */
function guessType(label: string): ArchNodeType {
  const s = label.toLowerCase()
  if (/\b(ia|ai|llm|claude|gpt|openai|modelo)\b/.test(s)) return 'ia'
  if (/\b(cola|queue|job|worker|cron|kafka|sqs|rabbitmq)\b/.test(s)) return 'queue'
  if (/\b(cache|redis|memcache)\b/.test(s)) return 'cache'
  if (/\b(base de datos|database|postgres\w*|mysql|mongo\w*|sql|\bdb\b)/.test(s)) return 'database'
  if (/\bapi\b/.test(s)) return 'api'
  if (/\b(frontend|front|react|next\.?js|vue|ui|cliente|spa|web app)\b/.test(s)) return 'frontend'
  if (/\b(backend|back|server|servidor|node|express|servicio)\b/.test(s)) return 'backend'
  return 'externo'
}

interface ImportItem { label: string; type: ArchNodeType }
interface ImportEdge { fromIdx: number; toIdx: number }
interface ImportResult { items: ImportItem[]; edges: ImportEdge[] }

/** Acepta el JSON propio del lienzo: { nodes, connections } (formato completo) o un array plano legado. */
function parseJsonImport(text: string): ImportResult | null {
  let data: unknown
  try { data = JSON.parse(text) } catch { return null }

  if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray((data as Record<string, unknown>).nodes)) {
    const rawNodes = (data as Record<string, unknown>).nodes as Record<string, unknown>[]
    const rawConns = Array.isArray((data as Record<string, unknown>).connections)
      ? (data as Record<string, unknown>).connections as Record<string, unknown>[]
      : []
    const idToIndex = new Map<string, number>()
    const items: ImportItem[] = []
    rawNodes.forEach(n => {
      if (typeof n.label !== 'string') return
      const label = n.label.trim()
      if (!label) return
      const type = typeof n.type === 'string' && n.type in NODE_TYPES ? (n.type as ArchNodeType) : guessType(label)
      if (typeof n.id === 'string') idToIndex.set(n.id, items.length)
      items.push({ label, type })
    })
    const edges: ImportEdge[] = rawConns
      .map(c => ({ fromIdx: idToIndex.get(String(c.from)), toIdx: idToIndex.get(String(c.to)) }))
      .filter((e): e is ImportEdge => e.fromIdx !== undefined && e.toIdx !== undefined && e.fromIdx !== e.toIdx)
    return items.length > 0 ? { items, edges } : null
  }

  if (Array.isArray(data)) {
    const items: ImportItem[] = data
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null && typeof item.label === 'string')
      .map(item => {
        const label = String(item.label).trim()
        const rawType = item.type
        const type = typeof rawType === 'string' && rawType in NODE_TYPES ? (rawType as ArchNodeType) : guessType(label)
        return { label, type }
      })
      .filter(item => item.label)
    return items.length > 0 ? { items, edges: [] } : null
  }

  return null
}

/** Extrae nodos (A[Label], B(Label), C{Label}, D((Label)), etc.) y flechas (A --> B) de un diagrama Mermaid. */
function parseMermaidImport(text: string): ImportResult | null {
  const nodeRe = /([A-Za-z_][\w-]*)\s*(?:\(\(|\[\(|\[\[|\{\{|[[({>])\s*"?([^"\]})]+?)"?\s*(?:\)\)|\)\]|\]\]|\}\}|[\])}])/g
  const idToIndex = new Map<string, number>()
  const items: ImportItem[] = []
  let m: RegExpExecArray | null
  while ((m = nodeRe.exec(text))) {
    const id = m[1]
    const label = m[2].trim()
    if (label && !idToIndex.has(id)) {
      idToIndex.set(id, items.length)
      items.push({ label, type: guessType(label) })
    }
  }
  if (items.length === 0) return null

  const edgeRe = /([A-Za-z_][\w-]*)\s*(?:-->|---|==>|-\.->|-\.-)\s*(?:\|[^|]*\|\s*)?([A-Za-z_][\w-]*)/g
  const edges: ImportEdge[] = []
  let e: RegExpExecArray | null
  while ((e = edgeRe.exec(text))) {
    const fromIdx = idToIndex.get(e[1])
    const toIdx = idToIndex.get(e[2])
    if (fromIdx !== undefined && toIdx !== undefined && fromIdx !== toIdx) {
      edges.push({ fromIdx, toIdx })
    }
  }
  return { items, edges }
}

/**
 * Acomoda los nodos en niveles según sus conexiones (estilo organigrama):
 * las raíces (sin flechas entrantes) arriba, y cada nodo un nivel debajo
 * del más profundo de sus padres. Los nodos sueltos quedan en el nivel 0.
 */
function autoLayout(nodes: ArchNode[], connections: ArchConnection[]): ArchNode[] {
  if (nodes.length === 0) return nodes
  const ids = new Set(nodes.map(n => n.id))
  const children = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  nodes.forEach(n => { children.set(n.id, []); inDegree.set(n.id, 0) })
  connections.forEach(c => {
    if (!ids.has(c.from) || !ids.has(c.to) || c.from === c.to) return
    children.get(c.from)!.push(c.to)
    inDegree.set(c.to, (inDegree.get(c.to) || 0) + 1)
  })

  const level = new Map<string, number>()
  const queue: string[] = []
  nodes.forEach(n => { if ((inDegree.get(n.id) || 0) === 0) { level.set(n.id, 0); queue.push(n.id) } })
  if (queue.length === 0) { level.set(nodes[0].id, 0); queue.push(nodes[0].id) }

  let qi = 0
  const guard = nodes.length * 6 + 10
  while (qi < queue.length && qi < guard) {
    const id = queue[qi++]
    const lvl = level.get(id) ?? 0
    for (const childId of children.get(id) || []) {
      if ((level.get(childId) ?? -1) < lvl + 1) {
        level.set(childId, lvl + 1)
        queue.push(childId)
      }
    }
  }
  nodes.forEach(n => { if (!level.has(n.id)) level.set(n.id, 0) })

  const byLevel = new Map<number, string[]>()
  nodes.forEach(n => {
    const lvl = level.get(n.id)!
    if (!byLevel.has(lvl)) byLevel.set(lvl, [])
    byLevel.get(lvl)!.push(n.id)
  })

  const GAP_X = NODE_W + 28
  const GAP_Y = NODE_H + 44
  const positioned = new Map<string, { x: number; y: number }>()
  Array.from(byLevel.keys()).sort((a, b) => a - b).forEach((lvl, rowIdx) => {
    byLevel.get(lvl)!.forEach((id, colIdx) => {
      positioned.set(id, { x: 16 + colIdx * GAP_X, y: 16 + rowIdx * GAP_Y })
    })
  })

  return nodes.map(n => ({ ...n, ...positioned.get(n.id)! }))
}

interface ArchitectureCanvasProps {
  nodes: ArchNode[]
  connections: ArchConnection[]
  onChange: (nodes: ArchNode[], connections: ArchConnection[]) => void
}

export default function ArchitectureCanvas({ nodes, connections, onChange }: ArchitectureCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [hoverConnId, setHoverConnId] = useState<string | null>(null)

  const addNode = (type: ArchNodeType) => {
    const idx = nodes.length
    const col = idx % 4
    const row = Math.floor(idx / 4)
    onChange([
      ...nodes,
      {
        id: makeId(),
        label: NODE_TYPES[type].label,
        type,
        x: 16 + col * (NODE_W + 16),
        y: 16 + row * (NODE_H + 16),
      },
    ], connections)
  }

  const removeNode = (id: string) =>
    onChange(nodes.filter(n => n.id !== id), connections.filter(c => c.from !== id && c.to !== id))

  const renameNode = (id: string, label: string) =>
    onChange(nodes.map(n => (n.id === id ? { ...n, label } : n)), connections)

  const removeConnection = (id: string) => onChange(nodes, connections.filter(c => c.id !== id))

  const onPointerDownNode = (e: React.PointerEvent, node: ArchNode) => {
    if (editingId) return
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return
    setDragId(node.id)
    dragOffset.current = {
      x: e.clientX - canvasRect.left - node.x,
      y: e.clientY - canvasRect.top - node.y,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const startConnection = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation()
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return
    setConnectingFrom(nodeId)
    setCursorPos({ x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return
    if (connectingFrom) {
      setCursorPos({ x: e.clientX - canvasRect.left, y: e.clientY - canvasRect.top })
      return
    }
    if (!dragId) return
    const maxX = canvasRect.width - NODE_W
    const maxY = canvasRect.height - NODE_H
    const x = Math.min(Math.max(0, e.clientX - canvasRect.left - dragOffset.current.x), Math.max(0, maxX))
    const y = Math.min(Math.max(0, e.clientY - canvasRect.top - dragOffset.current.y), Math.max(0, maxY))
    onChange(nodes.map(n => (n.id === dragId ? { ...n, x, y } : n)), connections)
  }, [dragId, connectingFrom, nodes, connections, onChange])

  const onPointerUp = (e: React.PointerEvent) => {
    if (connectingFrom) {
      const canvasRect = canvasRef.current?.getBoundingClientRect()
      if (canvasRect) {
        const px = e.clientX - canvasRect.left
        const py = e.clientY - canvasRect.top
        const target = nodes.find(n => n.id !== connectingFrom && px >= n.x && px <= n.x + NODE_W && py >= n.y && py <= n.y + NODE_H)
        if (target) {
          const exists = connections.some(c => (c.from === connectingFrom && c.to === target.id) || (c.from === target.id && c.to === connectingFrom))
          if (!exists) onChange(nodes, [...connections, { id: makeId(), from: connectingFrom, to: target.id }])
        }
      }
      setConnectingFrom(null)
      setCursorPos(null)
      return
    }
    setDragId(null)
  }

  const handleImport = () => {
    const text = importText.trim()
    if (!text) { setImportError('Pegá un JSON o un diagrama Mermaid primero.'); return }
    const result = parseJsonImport(text) || parseMermaidImport(text)
    if (!result) {
      setImportError('No se detectaron componentes. Pegá el JSON exportado del lienzo o un diagrama Mermaid (flowchart/graph).')
      return
    }
    const startIdx = nodes.length
    const newIds: string[] = []
    const newNodes: ArchNode[] = result.items.map((item, i) => {
      const idx = startIdx + i
      const col = idx % 4
      const row = Math.floor(idx / 4)
      const id = makeId()
      newIds.push(id)
      return { id, label: item.label, type: item.type, x: 16 + col * (NODE_W + 16), y: 16 + row * (NODE_H + 16) }
    })
    const newConnections: ArchConnection[] = result.edges.map(e => ({
      id: makeId(),
      from: newIds[e.fromIdx],
      to: newIds[e.toIdx],
    }))
    const allNodes = [...nodes, ...newNodes]
    const allConnections = [...connections, ...newConnections]
    onChange(autoLayout(allNodes, allConnections), allConnections)
    setShowImport(false)
    setImportText('')
    setImportError('')
  }

  const handleAutoOrganize = () => onChange(autoLayout(nodes, connections), connections)

  return (
    <div className="space-y-3">
      {/* Paleta de componentes */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(NODE_TYPES) as ArchNodeType[]).map(type => {
          const t = NODE_TYPES[type]
          return (
            <button
              key={type}
              type="button"
              onClick={() => addNode(type)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: `${t.color}1a`, border: `1px solid ${t.color}40`, color: t.color }}
            >
              <Plus size={12} />
              <t.icon size={13} />
              {t.label}
            </button>
          )
        })}
        <span className="w-px h-5 bg-gray-700" />
        <button
          type="button"
          onClick={handleAutoOrganize}
          disabled={nodes.length === 0}
          title="Reacomoda los componentes en niveles según sus conexiones"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          <Wand2 size={12} /> Organizar
        </button>
        <button
          type="button"
          onClick={() => { setShowImport(true); setImportError('') }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors"
        >
          <Upload size={12} /> Importar
        </button>
      </div>

      {/* Popup de importación: JSON propio del lienzo o diagrama Mermaid.
          Va en un portal a document.body por el mismo motivo que el popup
          del Cronograma: un ancestro con backdrop-filter/transform rompe
          el centrado de position:fixed si se renderiza en el flujo normal. */}
      {showImport && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowImport(false) }}
        >
          <div className="relative w-full max-w-lg bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-white font-semibold text-sm">Importar arquitectura</h3>
              <button onClick={() => setShowImport(false)}
                className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors flex-shrink-0">
                <X size={14} />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-gray-500 text-xs">
                Pegá el <strong className="text-gray-300">JSON</strong> exportado de otro lienzo, o un diagrama <strong className="text-gray-300">Mermaid</strong> (flowchart/graph) — se agregan como componentes nuevos al lienzo actual, junto con sus flechas.
              </p>
              <textarea
                autoFocus
                value={importText}
                onChange={e => setImportText(e.target.value)}
                rows={8}
                placeholder={'flowchart TD\n  A[Frontend] --> B[Backend]\n  B --> C[(Base de datos)]\n  B --> D{IA / LLM}'}
                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-xs font-mono leading-relaxed resize-none focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors"
              />
              {importError && <p className="text-red-400 text-xs">{importError}</p>}
              <div className="flex items-center justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowImport(false)}
                  className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium transition-colors">
                  Cancelar
                </button>
                <button type="button" onClick={handleImport}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-semibold transition-colors">
                  <Upload size={14} /> Importar
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Lienzo */}
      <div
        ref={canvasRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative w-full rounded-xl border border-gray-700 overflow-hidden select-none"
        style={{
          height: 340,
          background: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px) 0 0 / 18px 18px, #0a0a1c',
        }}
      >
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-600 text-sm">Agrega componentes desde los botones de arriba y arrástralos al lienzo.</p>
          </div>
        )}

        {/* Conexiones */}
        <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
          <defs>
            <marker id="arch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
            </marker>
            <marker id="arch-arrow-hover" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#EF4444" />
            </marker>
          </defs>
          {connections.map(c => {
            const from = nodes.find(n => n.id === c.from)
            const to = nodes.find(n => n.id === c.to)
            if (!from || !to) return null
            const x1 = from.x + NODE_W / 2, y1 = from.y + NODE_H / 2
            const x2 = to.x + NODE_W / 2, y2 = to.y + NODE_H / 2
            const hovered = hoverConnId === c.id
            return (
              <g key={c.id}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="transparent" strokeWidth={14}
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onPointerEnter={() => setHoverConnId(c.id)}
                  onPointerLeave={() => setHoverConnId(null)}
                  onClick={() => removeConnection(c.id)}
                />
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={hovered ? '#EF4444' : '#94a3b8'}
                  strokeWidth={hovered ? 2.5 : 1.5}
                  markerEnd={hovered ? 'url(#arch-arrow-hover)' : 'url(#arch-arrow)'}
                  style={{ pointerEvents: 'none' }}
                />
              </g>
            )
          })}
          {connectingFrom && cursorPos && (() => {
            const from = nodes.find(n => n.id === connectingFrom)
            if (!from) return null
            return (
              <line
                x1={from.x + NODE_W / 2} y1={from.y + NODE_H / 2}
                x2={cursorPos.x} y2={cursorPos.y}
                stroke="#06B6D4" strokeWidth={2} strokeDasharray="4 3"
              />
            )
          })()}
        </svg>

        {nodes.map(node => {
          const t = NODE_TYPES[node.type]
          const isEditing = editingId === node.id
          return (
            <div
              key={node.id}
              onPointerDown={e => onPointerDownNode(e, node)}
              className="absolute flex items-center gap-2 px-3 py-2.5 rounded-xl shadow-lg cursor-move group"
              style={{
                left: node.x, top: node.y, width: NODE_W, height: NODE_H,
                background: 'rgba(20,20,40,0.92)',
                border: `1px solid ${t.color}55`,
                boxShadow: `0 4px 16px rgba(0,0,0,0.4), 0 0 0 1px ${t.color}22`,
                touchAction: 'none',
              }}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${t.color}25` }}>
                <t.icon size={14} style={{ color: t.color }} />
              </div>
              <div className="min-w-0 flex-1">
                {isEditing ? (
                  <input
                    autoFocus
                    defaultValue={node.label}
                    onPointerDown={e => e.stopPropagation()}
                    onBlur={e => { renameNode(node.id, e.target.value.trim() || t.label); setEditingId(null) }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                    className="w-full bg-transparent border-b border-white/20 text-white text-xs font-medium outline-none"
                  />
                ) : (
                  <p
                    onDoubleClick={e => { e.stopPropagation(); setEditingId(node.id) }}
                    className="text-white text-xs font-medium truncate"
                    title="Doble click para renombrar"
                  >
                    {node.label}
                  </p>
                )}
                <p className="text-[10px] text-gray-500 truncate">{t.label}</p>
              </div>
              <button
                type="button"
                onPointerDown={e => e.stopPropagation()}
                onClick={() => removeNode(node.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 hover:bg-red-400 flex items-center justify-center flex-shrink-0"
              >
                <Trash2 size={10} className="text-white" />
              </button>
              <div
                onPointerDown={e => startConnection(e, node.id)}
                title="Arrastrá para conectar con otro componente"
                className="opacity-0 group-hover:opacity-100 transition-opacity absolute -right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-gray-600 hover:bg-cyan-400 border border-gray-900 cursor-crosshair flex-shrink-0"
                style={{ touchAction: 'none' }}
              />
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-gray-600">
        Arrastra los componentes para ubicarlos, doble click para renombrar. Arrastrá desde el punto del borde derecho para conectar dos componentes; click en una flecha para borrarla.
      </p>
    </div>
  )
}
