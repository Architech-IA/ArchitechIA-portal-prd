import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { getTriggerConfig, saveTriggerConfig } from '@/lib/council-trigger'

export async function GET(req: NextRequest) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  return NextResponse.json(await getTriggerConfig())
}

export async function PUT(req: NextRequest) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const config = await req.json()
  await saveTriggerConfig(config)
  return NextResponse.json({ ok: true })
}
