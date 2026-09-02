import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { emitTraceEvent, type TraceEventKind } from '@/lib/executor/traceEvents'
import { prisma } from '@/lib/prisma'

const VALID_KINDS = new Set(['info', 'write', 'check', 'run', 'fail'])

// La autenticacion server-to-server la resuelve src/proxy.ts via header
// x-api-key === INTERNAL_API_KEY (bypass de la sesion NextAuth) — mismo
// mecanismo que /api/executor/complete. Este endpoint lo llama masd_worker.py
// (Python, proceso separado, no tiene sesion) para narrar en vivo lo que va
// haciendo dentro del loop de herramientas.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Body inválido' }, { status: 400 })

  const { taskId, execId, kind, message } = body
  if (!taskId || !kind || !message) {
    return NextResponse.json({ error: 'taskId, kind y message son requeridos' }, { status: 400 })
  }
  if (!VALID_KINDS.has(kind)) {
    return NextResponse.json({ error: `kind inválido: ${kind}` }, { status: 400 })
  }

  await emitTraceEvent(taskId, execId ?? null, kind as TraceEventKind, message)
  return NextResponse.json({ ok: true })
}

// La UI de la Sala de Control (src/app/(portal)/control/[sprintId]/page.tsx)
// hace polling de esto cada pocos segundos para la task seleccionada mientras
// esta en curso — no hace falta SSE/websockets para el volumen real de
// eventos de una sola tarea.
export async function GET(req: NextRequest) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const taskId = searchParams.get('taskId')
  if (!taskId) return NextResponse.json({ error: 'taskId requerido' }, { status: 400 })

  const events = await prisma.$queryRawUnsafe(
    `SELECT id, kind, message, "createdAt" FROM "TaskExecutionEvent" WHERE "taskId" = $1 ORDER BY "createdAt" ASC LIMIT 500`,
    taskId
  )
  return NextResponse.json(events)
}
