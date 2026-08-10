import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthed } from '@/lib/apiAuth'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sprint = await prisma.sprint.findUnique({
    where: { id },
    include: {
      ownerArea: { select: { id: true, name: true, slug: true, color: true } },
      sprintAreas: { include: { area: { select: { id: true, name: true, slug: true, color: true } } } },
    },
  })
  if (!sprint) return NextResponse.json({ error: 'Sprint no encontrado' }, { status: 404 })
  return NextResponse.json({
    ownerArea: sprint.ownerArea,
    participantAreas: sprint.sprintAreas.map(sa => sa.area),
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const { ownerAreaId, participantAreaIds = [] } = await req.json()

  const sprint = await prisma.sprint.findUnique({
    where: { id },
    select: { id: true, name: true, sprintCode: true },
  })
  if (!sprint) return NextResponse.json({ error: 'Sprint no encontrado' }, { status: 404 })

  await prisma.sprint.update({
    where: { id },
    data: { ownerAreaId: ownerAreaId || null },
  })

  await prisma.sprintArea.deleteMany({ where: { sprintId: id } })
  if (participantAreaIds.length > 0) {
    await prisma.sprintArea.createMany({
      data: participantAreaIds.map((areaId: string) => ({
        id: `${id}-${areaId}`,
        sprintId: id,
        areaId,
      })),
      skipDuplicates: true,
    })
  }

  const areaIds = [ownerAreaId, ...participantAreaIds].filter(Boolean)
  const areas = await prisma.area.findMany({
    where: { id: { in: areaIds } },
    select: { id: true, name: true },
  })
  const ownerName = areas.find(a => a.id === ownerAreaId)?.name ?? 'Sin asignar'
  const participantNames = (participantAreaIds as string[])
    .map((pid) => areas.find(a => a.id === pid)?.name)
    .filter(Boolean)

  const sprintLabel = sprint.sprintCode ?? sprint.name
  const message = participantNames.length > 0
    ? `He asignado el **${sprintLabel}** — área líder: **${ownerName}**, participantes: **${participantNames.join(', ')}**.`
    : `He asignado el **${sprintLabel}** al área **${ownerName}** como responsable principal.`

  await prisma.$executeRawUnsafe(
    `INSERT INTO "OrionLog" (id, message, "actionType", "backlogItemId", "backlogItemTitle", "backlogItemCode", metadata, "createdAt")
     VALUES (gen_random_uuid()::text, $1, 'SPRINT_ASSIGNED', NULL, $2, $3, $4::jsonb, NOW())`,
    message,
    sprint.name,
    sprint.sprintCode ?? '',
    JSON.stringify({ sprintId: id, ownerAreaId, participantAreaIds })
  )

  const updated = await prisma.sprint.findUnique({
    where: { id },
    include: {
      ownerArea: { select: { id: true, name: true, slug: true, color: true } },
      sprintAreas: { include: { area: { select: { id: true, name: true, slug: true, color: true } } } },
    },
  })

  return NextResponse.json({
    ownerArea: updated?.ownerArea,
    participantAreas: updated?.sprintAreas.map(sa => sa.area) ?? [],
  })
}
