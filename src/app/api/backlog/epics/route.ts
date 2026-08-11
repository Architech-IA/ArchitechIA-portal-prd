import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthed } from '@/lib/apiAuth'
import { triggerEpicProposal } from '@/lib/council-trigger'

export async function GET() {
  const epics = await prisma.epic.findMany({
    include: {
      roadmap: { select: { id: true, name: true, quarter: true } },
      solucion: { select: { id: true, nombre: true } },
      sprints: {
        include: {
          _count: { select: { items: true } },
          items: { select: { status: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      _count: { select: { sprints: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(epics)
}

export async function POST(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { name, description, priority, color, startDate, endDate, roadmapId, solucionId } = await request.json()
  const epic = await prisma.epic.create({
    data: {
      name,
      description: description || null,
      priority: priority || 'MEDIUM',
      color: color || '#1D9375',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      roadmapId: roadmapId || null,
      solucionId: solucionId || null,
    },
    include: {
      roadmap: { select: { id: true, name: true, quarter: true } },
      sprints: true,
    },
  })
  ;(async () => {
    let solucionNombre: string | undefined
    let existingEpics: string[] = []
    if (solucionId) {
      const sol = await prisma.solucion.findUnique({ where: { id: solucionId }, select: { nombre: true } })
      solucionNombre = sol?.nombre ?? undefined
      const others = await prisma.epic.findMany({ where: { solucionId }, select: { name: true } })
      existingEpics = others.map((e: { name: string }) => e.name).filter((n: string) => n !== name)
    }
    await triggerEpicProposal({ id: epic.id, name, description: description || null, solucionId: solucionId || null, solucionNombre, existingEpics })
  })().catch(console.error)
  return NextResponse.json(epic)
}

export async function PUT(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id, ...data } = await request.json()
  if (data.startDate) data.startDate = new Date(data.startDate)
  if (data.endDate) data.endDate = new Date(data.endDate)
  const epic = await prisma.epic.update({ where: { id }, data })
  return NextResponse.json(epic)
}

export async function DELETE(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  await prisma.epic.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
