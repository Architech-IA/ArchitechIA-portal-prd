import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO, sesionVisible } from '@/lib/proyectos/auth'
import { generarRespuesta } from '@/lib/proyectos/modelo'

export const dynamic = 'force-dynamic'

// Reintentar / regenerar la ÚLTIMA respuesta del asistente (cuando falló o la persona quiere otra versión).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string; mid: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id, sid, mid } = await params
  const s = await sesionVisible(id, sid, u)
  if (!s) return NO_ENCONTRADO('Sesión')
  if (s.estado !== 'ACTIVA') return NextResponse.json({ error: 'La sesión está cerrada. Reábrela primero.' }, { status: 409 })

  const m = await prisma.proyectoMensaje.findFirst({ where: { id: mid, sesionId: sid, rol: 'assistant' } })
  if (!m) return NO_ENCONTRADO('Mensaje')
  const ultimo = await prisma.proyectoMensaje.aggregate({ where: { sesionId: sid }, _max: { orden: true } })
  if (m.orden !== ultimo._max.orden) return NextResponse.json({ error: 'Solo se puede regenerar la última respuesta' }, { status: 409 })
  if (m.estado === 'GENERANDO') return NextResponse.json({ error: 'La IA ya está respondiendo' }, { status: 409 })

  // Debe haber un mensaje de la persona justo antes
  const previo = await prisma.proyectoMensaje.findFirst({ where: { sesionId: sid, orden: { lt: m.orden }, rol: 'user' }, orderBy: { orden: 'desc' } })
  if (!previo) return NextResponse.json({ error: 'No hay una pregunta a la que responder' }, { status: 400 })

  const upd = await prisma.proyectoMensaje.update({ where: { id: mid }, data: { estado: 'GENERANDO', contenido: '', error: null, metadata: {} } })
  void generarRespuesta(sid, mid, u.id)
  return NextResponse.json(upd)
}
