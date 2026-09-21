import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO } from '@/lib/proyectos/auth'

export const dynamic = 'force-dynamic'

// Aprobar (opcionalmente editada) o rechazar una propuesta de actualización de la memoria
// que generó la IA al cerrar una sesión. Aprobar crea una versión nueva (origen IA).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; pid: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id, pid } = await params
  const p = await prisma.proyectoMemoriaPropuesta.findFirst({ where: { id: pid, solucionId: id } })
  if (!p) return NO_ENCONTRADO('Propuesta')
  if (p.estado !== 'PENDIENTE') return NextResponse.json({ error: 'La propuesta ya fue resuelta' }, { status: 409 })
  const b = await req.json().catch(() => ({})) as { accion?: string; contenido?: string; forzar?: boolean }

  if (b.accion === 'rechazar') {
    await prisma.proyectoMemoriaPropuesta.update({ where: { id: pid }, data: { estado: 'RECHAZADA', resueltaEn: new Date(), resueltaPor: u.nombre } })
    return NextResponse.json({ ok: true })
  }
  if (b.accion !== 'aprobar') return NextResponse.json({ error: 'accion debe ser aprobar o rechazar' }, { status: 400 })

  const contenido = typeof b.contenido === 'string' && b.contenido.trim() ? b.contenido.trim() : p.contenidoPropuesto
  if (contenido.length > 30_000) return NextResponse.json({ error: 'La memoria no puede superar los 30.000 caracteres' }, { status: 400 })

  const res = await prisma.$transaction(async tx => {
    const actual = await tx.proyectoMemoria.findUnique({ where: { solucionId: id } })
    const version = actual?.version ?? 0
    // La propuesta se calculó sobre una versión; si la memoria cambió después, hay que confirmarlo
    if (version !== p.baseVersion && !b.forzar) return { conflicto: true as const, version }
    const nueva = version + 1
    await tx.proyectoMemoriaVersion.create({ data: { solucionId: id, version: nueva, contenido, origen: 'IA', autor: `Aprobada por ${u.nombre}`, nota: p.resumenCambios.slice(0, 200) || null } })
    await tx.proyectoMemoria.upsert({
      where: { solucionId: id },
      create: { solucionId: id, contenido, version: nueva, actualizadoPor: u.nombre },
      update: { contenido, version: nueva, actualizadoPor: u.nombre },
    })
    await tx.proyectoMemoriaPropuesta.update({ where: { id: pid }, data: { estado: 'APROBADA', resueltaEn: new Date(), resueltaPor: u.nombre } })
    return { conflicto: false as const, version: nueva }
  })
  if (res.conflicto) return NextResponse.json({ error: 'La memoria cambió después de generar esta propuesta. Revísala y confirma para reemplazar.', version: res.version, requiereConfirmar: true }, { status: 409 })
  return NextResponse.json({ ok: true, version: res.version })
}
