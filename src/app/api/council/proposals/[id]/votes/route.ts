import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const votes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "AgentVote" WHERE "proposalId" = $1 ORDER BY round, "createdAt"`, id
  )
  const total = votes.reduce((s, v) => s + (v.vote ? Number(v.weight) : 0), 0)
  const threshold = 5
  return NextResponse.json({ votes, weightedScore: total, threshold, approved: total >= threshold })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const { agentId, agentName, agentSlug, weight = 1, vote, argument, round = 1 } = await req.json()
  if (!agentId || !agentName || vote === undefined) return NextResponse.json({ error: 'agentId, agentName y vote requeridos' }, { status: 400 })

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO "AgentVote" ("proposalId", "agentId", "agentName", "agentSlug", weight, vote, argument, round)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT ("proposalId", "agentId", round) DO UPDATE
       SET vote=$6, argument=$7, weight=$5, "createdAt"=NOW()
     RETURNING *`,
    id, agentId, agentName, agentSlug ?? null, weight, vote, argument ?? null, round
  )

  // Check if all 5 agents voted and evaluate result
  const allVotes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "AgentVote" WHERE "proposalId" = $1 AND round = $2`, id, round
  )
  const agents = await prisma.$queryRawUnsafe<any[]>(`SELECT id FROM "Agent" WHERE status = 'ACTIVE'`)
  const weightedScore = allVotes.reduce((s, v) => s + (v.vote ? Number(v.weight) : 0), 0)

  let newStatus: string | null = null
  if (allVotes.length >= 5) {
    newStatus = weightedScore >= 5 ? 'APPROVED' : (round >= 2 ? 'ESCALATED' : 'REJECTED')
    await prisma.$executeRawUnsafe(
      `UPDATE "Proposal" SET status = $1, "updatedAt" = NOW() WHERE id = $2`, newStatus, id
    )
  }

  return NextResponse.json({ vote: rows[0], weightedScore, threshold: 5, newStatus }, { status: 201 })
}
