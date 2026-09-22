import { NextRequest, NextResponse } from 'next/server'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO } from '@/lib/proyectos/auth'
import { listarNombresVariables, guardarVariable, borrarVariable } from '@/lib/executor/secrets'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function nombreDe(id: string): Promise<string | null> {
  const [sol] = await prisma.$queryRawUnsafe<{ nombre: string }[]>(`SELECT nombre FROM "Solucion" WHERE id = $1`, id)
  return sol?.nombre ?? null
}

// Variables de entorno del proyecto desplegado (MASD-0023-0006-028). Solo se listan NOMBRES,
// nunca valores — igual que los secrets de GitHub Actions. El valor solo se escribe, nunca se
// vuelve a leer hacia la UI.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  const nombre = await nombreDe(id)
  if (!nombre) return NO_ENCONTRADO('Proyecto')
  return NextResponse.json({ variables: listarNombresVariables(nombre) })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  const nombre = await nombreDe(id)
  if (!nombre) return NO_ENCONTRADO('Proyecto')
  const b = await req.json().catch(() => ({})) as { nombre?: string; valor?: string }
  if (typeof b.nombre !== 'string' || typeof b.valor !== 'string' || !b.nombre.trim()) {
    return NextResponse.json({ error: 'Faltan "nombre" y/o "valor".' }, { status: 400 })
  }
  try {
    guardarVariable(nombre, b.nombre.trim(), b.valor)
    return NextResponse.json({ variables: listarNombresVariables(nombre) })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  const nombre = await nombreDe(id)
  if (!nombre) return NO_ENCONTRADO('Proyecto')
  const variable = req.nextUrl.searchParams.get('variable')
  if (!variable) return NextResponse.json({ error: 'Falta "variable".' }, { status: 400 })
  borrarVariable(nombre, variable)
  return NextResponse.json({ variables: listarNombresVariables(nombre) })
}
