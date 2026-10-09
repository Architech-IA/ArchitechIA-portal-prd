'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Monitor, Server, Database, Workflow, Brain, Clock, Zap, Globe2, Trash2, Plus, Upload, X, Wand2,
  ZoomIn, ZoomOut, Maximize, ArrowUpRight, ArrowDownLeft,
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
  externo:  { label: 'Servicio externo', icon: Globe2, color: '#7f8a9c' },
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
  const childrenMap = new Map<string, string[]>()
  const parentsMap = new Map<string, string[]>()
  const inDegree = new Map<string, number>()
  nodes.forEach(n => { childrenMap.set(n.id, []); parentsMap.set(n.id, []); inDegree.set(n.id, 0) })
  connections.forEach(c => {
    if (!ids.has(c.from) || !ids.has(c.to) || c.from === c.to) return
    childrenMap.get(c.from)!.push(c.to)
    parentsMap.get(c.to)!.push(c.from)
    inDegree.set(c.to, (inDegree.get(c.to) || 0) + 1)
  })

  // 1) Nivel (columna) de cada nodo por BFS desde las raíces: izquierda = sin entradas.
  const level = new Map<string, number>()
  const queue: string[] = []
  nodes.forEach(n => { if ((inDegree.get(n.id) || 0) === 0) { level.set(n.id, 0); queue.push(n.id) } })
  if (queue.length === 0) { level.set(nodes[0].id, 0); queue.push(nodes[0].id) }
  let qi = 0
  const guard = nodes.length * 6 + 10
  while (qi < queue.length && qi < guard) {
    const id = queue[qi++]
    const lvl = level.get(id) ?? 0
    for (const childId of childrenMap.get(id) || []) {
      if ((level.get(childId) ?? -1) < lvl + 1) {
        level.set(childId, lvl + 1)
        queue.push(childId)
      }
    }
  }
  nodes.forEach(n => { if (!level.has(n.id)) level.set(n.id, 0) })

  const maxLevel = Math.max(...Array.from(level.values()))
  const levels: string[][] = Array.from({ length: maxLevel + 1 }, () => [])
  nodes.forEach(n => levels[level.get(n.id)!].push(n.id))

  // 2) Reducir cruces: orden dentro de cada columna según la posición promedio
  //    de sus vecinos en la columna adyacente (heurística de "barycenter").
  const order = new Map<string, number>()
  levels.forEach(col => col.forEach((id, i) => order.set(id, i)))

  const sweep = (neighborsOf: Map<string, string[]>, from: number, to: number, step: number) => {
    for (let li = from; step > 0 ? li <= to : li >= to; li += step) {
      const scored = levels[li].map(id => {
        const positions = (neighborsOf.get(id) || [])
          .map(nb => order.get(nb))
          .filter((p): p is number => p !== undefined)
        const score = positions.length > 0
          ? positions.reduce((a, b) => a + b, 0) / positions.length
          : order.get(id)!
        return { id, score }
      })
      scored.sort((a, b) => a.score - b.score)
      levels[li] = scored.map(s => s.id)
      levels[li].forEach((id, i) => order.set(id, i))
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    if (levels.length > 1) sweep(parentsMap, 1, levels.length - 1, 1)
    if (levels.length > 1) sweep(childrenMap, levels.length - 2, 0, -1)
  }

  // 3) Posicionar: nivel = columna (x), orden = fila (y) -> flujo de izquierda a derecha.
  const GAP_X = NODE_W + 36
  const GAP_Y = NODE_H + 24
  const positioned = new Map<string, { x: number; y: number }>()
  levels.forEach((col, li) => {
    col.forEach((id, idx) => positioned.set(id, { x: 16 + li * GAP_X, y: 16 + idx * GAP_Y }))
  })

  return nodes.map(n => ({ ...n, ...positioned.get(n.id)! }))
}

interface ArchitectureCanvasProps {
  nodes: ArchNode[]
  connections: ArchConnection[]
  onChange: (nodes: ArchNode[], connections: ArchConnection[]) => void
}

const MIN_SCALE = 0.4
const MAX_SCALE = 2

