import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthed } from '@/lib/apiAuth'

export async function GET() {
  const items = await prisma.backlogItem.findMany({
    include: {
      solucion: { select: { id: true, nombre: true, tipo: true } },
      sprint: { select: { id: true, sprintCode: true, name: true } },
    },
    orderBy: [{ createdAt: 'asc' }],
  })
  return NextResponse.json(items)
}

export async function POST(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { title, description, type, priority, status, points, solucionId, assigneeId, assigneeName, sprintId } = body

  let taskCode: string | null = null
  if (sprintId) {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, select: { sprintCode: true } })
    const count = await prisma.backlogItem.count({ where: { sprintId } })
    taskCode = sprint?.sprintCode ? `${sprint.sprintCode}-${String(count + 1).padStart(3, '0')}` : null
  }

  const item = await prisma.backlogItem.create({
    data: {
      title,
      description: description || null,
      type: type || null,
      priority: priority || null,
      status: status || 'BACKLOG',
      points: points ? Number(points) : null,
      solucionId: solucionId || null,
      assigneeId: assigneeId || null,
      assigneeName: assigneeName || null,
      sprintId: sprintId || null,
      taskCode,
    },
    include: {
      solucion: { select: { id: true, nombre: true, tipo: true } },
      sprint: { select: { id: true, sprintCode: true, name: true } },
    },
  })
  return NextResponse.json(item)
}
