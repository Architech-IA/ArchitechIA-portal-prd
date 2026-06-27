'use client'

import { useRef, useState, useCallback } from 'react'
import {
  Monitor, Server, Database, Workflow, Brain, Clock, Zap, Globe2, Trash2, Plus,
} from 'lucide-react'

export interface ArchNode {
  id: string
  label: string
  type: ArchNodeType
  x: number
  y: number
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

export default function ArchitectureCanvas({ nodes, onChange }: { nodes: ArchNode[]; onChange: (nodes: ArchNode[]) => void }) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const dragOffset = useRef({ x: 0, y: 0 })

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
    ])
  }

  const removeNode = (id: string) => onChange(nodes.filter(n => n.id !== id))

  const renameNode = (id: string, label: string) =>
    onChange(nodes.map(n => (n.id === id ? { ...n, label } : n)))

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

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragId) return
    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return
    const maxX = canvasRect.width - NODE_W
    const maxY = canvasRect.height - NODE_H
    const x = Math.min(Math.max(0, e.clientX - canvasRect.left - dragOffset.current.x), Math.max(0, maxX))
    const y = Math.min(Math.max(0, e.clientY - canvasRect.top - dragOffset.current.y), Math.max(0, maxY))
    onChange(nodes.map(n => (n.id === dragId ? { ...n, x, y } : n)))
  }, [dragId, nodes, onChange])

  const onPointerUp = () => setDragId(null)

  return (
    <div className="space-y-3">
      {/* Paleta de componentes */}
      <div className="flex flex-wrap gap-2">
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
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-gray-600">Arrastra los componentes para ubicarlos, doble click para renombrar.</p>
    </div>
  )
}
