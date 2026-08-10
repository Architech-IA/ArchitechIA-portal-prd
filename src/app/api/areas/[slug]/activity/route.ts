import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const area = await prisma.$queryRaw<any[]>`
    SELECT id, name FROM "Area" WHERE slug = ${slug} LIMIT 1
  `
  if (!area.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const areaId = area[0].id

  const subAreas = await prisma.$queryRaw<any[]>`
    SELECT id FROM "Area" WHERE "parentAreaId" = ${areaId}
  `
  const allAreaIds = [areaId, ...subAreas.map((s: any) => s.id)]

  // Use $queryRawUnsafe to pass array as IN list
  const placeholders = allAreaIds.map((_: any, i: number) => `$${i + 1}`).join(', ')
  const items = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
      bi.id, bi.title, bi.status, bi."updatedAt", bi."createdAt",
      bi."points", bi.type, bi.priority, bi."assigneeName",
      s."sprintCode", s.name as "sprintName"
    FROM "BacklogItem" bi
    LEFT JOIN "Sprint" s ON s.id = bi."sprintId"
    WHERE bi."areaId" IN (${placeholders})
    ORDER BY bi."updatedAt" DESC
    LIMIT 40`,
    ...allAreaIds
  )

  const events = items.map((item: any) => {
    let eventType = 'updated'
    let label = 'Actualizado'
    if (item.status === 'DONE') { eventType = 'completed'; label = 'Completado' }
    else if (item.status === 'IN_PROGRESS') { eventType = 'started'; label = 'En progreso' }
    else if (item.status === 'BACKLOG') {
      const diff = Math.abs(new Date(item.createdAt).getTime() - new Date(item.updatedAt).getTime())
      if (diff < 2000) { eventType = 'created'; label = 'Creado' }
    }
    return {
      id: item.id, type: eventType, label, title: item.title, status: item.status,
      priority: item.priority, itemType: item.type,
      sprint: item.sprintCode ?? null, sprintName: item.sprintName ?? null,
      assigneeName: item.assigneeName ?? null,
      timestamp: item.updatedAt,
    }
  })

  return NextResponse.json({ areaId, events })
}
