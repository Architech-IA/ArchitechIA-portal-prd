import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { resolveRepoConfig } from '@/lib/executor/repoConfig'
import crypto from 'crypto'

const OPENCODE_GO_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_EXPLAIN_MODEL = process.env.OPENCODE_EXECUTOR_MODEL ?? 'qwen3.7-max'
const HARNESS_API_URL = process.env.HARNESS_API_URL ?? 'http://127.0.0.1:8767'

const EXPLAIN_SYSTEM = `Sos un agente investigador de diagnóstico dentro del motor SAGE/MASD de ArchiTechIA.
Tu única tarea es EXPLICAR — en español claro, sin jerga innecesaria — por qué una tarea de desarrollo
quedó FAILED o BLOCKED, investigando el REPOSITORIO REAL con tus herramientas (find_symbol,
get_file_summary, get_dependents, list_files, grep_files, read_file) antes de responder.

Preferí find_symbol/get_file_summary/get_dependents primero (consultas exactas a un índice de código
ya parseado). Usá list_files/grep_files/read_file cuando necesites explorar por carpeta o ver el código
completo de un archivo. Tenés también write_file disponible, pero tu rol es diagnosticar, NO corregir —
no escribas ni modifiques ningún archivo salvo que sea estrictamente imprescindible para confirmar algo
(por ejemplo, nunca deberías necesitarlo para explicar un error de compilación o un bloqueo por
dependencia).

Tu respuesta final (texto plano, sin markdown pesado) debe cubrir, en este orden:
1. Causa raíz real (no el síntoma) — señalá el archivo y la línea exacta si la encontraste.
2. Por qué pasó esto (qué asunción rota, qué cambio en otro lado lo provocó, si es un problema de la
   propia tarea o de una dependencia).
3. Cómo se resolvería en la práctica — sé concreto: "cambiar tal tipo en tal archivo", "reintentar tal
   cual", "dividir la tarea en dos", etc.
No inventes nada que no hayas verificado leyendo el repo real.`

function buildUserPrompt(task: {
  taskCode: string | null; title: string; description: string | null
  status: string; resultado: string | null
}, sprint: { sprintCode: string | null; epicName: string | null; solucionNombre: string | null } | null): string {
  const lines = [
    `Tarea: ${task.taskCode ?? '(sin código)'} — ${task.title}`,
    task.description ? `Descripción: ${task.description}` : null,
    sprint ? `Sprint: ${sprint.sprintCode ?? '?'} · Épica: ${sprint.epicName ?? '?'} · Solución: ${sprint.solucionNombre ?? '?'}` : null,
    `Estado actual: ${task.status}`,
    '',
    task.status === 'FAILED' ? 'Error / motivo de la falla (tal cual lo guardó el motor):' : 'Motivo del bloqueo (tal cual lo guardó el motor):',
    task.resultado ?? '(sin detalle guardado)',
  ].filter(Boolean)
  return lines.join('\n')
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { taskId } = await params

  const rows = await prisma.$queryRawUnsafe<{
    id: string; taskCode: string | null; title: string; description: string | null
    status: string; resultado: string | null; solucionId: string | null; sprintId: string | null
  }[]>(
    `SELECT id, "taskCode", title, description, status, resultado, "solucionId", "sprintId"
     FROM "BacklogItem" WHERE id = $1`, taskId
  )
  const task = rows[0]
  if (!task) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 })
  if (task.status !== 'FAILED' && task.status !== 'BLOCKED') {
    return NextResponse.json({ error: 'Solo se puede explicar una tarea FAILED o BLOCKED' }, { status: 400 })
  }

  const sprintRows = task.sprintId ? await prisma.$queryRawUnsafe<{
    sprintCode: string | null; epicName: string | null; solucionNombre: string | null
  }[]>(
    `SELECT s."sprintCode", e.name as "epicName", sol.nombre as "solucionNombre"
     FROM "Sprint" s
     LEFT JOIN "Epic" e ON e.id = s."epicId"
     LEFT JOIN "Solucion" sol ON sol.id = COALESCE(s."solucionId", e."solucionId")
     WHERE s.id = $1`, task.sprintId
  ) : []

  const { repoPath } = await resolveRepoConfig(task.solucionId)
  const execId = crypto.randomUUID()
  const userPrompt = buildUserPrompt(task, sprintRows[0] ?? null)

  await prisma.$executeRawUnsafe(
    `INSERT INTO "TaskExplanation" (id, "taskId", "execId", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'RUNNING', NOW(), NOW())`,
    crypto.randomUUID(), taskId, execId
  )

  try {
    await fetch(`${HARNESS_API_URL}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'explain_task',
        agent: 'explicador',
        priority: 'MEDIUM',
        payload: {
          taskId, execId,
          apiUrl: OPENCODE_GO_URL,
          modelId: OPENCODE_EXPLAIN_MODEL,
          systemPrompt: EXPLAIN_SYSTEM,
          userPrompt,
          repoPath,
        },
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    await prisma.$executeRawUnsafe(
      `UPDATE "TaskExplanation" SET status = 'FAILED', resultado = $2, "updatedAt" = NOW() WHERE "execId" = $1`,
      execId, `No se pudo encolar en el Harness: ${err instanceof Error ? err.message : String(err)}`
    )
    return NextResponse.json({ error: 'No se pudo encolar la explicación' }, { status: 502 })
  }

  return NextResponse.json({ execId }, { status: 202 })
}

export async function GET(req: NextRequest) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const execId = searchParams.get('execId')
  if (!execId) return NextResponse.json({ error: 'execId requerido' }, { status: 400 })

  const rows = await prisma.$queryRawUnsafe<{
    status: string; resultado: string | null; toolLog: unknown
  }[]>(
    `SELECT status, resultado, "toolLog" FROM "TaskExplanation" WHERE "execId" = $1`, execId
  )
  if (!rows[0]) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
  return NextResponse.json(rows[0])
}
