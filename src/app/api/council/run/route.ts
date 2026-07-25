import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'

const HOST_API = 'http://host-gateway:8649'

export async function POST(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { task, pattern, agents } = await request.json()
  if (!task) return NextResponse.json({ error: 'task requerida' }, { status: 400 })

  const res = await fetch(`${HOST_API}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, pattern: pattern || 'solo', agents: agents || [] }),
  })
  const data = await res.json()
  return NextResponse.json(data)
}
