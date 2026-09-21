import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO } from '@/lib/proyectos/auth'
import { ejecutarSuscripcion } from '@/lib/proyectos/suscripciones'

export const dynamic = 'force-dynamic'

// «Ejecutar ahora»: lanza la automatización a mano y devuelve qué hizo.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; subId: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id, subId } = await params
  const s = await prisma.proyectoSuscripcion.findFirst({ where: { id: subId, solucionId: id }, select: { id: true } })
  if (!s) return NO_ENCONTRADO('Automatización')
  const resultado = await ejecutarSuscripcion(subId)
  return NextResponse.json({ resultado })
}
