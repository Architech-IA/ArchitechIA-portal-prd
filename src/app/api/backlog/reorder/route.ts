import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const { sprintId, orderedIds } = await request.json()
  if (!sprintId || !Array.isArray(orderedIds)) {
    return NextResponse.json({ error: 'sprintId and orderedIds required' }, { status: 400 })
  }

  const items = await prisma.backlogItem.findMany({ where: { sprintId, id: { in: orderedIds } } })

  const updated = await Promise.all(
    orderedIds.map(async (id: string, idx: number) => {
      const item = items.find(i => i.id === id)
      if (!item) return null

      // Build new taskCode: keep prefix (SOL-EPIC-SPRINT), replace last segment
      const newNum = String(idx + 1).padStart(3, '0')
      let newTaskCode = item.taskCode
      if (item.taskCode) {
        const parts = item.taskCode.split('-')
        if (parts.length >= 4) {
          parts[parts.length - 1] = newNum
          newTaskCode = parts.join('-')
        }
      }

      return prisma.backlogItem.update({
        where: { id },
        data: { taskCode: newTaskCode },
        include: {
          solucion: { select: { id: true, nombre: true, tipo: true } },
          sprint: { select: { id: true, sprintCode: true, name: true } },
        },
      })
    })
  )

  return NextResponse.json(updated.filter(Boolean))
}
