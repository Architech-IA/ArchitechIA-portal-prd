import { NextRequest, NextResponse } from 'next/server'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO, sesionVisible } from '@/lib/proyectos/auth'
import { construirContexto } from '@/lib/proyectos/contexto'

export const dynamic = 'force-dynamic'

// Qué contexto recibiría exactamente la IA ahora mismo (para el panel «Contexto»).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  const sesionId = new URL(req.url).searchParams.get('sesionId')
  const sesion = sesionId ? await sesionVisible(id, sesionId, u) : null
  if (sesionId && !sesion) return NO_ENCONTRADO('Sesión')
  const ctx = await construirContexto(id, sesion, u.id)
  if (!ctx) return NO_ENCONTRADO('Proyecto')
  return NextResponse.json({ fuentes: ctx.fuentes, totalChars: ctx.totalChars, presupuesto: 48_000, excluidas: sesion?.fuentesExcluidas ?? [] })
}
