import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO } from '@/lib/proyectos/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id, aid } = await params
  const a = await prisma.proyectoAdjunto.findFirst({ where: { id: aid, solucionId: id }, select: { id: true } })
  if (!a) return NO_ENCONTRADO('Adjunto')
  await prisma.proyectoAdjunto.delete({ where: { id: aid } })
  return NextResponse.json({ ok: true })
}
