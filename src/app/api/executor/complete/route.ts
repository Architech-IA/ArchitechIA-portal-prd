import { NextRequest, NextResponse } from 'next/server'
import { finalizeExecution } from '@/lib/executor/taskDispatcher'

// La autenticacion server-to-server la resuelve src/proxy.ts via header
// x-api-key === INTERNAL_API_KEY (bypass de la sesion NextAuth). Esta ruta
// solo se alcanza si ese chequeo ya paso.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const { taskId, execId, status, resultSummary, durationMs, contextUsed, toolLog } = body
  if (!taskId || !execId || !status) {
    return NextResponse.json({ error: 'taskId, execId y status son requeridos' }, { status: 400 })
  }
  if (status !== 'DONE' && status !== 'FAILED') {
    return NextResponse.json({ error: 'status debe ser DONE o FAILED' }, { status: 400 })
  }

  try {
    const result = await finalizeExecution({
      taskId,
      execId,
      finalStatus: status,
      resultSummary: resultSummary ?? '',
      durationMs: Number(durationMs) || 0,
      contextUsed,
      toolLog: Array.isArray(toolLog) ? toolLog : [],
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[EXECUTOR_COMPLETE] Error:', err)
    return NextResponse.json({ error: 'Error finalizando ejecución' }, { status: 500 })
  }
}
