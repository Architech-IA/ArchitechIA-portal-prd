import fs from 'fs'
import { prisma } from '@/lib/prisma'
import { writeVaultNote } from '@/lib/memory/vaultNotes'
import { sprintBranchName, sprintWorktreePath, openSprintPR } from '@/lib/executor/gitWorktree'

const OPENCODE_GO_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_KEY = process.env.OPENCODE_API_KEY ?? ''
const OPENCODE_MODEL = process.env.OPENCODE_VERIFIER_MODEL ?? 'qwen3.7-max'

export async function checkSprintCompletion(sprintId: string): Promise<void> {
  const tasks = await prisma.$queryRawUnsafe(
    `SELECT status FROM "BacklogItem" WHERE "sprintId" = $1`,
    sprintId
  ) as { status: string }[]

  if (tasks.length === 0) return
  // BUG REAL encontrado en produccion: BLOCKED (una task salteada en cascada
  // porque su dependencia fallo, fix de esta misma sesion) no contaba como
  // terminal aca — un sprint entero con varias tasks BLOCKED se quedaba en
  // PLANNED para siempre, nunca generaba su resumen ni abria su PR, aunque
  // ya no fuera a pasar nada mas con el sin intervencion humana.
  const allTerminal = tasks.every(t => t.status === 'DONE' || t.status === 'FAILED' || t.status === 'CANCELLED' || t.status === 'BLOCKED')
  if (!allTerminal) return

  // Sprint is complete — generate summary and set REVIEW_PENDING
  await generateSprintSummary(sprintId)
}

async function generateSprintSummary(sprintId: string): Promise<void> {
  const [sprint] = await prisma.$queryRawUnsafe(
    `SELECT s.id, s.name, s.goal, s."sprintCode", s."epicId", e.name as "epicName", sol."solucionCode"
     FROM "Sprint" s
     JOIN "Epic" e ON s."epicId" = e.id
     JOIN "Solucion" sol ON e."solucionId" = sol.id
     WHERE s.id = $1`,
    sprintId
  ) as { id: string; name: string; goal: string | null; sprintCode: string; epicId: string; epicName: string; solucionCode: string }[]

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
  const blocked = tasks.filter(t => t.status === 'BLOCKED').length

  const tasksSummary = tasks.map(t =>
    `[${t.status}] ${t.title}${t.agentName ? ` (${t.agentName})` : ''}` +
    (t.resultado ? `: ${t.resultado.substring(0, 150)}` : '')
  ).join('\n')

  const userPrompt = `SPRINT: ${sprint.name}
OBJETIVO: ${sprint.goal ?? '—'}
COMPLETADAS: ${done}/${tasks.length} | FALLIDAS: ${failed}/${tasks.length} | BLOQUEADAS (saltadas por una dependencia fallida): ${blocked}/${tasks.length}

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
    tasksBlocked: blocked,
    closedAt: new Date().toISOString(),
    summary: `Sprint ${sprint.name}: ${done}/${tasks.length} tareas completadas.`,
    achievements: [] as string[],
    blockers: failed > 0 ? [`${failed} tarea(s) fallaron`] : [],
    recommendation: 'Continuar con el siguiente sprint.',
  }

  try {
    const res = await fetch(OPENCODE_GO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENCODE_KEY}` },
      body: JSON.stringify({
        model: OPENCODE_MODEL,
        messages: [
          { role: 'system', content: 'Eres Orión, CEO del Council de ArchiTechIA. Generas Sprint Summaries ejecutivos.' },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(60_000),
    })
    if (res.ok) {
      const data = await res.json()
      const content = data.choices?.[0]?.message?.content ?? ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        metadata = { ...metadata, ...parsed, tasksCompleted: done, tasksFailed: failed, tasksBlocked: blocked, closedAt: new Date().toISOString() }
      }
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

  // Memoria persistente: nota real en el vault, legible e independiente de
  // Postgres. buildTaskContext la lee para el "PREVIOUS SPRINT SUMMARY" del
  // siguiente sprint del mismo epic, en vez de depender de metadata (que
  // antes quedaba vacia si esta llamada fallaba silenciosamente).
  const achievements = Array.isArray(metadata.achievements) ? metadata.achievements as string[] : []
  const blockers = Array.isArray(metadata.blockers) ? metadata.blockers as string[] : []
  const body = [
    `## Resumen`,
    String(metadata.summary ?? ''),
    ``,
    `## Logros`,
    achievements.length > 0 ? achievements.map(a => `- ${a}`).join('\n') : '(ninguno registrado)',
    ``,
    `## Bloqueos`,
    blockers.length > 0 ? blockers.map(b => `- ${b}`).join('\n') : '(ninguno)',
    ``,
    `## Recomendación`,
    String(metadata.recommendation ?? ''),
    ``,
    `## Epic relacionado`,
    `[[${sprint.epicName}]]`,
  ].join('\n')

  try {
    await writeVaultNote(
      `shared/decisions/sprints/${sprint.sprintCode}.md`,
      {
        sprintCode: sprint.sprintCode,
        epicId: sprint.epicId,
        solucionCode: sprint.solucionCode,
        tasksCompleted: done,
        tasksFailed: failed,
        closedAt: new Date().toISOString(),
        tags: ['sprint-summary', sprint.solucionCode],
      },
      `# ${sprint.name} (${sprint.sprintCode})\n\n${body}`
    )
  } catch (err) {
    console.error('[SPRINT_MONITOR] No se pudo escribir la nota del vault:', err)
  }

  console.log(`[SPRINT_MONITOR] Sprint ${sprint.name} → REVIEW_PENDING (${done} done, ${failed} failed)`)

  // Si alguna tarea CODE del sprint corrio en su propio worktree, existe una
  // rama de integracion del sprint con commits reales — se abre (o
  // reutiliza) UN SOLO PR de esa rama hacia main. Nunca se mergea sola: el
  // merge a main siempre queda para revision humana.
  const sprintWtPath = sprintWorktreePath(sprint.sprintCode)
  if (fs.existsSync(sprintWtPath)) {
    try {
      const pr = await openSprintPR({
        sprintBranch: sprintBranchName(sprint.sprintCode),
        sprintWorktreePath: sprintWtPath,
        title: `[${sprint.sprintCode}] ${sprint.name}`,
        body: [
          `**Sprint:** ${sprint.name} (${sprint.sprintCode})`,
          `**Épic:** ${sprint.epicName}`,
          `**Resultado:** ${done}/${tasks.length} tareas completadas, ${failed} fallidas.`,
          '',
          '## Resumen',
          String(metadata.summary ?? ''),
          '',
          '## Tareas',
          tasksSummary,
          '',
          '_PR abierto automáticamente por el Motor Agéntico SDD. Revisar y mergear manualmente — nunca se mergea solo._',
        ].join('\n'),
      })
      if (pr) console.log(`[SPRINT_MONITOR] PR del sprint ${sprint.sprintCode}: ${pr.url}`)
    } catch (err) {
      console.error(`[SPRINT_MONITOR] No se pudo abrir el PR del sprint ${sprint.sprintCode}:`, err)
    }
  }
}
