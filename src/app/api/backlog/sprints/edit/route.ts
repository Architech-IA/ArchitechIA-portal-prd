import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

async function buildSprintCode(solucionId: string | null, epicId: string | null, excludeId: string): Promise<string> {
  let solPrefix = 'SP'
  if (solucionId) {
    const sol = await prisma.solucion.findUnique({ where: { id: solucionId }, select: { solucionCode: true } })
    if (sol?.solucionCode) solPrefix = sol.solucionCode
  }

  let epicNum = '0000'
  if (epicId) {
    const epicsInSol = await prisma.epic.findMany({
      where: { solucionId: solucionId ?? undefined },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    const idx = epicsInSol.findIndex(e => e.id === epicId) + 1
    if (idx > 0) epicNum = String(idx).padStart(4, '0')
  }

  // Count existing sprints in same solution+epic bucket (excluding self to avoid incrementing unnecessarily)
  const sprintsBefore = await prisma.sprint.findMany({
    where: {
      solucionId: solucionId ?? undefined,
      epicId: epicId ?? undefined,
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  const selfIdx = sprintsBefore.findIndex(s => s.id === excludeId)
  // If already in the bucket, keep its position; otherwise use next available
  const sprintNum = selfIdx >= 0 ? selfIdx + 1 : sprintsBefore.length + 1

  return `${solPrefix}-${epicNum}-${String(sprintNum).padStart(4, '0')}`
}

export async function PUT(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id, name, goal, startDate, endDate, epicId, solucionId } = await request.json()

  const current = await prisma.sprint.findUnique({
    where: { id },
    select: { solucionId: true, epicId: true, sprintCode: true },
  })

  const resolvedSolucionId = solucionId || null
  const resolvedEpicId = epicId || null

  // Rebuild code if solution or epic changed
  const solutionChanged = resolvedSolucionId !== (current?.solucionId ?? null)
  const epicChanged = resolvedEpicId !== (current?.epicId ?? null)

  let newSprintCode: string | undefined
  if (solutionChanged || epicChanged) {
    newSprintCode = await buildSprintCode(resolvedSolucionId, resolvedEpicId, id)
  } else {
    // Also fix if existing code format doesn't match expected (stale from old format)
    const parts = current?.sprintCode?.split('-') ?? []
    if (parts.length !== 3) {
      newSprintCode = await buildSprintCode(resolvedSolucionId, resolvedEpicId, id)
    }
  }

  const sprint = await prisma.sprint.update({
    where: { id },
    data: {
      name,
      goal: goal || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      epicId: resolvedEpicId,
      solucionId: resolvedSolucionId,
      ...(newSprintCode ? { sprintCode: newSprintCode } : {}),
    },
    include: {
      _count: { select: { items: true } },
      epic: { select: { id: true, name: true, color: true } },
      solucion: { select: { id: true, solucionCode: true, nombre: true } },
    },
  })

  // Update taskCodes of items in this sprint if sprintCode changed
  if (newSprintCode) {
    const items = await prisma.backlogItem.findMany({
      where: { sprintId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })
    for (let i = 0; i < items.length; i++) {
      await prisma.backlogItem.update({
        where: { id: items[i].id },
        data: { taskCode: `${newSprintCode}-${String(i + 1).padStart(3, '0')}` },
      })
    }
  }

  return NextResponse.json(sprint)
}
