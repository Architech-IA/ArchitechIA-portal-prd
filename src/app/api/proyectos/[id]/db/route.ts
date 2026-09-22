import { NextRequest, NextResponse } from 'next/server'
import { usuarioActual, NO_AUTENTICADO } from '@/lib/proyectos/auth'
import { aprovisionarBaseDeDatos } from '@/lib/executor/deploy'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// «Agregar base de datos», separado de «Publicar» — no todos los proyectos la necesitan.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  try {
    const r = await aprovisionarBaseDeDatos(id)
    return NextResponse.json(r)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg.slice(0, 500) }, { status: 400 })
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  const [sol] = await prisma.$queryRawUnsafe<{ dbStatus: string | null; dbProvisionedAt: Date | null }[]>(
    `SELECT "dbStatus", "dbProvisionedAt" FROM "Solucion" WHERE id = $1`, id)
  if (!sol) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(sol)
}
