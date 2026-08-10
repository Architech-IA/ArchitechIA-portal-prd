import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { isAuthed } from '@/lib/apiAuth'
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
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })

  const body = await request.json()
  const { title, description, type, priority, status, points, solucionId, assigneeId, assigneeName, sprintId, areaId: bodyAreaId } = body
  const resolvedAreaId = bodyAreaId || (assigneeId === ORION_AGENT_ID || /orion/i.test(assigneeName || '') ? BACKLOG_HUB_AREA_ID : null)

  let taskCode: string | null = null
  if (sprintId) {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, select: { sprintCode: true } })
    const count = await prisma.backlogItem.count({ where: { sprintId } })
    taskCode = sprint?.sprintCode ? sprint.sprintCode + '-' + String(count + 1).padStart(3, '0') : null
  }

  const item = await prisma.backlogItem.create({
    data: {
      title, description: description || null, type: type || null,
      priority: priority || null, status: status || 'BACKLOG',
      points: points ? Number(points) : null, solucionId: solucionId || null,
      assigneeId: assigneeId || null, assigneeName: assigneeName || null,
      sprintId: sprintId || null, taskCode,
      areaId: resolvedAreaId || null,
    },
    include: {
      solucion: { select: { id: true, nombre: true, tipo: true } },
      sprint: { select: { id: true, sprintCode: true, name: true } },
    },
  })
  if (resolvedAreaId === BACKLOG_HUB_AREA_ID) {
    const priorityLabel: Record<string,string> = { CRITICAL:'🔴 Crítica', HIGH:'🟠 Alta', MEDIUM:'🟡 Media', LOW:'⚪ Baja' }
    await orionLog({
      message: `Se ha recibido la adjudicación de la tarea **${title}**${taskCode ? ' (' + taskCode + ')' : ''} a Oficina Virtual.`,
      actionType: 'RECEIVED',
      backlogItemId: item.id, backlogItemTitle: title, backlogItemCode: taskCode ?? undefined,
      metadata: { priority, type, status },
    })
  }
  await logActivity({
    type: 'CREATED', description: 'creó el ítem de backlog  + title + ' + (taskCode ? ' (' + taskCode + ')' : ''),
    entityType: 'backlogItem', entityId: item.id, userId: token?.sub,
  })
  return NextResponse.json(item)
}
