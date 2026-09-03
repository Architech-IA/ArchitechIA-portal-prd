import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { generateSolucionCode, uniqueSolucionCode } from '@/lib/solucionCode'

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
  const { title, description, inputChannel = 'CONVERSATION', items = [], epicId, sprintId, createdByAgentId, createdByAgentName, metadata, solucionPropuesta } = body
  let { solucionId } = body
  if (!title) return NextResponse.json({ error: 'title requerido' }, { status: 400 })

  // Si el humano eligio "crear Solucion nueva" en el panel de Propuesta
  // Extraida (en vez de una existente), se crea ahora mismo — la propuesta
  // queda asociada de entrada, en vez de dejar la decision pendiente para
  // que el LLM la adivine mucho mas adelante en plan/start.
  if (!solucionId && solucionPropuesta?.name) {
    // Toda Solucion debe tener solucionCode (sin el, sus Sprints/Tasks caen
    // al prefijo generico "SP", indistinguible de cualquier otra Solucion
    // sin codigo — bug real encontrado en produccion con "Executive AI
    // Inbox & Hub").
    const code = await uniqueSolucionCode(generateSolucionCode(solucionPropuesta.name))
    const solRows = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "Solucion" (id, nombre, descripcion, estado, tipo, repositorio, "solucionCode", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'ACTIVO', 'PRODUCT', $4, $5, NOW(), NOW())
       RETURNING id`,
      crypto.randomUUID(), solucionPropuesta.name, solucionPropuesta.description ?? null,
      solucionPropuesta.repositorio ?? 'portal-architechia', code
    )
    solucionId = solRows[0]?.id ?? null
  }

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
