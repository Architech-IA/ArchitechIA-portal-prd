import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { resolveRepoConfig } from '@/lib/executor/repoConfig'
import crypto from 'crypto'

const OPENCODE_GO_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_EXPLAIN_MODEL = process.env.OPENCODE_EXECUTOR_MODEL ?? 'qwen3.7-max'
const HARNESS_API_URL = process.env.HARNESS_API_URL ?? 'http://127.0.0.1:8767'

// A diferencia de EXPLAIN_SYSTEM (texto libre), este pide un formato JSON
// estricto — el "Ejecutar plan" del portal necesita pasos estructurados
// para mostrarlos desglosados en la UI, no un párrafo.
const PLAN_SYSTEM = `Sos un agente de planificación de remediación dentro del motor SAGE/MASD de ArchiTechIA.
Tu tarea es investigar el REPOSITORIO REAL (con find_symbol, get_file_summary, get_dependents, list_files,
grep_files, read_file) para entender por qué una tarea quedó FAILED o BLOCKED, y proponer un PLAN DE TRABAJO
concreto y bien desglosado para resolverlo — NO ejecutar nada todavía. Tenés write_file disponible pero NO
debés usarlo: tu única salida es el plan, en JSON.

Respondé ÚNICAMENTE con un objeto JSON válido (sin markdown, sin \`\`\`, sin texto antes o después), con esta forma exacta:
{
  "resumen": "1-2 frases de la causa raíz real, ya investigada en el repo",
  "automatizable": true | false,
  "motivoNoAutomatizable": "si automatizable=false, por qué un agente de código no puede resolver esto solo (ej. requiere una acción humana externa, una decisión de negocio, acceso a un sistema que el agente no tiene). Si automatizable=true, dejalo en null.",
  "pasos": [
    {
      "titulo": "Título corto del paso (una línea)",
      "descripcion": "Qué hacer exactamente, con el detalle suficiente para que otro agente lo ejecute sin re-investigar todo desde cero",
      "archivos": ["ruta/relativa/al/archivo.ts"],
      "riesgo": "bajo" | "medio" | "alto"
    }
  ]
}

Reglas:
- Cada paso debe ser accionable y verificable por separado — no un paso vago tipo "arreglar el bug".
- Ordená los pasos en el orden real en que deberían aplicarse.
- "automatizable" es CRÍTICO — un botón del portal usa este campo para decidir si se le permite a un agente
  de código ejecutar este plan automáticamente. Poné false si CUALQUIER paso requiere: una acción humana
  real (reunión, llamada, aprobación de negocio, enviar un email/contrato), completar otra tarea del
  backlog que depende de una persona, o acceso a un sistema externo que el agente no tiene. Poné true SOLO
  si TODOS los pasos son cambios de código/configuración que un agente puede hacer solo en este repo.
- Si automatizable=false, los "pasos" igual deben describir qué hay que hacer (aunque sea manualmente) —
  simplemente no se van a poder ejecutar con el botón de auto-ejecución.
- No inventes nada que no hayas verificado leyendo el repo real.`

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
    return NextResponse.json({ error: 'Solo se puede proponer un plan para una tarea FAILED o BLOCKED' }, { status: 400 })
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
    `INSERT INTO "TaskRemediationPlan" (id, "taskId", "execId", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'RUNNING', NOW(), NOW())`,
    crypto.randomUUID(), taskId, execId
  )

  try {
    await fetch(`${HARNESS_API_URL}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'plan_task',
        agent: 'planificador',
        priority: 'MEDIUM',
        payload: {
          taskId, execId,
          apiUrl: OPENCODE_GO_URL,
          modelId: OPENCODE_EXPLAIN_MODEL,
          systemPrompt: PLAN_SYSTEM,
          userPrompt,
          repoPath,
        },
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    await prisma.$executeRawUnsafe(
      `UPDATE "TaskRemediationPlan" SET status = 'FAILED', resultado = $2, "updatedAt" = NOW() WHERE "execId" = $1`,
      execId, `No se pudo encolar en el Harness: ${err instanceof Error ? err.message : String(err)}`
    )
    return NextResponse.json({ error: 'No se pudo encolar la propuesta de plan' }, { status: 502 })
  }

  return NextResponse.json({ execId }, { status: 202 })
}

export async function GET(req: NextRequest) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const execId = searchParams.get('execId')
  if (!execId) return NextResponse.json({ error: 'execId requerido' }, { status: 400 })

  const rows = await prisma.$queryRawUnsafe<{
    id: string; status: string; resultado: string | null; planJson: unknown; appliedAt: string | null
  }[]>(
    `SELECT id, status, resultado, "planJson", "appliedAt" FROM "TaskRemediationPlan" WHERE "execId" = $1`, execId
  )
  if (!rows[0]) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(rows[0])
}