export default function ArchitectureCanvas({ nodes, connections, onChange }: ArchitectureCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [replaceOnImport, setReplaceOnImport] = useState(false)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)
  const [hoverConnId, setHoverConnId] = useState<string | null>(null)
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })
  const [panning, setPanning] = useState(false)
  const panStart = useRef({ x: 0, y: 0, viewX: 0, viewY: 0 })
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const dragMoved = useRef(false)
  const dragStartScreen = useRef({ x: 0, y: 0 })

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: (clientX - rect.left - view.x) / view.scale, y: (clientY - rect.top - view.y) / view.scale }
  }, [view])

  const zoomAt = useCallback((factor: number, anchorX?: number, anchorY?: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    const cx = anchorX ?? (rect ? rect.width / 2 : 0)
    const cy = anchorY ?? (rect ? rect.height / 2 : 0)
    setView(v => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor))
      const worldX = (cx - v.x) / v.scale
      const worldY = (cy - v.y) / v.scale
      return { scale: newScale, x: cx - worldX * newScale, y: cy - worldY * newScale }
    })
  }, [])

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const fitToView = () => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    if (nodes.length === 0) { setView({ x: 0, y: 0, scale: 1 }); return }
    const minX = Math.min(...nodes.map(n => n.x))
    const minY = Math.min(...nodes.map(n => n.y))
    const maxX = Math.max(...nodes.map(n => n.x + NODE_W))
    const maxY = Math.max(...nodes.map(n => n.y + NODE_H))
    const pad = 32
    const contentW = Math.max(maxX - minX, 1)
    const contentH = Math.max(maxY - minY, 1)
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min((rect.width - pad * 2) / contentW, (rect.height - pad * 2) / contentH, 1)))
    setView({
      x: (rect.width - contentW * scale) / 2 - minX * scale,
      y: (rect.height - contentH * scale) / 2 - minY * scale,
      scale,
    })
  }

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

  const changeNodeType = (id: string, type: ArchNodeType) =>
    onChange(nodes.map(n => (n.id === id ? { ...n, type } : n)), connections)

  const removeConnection = (id: string) => onChange(nodes, connections.filter(c => c.id !== id))

  const onPointerDownNode = (e: React.PointerEvent, node: ArchNode) => {
    e.stopPropagation()
    if (editingId) return
    dragStartScreen.current = { x: e.clientX, y: e.clientY }
    dragMoved.current = false
    const w = toWorld(e.clientX, e.clientY)
    setDragId(node.id)
    dragOffset.current = { x: w.x - node.x, y: w.y - node.y }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const startConnection = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation()
    setConnectingFrom(nodeId)
    setCursorPos(toWorld(e.clientX, e.clientY))
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (editingId) return
    panStart.current = { x: e.clientX, y: e.clientY, viewX: view.x, viewY: view.y }
    setPanning(true)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (panning) {
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      setView(v => ({ ...v, x: panStart.current.viewX + dx, y: panStart.current.viewY + dy }))
      return
    }
    if (connectingFrom) {
      setCursorPos(toWorld(e.clientX, e.clientY))
      return
    }
    if (!dragId) return
    const dx = e.clientX - dragStartScreen.current.x
    const dy = e.clientY - dragStartScreen.current.y
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved.current = true
    const w = toWorld(e.clientX, e.clientY)
    onChange(nodes.map(n => (n.id === dragId ? { ...n, x: w.x - dragOffset.current.x, y: w.y - dragOffset.current.y } : n)), connections)
  }, [panning, dragId, connectingFrom, nodes, connections, onChange, toWorld])

  const onPointerUp = (e: React.PointerEvent) => {
    if (panning) { setPanning(false); return }
    if (connectingFrom) {
      const w = toWorld(e.clientX, e.clientY)
      const target = nodes.find(n => n.id !== connectingFrom && w.x >= n.x && w.x <= n.x + NODE_W && w.y >= n.y && w.y <= n.y + NODE_H)
      if (target) {
        const exists = connections.some(c => (c.from === connectingFrom && c.to === target.id) || (c.from === target.id && c.to === connectingFrom))
        if (!exists) onChange(nodes, [...connections, { id: makeId(), from: connectingFrom, to: target.id }])
      }
      setConnectingFrom(null)
      setCursorPos(null)
      return
    }
    if (dragId) {
      if (!dragMoved.current) setSelectedNodeId(dragId)
      setDragId(null)
    }
  }

  const handleImport = () => {
    const text = importText.trim()
    if (!text) { setImportError('Pegá un JSON o un diagrama Mermaid primero.'); return }
    const result = parseJsonImport(text) || parseMermaidImport(text)
    if (!result) {
      setImportError('No se detectaron componentes. Pegá el JSON exportado del lienzo o un diagrama Mermaid (flowchart/graph).')
      return
    }
    if (replaceOnImport && nodes.length > 0 && !window.confirm(`Esto va a borrar los ${nodes.length} componente(s) actuales y dejar solo los ${result.items.length} importados. ¿Continuar?`)) {
      return
    }
    const baseNodes = replaceOnImport ? [] : nodes
    const baseConnections = replaceOnImport ? [] : connections
    const startIdx = baseNodes.length
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
    const allNodes = [...baseNodes, ...newNodes]
    const allConnections = [...baseConnections, ...newConnections]
    onChange(autoLayout(allNodes, allConnections), allConnections)
    setShowImport(false)
    setImportText('')
    setImportError('')
  }

  const handleAutoOrganize = () => onChange(autoLayout(nodes, connections), connections)

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null
  const relatedConnections = selectedNode
    ? connections
        .map(c => {
          if (c.from === selectedNode.id) return { conn: c, dir: 'out' as const, other: nodes.find(n => n.id === c.to) }
          if (c.to === selectedNode.id) return { conn: c, dir: 'in' as const, other: nodes.find(n => n.id === c.from) }
          return null
        })
        .filter((r): r is { conn: ArchConnection; dir: 'in' | 'out'; other: ArchNode | undefined } => r !== null)
    : []

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
          onClick={() => { setShowImport(true); setImportError(''); setReplaceOnImport(false) }}
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
              <p className="text-[#7f8a9c] text-xs">
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
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={replaceOnImport}
                  onChange={e => setReplaceOnImport(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500/40"
                />
                Reemplazar el lienzo actual (en vez de agregar a lo que ya hay)
              </label>
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

      {/* Popup con el detalle del componente seleccionado: click simple (sin arrastrar) en un nodo. */}
      {selectedNode && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedNodeId(null) }}
        >
          <div className="relative w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${NODE_TYPES[selectedNode.type].color}25` }}>
                  {(() => {
                    const SelectedIcon = NODE_TYPES[selectedNode.type].icon
                    return <SelectedIcon size={15} style={{ color: NODE_TYPES[selectedNode.type].color }} />
                  })()}
                </div>
                <h3 className="text-white font-semibold text-sm truncate">{selectedNode.label || 'Sin nombre'}</h3>
              </div>
              <button onClick={() => setSelectedNodeId(null)}
                className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors flex-shrink-0">
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Nombre</label>
                <input
                  type="text"
                  value={selectedNode.label}
                  onChange={e => renameNode(selectedNode.id, e.target.value)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Tipo</label>
                <select
                  value={selectedNode.type}
                  onChange={e => changeNodeType(selectedNode.id, e.target.value as ArchNodeType)}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors appearance-none cursor-pointer"
                >
                  {(Object.keys(NODE_TYPES) as ArchNodeType[]).map(type => (
                    <option key={type} value={type}>{NODE_TYPES[type].label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Conexiones relacionadas {relatedConnections.length > 0 && `(${relatedConnections.length})`}
                </label>
                {relatedConnections.length === 0 ? (
                  <p className="text-[#7f8a9c] text-xs">Sin conexiones todavía. Arrastrá desde el borde derecho del nodo para crear una.</p>
                ) : (
                  <div className="space-y-1.5">
                    {relatedConnections.map(({ conn, dir, other }) => (
                      <div key={conn.id} className="flex items-center justify-between gap-2 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2">
                        <span className="text-xs text-gray-300 truncate flex items-center gap-1.5">
                          {dir === 'out' ? <ArrowUpRight size={12} className="text-[#7f8a9c] flex-shrink-0" /> : <ArrowDownLeft size={12} className="text-[#7f8a9c] flex-shrink-0" />}
                          {other?.label || 'Sin nombre'}
                        </span>
                        <button type="button" onClick={() => removeConnection(conn.id)}
                          className="text-[#7f8a9c] hover:text-red-400 transition-colors flex-shrink-0">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-red-900/40 bg-red-950/10 rounded-xl p-3">
                <button
                  type="button"
                  onClick={() => { removeNode(selectedNode.id); setSelectedNodeId(null) }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                >
                  <Trash2 size={14} /> Eliminar componente
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Lienzo: pan arrastrando el fondo vacío, zoom con la rueda del mouse */}
      <div
        ref={canvasRef}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative w-full rounded-xl border border-gray-700 overflow-hidden select-none"
        style={{
          height: 340,
          cursor: panning ? 'grabbing' : 'grab',
          background: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px) ${view.x}px ${view.y}px / ${18 * view.scale}px ${18 * view.scale}px, #0a0a1c`,
        }}
      >
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-[#7f8a9c] text-sm">Agrega componentes desde los botones de arriba y arrástralos al lienzo.</p>
          </div>
        )}

        {/* Contenido del mundo: pan/zoom aplicado vía transform */}
        <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '0 0' }}>
          {/* Conexiones */}
          <svg className="absolute pointer-events-none" style={{ left: 0, top: 0, width: 4000, height: 4000, overflow: 'visible' }}>
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

              // Ruta en escuadra: sale por el borde derecho/izquierdo (no del centro),
              // y solo dobla en ángulo recto si el destino no está en la misma fila —
              // evita las diagonales que cruzan el lienzo sin necesidad.
              const fromCY = from.y + NODE_H / 2
              const toCY = to.y + NODE_H / 2
              let x1: number, y1: number, x2: number, y2: number
              if (to.x >= from.x + NODE_W) {
                x1 = from.x + NODE_W; y1 = fromCY
                x2 = to.x; y2 = toCY
              } else if (to.x + NODE_W <= from.x) {
                x1 = from.x; y1 = fromCY
                x2 = to.x + NODE_W; y2 = toCY
              } else {
                x1 = from.x + NODE_W / 2; y1 = fromCY
                x2 = to.x + NODE_W / 2; y2 = toCY
              }
              const midX = (x1 + x2) / 2
              const d = y1 === y2 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} L${midX},${y1} L${midX},${y2} L${x2},${y2}`
              const hovered = hoverConnId === c.id
              return (
                <g key={c.id}>
                  <path
                    d={d} fill="none"
                    stroke="transparent" strokeWidth={14}
                    style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                    onPointerEnter={() => setHoverConnId(c.id)}
                    onPointerLeave={() => setHoverConnId(null)}
                    onClick={() => removeConnection(c.id)}
                  />
                  <path
                    d={d} fill="none"
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
                  <p className="text-[11px] text-[#7f8a9c] truncate">{t.label}</p>
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

        {/* Controles de zoom: fijos, no se mueven con el pan */}
        <div className="absolute bottom-2 right-2 flex items-center gap-0.5 bg-gray-900/90 border border-gray-700 rounded-lg p-1">
          <button type="button" onClick={() => zoomAt(1 / 1.2)} title="Alejar"
            className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <ZoomOut size={13} />
          </button>
          <span className="text-[11px] text-[#7f8a9c] font-mono w-9 text-center select-none">{Math.round(view.scale * 100)}%</span>
          <button type="button" onClick={() => zoomAt(1.2)} title="Acercar"
            className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <ZoomIn size={13} />
          </button>
          <span className="w-px h-4 bg-gray-700 mx-0.5" />
          <button type="button" onClick={fitToView} title="Ajustar a la vista"
            className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
            <Maximize size={13} />
          </button>
        </div>
      </div>
      <p className="text-[11px] text-[#7f8a9c]">
        Arrastra los componentes para ubicarlos, doble click para renombrar. Arrastrá el fondo vacío para mover la vista, rueda del mouse para zoom. Arrastrá desde el punto del borde derecho para conectar dos componentes; click en una flecha para borrarla.
      </p>
    </div>
  )
}
