import { NextRequest, NextResponse } from 'next/server'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO, sesionVisible } from '@/lib/proyectos/auth'
import { extraerPlan } from '@/lib/proyectos/modelo'

export const dynamic = 'force-dynamic'

// Coordinador: propone las tareas de backlog que salen de la conversación. NO crea nada:
// devuelve una vista previa que la persona revisa y aprueba (ver plan/aplicar).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id, sid } = await params
  const s = await sesionVisible(id, sid, u)
  if (!s) return NO_ENCONTRADO('Sesión')
  try {
    return NextResponse.json(await extraerPlan(sid, u.id))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'No se pudo armar el plan'
    const amable = /timeout|aborted/i.test(msg) ? 'La IA tardó demasiado. Inténtalo de nuevo.' : msg
    return NextResponse.json({ error: amable }, { status: 422 })
  }
}
