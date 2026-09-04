import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// La autenticacion server-to-server la resuelve src/proxy.ts via header
// x-api-key === INTERNAL_API_KEY (bypass de la sesion NextAuth), mismo
// mecanismo que /api/executor/complete y /api/executor/event. Este endpoint
// NO debe llamar a finalizeExecution — una explicacion es de solo lectura
// sobre el estado del repo, nunca toca BacklogItem.status ni worktrees.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const { execId, status, resultSummary, toolLog } = body
  if (!execId || !status) {
    return NextResponse.json({ error: 'execId y status son requeridos' }, { status: 400 })
  }
  if (status !== 'DONE' && status !== 'FAILED') {
    return NextResponse.json({ error: 'status debe ser DONE o FAILED' }, { status: 400 })
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "TaskExplanation" SET status = $2, resultado = $3, "toolLog" = $4::jsonb, "updatedAt" = NOW() WHERE "execId" = $1`,
    execId, status, resultSummary ?? '', JSON.stringify(Array.isArray(toolLog) ? toolLog : [])
  )
  return NextResponse.json({ ok: true })
}
