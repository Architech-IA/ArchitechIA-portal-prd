'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface GraphNode {
  id: number;
  path: string;
  title: string;
  folder: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphLink {
  source_path: string;
  target_path: string;
}

const FOLDER_COLORS: Record<string, string> = {
  '_contexto': '#f97316',
  '_sesiones': '#3b82f6',
  '_decisiones': '#10b981',
  '/': '#6b7280',
};

function getFolderColor(folder: string): string {
  if (FOLDER_COLORS[folder]) return FOLDER_COLORS[folder];
  const top = folder.split('/')[0];
  if (FOLDER_COLORS[top]) return FOLDER_COLORS[top];
  let hash = 0;
  for (let i = 0; i < folder.length; i++) hash = folder.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 60%, 55%)`;
}

export default function GraphPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const dragRef = useRef<{ node: GraphNode; offsetX: number; offsetY: number } | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const animRef = useRef<number>(0);

  useEffect(() => {
    fetch('/api/graph')
      .then(r => r.json())
      .then(data => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const ns: GraphNode[] = data.nodes.map((n: Omit<GraphNode, 'x' | 'y' | 'vx' | 'vy'>) => ({
          ...n,
          x: w / 2 + (Math.random() - 0.5) * 400,
          y: h / 2 + (Math.random() - 0.5) * 400,
          vx: 0,
          vy: 0,
        }));
        setNodes(ns);
        setLinks(data.links);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const simulate = useCallback(() => {
    if (nodes.length === 0) return;

    const pathIndex = new Map(nodes.map((n, i) => [n.path, i]));

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = 800 / (dist * dist);
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        a.vx -= dx; a.vy -= dy;
        b.vx += dx; b.vy += dy;
      }
    }

    for (const link of links) {
      const si = pathIndex.get(link.source_path);
      const ti = pathIndex.get(link.target_path);
      if (si === undefined || ti === undefined) continue;
      const a = nodes[si], b = nodes[ti];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - 120) * 0.005;
      dx = (dx / dist) * force;
      dy = (dy / dist) * force;
      a.vx += dx; a.vy += dy;
      b.vx -= dx; b.vy -= dy;
    }

    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    for (const n of nodes) {
      if (dragRef.current?.node === n) continue;
      n.vx += (cx - n.x) * 0.0005;
      n.vy += (cy - n.y) * 0.0005;
      n.vx *= 0.92;
      n.vy *= 0.92;
      n.x += n.vx;
      n.y += n.vy;
    }
  }, [nodes, links]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(panRef.current.x, panRef.current.y);
    ctx.scale(zoomRef.current, zoomRef.current);

    const pathIndex = new Map(nodes.map((n, i) => [n.path, i]));

    for (const link of links) {
      const si = pathIndex.get(link.source_path);
      const ti = pathIndex.get(link.target_path);
      if (si === undefined || ti === undefined) continue;
      const a = nodes[si], b = nodes[ti];
      const dimmed = selectedFolder && (a.folder !== selectedFolder && b.folder !== selectedFolder);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = dimmed ? 'rgba(75,85,99,0.1)' : 'rgba(249,115,22,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (const n of nodes) {
      const dimmed = selectedFolder && n.folder !== selectedFolder;
      const isHovered = hovered === n;
      const color = getFolderColor(n.folder);
      const linkCount = links.filter(l => l.source_path === n.path || l.target_path === n.path).length;
      const radius = Math.max(4, Math.min(12, 4 + linkCount * 2));

      ctx.beginPath();
      ctx.arc(n.x, n.y, radius + (isHovered ? 3 : 0), 0, Math.PI * 2);
      ctx.fillStyle = dimmed ? 'rgba(75,85,99,0.2)' : color;
      ctx.globalAlpha = dimmed ? 0.3 : (isHovered ? 1 : 0.85);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (isHovered) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      if (isHovered || (zoomRef.current > 0.8 && !dimmed)) {
        ctx.fillStyle = dimmed ? 'rgba(156,163,175,0.3)' : '#e5e7eb';
        ctx.font = isHovered ? 'bold 12px system-ui' : '10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(n.title, n.x, n.y - radius - 6);
      }
    }

    ctx.restore();

    simulate();
    animRef.current = requestAnimationFrame(draw);
  }, [nodes, links, hovered, selectedFolder, simulate]);

  useEffect(() => {
    if (nodes.length > 0) {
      animRef.current = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(animRef.current);
    }
  }, [nodes, draw]);

  const screenToWorld = useCallback((sx: number, sy: number) => ({
    x: (sx - panRef.current.x) / zoomRef.current,
    y: (sy - panRef.current.y) / zoomRef.current,
  }), []);

  const findNode = useCallback((sx: number, sy: number) => {
    const { x, y } = screenToWorld(sx, sy);
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = n.x - x, dy = n.y - y;
      if (dx * dx + dy * dy < 200) return n;
    }
    return null;
  }, [nodes, screenToWorld]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (dragRef.current) {
      const { x, y } = screenToWorld(sx, sy);
      dragRef.current.node.x = x - dragRef.current.offsetX;
      dragRef.current.node.y = y - dragRef.current.offsetY;
      dragRef.current.node.vx = 0;
      dragRef.current.node.vy = 0;
      return;
    }

    setHovered(findNode(sx, sy));
  }, [findNode, screenToWorld]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const node = findNode(sx, sy);
    if (node) {
      const { x, y } = screenToWorld(sx, sy);
      dragRef.current = { node, offsetX: x - node.x, offsetY: y - node.y };
    }
  }, [findNode, screenToWorld]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.2, Math.min(3, zoomRef.current * delta));
    panRef.current.x = mx - (mx - panRef.current.x) * (newZoom / zoomRef.current);
    panRef.current.y = my - (my - panRef.current.y) * (newZoom / zoomRef.current);
    zoomRef.current = newZoom;
  }, []);

  const folders = [...new Set(nodes.map(n => n.folder))].sort();

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
    </div>
  );

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Stats overlay */}
      <div className="absolute top-4 left-4 rounded-xl px-4 py-3 text-sm"
        style={{ background: 'rgba(10,10,10,0.85)', border: '1px solid rgba(249,115,22,0.2)' }}>
        <h2 className="text-orange-400 font-semibold mb-1">Grafo de Conocimiento</h2>
        <p className="text-gray-400">{nodes.length} notas &middot; {links.length} conexiones</p>
      </div>

      {/* Folder legend */}
      <div className="absolute top-4 right-4 rounded-xl px-4 py-3 text-xs max-h-80 overflow-y-auto"
        style={{ background: 'rgba(10,10,10,0.85)', border: '1px solid rgba(249,115,22,0.2)' }}>
        <p className="text-gray-400 font-semibold mb-2 uppercase tracking-wide">Carpetas</p>
        <button
          onClick={() => setSelectedFolder(null)}
          className="block w-full text-left mb-1 px-2 py-1 rounded"
          style={{
            color: !selectedFolder ? '#f97316' : '#9ca3af',
            background: !selectedFolder ? 'rgba(249,115,22,0.1)' : 'transparent',
          }}
        >
          Todas
        </button>
        {folders.map(f => (
          <button key={f}
            onClick={() => setSelectedFolder(f === selectedFolder ? null : f)}
            className="flex items-center gap-2 w-full text-left px-2 py-1 rounded"
            style={{
              color: f === selectedFolder ? '#fff' : '#9ca3af',
              background: f === selectedFolder ? 'rgba(249,115,22,0.1)' : 'transparent',
            }}
          >
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: getFolderColor(f) }} />
            {f || '/'}
          </button>
        ))}
      </div>

      {/* Hovered node info */}
      {hovered && (
        <div className="absolute bottom-4 left-4 rounded-xl px-4 py-3 text-sm"
          style={{ background: 'rgba(10,10,10,0.9)', border: '1px solid rgba(249,115,22,0.3)' }}>
          <p className="text-orange-400 font-semibold">{hovered.title}</p>
          <p className="text-gray-500 text-xs mt-0.5">{hovered.folder}/{hovered.path.split('/').pop()}</p>
        </div>
      )}
    </div>
  );
}
