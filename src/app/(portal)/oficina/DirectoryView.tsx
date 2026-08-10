'use client'
import { useCallback, useMemo } from 'react'
import ReactFlow, {
  Background, Controls, Node, Edge, NodeProps, Handle, Position,
  BackgroundVariant,
} from 'reactflow'
import 'reactflow/dist/style.css'

interface SubArea {
  id: string; name: string; slug: string; color: string
  agentId: string | null; agentName: string | null; agentStatus: string | null
  activeItems: number; inProgressItems: number
}
interface Area extends SubArea { subAreas: SubArea[] }

/* ── Custom node: Area ── */
function AreaNode({ data }: NodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: data.color, border: 'none', width: 6, height: 6 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: data.color, border: 'none', width: 6, height: 6 }} />
      <div className="rounded-xl px-4 py-2.5 text-center min-w-[130px]"
           style={{ background: data.color + '18', border: `1.5px solid ${data.color}40` }}>
        <div className="text-[11px] font-black tracking-wide uppercase" style={{ color: data.color }}>{data.label}</div>
        {data.count > 0 && (
          <div className="text-[9px] mt-0.5 font-mono" style={{ color: data.color + 'aa' }}>{data.count} activas</div>
        )}
      </div>
    </>
  )
}

/* ── Custom node: Sub-area ── */
function SubAreaNode({ data }: NodeProps) {
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: data.color, border: 'none', width: 5, height: 5 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: data.color, border: 'none', width: 5, height: 5 }} />
      <div className="rounded-lg px-3 py-2 text-center min-w-[110px]"
           style={{ background: data.color + '12', border: `1px solid ${data.color}30` }}>
        <div className="text-[10px] font-bold" style={{ color: data.color + 'cc' }}>{data.label}</div>
      </div>
    </>
  )
}

/* ── Custom node: Agent ── */
function AgentNode({ data }: NodeProps) {
  const isActive = data.status === 'ACTIVE'
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: '#6b7280', border: 'none', width: 5, height: 5 }} />
      <div className="rounded-lg px-3 py-2 min-w-[120px]"
           style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-green-400' : 'bg-gray-600'}`} />
          <div className="text-[10px] font-bold text-gray-200 truncate">{data.label}</div>
        </div>
        <div className="text-[9px] text-gray-600 truncate pl-3">{data.role}</div>
      </div>
    </>
  )
}

/* ── Custom node: CEO / Orión ── */
function CeoNode({ data }: NodeProps) {
  return (
    <>
      <Handle type="source" position={Position.Bottom} style={{ background: '#f59e0b', border: 'none', width: 8, height: 8 }} />
      <div className="rounded-2xl px-6 py-3 text-center"
           style={{ background: 'rgba(245,158,11,0.12)', border: '2px solid rgba(245,158,11,0.5)', minWidth: 160 }}>
        <div className="text-[13px] font-black tracking-widest uppercase text-amber-400">{data.label}</div>
        <div className="text-[9px] text-amber-600 mt-0.5 uppercase tracking-wider font-bold">{data.role}</div>
      </div>
    </>
  )
}

const nodeTypes = { areaNode: AreaNode, subNode: SubAreaNode, agentNode: AgentNode, ceoNode: CeoNode }

const NODE_W = 140
const NODE_H = 52
const COL_GAP = 28
const ROW_GAP = 70

function buildGraph(areas: Area[]) {
  const nodes: Node[] = []
  const edges: Edge[] = []
  let x = 0

  // Calculate total width first to center Orión
  const totalCols = areas.reduce((acc, area) => acc + Math.max(1, area.subAreas.length), 0)
  const totalW = totalCols * (NODE_W + COL_GAP) - COL_GAP
  const CEO_Y = -130

  // Orión CEO node (centered above all areas)
  nodes.push({
    id: 'ceo-orion',
    type: 'ceoNode',
    position: { x: totalW / 2 - 80, y: CEO_Y },
    data: { label: 'Orión', role: 'CEO · Orchestrator' },
    draggable: true,
  })

  areas.forEach((area) => {
    const subCount = area.subAreas.length
    const cols = Math.max(1, subCount)
    const blockW = cols * (NODE_W + COL_GAP) - COL_GAP
    const areaX = x + blockW / 2 - NODE_W / 2

    // Area node
    nodes.push({
      id: `area-${area.id}`,
      type: 'areaNode',
      position: { x: areaX, y: 0 },
      data: { label: area.name, color: area.color, count: area.activeItems },
      draggable: true,
    })
    // Edge from CEO Orión to this area
    edges.push({
      id: `e-ceo-${area.id}`,
      source: 'ceo-orion', target: `area-${area.id}`,
      type: 'smoothstep',
      style: { stroke: 'rgba(245,158,11,0.25)', strokeWidth: 1.5 },
    })

    if (subCount === 0) {
      // No sub-areas: agent directly below area
      if (area.agentName) {
        nodes.push({
          id: `agent-${area.id}`,
          type: 'agentNode',
          position: { x: areaX, y: NODE_H + ROW_GAP },
          data: { label: area.agentName, role: area.name, status: area.agentStatus },
          draggable: true,
        })
        edges.push({
          id: `e-${area.id}-agent`,
          source: `area-${area.id}`, target: `agent-${area.id}`,
          type: 'smoothstep', animated: area.agentStatus === 'ACTIVE',
          style: { stroke: area.color + '50', strokeWidth: 1.5 },
        })
      }
    } else {
      // Sub-areas row
      area.subAreas.forEach((sub, si) => {
        const subX = x + si * (NODE_W + COL_GAP)
        const subY = NODE_H + ROW_GAP

        nodes.push({
          id: `sub-${sub.id}`,
          type: 'subNode',
          position: { x: subX, y: subY },
          data: { label: sub.name, color: sub.color },
          draggable: true,
        })
        edges.push({
          id: `e-area-${area.id}-sub-${sub.id}`,
          source: `area-${area.id}`, target: `sub-${sub.id}`,
          type: 'smoothstep',
          style: { stroke: area.color + '35', strokeWidth: 1 },
        })

        if (sub.agentName) {
          nodes.push({
            id: `agent-sub-${sub.id}`,
            type: 'agentNode',
            position: { x: subX, y: subY + NODE_H + ROW_GAP },
            data: { label: sub.agentName, role: sub.name, status: sub.agentStatus },
            draggable: true,
          })
          edges.push({
            id: `e-sub-${sub.id}-agent`,
            source: `sub-${sub.id}`, target: `agent-sub-${sub.id}`,
            type: 'smoothstep', animated: sub.agentStatus === 'ACTIVE',
            style: { stroke: sub.color + '50', strokeWidth: 1.5 },
          })
        }
      })
    }

    x += blockW + COL_GAP + 24
  })

  return { nodes, edges }
}

export default function DirectoryView({ areas }: { areas: Area[] }) {
  const { nodes, edges } = useMemo(() => buildGraph(areas), [areas])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-5 py-2 border-b border-white/5 flex-shrink-0"
           style={{ background: 'rgba(167,139,250,0.05)' }}>
        <div className="text-[11px] font-black tracking-widest uppercase text-purple-400">Directory</div>
      </div>
      <div style={{ flex: 1, background: 'transparent' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          style={{ background: 'transparent' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(255,255,255,0.04)" />
          <Controls
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
            showInteractive={false}
          />
        </ReactFlow>
      </div>
    </div>
  )
}
