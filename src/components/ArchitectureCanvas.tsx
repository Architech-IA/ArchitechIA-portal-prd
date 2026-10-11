'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Monitor, Server, Database, Workflow, Brain, Clock, Zap, Globe2, Trash2, Plus, Upload, X, Wand2,
  ZoomIn, ZoomOut, Maximize, ArrowUpRight, ArrowDownLeft, StickyNote, BoxSelect, Undo2, Redo2, Copy, Grid3x3, Download, Code2,
} from 'lucide-react'

export interface ArchNode {
  id: string
  label: string
  type: ArchTipoNodo
  x: number
  y: number
  /** Tecnología o rol del componente; en una nota, su texto. */
  description?: string
  /** Tamaño de grupos y notas (los componentes tienen tamaño fijo). */
  w?: number
  h?: number
}

export interface ArchConnection {
  id: string
  from: string
  to: string
}

/** Además de los componentes, el lienzo admite notas adhesivas y grupos (recuadros que agrupan). */
export type ArchTipoNodo = ArchNodeType | 'nota' | 'grupo'

export type ArchNodeType = 'frontend' | 'backend' | 'database' | 'api' | 'ia' | 'queue' | 'cache' | 'externo'

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
  /** Lo que el motor propone agregar: se dibuja punteado y no se edita hasta que se acepta. */
  fantasmas?: { nodes: ArchNode[]; connections: ArchConnection[] }
}

const MIN_SCALE = 0.3
const MAX_SCALE = 2
const CELDA = 18
const esComp = (n: ArchNode) => n.type !== 'nota' && n.type !== 'grupo'
const dims = (n: ArchNode) =>
  n.type === 'grupo' ? { w: n.w ?? 280, h: n.h ?? 180 } : n.type === 'nota' ? { w: n.w ?? 160, h: n.h ?? 88 } : { w: NODE_W, h: NODE_H }

interface Foto { nodes: ArchNode[]; connections: ArchConnection[] }

/** Acomoda solo los componentes; las notas y los grupos se quedan donde la persona los puso. */
function ordenarComponentes(nodes: ArchNode[], connections: ArchConnection[]): ArchNode[] {
  return [...autoLayout(nodes.filter(esComp), connections), ...nodes.filter(n => !esComp(n))]
}

