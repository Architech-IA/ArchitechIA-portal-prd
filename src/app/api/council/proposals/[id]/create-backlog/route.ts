import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const AREA_MAP: Record<string, string> = {
  dev: '947ca771-fe9e-4c3f-bfea-2ef2e27986c6',
  data: '698bcc5e-08ba-49bb-a872-ffac31f0e5c9',
  infra: '74b21d1d-0954-4757-a1fd-0fabed1e9e3a',
  qa: '3695ed86-da91-4327-bdde-b14cfa8a10b5',
  sales: '8df9b7a1-9650-4ec2-8240-f0bb350eb97f',
  operations: '53999e08-ce6a-4615-82ea-eca49fe33103',
  finance: 'edd4e3af-76a8-441c-a498-e919da3e7574',
  marketing: '74b21d1d-0954-4757-a1fd-0fabed1e9e3a',
  people: '9ab2cc55-3888-4cd9-9418-4eca6286a0b6',
  delivery: '7b997ca4-1eb1-4684-898b-9e9c860e079e',
  security: '195bed20-8d96-41fa-8672-8f2e9892f264',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const { epic, sprints, solucionId } = await req.json()

  // 1. Create Epic
  const [createdEpic] = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO "Epic" (name, description, status, priority, color, "startDate", "endDate", "solucionId", "createdAt", "updatedAt")
     VALUES ($1, $2, 'ACTIVE', 'HIGH', '#6366f1', $3, $4, $5, NOW(), NOW())
     RETURNING id`,
    epic.name, epic.description ?? null,
    epic.startDate ? new Date(epic.startDate) : null,
    epic.endDate ? new Date(epic.endDate) : null,
    solucionId ?? null
  )
  const epicId = createdEpic.id

  // 2. Create Sprints + Tasks
  const createdSprints = []
  for (const sprint of sprints) {
    const areaId = AREA_MAP[sprint.areaSlug] ?? null
    const [createdSprint] = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "Sprint" (name, goal, status, "startDate", "endDate", "epicId", "ownerAreaId", "responsibleName", "createdAt")
       VALUES ($1, $2, 'PLANNED', $3, $4, $5, $6, $7, NOW())
       RETURNING id`,
      sprint.name, sprint.goal ?? null,
      sprint.startDate ? new Date(sprint.startDate) : null,
      sprint.endDate ? new Date(sprint.endDate) : null,
      epicId, areaId,
      'Orión'
    )
    const sprintId = createdSprint.id

    for (const task of (sprint.tasks ?? [])) {
      const taskAreaId = AREA_MAP[task.areaSlug] ?? areaId
      await prisma.$executeRawUnsafe(
        `INSERT INTO "BacklogItem" (title, description, type, priority, status, "sprintId", "areaId", "assigneeName", "solucionId", "createdAt", "updatedAt")
         VALUES ($1, $2, 'TASK', $3, 'BACKLOG', $4, $5, $6, $7, NOW(), NOW())`,
        task.title, task.description ?? null,
        task.priority ?? 'MEDIUM',
        sprintId, taskAreaId,
        task.assigneeName ?? null,
        solucionId ?? null
      )
    }
    createdSprints.push({ id: sprintId, name: sprint.name, taskCount: sprint.tasks?.length ?? 0 })
  }

  // 3. Mark proposal as APPROVED
  await prisma.$executeRawUnsafe(
    `UPDATE "CouncilProposal" SET status = 'APPROVED', "updatedAt" = NOW() WHERE id = $1`, id
  )

  return NextResponse.json({ epicId, sprints: createdSprints, approved: true })
}
