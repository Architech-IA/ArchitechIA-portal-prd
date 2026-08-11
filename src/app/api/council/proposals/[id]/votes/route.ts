import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

const COUNCIL_AGENTS = ['orion', 'ares', 'atlas', 'iris', 'vesta']
const THRESHOLD = 5

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const votes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "AgentVote" WHERE "proposalId" = $1 ORDER BY round, "createdAt"`, id
  )
  const total = votes.reduce((s: number, v: any) => s + (v.vote ? Number(v.weight) : 0), 0)
  return NextResponse.json({ votes, weightedScore: total, threshold: THRESHOLD, approved: total >= THRESHOLD })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const { agentId, agentName, agentSlug, vote, argument, round = 1 } = await req.json()
  if (!agentId || !agentName || vote === undefined)
    return NextResponse.json({ error: 'agentId, agentName y vote requeridos' }, { status: 400 })

  // 1. Auto-calculate weight: Orión=3, área propietaria=2, resto=1
  let weight = 1
  const slug = (agentSlug ?? '').toLowerCase()
  if (slug === 'orion') {
    weight = 3
  } else {
    const [proposal] = await prisma.$queryRawUnsafe<any[]>(
      `SELECT items FROM "CouncilProposal" WHERE id = $1`, id
    )
    const items: any[] = proposal?.items ?? []
    const areaIds: string[] = items.map((i: any) => i.areaId).filter(Boolean)
    if (areaIds.length > 0) {
      const areaAgents = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "agentSlug" FROM "Area" WHERE id = ANY($1::text[]) AND "agentSlug" IS NOT NULL`,
        areaIds
      )
      if (areaAgents.some((a: any) => a.agentSlug === agentSlug)) weight = 2
    }
  }

  // 2. Upsert vote
  const [voteRow] = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO "AgentVote" ("proposalId", "agentId", "agentName", "agentSlug", weight, vote, argument, round)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT ("proposalId", "agentId", round) DO UPDATE
       SET vote=$6, argument=$7, weight=$5, "createdAt"=NOW()
     RETURNING *`,
    id, agentId, agentName, agentSlug ?? null, weight, vote, argument ?? null, round
  )

  // 3. Check if all 5 council agents voted this round
  const allVotes = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "AgentVote" WHERE "proposalId" = $1 AND round = $2`, id, round
  )
  const votedSlugs = allVotes.map((v: any) => (v.agentSlug ?? '').toLowerCase()).filter(Boolean)
  const allVoted = COUNCIL_AGENTS.every(s => votedSlugs.includes(s))
  const weightedScore = allVotes.reduce((s: number, v: any) => s + (v.vote ? Number(v.weight) : 0), 0)

  let newStatus: string | null = null

  if (allVoted) {
    if (weightedScore >= THRESHOLD) {
      newStatus = 'APPROVED'
      await prisma.$executeRawUnsafe(
        `UPDATE "CouncilProposal" SET status = 'APPROVED', "updatedAt" = NOW() WHERE id = $1`, id
      )
      await createBacklogItems(id, agentId, agentName)
    } else if (round >= 2) {
      newStatus = 'ESCALATED'
      await prisma.$executeRawUnsafe(
        `UPDATE "CouncilProposal" SET status = 'ESCALATED', "updatedAt" = NOW() WHERE id = $1`, id
      )
    } else {
      newStatus = 'REVISED'
      await prisma.$executeRawUnsafe(
        `UPDATE "CouncilProposal" SET status = 'REVISED', "updatedAt" = NOW() WHERE id = $1`, id
      )
      await createRound2Proposal(id)
    }
  }

  return NextResponse.json({ vote: voteRow, weightedScore, threshold: THRESHOLD, newStatus, allVoted }, { status: 201 })
}

async function createBacklogItems(proposalId: string, agentId: string, agentName: string) {
  const [proposal] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "CouncilProposal" WHERE id = $1`, proposalId
  )
  const items: any[] = proposal?.items ?? []
  for (const item of items) {
    if (item.type === 'task') {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "BacklogItem" (title, description, status, priority, "itemType", "areaId", "epicId", "sprintId", "createdByAgentId", "createdByAgentName")
         VALUES ($1,$2,'BACKLOG',$3,'TASK',$4,$5,$6,$7,$8)`,
        item.title ?? 'Task sin título',
        item.description ?? null,
        item.priority ?? 'MEDIUM',
        item.areaId ?? null,
        proposal.epicId ?? item.epicId ?? null,
        proposal.sprintId ?? item.sprintId ?? null,
        agentId,
        agentName
      )
    } else if (item.type === 'sprint') {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Sprint" (name, goal, status, "epicId", "ownerAreaId", "responsibleId", "responsibleName")
         VALUES ($1,$2,'PLANNED',$3,$4,$5,$6)`,
        item.title ?? 'Sprint sin título',
        item.goal ?? null,
        proposal.epicId ?? item.epicId ?? null,
        item.areaId ?? null,
        agentId,
        agentName
      )
    }
  }
}

async function createRound2Proposal(originalId: string) {
  const [original] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "CouncilProposal" WHERE id = $1`, originalId
  )
  if (!original) return
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CouncilProposal" (title, description, status, "inputChannel", items, round, "epicId", "sprintId", "solucionId", "createdByAgentId", "createdByAgentName", metadata)
     VALUES ($1,$2,'PENDING',$3,$4::jsonb,2,$5,$6,$7,$8,$9,$10::jsonb)`,
    `[Revisada] ${original.title}`,
    original.description,
    original.inputChannel,
    JSON.stringify(original.items),
    original.epicId,
    original.sprintId,
    original.solucionId,
    original.createdByAgentId,
    original.createdByAgentName,
    JSON.stringify({ originalProposalId: originalId, revisedRound: 2, ...(original.metadata ?? {}) })
  )
}