/** Texto Mermaid (flowchart) del lienzo, para pegarlo en un documento o en la pestaña Diagramas. */
export function aMermaid(nodes: ArchNode[], connections: ArchConnection[]): string {
  const comp = nodes.filter(esComp)
  const id = (n: ArchNode) => `n${comp.indexOf(n) + 1}`
  const forma = (n: ArchNode) => {
    const l = (n.label || 'Sin nombre').replace(/"/g, "'")
    return n.type === 'database' ? `${id(n)}[("${l}")]` : n.type === 'externo' ? `${id(n)}{{"${l}"}}` : `${id(n)}["${l}"]`
  }
  const lineas = comp.map(n => `  ${forma(n)}`)
  connections.forEach(c => {
    const a = comp.find(n => n.id === c.from)
    const b = comp.find(n => n.id === c.to)
    if (a && b) lineas.push(`  ${id(a)} --> ${id(b)}`)
  })
  return `flowchart LR\n${lineas.join('\n')}`
}

export default function ArchitectureCanvas({ nodes, connections, onChange, fantasmas }: ArchitectureCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const arrastrados = useRef<Set<string>>(new Set())
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
  const [cuadricula, setCuadricula] = useState(false)
  const [aviso, setAviso] = useState('')
  const pasado = useRef<Foto[]>([])
  const futuro = useRef<Foto[]>([])
  const [, setVersion] = useState(0)

  const avisar = (t: string) => { setAviso(t); setTimeout(() => setAviso(''), 2200) }
  /** Todo cambio hecho por la persona pasa por aquí para poder deshacerlo (los textos que se escriben tecla a tecla no apilan un paso por letra). */
  const cambiar = useCallback((n: ArchNode[], c: ArchConnection[], historial = true) => {
    if (historial) {
      pasado.current.push({ nodes, connections })
      if (pasado.current.length > 60) pasado.current.shift()
      futuro.current = []
      setVersion(v => v + 1)
    }
    onChange(n, c)
  }, [nodes, connections, onChange])
  const deshacer = () => {
    const p = pasado.current.pop()
    if (!p) return
    futuro.current.push({ nodes, connections })
    onChange(p.nodes, p.connections)
    setVersion(v => v + 1)
  }
  const rehacer = () => {
    const f = futuro.current.pop()
    if (!f) return
    pasado.current.push({ nodes, connections })
    onChange(f.nodes, f.connections)
    setVersion(v => v + 1)
  }

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
    // Con la rueda sola la pantalla se desplaza (el lienzo ocupa mucho espacio); con Ctrl o Cmd se hace zoom.
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
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
    const maxX = Math.max(...nodes.map(n => n.x + dims(n).w))
    const maxY = Math.max(...nodes.map(n => n.y + dims(n).h))
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

  /** Un lugar libre en lo que se ve ahora (no siempre en la esquina, donde se amontonaría todo). */
  const puntoVisible = (extraX = 0) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    const w = rect ? toWorld(rect.left + rect.width / 2, rect.top + rect.height / 2) : { x: 120, y: 120 }
    const n = nodes.length % 6
    return { x: Math.round(w.x - NODE_W / 2 + n * 16 + extraX), y: Math.round(w.y - NODE_H / 2 + n * 16) }
  }

  const addNode = (type: ArchNodeType) => {
    const p = puntoVisible()
    const id = makeId()
    cambiar([...nodes, { id, label: NODE_TYPES[type].label, type, x: p.x, y: p.y }], connections)
    setSelectedNodeId(id)
  }
  const addNota = () => {
    const p = puntoVisible(40)
    const id = makeId()
    cambiar([...nodes, { id, label: 'Nota', description: 'Escribe aquí una pregunta o un recordatorio', type: 'nota', x: p.x, y: p.y }], connections)
    setSelectedNodeId(id)
  }
  const addGrupo = () => {
    const p = puntoVisible(-60)
    const id = makeId()
    cambiar([{ id, label: 'Grupo', type: 'grupo', x: p.x - 40, y: p.y - 40, w: 280, h: 180 }, ...nodes], connections)
    setSelectedNodeId(id)
  }
  const duplicar = (id: string) => {
    const n = nodes.find(x => x.id === id)
    if (!n) return
    const copia = { ...n, id: makeId(), x: n.x + 24, y: n.y + 24, label: n.type === 'nota' || n.type === 'grupo' ? n.label : `${n.label} (copia)` }
    cambiar([...nodes, copia], connections)
    setSelectedNodeId(copia.id)
  }

  const removeNode = (id: string) =>
    cambiar(nodes.filter(n => n.id !== id), connections.filter(c => c.from !== id && c.to !== id))
  const editarNodo = (id: string, parche: Partial<ArchNode>) =>
    cambiar(nodes.map(n => (n.id === id ? { ...n, ...parche } : n)), connections, false)
  const changeNodeType = (id: string, type: ArchNodeType) =>
    cambiar(nodes.map(n => (n.id === id ? { ...n, type } : n)), connections)
  const removeConnection = (id: string) => cambiar(nodes, connections.filter(c => c.id !== id))

  const onPointerDownNode = (e: React.PointerEvent, node: ArchNode) => {
    e.stopPropagation()
    if (editingId) return
    canvasRef.current?.focus()
    dragStartScreen.current = { x: e.clientX, y: e.clientY }
    dragMoved.current = false
    const w = toWorld(e.clientX, e.clientY)
    setDragId(node.id)
    dragOffset.current = { x: w.x - node.x, y: w.y - node.y }
    // Mover un grupo mueve lo que tiene adentro.
    arrastrados.current = new Set()
    if (node.type === 'grupo') {
      const d = dims(node)
      nodes.forEach(n => {
        if (n.id === node.id || n.type === 'grupo') return
        const dn = dims(n)
        const cx = n.x + dn.w / 2
        const cy = n.y + dn.h / 2
        if (cx >= node.x && cx <= node.x + d.w && cy >= node.y && cy <= node.y + d.h) arrastrados.current.add(n.id)
      })
    }
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
    canvasRef.current?.focus()
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
    if (!dragMoved.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      dragMoved.current = true
      pasado.current.push({ nodes, connections })
      futuro.current = []
      setVersion(v => v + 1)
    }
    if (!dragMoved.current) return
    const w = toWorld(e.clientX, e.clientY)
    let nx = w.x - dragOffset.current.x
    let ny = w.y - dragOffset.current.y
    if (cuadricula) { nx = Math.round(nx / CELDA) * CELDA; ny = Math.round(ny / CELDA) * CELDA }
    const arrastrado = nodes.find(n => n.id === dragId)
    if (!arrastrado) return
    const ddx = nx - arrastrado.x
    const ddy = ny - arrastrado.y
    onChange(nodes.map(n => (n.id === dragId ? { ...n, x: nx, y: ny } : arrastrados.current.has(n.id) ? { ...n, x: n.x + ddx, y: n.y + ddy } : n)), connections)
  }, [panning, dragId, connectingFrom, nodes, connections, onChange, toWorld, cuadricula])

  const onPointerUp = (e: React.PointerEvent) => {
    if (panning) { setPanning(false); return }
    if (connectingFrom) {
      const w = toWorld(e.clientX, e.clientY)
      const target = nodes.find(n => n.id !== connectingFrom && esComp(n) && w.x >= n.x && w.x <= n.x + NODE_W && w.y >= n.y && w.y <= n.y + NODE_H)
      if (target) {
        const exists = connections.some(c => (c.from === connectingFrom && c.to === target.id) || (c.from === target.id && c.to === connectingFrom))
        if (!exists) cambiar(nodes, [...connections, { id: makeId(), from: connectingFrom, to: target.id }])
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

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editingId || (e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer() }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); rehacer() }
    else if (mod && e.key.toLowerCase() === 'd' && selectedNodeId) { e.preventDefault(); duplicar(selectedNodeId) }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) { e.preventDefault(); removeNode(selectedNodeId); setSelectedNodeId(null) }
    else if (e.key === 'Escape') setSelectedNodeId(null)
  }

  const handleImport = () => {
    const text = importText.trim()
    if (!text) { setImportError('Pegá un JSON o un diagrama Mermaid primero.'); return }
    const result = parseJsonImport(text) || parseMermaidImport(text)
    if (!result) {
      setImportError('No se detectaron componentes. Pegá el JSON exportado del lienzo o un diagrama Mermaid (flowchart/graph).')
      return
    }
    if (replaceOnImport && nodes.length > 0 && !window.confirm(`Esto va a borrar los ${nodes.length} elemento(s) actuales y dejar solo los ${result.items.length} importados. ¿Continuar?`)) {
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
    cambiar(ordenarComponentes(allNodes, allConnections), allConnections)
    setShowImport(false)
    setImportText('')
    setImportError('')
  }

  const handleAutoOrganize = () => cambiar(ordenarComponentes(nodes, connections), connections)

  const copiarMermaid = () => {
    void navigator.clipboard?.writeText(aMermaid(nodes, connections)).then(() => avisar('Mermaid copiado'), () => avisar('No se pudo copiar'))
  }
  const exportarJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ nodes, connections }, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'arquitectura.json'
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

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

  const btn = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-colors disabled:opacity-40'
  const todos = [...nodes, ...(fantasmas?.nodes ?? [])]
  const comps = nodes.filter(esComp)

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
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={addNota} className={btn} title="Una nota adhesiva para una pregunta o un recordatorio"><StickyNote size={12} /> Nota</button>
        <button type="button" onClick={addGrupo} className={btn} title="Un recuadro que agrupa componentes; al moverlo se mueven con él"><BoxSelect size={12} /> Grupo</button>
        <span className="w-px h-5 bg-gray-700" />
        <button type="button" onClick={deshacer} disabled={pasado.current.length === 0} className={btn} title="Deshacer (Ctrl+Z)"><Undo2 size={12} /></button>
        <button type="button" onClick={rehacer} disabled={futuro.current.length === 0} className={btn} title="Rehacer (Ctrl+Y)"><Redo2 size={12} /></button>
        <button type="button" onClick={() => selectedNodeId && duplicar(selectedNodeId)} disabled={!selectedNodeId} className={btn} title="Duplicar el elemento seleccionado (Ctrl+D)"><Copy size={12} /> Duplicar</button>
        <button type="button" onClick={() => setCuadricula(v => !v)} className={`${btn} ${cuadricula ? '!bg-cyan-900/50 !text-cyan-300' : ''}`} title="Alinear a la cuadrícula al arrastrar"><Grid3x3 size={12} /> Cuadrícula</button>
        <span className="w-px h-5 bg-gray-700" />
        <button type="button" onClick={handleAutoOrganize} disabled={comps.length === 0} title="Reacomoda los componentes en niveles según sus conexiones" className={btn}><Wand2 size={12} /> Organizar</button>
        <button type="button" onClick={() => { setShowImport(true); setImportError(''); setReplaceOnImport(false) }} className={btn}><Upload size={12} /> Importar</button>
        <button type="button" onClick={copiarMermaid} disabled={comps.length === 0} className={btn} title="Copia el lienzo como diagrama Mermaid"><Code2 size={12} /> Mermaid</button>
        <button type="button" onClick={exportarJson} disabled={nodes.length === 0} className={btn} title="Descarga el lienzo como JSON"><Download size={12} /> JSON</button>
        {aviso && <span className="text-[11px] text-emerald-400">{aviso}</span>}
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
                className="w-full bg-gray-950 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-xs font-mono leading-relaxed resize-none focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40 transition-colors"
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

      <div className="grid gap-3" style={{ gridTemplateColumns: selectedNode ? 'minmax(0,1fr) 230px' : 'minmax(0,1fr)' }}>
        {/* Lienzo: pan arrastrando el fondo vacío, zoom con la rueda del mouse */}
        <div
          ref={canvasRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="relative w-full rounded-xl border border-gray-700 overflow-hidden select-none outline-none focus:border-cyan-600/60"
          style={{
            height: 460,
            cursor: panning ? 'grabbing' : 'grab',
            background: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px) ${view.x}px ${view.y}px / ${CELDA * view.scale}px ${CELDA * view.scale}px, #0a0a1c`,
          }}
        >
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-[#7f8a9c] text-sm">Agrega componentes desde los botones de arriba y arrástralos al lienzo.</p>
            </div>
          )}

          {/* Contenido del mundo: pan/zoom aplicado vía transform */}
          <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: '0 0' }}>
            {/* Grupos: por debajo de todo para que los componentes de adentro sigan siendo tocables */}
            {nodes.filter(n => n.type === 'grupo').map(g => {
              const d = dims(g)
              const sel = selectedNodeId === g.id
              return (
                <div key={g.id} onPointerDown={e => onPointerDownNode(e, g)} className="absolute rounded-2xl cursor-move"
                  style={{ left: g.x, top: g.y, width: d.w, height: d.h, border: `1.5px dashed ${sel ? '#06B6D4' : '#64748b'}`, background: 'rgba(100,116,139,0.06)', touchAction: 'none' }}>
                  <span className="absolute -top-0.5 left-3 -translate-y-full text-[11px] font-medium text-gray-300 bg-[#0a0a1c] px-1.5 rounded">{g.label || 'Grupo'}</span>
                </div>
              )
            })}

            {/* Conexiones */}
            <svg className="absolute pointer-events-none" style={{ left: 0, top: 0, width: 4000, height: 4000, overflow: 'visible' }}>
              <defs>
                <marker id="arch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
                </marker>
                <marker id="arch-arrow-hover" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#EF4444" />
                </marker>
                <marker id="arch-arrow-prop" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#f59e0b" />
                </marker>
              </defs>
              {[...connections.map(c => ({ c, propuesta: false })), ...(fantasmas?.connections ?? []).map(c => ({ c, propuesta: true }))].map(({ c, propuesta }) => {
                const from = todos.find(n => n.id === c.from)
                const to = todos.find(n => n.id === c.to)
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
                const hovered = !propuesta && hoverConnId === c.id
                return (
                  <g key={(propuesta ? 'p-' : '') + c.id}>
                    {!propuesta && (
                      <path
                        d={d} fill="none"
                        stroke="transparent" strokeWidth={14}
                        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                        onPointerEnter={() => setHoverConnId(c.id)}
                        onPointerLeave={() => setHoverConnId(null)}
                        onClick={() => removeConnection(c.id)}
                      />
                    )}
                    <path
                      d={d} fill="none"
                      stroke={propuesta ? '#f59e0b' : hovered ? '#EF4444' : '#94a3b8'}
                      strokeWidth={hovered ? 2.5 : 1.5}
                      strokeDasharray={propuesta ? '5 4' : undefined}
                      markerEnd={propuesta ? 'url(#arch-arrow-prop)' : hovered ? 'url(#arch-arrow-hover)' : 'url(#arch-arrow)'}
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

            {/* Notas adhesivas */}
            {nodes.filter(n => n.type === 'nota').map(n => {
              const d = dims(n)
              return (
                <div key={n.id} onPointerDown={e => onPointerDownNode(e, n)} className="absolute rounded-md p-2 cursor-move overflow-hidden"
                  style={{ left: n.x, top: n.y, width: d.w, height: d.h, background: '#FAEEDA', color: '#412402', border: `1px solid ${selectedNodeId === n.id ? '#06B6D4' : '#EF9F27'}`, touchAction: 'none' }}>
                  <p className="text-[11px] font-semibold truncate">{n.label || 'Nota'}</p>
                  <p className="text-[11px] leading-snug mt-0.5" style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.description}</p>
                </div>
              )
            })}

            {/* Componentes (y los que propone el motor, punteados) */}
            {[...nodes.filter(esComp).map(n => ({ n, propuesta: false })), ...(fantasmas?.nodes ?? []).map(n => ({ n, propuesta: true }))].map(({ n: node, propuesta }) => {
              const t = NODE_TYPES[(node.type in NODE_TYPES ? node.type : 'externo') as ArchNodeType]
              const isEditing = !propuesta && editingId === node.id
              const sel = !propuesta && selectedNodeId === node.id
              return (
                <div
                  key={(propuesta ? 'p-' : '') + node.id}
                  onPointerDown={propuesta ? e => e.stopPropagation() : e => onPointerDownNode(e, node)}
                  className={`absolute flex items-center gap-2 px-3 py-2.5 rounded-xl shadow-lg group ${propuesta ? 'cursor-default' : 'cursor-move'}`}
                  title={node.description || undefined}
                  style={{
                    left: node.x, top: node.y, width: NODE_W, height: NODE_H,
                    background: propuesta ? 'rgba(245,158,11,0.08)' : 'rgba(20,20,40,0.92)',
                    border: propuesta ? '1.5px dashed #f59e0b' : `1px solid ${sel ? '#06B6D4' : `${t.color}55`}`,
                    boxShadow: propuesta ? 'none' : `0 4px 16px rgba(0,0,0,0.4), 0 0 0 ${sel ? 2 : 1}px ${sel ? '#06B6D4' : `${t.color}22`}`,
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
                        onBlur={e => { editarNodo(node.id, { label: e.target.value.trim() || t.label }); setEditingId(null) }}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        className="w-full bg-transparent border-b border-white/20 text-white text-xs font-medium outline-none"
                      />
                    ) : (
                      <p
                        onDoubleClick={propuesta ? undefined : e => { e.stopPropagation(); setEditingId(node.id) }}
                        className="text-white text-xs font-medium truncate"
                        title={propuesta ? undefined : 'Doble click para renombrar'}
                      >
                        {node.label}
                      </p>
                    )}
                    <p className={`text-[11px] truncate ${propuesta ? 'text-amber-400' : 'text-[#7f8a9c]'}`}>{propuesta ? 'Propuesta del motor' : t.label}</p>
                  </div>
                  {!propuesta && (
                    <>
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
                    </>
                  )}
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

        {/* Propiedades del elemento seleccionado: siempre a la vista, no en una ventana que tape el lienzo */}
        {selectedNode && (
          <aside className="rounded-xl border border-gray-700 bg-gray-950/70 p-3 space-y-3 self-start" aria-label="Propiedades">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-200 truncate">{selectedNode.type === 'nota' ? 'Nota' : selectedNode.type === 'grupo' ? 'Grupo' : NODE_TYPES[selectedNode.type as ArchNodeType].label}</p>
              <button type="button" onClick={() => setSelectedNodeId(null)} aria-label="Cerrar propiedades" className="text-gray-500 hover:text-gray-300"><X size={13} /></button>
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">{selectedNode.type === 'nota' ? 'Título' : 'Nombre'}</label>
              <input type="text" value={selectedNode.label} onChange={e => editarNodo(selectedNode.id, { label: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500" />
            </div>
            {esComp(selectedNode) && (
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Tipo</label>
                <select value={selectedNode.type} onChange={e => changeNodeType(selectedNode.id, e.target.value as ArchNodeType)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500 cursor-pointer">
                  {(Object.keys(NODE_TYPES) as ArchNodeType[]).map(type => <option key={type} value={type}>{NODE_TYPES[type].label}</option>)}
                </select>
              </div>
            )}
            {selectedNode.type !== 'grupo' && (
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">{selectedNode.type === 'nota' ? 'Texto' : 'Descripción (tecnología o rol)'}</label>
                <textarea value={selectedNode.description ?? ''} onChange={e => editarNodo(selectedNode.id, { description: e.target.value })} rows={selectedNode.type === 'nota' ? 5 : 3}
                  placeholder={selectedNode.type === 'nota' ? '' : 'Ej.: Next.js, Server Actions'}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-cyan-500 resize-y" />
              </div>
            )}
            {(selectedNode.type === 'grupo' || selectedNode.type === 'nota') && (
              <div className="grid grid-cols-2 gap-2">
                <div><label className="block text-[11px] text-gray-500 mb-1">Ancho</label>
                  <input type="number" min={80} max={1200} value={dims(selectedNode).w} onChange={e => editarNodo(selectedNode.id, { w: Math.max(80, Number(e.target.value) || 80) })} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500" /></div>
                <div><label className="block text-[11px] text-gray-500 mb-1">Alto</label>
                  <input type="number" min={60} max={1200} value={dims(selectedNode).h} onChange={e => editarNodo(selectedNode.id, { h: Math.max(60, Number(e.target.value) || 60) })} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-500" /></div>
              </div>
            )}
            {esComp(selectedNode) && (
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">Conexiones {relatedConnections.length > 0 && `(${relatedConnections.length})`}</label>
                {relatedConnections.length === 0 ? (
                  <p className="text-[11px] text-gray-500">Arrastra desde el punto del borde derecho del componente para conectarlo.</p>
                ) : (
                  <div className="space-y-1">
                    {relatedConnections.map(({ conn, dir, other }) => (
                      <div key={conn.id} className="flex items-center justify-between gap-2 bg-gray-900 border border-gray-800 rounded-lg px-2 py-1">
                        <span className="text-[11px] text-gray-300 truncate flex items-center gap-1">
                          {dir === 'out' ? <ArrowUpRight size={11} className="text-[#7f8a9c] flex-shrink-0" /> : <ArrowDownLeft size={11} className="text-[#7f8a9c] flex-shrink-0" />}
                          {other?.label || 'Sin nombre'}
                        </span>
                        <button type="button" onClick={() => removeConnection(conn.id)} aria-label="Quitar conexión" className="text-[#7f8a9c] hover:text-red-400 flex-shrink-0"><X size={11} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => duplicar(selectedNode.id)} className={`${btn} flex-1 justify-center`}><Copy size={12} /> Duplicar</button>
              <button type="button" onClick={() => { removeNode(selectedNode.id); setSelectedNodeId(null) }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 text-xs font-medium transition-colors"><Trash2 size={12} /> Eliminar</button>
            </div>
          </aside>
        )}
      </div>
      <p className="text-[11px] text-[#7f8a9c]">
        Arrastra los elementos para ubicarlos; clic para ver y editar sus propiedades; doble clic en un componente para renombrarlo. Arrastra el fondo para mover la vista y usa Ctrl + rueda para el zoom. Conecta con el punto del borde derecho; clic en una flecha la borra.
        Atajos con el lienzo enfocado: Ctrl+Z deshacer, Ctrl+Y rehacer, Ctrl+D duplicar, Supr borra el seleccionado.
      </p>
    </div>
  )
}
