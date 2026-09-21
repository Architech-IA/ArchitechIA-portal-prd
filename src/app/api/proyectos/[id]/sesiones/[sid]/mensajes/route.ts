import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO, sesionVisible } from '@/lib/proyectos/auth'
import { generarRespuesta, GENERACION_MAX_MS } from '@/lib/proyectos/modelo'

export const dynamic = 'force-dynamic'

// Enviar un mensaje: se guarda AL INSTANTE (junto con un marcador «generando» del asistente) y la
// respuesta se produce en segundo plano en el servidor. El cliente sondea la sesión; si cierra la
// pestaña, la respuesta igual queda guardada.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id, sid } = await params
  const s = await sesionVisible(id, sid, u)
  if (!s) return NO_ENCONTRADO('Sesión')
  if (s.estado !== 'ACTIVA') return NextResponse.json({ error: 'La sesión está cerrada o archivada. Reábrela para seguir conversando.' }, { status: 409 })

  const b = await req.json().catch(() => ({})) as { contenido?: string; adjuntoIds?: string[] }
  const contenido = typeof b.contenido === 'string' ? b.contenido.trim() : ''
  if (!contenido) return NextResponse.json({ error: 'El mensaje está vacío' }, { status: 400 })
  if (contenido.length > 20_000) return NextResponse.json({ error: 'El mensaje supera los 20.000 caracteres' }, { status: 400 })

  const enCurso = await prisma.proyectoMensaje.findFirst({
    where: { sesionId: sid, estado: 'GENERANDO', updatedAt: { gt: new Date(Date.now() - GENERACION_MAX_MS) } }, select: { id: true },
  })
  if (enCurso) return NextResponse.json({ error: 'La IA todavía está respondiendo. Espera a que termine.' }, { status: 409 })

  // Adjuntos referenciados: se ligan a esta sesión (quedan priorizados en el contexto)
  let adjuntos: { id: string; nombre: string }[] = []
  if (Array.isArray(b.adjuntoIds) && b.adjuntoIds.length > 0) {
    const ids = b.adjuntoIds.filter(x => typeof x === 'string').slice(0, 10)
    await prisma.proyectoAdjunto.updateMany({ where: { id: { in: ids }, solucionId: id, sesionId: null }, data: { sesionId: sid } })
    adjuntos = await prisma.proyectoAdjunto.findMany({ where: { id: { in: ids }, solucionId: id }, select: { id: true, nombre: true } })
  }

  const [msgUsuario, msgAsistente] = await prisma.$transaction(async tx => {
    const max = await tx.proyectoMensaje.aggregate({ where: { sesionId: sid }, _max: { orden: true } })
    const orden = (max._max.orden ?? 0) + 1
    const mu = await tx.proyectoMensaje.create({ data: {
      sesionId: sid, orden, rol: 'user', contenido, estado: 'LISTO', autorId: u.id, autorNombre: u.nombre, metadata: { adjuntos } as never,
    } })
    const ma = await tx.proyectoMensaje.create({ data: { sesionId: sid, orden: orden + 1, rol: 'assistant', contenido: '', estado: 'GENERANDO', metadata: {} } })
    await tx.proyectoSesion.update({ where: { id: sid }, data: { updatedAt: new Date() } })
    return [mu, ma]
  })

  void generarRespuesta(sid, msgAsistente.id, u.id)
  return NextResponse.json({ mensajes: [msgUsuario, msgAsistente] }, { status: 201 })
}
