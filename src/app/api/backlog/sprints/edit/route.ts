import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id, name, goal, startDate, endDate, epicId, solucionId } = await request.json()

  const current = await prisma.sprint.findUnique({
    where: { id },
    select: { solucionId: true, sprintCode: true },
  })

  // Determine if we need a new sprint code:
  // - solution changed, OR
  // - current code prefix doesn't match the solution's code (stale code from old solution)
  let newSprintCode: string | undefined
  const resolvedSolucionId = solucionId || null

  let sol = null
  if (resolvedSolucionId) {
    sol = await prisma.solucion.findUnique({
      where: { id: resolvedSolucionId },
      select: { solucionCode: true },
    })
  }

  const expectedPrefix = sol?.solucionCode ?? 'SP'
  const currentPrefix = current?.sprintCode?.split('-')[0] ?? ''
  const solutionChanged = resolvedSolucionId !== (current?.solucionId ?? null)
  const prefixMismatch = currentPrefix !== expectedPrefix

  if (solutionChanged || prefixMismatch) {
    const countBySolucion = await prisma.sprint.count({
      where: resolvedSolucionId ? { solucionId: resolvedSolucionId } : {},
    })
    newSprintCode = `${expectedPrefix}-${String(countBySolucion + 1).padStart(4, '0')}`
  }

  const sprint = await prisma.sprint.update({
    where: { id },
    data: {
      name,
      goal: goal || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      epicId: epicId || null,
      solucionId: resolvedSolucionId,
      ...(newSprintCode ? { sprintCode: newSprintCode } : {}),
    },
    include: {
      _count: { select: { items: true } },
      epic: { select: { id: true, name: true, color: true } },
      solucion: { select: { id: true, solucionCode: true, nombre: true } },
    },
  })
  return NextResponse.json(sprint)
}
