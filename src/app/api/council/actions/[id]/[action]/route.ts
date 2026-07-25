import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'

const HOST = 'http://host-gateway:8649'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id, action } = await params
  if (!['approve', 'reject'].includes(action)) return NextResponse.json({ error: 'invalid action' }, { status: 400 })
  try {
    const res = await fetch(`${HOST}/actions/${id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    return NextResponse.json(await res.json())
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
