import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id, name, goal, startDate, endDate, epicId, solucionId } = await request.json()
  const sprint = await prisma.sprint.update({
    where: { id },
    data: {
      name,
      goal: goal || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      epicId: epicId || null,
      solucionId: solucionId || null,
    },
    include: {
      _count: { select: { items: true } },
      epic: { select: { id: true, name: true, color: true } },
      solucion: { select: { id: true, solucionCode: true, nombre: true } },
    },
  })
  return NextResponse.json(sprint)
}
