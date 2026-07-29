import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Buscar la solución asociada al lead
  const solucion = await prisma.solucion.findUnique({ where: { leadId: id } })
  if (!solucion) return NextResponse.json([])

  // Traer items de sprints (no los de backlog puro)
  const items = await prisma.backlogItem.findMany({
    where: { solucionId: solucion.id, sprint: { isNot: null } },
    include: { sprint: { select: { name: true, sprintCode: true } } },
    orderBy: [{ sprint: { createdAt: 'asc' } }, { order: 'asc' }],
  })
  return NextResponse.json(items)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { itemId, status } = await req.json()
  const updated = await prisma.backlogItem.update({
    where: { id: itemId },
    data: { status },
    include: { sprint: { select: { name: true, sprintCode: true } } },
  })
  return NextResponse.json(updated)
}
