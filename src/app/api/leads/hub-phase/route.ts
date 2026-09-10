import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const leadId = searchParams.get('leadId')
  if (!leadId) return NextResponse.json({ error: 'leadId requerido' }, { status: 400 })

  const phases = await prisma.leadHub.findMany({
    where: { leadId },
    include: {
      files: {
        select: { id: true, name: true, size: true, mimeType: true, uploadedBy: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(phases)
}

// Mismo orden que PHASES en leads/[id]/hub/page.tsx — no se importa desde
// ahi porque ese archivo es 'use client' y este es server-only.
const PHASE_ORDER = ['NEW', 'CONTACTED', 'DIAGNOSIS', 'DEMO_VALIDATION', 'PROPOSAL_SENT', 'NEGOTIATION', 'RESULT']

export async function PUT(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { leadId, phase, content } = await request.json()

  // Defensa en profundidad: la UI ya deshabilita Guardar en una fase
  // FUTURA (todavia no se llego ahi) o con contenido vacio, pero esta ruta
  // no puede confiar solo en eso — un llamado directo (curl, otro cliente)
  // tiene que chocar con la misma regla. Una fase PASADA (ya completada) SI
  // se puede seguir editando — solo se bloquea escribir adelantado.
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { status: true } })
  if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })
  const currentIdx = PHASE_ORDER.indexOf(lead.status)
  const phaseIdx = PHASE_ORDER.indexOf(phase)
  if (currentIdx === -1 || phaseIdx === -1 || phaseIdx > currentIdx) {
    return NextResponse.json(
      { error: `No se puede guardar contenido en "${phase}" — el pipeline todavía no llegó hasta ahí (fase activa: "${lead.status}").` },
      { status: 409 }
    )
  }
  // El chequeo de "contenido vacio" se queda solo del lado del cliente
  // (deshabilita el boton Guardar) — ADREDE no se replica aca: el flujo de
  // Adjuntar archivo crea el registro de LeadHub con content todavia vacio
  // (recien se escribe algo despues), y bloquearlo aca rompería subir un
  // archivo como primera accion en una fase.

  const userName = (token as any).name ?? (token as any).email ?? 'unknown'

  const hub = await prisma.leadHub.upsert({
    where:  { leadId_phase: { leadId, phase } },
    update: { content, updatedBy: userName },
    create: { leadId, phase, content, updatedBy: userName },
    include: {
      files: {
        select: { id: true, name: true, size: true, mimeType: true, uploadedBy: true, createdAt: true },
      },
    },
  })

  return NextResponse.json(hub)
}
