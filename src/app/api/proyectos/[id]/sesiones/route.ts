import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO, solucionExiste } from '@/lib/proyectos/auth'
import { TIPOS_SESION } from '@/lib/proyectos/tipos'

export const dynamic = 'force-dynamic'

// Crear una sesión (conversación persistente) dentro de un proyecto.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  if (!(await solucionExiste(id))) return NO_ENCONTRADO('Proyecto')
  const body = await req.json().catch(() => ({})) as { titulo?: string; tipo?: string; privada?: boolean }
  const tipo = (TIPOS_SESION as readonly string[]).includes(String(body.tipo)) && body.tipo !== 'BITACORA' ? String(body.tipo) : 'LIBRE'
  const titulo = typeof body.titulo === 'string' && body.titulo.trim() ? body.titulo.trim().slice(0, 80) : 'Nueva sesión'
  const s = await prisma.proyectoSesion.create({ data: {
    solucionId: id, titulo, tipo, privada: !!body.privada, creadaPorId: u.id, creadaPorNombre: u.nombre,
  } })
  return NextResponse.json(s, { status: 201 })
}
