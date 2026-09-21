import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO, sesionVisible } from '@/lib/proyectos/auth'

export const dynamic = 'force-dynamic'

// Bifurcar: nueva sesión con una copia de la conversación hasta un mensaje (para explorar otra línea).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id, sid } = await params
  const s = await sesionVisible(id, sid, u)
  if (!s) return NO_ENCONTRADO('Sesión')
  const b = await req.json().catch(() => ({})) as { desdeOrden?: number }
  const desde = Number(b.desdeOrden)
  if (!Number.isFinite(desde) || desde < 1) return NextResponse.json({ error: 'desdeOrden inválido' }, { status: 400 })

  const msgs = await prisma.proyectoMensaje.findMany({ where: { sesionId: sid, orden: { lte: desde }, estado: 'LISTO' }, orderBy: { orden: 'asc' } })
  if (msgs.length === 0) return NextResponse.json({ error: 'No hay mensajes para copiar' }, { status: 400 })

  const nueva = await prisma.$transaction(async tx => {
    const n = await tx.proyectoSesion.create({ data: {
      solucionId: id, titulo: `${s.titulo} (bifurcada)`.slice(0, 80), tipo: s.tipo === 'BITACORA' ? 'LIBRE' : s.tipo,
      privada: s.privada, creadaPorId: u.id, creadaPorNombre: u.nombre, fuentesExcluidas: s.fuentesExcluidas as never,
    } })
    await tx.proyectoMensaje.createMany({ data: msgs.map((m, i) => ({
      sesionId: n.id, orden: i + 1, rol: m.rol, contenido: m.contenido, estado: 'LISTO', metadata: m.metadata as never, autorId: m.autorId, autorNombre: m.autorNombre,
    })) })
    return n
  })
  return NextResponse.json(nueva, { status: 201 })
}
