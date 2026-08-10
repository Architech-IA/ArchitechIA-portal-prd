import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const areas = await prisma.$queryRaw<any[]>`
    SELECT
      a.id, a.name, a.slug, a.icon, a.color, a.description, a."parentAreaId",
      ag.id as "agentId", ag.name as "agentName", ag.slug as "agentSlug", ag.status as "agentStatus",
      COUNT(bi.id) FILTER (WHERE bi.status NOT IN ('DONE','CANCELLED')) as "activeItems",
      COUNT(bi.id) FILTER (WHERE bi.status = 'IN_PROGRESS') as "inProgressItems"
    FROM "Area" a
    LEFT JOIN "Agent" ag ON ag."areaId" = a.id
    LEFT JOIN "BacklogItem" bi ON bi."areaId" = a.id
    GROUP BY a.id, a.name, a.slug, a.icon, a.color, a.description, a."parentAreaId",
             ag.id, ag.name, ag.slug, ag.status
    ORDER BY a."parentAreaId" NULLS FIRST, a."sortOrder" ASC NULLS LAST, a.name
  `

  const main = areas.filter((a: any) => !a.parentAreaId)
  const sub  = areas.filter((a: any) =>  a.parentAreaId)

  const result = main.map((area: any) => ({
    ...area,
    activeItems:     Number(area.activeItems     ?? 0),
    inProgressItems: Number(area.inProgressItems ?? 0),
    subAreas: sub
      .filter((s: any) => s.parentAreaId === area.id)
      .map((s: any) => ({
        ...s,
        activeItems:     Number(s.activeItems     ?? 0),
        inProgressItems: Number(s.inProgressItems ?? 0),
      })),
  }))

  return NextResponse.json(result)
}
