import { NextRequest, NextResponse } from 'next/server'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO, solucionExiste } from '@/lib/proyectos/auth'
import { buscarProyecto } from '@/lib/proyectos/busqueda'

export const dynamic = 'force-dynamic'

// Búsqueda en todas las sesiones visibles, adjuntos y memoria del proyecto.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  if (!(await solucionExiste(id))) return NO_ENCONTRADO('Proyecto')
  const q = new URL(req.url).searchParams.get('q') ?? ''
  if (q.trim().length < 2) return NextResponse.json([])
  return NextResponse.json(await buscarProyecto(id, q, u.id, { limite: 20 }))
}
