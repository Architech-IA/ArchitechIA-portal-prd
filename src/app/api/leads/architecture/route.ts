import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get('leadId')
  if (!leadId) return NextResponse.json({ error: 'leadId requerido' }, { status: 400 })

  const row = await prisma.leadArchitecture.findUnique({ where: { leadId } })
  return NextResponse.json({ data: row?.data ?? null })
}

export async function PUT(req: NextRequest) {
  const { leadId, data } = await req.json().catch(() => ({}))
  if (!leadId) return NextResponse.json({ error: 'leadId requerido' }, { status: 400 })

  const row = await prisma.leadArchitecture.upsert({
    where: { leadId },
    create: { leadId, data: data ?? {} },
    update: { data: data ?? {}, updatedAt: new Date() },
  })
  return NextResponse.json({ ok: true, id: row.id })
}
