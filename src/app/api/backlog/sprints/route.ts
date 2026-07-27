import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { isAuthed } from '@/lib/apiAuth'

async function buildSprintCode(solucionId: string | null, epicId: string | null): Promise<string> {
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

  const sprintCount = await prisma.sprint.count({
    where: {
      solucionId: solucionId ?? undefined,
      epicId: epicId ?? undefined,
    },
  })

  return `${solPrefix}-${epicNum}-${String(sprintCount + 1).padStart(4, '0')}`
}

export async function GET() {
  const sprints = await prisma.sprint.findMany({
    include: {
      _count: { select: { items: true } },
      solucion: { select: { id: true, solucionCode: true, nombre: true } },
      epic: { select: { id: true, name: true, color: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(sprints)
}

export async function POST(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { name, goal, startDate, endDate, solucionId, epicId } = await request.json()

  const sprintCode = await buildSprintCode(solucionId || null, epicId || null)

  const sprint = await prisma.sprint.create({
    data: {
      sprintCode,
      name,
      goal: goal || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status: 'PLANNED',
      ...(solucionId ? { solucionId } : {}),
      ...(epicId ? { epicId } : {}),
    },
    include: {
      _count: { select: { items: true } },
      solucion: { select: { id: true, solucionCode: true, nombre: true } },
      epic: { select: { id: true, name: true, color: true } },
    },
  })
  return NextResponse.json(sprint)
}

export async function PUT(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id, status } = await request.json()
  const sprint = await prisma.sprint.update({
    where: { id },
    data: { status },
    include: {
      _count: { select: { items: true } },
      solucion: { select: { id: true, solucionCode: true, nombre: true } },
      epic: { select: { id: true, name: true, color: true } },
    },
  })
  return NextResponse.json(sprint)
}
