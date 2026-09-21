import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO } from '@/lib/proyectos/auth'

export const dynamic = 'force-dynamic'

// Un proyecto: cabecera + sesiones visibles para quien consulta.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  const sol = await prisma.solucion.findUnique({ where: { id }, select: { id: true, nombre: true, tipo: true, estado: true, solucionCode: true, leadId: true, updatedAt: true } })
  if (!sol) return NO_ENCONTRADO('Proyecto')
  const incluirArchivadas = new URL(req.url).searchParams.get('archivadas') === '1'

  const [sesiones, mem, pendientes, adjuntos] = await Promise.all([
    prisma.proyectoSesion.findMany({
      where: { solucionId: id, ...(incluirArchivadas ? {} : { estado: { not: 'ARCHIVADA' } }), OR: [{ privada: false }, { creadaPorId: u.id }] },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, titulo: true, tipo: true, estado: true, privada: true, creadaPorId: true, creadaPorNombre: true, cierreEstado: true, createdAt: true, updatedAt: true },
    }),
    prisma.proyectoMemoria.findUnique({ where: { solucionId: id }, select: { version: true, updatedAt: true } }),
    prisma.proyectoMemoriaPropuesta.count({ where: { solucionId: id, estado: 'PENDIENTE' } }),
    prisma.proyectoAdjunto.count({ where: { solucionId: id } }),
  ])
  // Cantidad de mensajes por sesión
  const conteo = sesiones.length
    ? await prisma.proyectoMensaje.groupBy({ by: ['sesionId'], where: { sesionId: { in: sesiones.map(s => s.id) } }, _count: { _all: true } })
    : []
  const cm = new Map(conteo.map(c => [c.sesionId, c._count._all]))
  return NextResponse.json({
    proyecto: sol,
    yo: { id: u.id, nombre: u.nombre },
    sesiones: sesiones.map(s => ({ ...s, mensajes: cm.get(s.id) ?? 0, mia: s.creadaPorId === u.id })),
    memoriaVersion: mem?.version ?? 0,
    propuestasPendientes: pendientes,
    adjuntos,
  })
}
