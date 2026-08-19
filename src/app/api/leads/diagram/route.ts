import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const PHASE_KEY = 'COMPONENT_DIAGRAM'

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get('leadId')
  if (!leadId) return NextResponse.json({ error: 'leadId requerido' }, { status: 400 })

  const row = await prisma.leadHub.findUnique({ where: { leadId_phase: { leadId, phase: PHASE_KEY } } })
  if (!row?.content) return NextResponse.json({ data: null })
  try {
    return NextResponse.json({ data: JSON.parse(row.content) })
  } catch {
    return NextResponse.json({ data: null })
  }
}

export async function PUT(req: NextRequest) {
  const { leadId, data } = await req.json().catch(() => ({}))
  if (!leadId) return NextResponse.json({ error: 'leadId requerido' }, { status: 400 })

  await prisma.leadHub.upsert({
    where: { leadId_phase: { leadId, phase: PHASE_KEY } },
    create: { leadId, phase: PHASE_KEY, content: JSON.stringify(data ?? {}) },
    update: { content: JSON.stringify(data ?? {}), updatedAt: new Date() },
  })
  return NextResponse.json({ ok: true })
}
