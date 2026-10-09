'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface NicheNode {
  id: string;
  name: string;
  color: string;
  size: number;
  x: number;
  y: number;
  industry: string;
  potential: number;
  competitors: number;
  trend: string;
  description: string | null;
  user: { id: string; name: string };
}

interface ConnEdge {
  id: string;
  fromId: string;
  toId: string;
  label: string | null;
  strength: number;
}

interface DragState {
  nodeId: string | null;
  offsetX: number;
  offsetY: number;
}

const COLORS = ['#f97316','#3b82f6','#22c55e','#a855f7','#ec4899','#06b6d4','#eab308','#ef4444'];
const TREND_ICONS: Record<string, string> = { up: '↑', down: '↓', stable: '→' };

export default function NicheGraph({
  nodes, edges, onMoveNode, onSelectNode, selectedId, onConnect,
}: {
  nodes: NicheNode[];
  edges: ConnEdge[];
  onMoveNode: (id: string, x: number, y: number) => void;
  onSelectNode: (node: NicheNode | null) => void;
  selectedId: string | null;
  onConnect: (sourceId: string, targetId: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<DragState>({ nodeId: null, offsetX: 0, offsetY: 0 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [particles, setParticles] = useState<{ edgeId: string; progress: number }[]>([]);

  const containerRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setParticles(prev => prev.map(p => ({
        ...p,
        progress: (p.progress + 0.008) % 1,
      })));
    }, 30);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setParticles(edges.map(e => ({ edgeId: e.id, progress: Math.random() })));
  }, [edges]);

  const handleMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (e.shiftKey) {
      if (connectingFrom) {
        if (connectingFrom !== nodeId) onConnect(connectingFrom, nodeId);
        setConnectingFrom(null);
      } else {
        setConnectingFrom(nodeId);
      }
      return;
    }
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDrag({ nodeId, offsetX: e.clientX - rect.left - node.x, offsetY: e.clientY - rect.top - node.y });
  }, [nodes, connectingFrom, onConnect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (drag.nodeId) {
      e.preventDefault();
      const newX = e.clientX - rect.left - drag.offsetX;
      const newY = e.clientY - rect.top - drag.offsetY;
      onMoveNode(drag.nodeId, Math.round(newX), Math.round(newY));
    }
  }, [drag, onMoveNode]);

  const handleMouseUp = useCallback(() => {
    setDrag({ nodeId: null, offsetX: 0, offsetY: 0 });
  }, []);

  const getNodePosition = (id: string) => {
    const n = nodes.find(x => x.id === id);
    return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
  };

  const padW = 600;
  const padH = 450;

  return (
    <div className="relative">
      {connectingFrom && (
        <div className="mb-2 px-3 py-1.5 bg-orange-600/20 border border-orange-500/30 rounded-lg text-xs text-orange-400 inline-flex items-center gap-2">
          <span>Selecciona el nodo destino (Shift+Click)</span>
          <button onClick={() => setConnectingFrom(null)} className="text-orange-300 hover:text-white">× Cancelar</button>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${padW} ${padH}`}
        className="w-full bg-gray-950 border border-gray-800 rounded-xl cursor-grab active:cursor-grabbing"
        style={{ minHeight: padH }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id="bgGrad">
            <stop offset="0%" stopColor="#1a1a2e" />
            <stop offset="100%" stopColor="#0a0a0f" />
          </radialGradient>
        </defs>

        <rect width={padW} height={padH} fill="url(#bgGrad)" rx="12" />

        {/* Grid */}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={`gv${i}`} x1={i * 50} y1={0} x2={i * 50} y2={padH} stroke="#ffffff04" strokeWidth={0.5} />
        ))}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`gh${i}`} x1={0} y1={i * 50} x2={padW} y2={i * 50} stroke="#ffffff04" strokeWidth={0.5} />
        ))}

        {/* Edges */}
        {edges.map(edge => {
          const src = getNodePosition(edge.fromId);
          const tgt = getNodePosition(edge.toId);
          if (!src.x && !src.y) return null;
          const particle = particles.find(p => p.edgeId === edge.id);
          const px = src.x + (tgt.x - src.x) * (particle?.progress || 0);
          const py = src.y + (tgt.y - src.y) * (particle?.progress || 0);
          return (
            <g key={edge.id}>
              <line
                x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                stroke={nodes.find(n => n.id === edge.fromId)?.color || '#555'}
                strokeWidth={Math.max(1, edge.strength * 2)}
                strokeOpacity={0.4}
              />
              {particle && (
                <circle cx={px} cy={py} r={3}
                  fill={nodes.find(n => n.id === edge.fromId)?.color || '#f97316'}
                  filter="url(#glow)" opacity={0.9}
                />
              )}
              {edge.label && (
                <text
                  x={(src.x + tgt.x) / 2} y={(src.y + tgt.y) / 2 - 6}
                  textAnchor="middle" fill="#6b7280" fontSize="9" fontFamily="monospace"
                >{edge.label}</text>
              )}
            </g>
          );
        })}

        {/* Connecting line (while dragging to connect) */}
        {connectingFrom && (() => {
          const src = getNodePosition(connectingFrom);
          return (
            <line
              x1={src.x} y1={src.y} x2={mousePos.x} y2={mousePos.y}
              stroke="#f97316" strokeWidth={2} strokeDasharray="6 3" opacity={0.7}
            />
          );
        })()}

        {/* Nodes */}
        {nodes.map(node => (
          <g
            key={node.id}
            onMouseDown={e => handleMouseDown(e, node.id)}
            onClick={() => onSelectNode(node)}
            style={{ cursor: connectingFrom ? 'crosshair' : 'pointer' }}
          >
            {/* Outer glow ring */}
            <circle
              cx={node.x} cy={node.y} r={node.size + 8}
              fill="none" stroke={node.color} strokeWidth={selectedId === node.id ? 3 : 1}
              strokeOpacity={selectedId === node.id ? 0.6 : 0.2}
              filter="url(#glow)"
            />
            {/* Orbit ring */}
            <circle
              cx={node.x} cy={node.y} r={node.size + 14}
              fill="none" stroke={node.color} strokeWidth={0.5} strokeOpacity={0.15}
              strokeDasharray="8 4"
            />
            {/* Main node circle */}
            <circle
              cx={node.x} cy={node.y} r={node.size}
              fill={node.color} fillOpacity={0.25}
              stroke={node.color} strokeWidth={1.5}
              filter={selectedId === node.id ? 'url(#glow)' : undefined}
            />
            {/* Inner circle */}
            <circle
              cx={node.x} cy={node.y} r={node.size * 0.5}
              fill={node.color} fillOpacity={0.5}
            />
            {/* Trend indicator */}
            <text
              x={node.x + node.size + 6} y={node.y - node.size * 0.2}
              fill={node.trend === 'up' ? '#22c55e' : node.trend === 'down' ? '#ef4444' : '#9ca3af'}
              fontSize="10" fontWeight="bold"
            >{TREND_ICONS[node.trend] || ''}</text>
            {/* Label */}
            <text
              x={node.x} y={node.y + node.size + 14}
              textAnchor="middle" fill="#e5e7eb" fontSize="8"
              fontWeight="bold" fontFamily="monospace"
              pointerEvents="none"
            >{node.name}</text>
            {/* Potential bar below */}
            <rect
              x={node.x - node.size} y={node.y + node.size + 17}
              width={node.size * 2} height={3} rx={1.5}
              fill="#374151"
            />
            <rect
              x={node.x - node.size} y={node.y + node.size + 17}
              width={Math.min(node.size * 2, node.potential * (node.size * 2) / 100)} height={3} rx={1.5}
              fill={node.color} fillOpacity={0.7}
            />
          </g>
        ))}

        {nodes.length === 0 && (
          <text x={padW / 2} y={padH / 2} textAnchor="middle" fill="#4b5563" fontSize="16">
            Sin nichos. Agrega el primero.
          </text>
        )}
      </svg>

      <p className="text-xs text-[#7f8a9c] mt-2 text-center">
        Shift+Click nodo para conectar · Arrastra nodos · Click para ver detalles
      </p>
    </div>
  );
}
