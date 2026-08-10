import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

const ORION_AGENT_ID = 'cmsii11qf0003l0w1jikaxygb'
const BACKLOG_HUB_AREA_ID = 'area_backlog_hub_001'

async function orionLog(data: {
  message: string; actionType: string;
  backlogItemId?: string; backlogItemTitle?: string; backlogItemCode?: string; metadata?: object
}) {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "OrionLog" (message, "actionType", "backlogItemId", "backlogItemTitle", "backlogItemCode", metadata)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      data.message, data.actionType,
      data.backlogItemId ?? null, data.backlogItemTitle ?? null,
      data.backlogItemCode ?? null, data.metadata ? JSON.stringify(data.metadata) : null
    )
  } catch (_) {}
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  const { id } = await params
  const body = await request.json()
  const { title, description, resultado, fechaEjecucion, type, priority, status, points, solucionId, assigneeId, assigneeName, sprintId, areaId: bodyAreaId } = body
  const isOrion = assigneeId === ORION_AGENT_ID || /orion/i.test(assigneeName || '')
  const resolvedAreaId = bodyAreaId !== undefined ? bodyAreaId : (isOrion ? BACKLOG_HUB_AREA_ID : undefined)

  const prevItem = await prisma.backlogItem.findUnique({ where: { id }, select: { sprintId: true, taskCode: true, areaId: true } })

  let taskCodeUpdate: { taskCode: string } | Record<string, never> = {}
  if (sprintId) {
    const existing = prevItem
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
      ...(resolvedAreaId !== undefined ? { areaId: resolvedAreaId || null } : {}),
      ...(sprintId !== undefined ? { sprintId: sprintId || null, ...(sprintId === null ? { taskCode: null } : taskCodeUpdate) } : {}),
    },
    include: {
      solucion: { select: { id: true, nombre: true, tipo: true } },
      sprint: { select: { id: true, sprintCode: true, name: true } },
    },
  })

  // Orion chat log — DISPATCHED: when area changes from BacklogHub to another area
  if (
    bodyAreaId && bodyAreaId !== BACKLOG_HUB_AREA_ID &&
    prevItem?.areaId === BACKLOG_HUB_AREA_ID
  ) {
    const area = await prisma.area.findUnique({ where: { id: bodyAreaId }, select: { name: true } })
    const areaName = area?.name ?? bodyAreaId
    const taskCode = item.sprint?.sprintCode
      ? null  // sprint tasks don't have their own code here
      : (prevItem as any)?.taskCode ?? null
    const codeStr = (item as any).taskCode ? ` (${(item as any).taskCode})` : ''
    await orionLog({
      message: `Se ha asignado la tarea **${title}**${codeStr} al área de **${areaName}**.`,
      actionType: 'DISPATCHED',
      backlogItemId: id, backlogItemTitle: title,
      backlogItemCode: (item as any).taskCode ?? undefined,
      metadata: { toArea: areaName },
    })
  }

  // Orion chat log — STATUS updates while in BacklogHub
  if (item.areaId === BACKLOG_HUB_AREA_ID || resolvedAreaId === BACKLOG_HUB_AREA_ID) {
    const statusLabel: Record<string,string> = {
      IN_PROGRESS:'🔄 En progreso', DONE:'✅ Completada', REVIEW:'🔍 En revisión',
      CANCELLED:'❌ Cancelada', BACKLOG:'📋 En backlog', TODO:'📌 Por hacer',
    }
    if (body.status && body.status !== 'BACKLOG') {
      const label = statusLabel[body.status] ?? body.status
      const msg = body.status === 'DONE'
        ? `La tarea **${title}** ha sido completada exitosamente. Cerrando el ciclo de coordinación.`
        : `He actualizado el estado de **${title}** a **${label}**.`
      await orionLog({
        message: msg, actionType: body.status === 'DONE' ? 'COMPLETED' : 'STATUS_CHANGED',
        backlogItemId: id, backlogItemTitle: title, metadata: { status: body.status },
      })
    }
  }
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
