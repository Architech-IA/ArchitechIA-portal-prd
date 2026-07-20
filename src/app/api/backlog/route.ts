import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'



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
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { title, description, type, priority, status, points, solucionId, assigneeId, assigneeName, sprintId } = body

  if (!solucionId) {
    return NextResponse.json({ error: 'La solución asociada es obligatoria' }, { status: 400 })
  }

  // Auto-generate taskCode if assigning to a sprint
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
      type,
      priority,
      status: status || 'BACKLOG',
      points: points ? Number(points) : null,
      solucionId,
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
