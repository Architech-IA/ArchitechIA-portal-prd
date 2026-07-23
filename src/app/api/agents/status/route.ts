import { NextRequest, NextResponse } from 'next/server';
import { isAuthed } from '@/lib/apiAuth';

const AGENTS = [
  { id: 'nexus', port: 8642, key: 'nexus-portal-key-a1b2c3d4e5f6' },
  { id: 'sage',  port: 8643, key: 'sage-portal-key-f6e5d4c3b2a1' },
];

export async function GET(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const results = await Promise.all(
    AGENTS.map(async (agent) => {
      const start = Date.now();
      try {
        const res = await fetch(`http://${process.env.HERMES_HOST ?? "172.16.0.1"}:${agent.port}/health/detailed`, {
          headers: { 'Authorization': `Bearer ${agent.key}` },
          signal: AbortSignal.timeout(3000),
        });
        const latency = Date.now() - start;
        if (!res.ok) return { id: agent.id, status: 'degraded', latency };
        const data = await res.json();
        return { id: agent.id, status: 'online', latency, detail: data };
      } catch {
        return { id: agent.id, status: 'offline', latency: Date.now() - start };
      }
    })
  );

  return NextResponse.json(results);
}
