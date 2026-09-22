import { NextRequest, NextResponse } from 'next/server'
import { usuarioActual, NO_AUTENTICADO } from '@/lib/proyectos/auth'
import { aplicarMigraciones } from '@/lib/executor/deploy'

export const dynamic = 'force-dynamic'

// «Aplicar migraciones» — manual, aparte de «Publicar» (decisión explícita: nada que pueda
// alterar datos reales corre solo).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  try {
    const r = await aplicarMigraciones(id)
    return NextResponse.json(r, { status: r.ok ? 200 : 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: msg.slice(0, 500) }, { status: 400 })
  }
}
