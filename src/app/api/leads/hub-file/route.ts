import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

const MAX_SIZE = 5 * 1024 * 1024 // 5MB

// Mismo orden que PHASES en leads/[id]/hub/page.tsx.
const PHASE_ORDER = ['NEW', 'CONTACTED', 'DIAGNOSIS', 'DEMO_VALIDATION', 'PROPOSAL_SENT', 'NEGOTIATION', 'RESULT']

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const userName = (token as any).name ?? (token as any).email ?? 'unknown'
  const { hubId, name, mimeType, base64 } = await request.json()

  // Misma regla que hub-phase PUT: se puede adjuntar en la fase activa o
  // en cualquier fase pasada (ya completada) — solo se bloquea una fase
  // FUTURA a la que el pipeline todavia no llego.
  const hub = await prisma.leadHub.findUnique({ where: { id: hubId }, select: { leadId: true, phase: true } })
  if (!hub) return NextResponse.json({ error: 'Fase no encontrada' }, { status: 404 })
  const lead = await prisma.lead.findUnique({ where: { id: hub.leadId }, select: { status: true } })
  const currentIdx = lead ? PHASE_ORDER.indexOf(lead.status) : -1
  const phaseIdx = PHASE_ORDER.indexOf(hub.phase)
  if (currentIdx === -1 || phaseIdx === -1 || phaseIdx > currentIdx) {
    return NextResponse.json(
      { error: `No se puede adjuntar en "${hub.phase}" — el pipeline todavía no llegó hasta ahí (fase activa: "${lead?.status}").` },
      { status: 409 }
    )
  }

  const size = Math.round((base64.length * 3) / 4)
  if (size > MAX_SIZE) {
    return NextResponse.json({ error: 'Archivo muy grande (máx 5MB)' }, { status: 400 })
  }

  const file = await prisma.leadHubFile.create({
    data: { hubId, name, size, mimeType, base64, uploadedBy: userName },
    select: { id: true, name: true, size: true, mimeType: true, uploadedBy: true, createdAt: true },
  })

  return NextResponse.json(file)
}

export async function DELETE(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await request.json()
  await prisma.leadHubFile.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const file = await prisma.leadHubFile.findUnique({ where: { id } })
  if (!file) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  return NextResponse.json(file)
}
