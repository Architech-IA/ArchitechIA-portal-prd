import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const { sprintId, orderedIds } = await request.json()
  if (!sprintId || !Array.isArray(orderedIds)) {
    return NextResponse.json({ error: 'sprintId and orderedIds required' }, { status: 400 })
  }

  const items = await prisma.backlogItem.findMany({ where: { sprintId, id: { in: orderedIds } } })

  // Step 1: set all to temp codes to avoid unique constraint collisions
  for (const item of items) {
    await prisma.backlogItem.update({
      where: { id: item.id },
      data: { taskCode: `__tmp_${item.id}` },
    })
  }

  // Step 2: assign final codes sequentially in drag order
  const updated = []
  for (let idx = 0; idx < orderedIds.length; idx++) {
    const id = orderedIds[idx]
    const item = items.find(i => i.id === id)
    if (!item) continue

    const newNum = String(idx + 1).padStart(3, '0')
    let newTaskCode = item.taskCode
    if (item.taskCode) {
      const parts = item.taskCode.split('-')
      if (parts.length >= 4) {
        parts[parts.length - 1] = newNum
        newTaskCode = parts.join('-')
      }
    }

    const result = await prisma.backlogItem.update({
      where: { id },
      data: { taskCode: newTaskCode },
      include: {
        solucion: { select: { id: true, nombre: true, tipo: true } },
        sprint: { select: { id: true, sprintCode: true, name: true } },
      },
    })
    updated.push(result)
  }

  return NextResponse.json(updated)
}
