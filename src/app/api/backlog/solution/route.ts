import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const soluciones = await prisma.solucion.findMany({
    include: {
      epics: {
        include: {
          sprints: {
            include: { _count: { select: { items: true } } },
          },
          _count: { select: { sprints: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(soluciones)
}
