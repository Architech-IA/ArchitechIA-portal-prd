import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO, sesionVisible } from '@/lib/proyectos/auth'
import { procesarCierre } from '@/lib/proyectos/modelo'

export const dynamic = 'force-dynamic'

// Cerrar la sesión: queda guardada completa; en segundo plano se genera el resumen final y se
// PROPONE una actualización de la memoria del proyecto (que la persona aprueba o rechaza).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id, sid } = await params
  const s = await sesionVisible(id, sid, u)
  if (!s) return NO_ENCONTRADO('Sesión')
  if (s.tipo === 'BITACORA') return NextResponse.json({ error: 'La Bitácora no se cierra' }, { status: 400 })
  const enCurso = await prisma.proyectoMensaje.findFirst({ where: { sesionId: sid, estado: 'GENERANDO', updatedAt: { gt: new Date(Date.now() - 4 * 60_000) } }, select: { id: true } })
  if (enCurso) return NextResponse.json({ error: 'Espera a que la IA termine de responder para cerrar la sesión' }, { status: 409 })

  const upd = await prisma.proyectoSesion.update({ where: { id: sid }, data: { estado: 'CERRADA', cierreEstado: 'PROCESANDO' } })
  void procesarCierre(sid)
  return NextResponse.json(upd)
}
