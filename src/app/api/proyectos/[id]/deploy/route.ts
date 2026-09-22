import { NextRequest, NextResponse } from 'next/server'
import { usuarioActual, NO_AUTENTICADO } from '@/lib/proyectos/auth'
import { desplegarSolucion } from '@/lib/executor/deploy'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Publicar un proyecto: botón «Publicar» en el panel Ejecución. Manual siempre — nunca se
// dispara solo al mergear un PR (mismo criterio que el resto del Motor: una persona decide
// cuándo pasa algo real). Corre del lado Node/root, nunca dentro del sandbox de run_command.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  try {
    const r = await desplegarSolucion(id)
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
  const [sol] = await prisma.$queryRawUnsafe<{ deployUrl: string | null; deployStatus: string | null; deployedAt: Date | null; deployPort: number | null }[]>(
    `SELECT "deployUrl", "deployStatus", "deployedAt", "deployPort" FROM "Solucion" WHERE id = $1`, id)
  if (!sol) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(sol)
}
