import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'

const HOST = 'http://host-gateway:8649'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'pending'
  try {
    const res = await fetch(`${HOST}/actions?status=${status}`, { cache: 'no-store' })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ actions: [] })
  }
}

export async function POST(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { trigger_id } = await request.json()
  try {
    const res = await fetch(`${HOST}/trigger`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger_id }),
    })
    return NextResponse.json(await res.json())
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
