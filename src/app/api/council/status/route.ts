import { NextResponse } from 'next/server'

const AGENTS = [
  { id: 'orion', name: 'Orion', area: 'Admin',      port: 8644, key: 'orion-council-key-a1b2c3d4e5f6', color: '#7F77DD' },
  { id: 'ares',  name: 'Ares',  area: 'Sales',      port: 8645, key: 'ares-council-key-b2c3d4e5f6a1',  color: '#E2562A' },
  { id: 'atlas', name: 'Atlas', area: 'Operations', port: 8646, key: 'atlas-council-key-c3d4e5f6a1b2', color: '#1D9375' },
  { id: 'vesta', name: 'Vesta', area: 'Finance',    port: 8647, key: 'vesta-council-key-d4e5f6a1b2c3', color: '#BA6057' },
  { id: 'iris',  name: 'Iris',  area: 'Marketing',  port: 8648, key: 'iris-council-key-e5f6a1b2c3d4',  color: '#378C3D' },
]

export async function GET() {
  const results = await Promise.all(
    AGENTS.map(async (agent) => {
      const t0 = Date.now()
      try {
        const res = await fetch(`http://host-gateway:${agent.port}/health`, {
          signal: AbortSignal.timeout(3000),
        })
        const latency = Date.now() - t0
        return { ...agent, status: res.ok ? 'online' : 'degraded', latency }
      } catch {
        return { ...agent, status: 'offline', latency: null }
      }
    })
  )
  return NextResponse.json({ agents: results })
}
