import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  const { id } = await params
  const body = await request.json()
  const { title, description, resultado, fechaEjecucion, type, priority, status, points, solucionId, assigneeId, assigneeName, sprintId } = body

  let taskCodeUpdate: { taskCode: string } | Record<string, never> = {}
  if (sprintId) {
    const existing = await prisma.backlogItem.findUnique({ where: { id }, select: { sprintId: true, taskCode: true } })
    if (!existing?.taskCode || existing.sprintId !== sprintId) {
      const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, select: { sprintCode: true } })
      const count = await prisma.backlogItem.count({ where: { sprintId } })
      const code = sprint?.sprintCode ? sprint.sprintCode + '-' + String(count + 1).padStart(3, '0') : null
      if (code) taskCodeUpdate = { taskCode: code }
    }
  }

  const item = await prisma.backlogItem.update({
    where: { id },
    data: {
      title, description: description || null, resultado: resultado ?? undefined,
      fechaEjecucion: fechaEjecucion ? new Date(fechaEjecucion) : null,
      type, priority, status, points: points ? Number(points) : null,
      ...(solucionId !== undefined ? { solucionId: solucionId || null } : {}),
      assigneeId: assigneeId || null, assigneeName: assigneeName || null,
      ...(sprintId !== undefined ? { sprintId: sprintId || null, ...(sprintId === null ? { taskCode: null } : taskCodeUpdate) } : {}),
    },
    include: {
      solucion: { select: { id: true, nombre: true, tipo: true } },
      sprint: { select: { id: true, sprintCode: true, name: true } },
    },
  })

  if (body.status !== undefined) {
    await logActivity({
      type: 'STATUS_CHANGED', description: 'cambió el estado de  + title +  a ' + status,
      entityType: 'backlogItem', entityId: id, userId: token?.sub,
    })
  } else {
    await logActivity({
      type: 'UPDATED', description: 'actualizó el ítem de backlog  + title + ',
      entityType: 'backlogItem', entityId: id, userId: token?.sub,
    })
  }
  return NextResponse.json(item)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  const { id } = await params
  const item = await prisma.backlogItem.findUnique({ where: { id }, select: { title: true } })
  await prisma.backlogItem.delete({ where: { id } })
  await logActivity({
    type: 'UPDATED', description: 'eliminó el ítem de backlog  + item?.title + ',
    entityType: 'backlogItem', entityId: id, userId: token?.sub,
  })
  return NextResponse.json({ ok: true })
}
