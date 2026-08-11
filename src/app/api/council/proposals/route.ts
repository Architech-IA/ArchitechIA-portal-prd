import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const where = status ? `WHERE status = '${status.replace(/'/g, '')}'` : ''
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, title, description, status, "inputChannel", items, round,
            "epicId", "sprintId", "solucionId", "createdByAgentId", "createdByAgentName",
            metadata, "createdAt", "updatedAt"
     FROM "CouncilProposal" ${where}
     ORDER BY "createdAt" DESC LIMIT 50`
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await req.json()
  const { title, description, inputChannel = 'CONVERSATION', items = [], epicId, sprintId, solucionId, createdByAgentId, createdByAgentName, metadata } = body
  if (!title) return NextResponse.json({ error: 'title requerido' }, { status: 400 })

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO "CouncilProposal" (title, description, "inputChannel", items, "epicId", "sprintId", "solucionId", "createdByAgentId", "createdByAgentName", metadata)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10::jsonb)
     RETURNING *`,
    title, description ?? null, inputChannel, JSON.stringify(items),
    epicId ?? null, sprintId ?? null, solucionId ?? null,
    createdByAgentId ?? null, createdByAgentName ?? null,
    metadata ? JSON.stringify(metadata) : null
  )
  return NextResponse.json(rows[0], { status: 201 })
}
