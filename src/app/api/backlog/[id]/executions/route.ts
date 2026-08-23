import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const executions = await prisma.$queryRawUnsafe(
      `SELECT id, "agentId", "agentName", "startedAt", "finishedAt",
              status, "resultSummary", "durationMs", "contextUsed",
              artifacts, "createdAt"
       FROM "TaskExecution"
       WHERE "backlogItemId" = $1
       ORDER BY "startedAt" DESC`,
      id
    )
    return NextResponse.json({ executions })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error fetching executions' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const {
    agentId,
    agentName,
    status = 'RUNNING',
    resultSummary,
    artifacts,
    durationMs,
    contextUsed,
  } = body

  try {
    const execId = await prisma.$queryRawUnsafe(
      `INSERT INTO "TaskExecution"
       (id, "backlogItemId", "agentId", "agentName", "startedAt", "finishedAt",
        status, "resultSummary", artifacts, "durationMs", "contextUsed")
       VALUES (
         gen_random_uuid()::text, $1, $2, $3, NOW(),
         CASE WHEN $4 IN ('DONE','FAILED') THEN NOW() ELSE NULL END,
         $4, $5, $6::jsonb, $7, $8
       )
       RETURNING id`,
      id, agentId, agentName, status,
      resultSummary ?? null,
      artifacts ? JSON.stringify(artifacts) : '[]',
      durationMs ?? null,
      contextUsed ?? null
    )

    // Sync BacklogItem timestamps & resultado based on final status
    if (status === 'RUNNING') {
      await prisma.$executeRawUnsafe(
        `UPDATE "BacklogItem" SET status='IN_PROGRESS', "fechaInicio"=NOW() WHERE id=$1 AND status='BACKLOG'`,
        id
      )
    } else if (status === 'DONE') {
      await prisma.$executeRawUnsafe(
        `UPDATE "BacklogItem"
         SET status='DONE', "fechaFin"=NOW(),
             resultado=COALESCE($2, resultado)
         WHERE id=$1`,
        id, resultSummary ?? null
      )
    } else if (status === 'FAILED') {
      await prisma.$executeRawUnsafe(
        `UPDATE "BacklogItem"
         SET status='FAILED', "fechaFin"=NOW(),
             resultado=COALESCE($2, resultado)
         WHERE id=$1`,
        id, resultSummary ?? null
      )
    }

    const [exec] = execId as { id: string }[]
    return NextResponse.json({ id: exec.id, status: 'created' }, { status: 201 })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error creating execution' }, { status: 500 })
  }
}
