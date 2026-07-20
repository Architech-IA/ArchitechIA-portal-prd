import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const sprints = await prisma.sprint.findMany({
    include: { _count: { select: { items: true } }, solucion: { select: { id: true, solucionCode: true, nombre: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(sprints)
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { name, goal, startDate, endDate, solucionId } = await request.json()

  // Generate sprintCode: PIAT-0001 if solucionCode exists, else SP-0001
  let sprintPrefix = 'SP'
  if (solucionId) {
    const sol = await prisma.solucion.findUnique({ where: { id: solucionId }, select: { solucionCode: true } })
    if (sol?.solucionCode) sprintPrefix = sol.solucionCode
  }
  const countBySolucion = await prisma.sprint.count({ where: solucionId ? { solucionId } : {} })
  const sprintCode = `${sprintPrefix}-${String(countBySolucion + 1).padStart(4, '0')}`

  const sprint = await prisma.sprint.create({
    data: { sprintCode, name, goal: goal || null, startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, status: 'PLANNED', ...(solucionId ? { solucionId } : {}) },
    include: { _count: { select: { items: true } }, solucion: { select: { id: true, solucionCode: true, nombre: true } } },
  })
  return NextResponse.json(sprint)
}

export async function PUT(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id, status } = await request.json()
  const sprint = await prisma.sprint.update({
    where: { id }, data: { status },
    include: { _count: { select: { items: true } }, solucion: { select: { id: true, solucionCode: true, nombre: true } } },
  })
  return NextResponse.json(sprint)
}
