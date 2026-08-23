import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT p.*,
      COALESCE(json_agg(DISTINCT dm.*) FILTER (WHERE dm.id IS NOT NULL), '[]') as messages,
      COALESCE(json_agg(DISTINCT av.*) FILTER (WHERE av.id IS NOT NULL), '[]') as votes
     FROM "CouncilProposal" p
     LEFT JOIN "DebateMessage" dm ON dm."proposalId" = p.id
     LEFT JOIN "AgentVote" av ON av."proposalId" = p.id
     WHERE p.id = $1
     GROUP BY p.id`,
    id
  )
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(rows[0])
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const { status, round } = await req.json()

  const setParts: string[] = ['"updatedAt" = NOW()']
  const vals: any[] = [id]
  if (status) { setParts.push(`status = $${vals.length + 1}`); vals.push(status) }
  if (round)  { setParts.push(`round = $${vals.length + 1}`); vals.push(round) }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `UPDATE "CouncilProposal" SET ${setParts.join(', ')} WHERE id = $1 RETURNING *`,
    ...vals
  )
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(rows[0])
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  await prisma.$executeRawUnsafe(`DELETE FROM "DebateMessage" WHERE "proposalId" = $1`, id)
  await prisma.$executeRawUnsafe(`DELETE FROM "AgentVote" WHERE "proposalId" = $1`, id)
  await prisma.$executeRawUnsafe(`DELETE FROM "CouncilProposal" WHERE id = $1`, id)
  return NextResponse.json({ deleted: true })
}
