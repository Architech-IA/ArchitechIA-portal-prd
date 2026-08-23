import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { dispatchTask } from '@/lib/executor/taskDispatcher'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // 1. Close current sprint
    const [sprint] = await prisma.$queryRawUnsafe(
      `UPDATE "Sprint" SET status='CLOSED' WHERE id=$1 AND status='REVIEW_PENDING' RETURNING id, "epicId", "solucionId", "sprintCode"`,
      id
    ) as { id: string; epicId: string; solucionId: string; sprintCode: string }[]

    if (!sprint) {
      return NextResponse.json({ error: 'Sprint not found or not in REVIEW_PENDING' }, { status: 400 })
    }

    // 2. Find next PLANNED sprint in same epic
    const [nextSprint] = await prisma.$queryRawUnsafe(`
      SELECT id, name, "sprintCode" FROM "Sprint"
      WHERE "epicId" = $1 AND status = 'PLANNED'
      ORDER BY "createdAt" ASC LIMIT 1
    `, sprint.epicId) as { id: string; name: string; sprintCode: string }[] | []

    let nextSprintInfo = null
    let dispatched = null

    if (nextSprint) {
      // 3. Activate next sprint
      await prisma.$executeRawUnsafe(
        `UPDATE "Sprint" SET status='ACTIVE' WHERE id=$1`,
        nextSprint.id
      )

      // 4. Dispatch first BACKLOG task
      const [firstTask] = await prisma.$queryRawUnsafe(
        `SELECT id FROM "BacklogItem" WHERE "sprintId"=$1 AND status='BACKLOG' ORDER BY "createdAt" LIMIT 1`,
        nextSprint.id
      ) as { id: string }[]

      if (firstTask) {
        dispatched = await dispatchTask(firstTask.id)
      }

      nextSprintInfo = { id: nextSprint.id, name: nextSprint.name, sprintCode: nextSprint.sprintCode }
    }

    return NextResponse.json({
      closed: sprint.sprintCode,
      nextSprint: nextSprintInfo,
      dispatched,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error approving sprint' }, { status: 500 })
  }
}
