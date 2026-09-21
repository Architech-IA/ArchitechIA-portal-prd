import { NextRequest, NextResponse } from 'next/server'
import { usuarioActual, NO_AUTENTICADO } from '@/lib/proyectos/auth'
import { ejecutarPendientes } from '@/lib/proyectos/suscripciones'

export const dynamic = 'force-dynamic'

// Lo llama el cron del servidor cada 10 minutos. Solo con la clave interna (x-api-key).
export async function POST(req: NextRequest) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  if (!u.sistema) return NextResponse.json({ error: 'Solo la clave interna puede ejecutar todas las automatizaciones' }, { status: 403 })
  return NextResponse.json(await ejecutarPendientes())
}
