import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "DebateMessage" WHERE "proposalId" = $1 ORDER BY round, "createdAt"`, id
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params
  const { agentId, agentName, agentSlug, content, round = 1 } = await req.json()
  if (!agentId || !agentName || !content) return NextResponse.json({ error: 'agentId, agentName y content requeridos' }, { status: 400 })

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO "DebateMessage" ("proposalId", "agentId", "agentName", "agentSlug", content, round)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    id, agentId, agentName, agentSlug ?? null, content, round
  )
  return NextResponse.json(rows[0], { status: 201 })
}
