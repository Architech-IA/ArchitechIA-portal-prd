import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO } from '@/lib/proyectos/auth'

export const dynamic = 'force-dynamic'

type P = { params: Promise<{ id: string; subId: string }> }

export async function PATCH(req: NextRequest, { params }: P) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id, subId } = await params
  const s = await prisma.proyectoSuscripcion.findFirst({ where: { id: subId, solucionId: id }, select: { id: true } })
  if (!s) return NO_ENCONTRADO('Automatización')
  const b = await req.json().catch(() => ({})) as { activa?: boolean; intervaloMin?: number; nombre?: string }
  const data: Record<string, unknown> = {}
  if (typeof b.activa === 'boolean') data.activa = b.activa
  if (Number.isFinite(Number(b.intervaloMin)) && Number(b.intervaloMin) >= 10) data.intervaloMin = Math.min(Number(b.intervaloMin), 43_200)
  if (typeof b.nombre === 'string') data.nombre = b.nombre.slice(0, 80)
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  const upd = await prisma.proyectoSuscripcion.update({ where: { id: subId }, data })
  return NextResponse.json({ ...upd, config: undefined })
}

export async function DELETE(req: NextRequest, { params }: P) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id, subId } = await params
  const s = await prisma.proyectoSuscripcion.findFirst({ where: { id: subId, solucionId: id }, select: { id: true } })
  if (!s) return NO_ENCONTRADO('Automatización')
  await prisma.proyectoSuscripcion.delete({ where: { id: subId } })
  return NextResponse.json({ ok: true })
}
