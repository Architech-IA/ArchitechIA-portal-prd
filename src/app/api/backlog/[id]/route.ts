import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { title, description, resultado, fechaEjecucion, type, priority, status, points, solucionId, assigneeId, assigneeName, sprintId } = body

  // Auto-generate taskCode when assigning to a sprint for the first time
  let taskCodeUpdate: { taskCode: string } | Record<string, never> = {}
  if (sprintId) {
    const existing = await prisma.backlogItem.findUnique({ where: { id }, select: { sprintId: true, taskCode: true } })
    if (!existing?.taskCode || existing.sprintId !== sprintId) {
      const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, select: { sprintCode: true } })
      const count = await prisma.backlogItem.count({ where: { sprintId } })
      const code = sprint?.sprintCode ? `${sprint.sprintCode}-${String(count + 1).padStart(3, '0')}` : null
      if (code) taskCodeUpdate = { taskCode: code }
    }
  }

  const item = await prisma.backlogItem.update({
    where: { id },
    data: {
      title, description: description || null, resultado: resultado ?? undefined, fechaEjecucion: fechaEjecucion ? new Date(fechaEjecucion) : null, type, priority, status,
      points: points ? Number(points) : null,
      ...(solucionId !== undefined ? { solucionId: solucionId || null } : {}),
      assigneeId: assigneeId || null, assigneeName: assigneeName || null,
      ...(sprintId !== undefined ? { sprintId: sprintId || null, ...(sprintId === null ? { taskCode: null } : taskCodeUpdate) } : {}),
    },
    include: {
      solucion: { select: { id: true, nombre: true, tipo: true } },
      sprint: { select: { id: true, sprintCode: true, name: true } },
    },
  })
  return NextResponse.json(item)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  await prisma.backlogItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
