import { prisma } from '@/lib/prisma'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function checkSprintCompletion(sprintId: string): Promise<void> {
  const tasks = await prisma.$queryRawUnsafe(
    `SELECT status FROM "BacklogItem" WHERE "sprintId" = $1`,
    sprintId
  ) as { status: string }[]

  if (tasks.length === 0) return
  const allTerminal = tasks.every(t => t.status === 'DONE' || t.status === 'FAILED' || t.status === 'CANCELLED')
  if (!allTerminal) return

  // Sprint is complete — generate summary and set REVIEW_PENDING
  await generateSprintSummary(sprintId)
}

async function generateSprintSummary(sprintId: string): Promise<void> {
  const [sprint] = await prisma.$queryRawUnsafe(
    `SELECT id, name, goal FROM "Sprint" WHERE id = $1`,
    sprintId
  ) as { id: string; name: string; goal: string | null }[]

  const tasks = await prisma.$queryRawUnsafe(`
    SELECT bi.title, bi.status, bi.resultado,
           te."agentName", te."resultSummary", te."durationMs"
    FROM "BacklogItem" bi
    LEFT JOIN "TaskExecution" te ON te."backlogItemId" = bi.id AND te.status = bi.status
    WHERE bi."sprintId" = $1
    ORDER BY bi."createdAt"
  `, sprintId) as {
    title: string; status: string; resultado: string | null;
    agentName: string | null; resultSummary: string | null; durationMs: number | null
  }[]

  const done = tasks.filter(t => t.status === 'DONE').length
  const failed = tasks.filter(t => t.status === 'FAILED').length

  const tasksSummary = tasks.map(t =>
    `[${t.status}] ${t.title}${t.agentName ? ` (${t.agentName})` : ''}` +
    (t.resultado ? `: ${t.resultado.substring(0, 150)}` : '')
  ).join('\n')

  const prompt = `Eres Orión, CEO del Council. Genera un Sprint Summary ejecutivo.

SPRINT: ${sprint.name}
OBJETIVO: ${sprint.goal ?? '—'}
COMPLETADAS: ${done}/${tasks.length} | FALLIDAS: ${failed}/${tasks.length}

TAREAS:
${tasksSummary}

Responde ÚNICAMENTE con JSON:
{
  "summary": "Párrafo ejecutivo de 2-3 oraciones sobre qué se logró",
  "achievements": ["logro 1", "logro 2"],
  "blockers": ["bloqueo 1 si hubo", "..."],
  "recommendation": "Qué hacer en el siguiente sprint"
}
Sin markdown extra.`

  let metadata: Record<string, unknown> = {
    tasksCompleted: done,
    tasksFailed: failed,
    closedAt: new Date().toISOString(),
    summary: `Sprint ${sprint.name}: ${done}/${tasks.length} tareas completadas.`,
    achievements: [],
    blockers: failed > 0 ? [`${failed} tarea(s) fallaron`] : [],
    recommendation: 'Continuar con el siguiente sprint.',
  }

  try {
    const { stdout } = await execAsync(
      `claude --print "${prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`,
      { timeout: 60_000 }
    )
    const jsonMatch = stdout.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      metadata = { ...metadata, ...parsed, tasksCompleted: done, tasksFailed: failed, closedAt: new Date().toISOString() }
    }
  } catch {
    // Keep fallback metadata
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "Sprint"
     SET status = 'REVIEW_PENDING',
         metadata = $2::jsonb
     WHERE id = $1`,
    sprintId,
    JSON.stringify(metadata)
  )

  console.log(`[SPRINT_MONITOR] Sprint ${sprint.name} → REVIEW_PENDING (${done} done, ${failed} failed)`)
}
