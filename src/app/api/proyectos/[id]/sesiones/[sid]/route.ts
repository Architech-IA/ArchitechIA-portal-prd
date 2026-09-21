import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO, sesionVisible } from '@/lib/proyectos/auth'
import { FUENTES_CLAVES } from '@/lib/proyectos/tipos'
import { GENERACION_MAX_MS } from '@/lib/proyectos/modelo'

export const dynamic = 'force-dynamic'

type P = { params: Promise<{ id: string; sid: string }> }

// Sesión + mensajes. Con ?desde=<ISO> devuelve solo los mensajes creados o modificados después
// (así el sondeo mientras la IA responde es liviano).
export async function GET(req: NextRequest, { params }: P) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id, sid } = await params
  const s = await sesionVisible(id, sid, u)
  if (!s) return NO_ENCONTRADO('Sesión')

  // Una generación que lleva demasiado tiempo se da por interrumpida (p. ej. el servidor se reinició)
  await prisma.proyectoMensaje.updateMany({
    where: { sesionId: sid, estado: 'GENERANDO', updatedAt: { lt: new Date(Date.now() - GENERACION_MAX_MS) } },
    data: { estado: 'ERROR', error: 'La generación se interrumpió. Puedes reintentar.' },
  })

  const desde = new URL(req.url).searchParams.get('desde')
  const fecha = desde ? new Date(desde) : null
  const mensajes = await prisma.proyectoMensaje.findMany({
    where: { sesionId: sid, ...(fecha && !isNaN(+fecha) ? { updatedAt: { gt: fecha } } : {}) },
    orderBy: { orden: 'asc' },
  })
  return NextResponse.json({ sesion: s, mensajes, ahora: new Date().toISOString(), yo: { id: u.id } })
}

export async function PATCH(req: NextRequest, { params }: P) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id, sid } = await params
  const s = await sesionVisible(id, sid, u)
  if (!s) return NO_ENCONTRADO('Sesión')
  const b = await req.json().catch(() => ({})) as { titulo?: string; estado?: string; privada?: boolean; fuentesExcluidas?: unknown }
  const data: Record<string, unknown> = {}
  if (typeof b.titulo === 'string' && b.titulo.trim()) data.titulo = b.titulo.trim().slice(0, 80)
  if (b.estado === 'ACTIVA' || b.estado === 'ARCHIVADA') { data.estado = b.estado; if (b.estado === 'ACTIVA') data.cierreEstado = null }
  if (typeof b.privada === 'boolean') {
    if (s.creadaPorId !== u.id && !u.sistema) return NextResponse.json({ error: 'Solo quien creó la sesión puede cambiar su privacidad' }, { status: 403 })
    data.privada = b.privada
  }
  if (Array.isArray(b.fuentesExcluidas)) {
    data.fuentesExcluidas = b.fuentesExcluidas.filter((x): x is string => typeof x === 'string' && (FUENTES_CLAVES as readonly string[]).includes(x) && x !== 'ficha')
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  const upd = await prisma.proyectoSesion.update({ where: { id: sid }, data })
  return NextResponse.json(upd)
}

export async function DELETE(req: NextRequest, { params }: P) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id, sid } = await params
  const s = await sesionVisible(id, sid, u)
  if (!s) return NO_ENCONTRADO('Sesión')
  if (s.creadaPorId !== u.id && !u.sistema) return NextResponse.json({ error: 'Solo quien creó la sesión puede eliminarla' }, { status: 403 })
  if (s.tipo === 'BITACORA') return NextResponse.json({ error: 'La Bitácora no se puede eliminar' }, { status: 400 })
  await prisma.proyectoSesion.delete({ where: { id: sid } })
  return NextResponse.json({ ok: true })
}
