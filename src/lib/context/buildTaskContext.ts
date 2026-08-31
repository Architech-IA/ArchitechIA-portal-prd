import { prisma } from '@/lib/prisma'

// Techo duro sobre el contexto final. Un sprint con decenas de tareas no
// puede hacer crecer esto sin limite.
const MAX_CONTEXT_CHARS = 8000

// Cuantas tareas del sprint se listan como maximo en SPRINT PROGRESS,
// sin importar cuantas tenga el sprint en total.
const MAX_SPRINT_TASKS_LISTED = 8

export async function buildTaskContext(taskId: string): Promise<string> {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      bi.id as "taskId", bi.title as "taskTitle", bi.description as "taskDescription",
      bi.priority, bi.status as "taskStatus", bi."taskCode",
      bi."areaId", a.name as "areaName",
      s.id as "sprintId", s.name as "sprintName", s.goal as "sprintGoal", s."sprintCode",
      e.id as "epicId", e.name as "epicName", e.description as "epicDescription",
      sol.id as "solId", sol.nombre as "solNombre", sol.descripcion as "solDescripcion",
      sol."solucionCode"
    FROM "BacklogItem" bi
    LEFT JOIN "Sprint" s ON bi."sprintId" = s.id
    LEFT JOIN "Epic" e ON s."epicId" = e.id
    LEFT JOIN "Solucion" sol ON s."solucionId" = sol.id
    LEFT JOIN "Area" a ON bi."areaId" = a.id
    WHERE bi.id = $1
  `, taskId)

  if (!rows || (rows as unknown[]).length === 0) {
    return `Task ${taskId} not found.`
  }

  const task = (rows as Record<string, unknown>[])[0]

  // ── Bloque ESTABLE ──────────────────────────────────────────────────────
  // Identico entre tareas del mismo sprint/epic/solucion. Va primero para
  // que, si el proveedor detras de OpenCode soporta prompt caching, el
  // prefijo compartido se sirva desde cache en vez de recomputarse/pagarse
  // completo en cada llamada (requiere prefijo identico byte a byte y
  // llamadas suficientemente seguidas para no perder el cache).
  const stableParts: string[] = []

  stableParts.push(`=== SDD HIERARCHY ===`)
  stableParts.push(`SOLUTION: [${task.solucionCode}] ${task.solNombre}`)
  if (task.solDescripcion) stableParts.push(`  ${task.solDescripcion}`)
  stableParts.push(`EPIC: ${task.epicName}`)
  if (task.epicDescription) stableParts.push(`  ${task.epicDescription}`)
  stableParts.push(`SPRINT: [${task.sprintCode}] ${task.sprintName}`)
  if (task.sprintGoal) stableParts.push(`  Goal: ${task.sprintGoal}`)

  // Council debate (planning messages round=10) — estable durante toda la solucion
  const councilMsgs = await prisma.$queryRawUnsafe(`
    SELECT dm."agentSlug", dm.content, dm."createdAt"
    FROM "DebateMessage" dm
    JOIN "CouncilProposal" cp ON dm."proposalId" = cp.id
    WHERE cp."solucionId" = $1 AND dm.round = 10
    ORDER BY dm."createdAt" DESC
    LIMIT 3
  `, task.solId) as { agentSlug: string; content: string }[]

  if (councilMsgs.length > 0) {
    stableParts.push(`\n=== COUNCIL DEBATE (PLANNING) ===`)
    for (const m of councilMsgs.reverse()) {
      stableParts.push(`[${m.agentSlug}]: ${m.content.substring(0, 400)}`)
    }
  }

  // Previous sprint summary — estable, solo cambia cuando cierra un sprint del epic
  const prevSprint = await prisma.$queryRawUnsafe(`
    SELECT metadata FROM "Sprint"
    WHERE "epicId" = $1 AND status = 'CLOSED' AND id != $2
    ORDER BY "createdAt" DESC LIMIT 1
  `, task.epicId, task.sprintId) as { metadata: Record<string, unknown> | null }[]

  if (prevSprint.length > 0 && prevSprint[0].metadata) {
    const summary = (prevSprint[0].metadata as Record<string, unknown>).summary
    if (summary) {
      stableParts.push(`\n=== PREVIOUS SPRINT SUMMARY ===`)
      stableParts.push(String(summary).substring(0, 500))
    }
  }

  // Area execution history — cambia solo cuando termina otra tarea del area
  const areaHistory = await prisma.$queryRawUnsafe(`
    SELECT te."agentName", te."resultSummary", te."durationMs", te."finishedAt"
    FROM "TaskExecution" te
    JOIN "BacklogItem" bi ON te."backlogItemId" = bi.id
    WHERE bi."areaId" = $1
      AND bi."solucionId" = $2
      AND te.status = 'DONE'
    ORDER BY te."finishedAt" DESC
    LIMIT 3
  `, task.areaId, task.solId) as { agentName: string; resultSummary: string | null; durationMs: number | null }[]

  if (areaHistory.length > 0) {
    stableParts.push(`\n=== AREA EXECUTION HISTORY ===`)
    for (const h of areaHistory) {
      const dur = h.durationMs ? ` (${Math.round(h.durationMs / 1000)}s)` : ''
      const res = h.resultSummary ? h.resultSummary.substring(0, 200) : '—'
      stableParts.push(`${h.agentName}${dur}: ${res}`)
    }
  }

  // ── Bloque VARIABLE ─────────────────────────────────────────────────────
  // Cambia en cada tarea (o cada vez que otra tarea del sprint termina).
  // Va al final y NUNCA se trunca — si hay que recortar algo para respetar
  // el techo de tamano, se recorta el bloque estable, no este.
  const volatileParts: string[] = []

  // Sprint progress: solo las N tareas mas recientes, nunca el sprint entero.
  const [{ count: sprintTaskCount }] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int as count FROM "BacklogItem" WHERE "sprintId" = $1 AND id != $2`,
    task.sprintId, taskId
  ) as { count: number }[]

  const sprintTasks = await prisma.$queryRawUnsafe(`
    SELECT "taskCode", title, status, resultado
    FROM "BacklogItem"
    WHERE "sprintId" = $1 AND id != $2
    ORDER BY "createdAt" DESC
    LIMIT $3
  `, task.sprintId, taskId, MAX_SPRINT_TASKS_LISTED) as { taskCode: string; title: string; status: string; resultado: string | null }[]

  if (sprintTasks.length > 0) {
    volatileParts.push(`\n=== SPRINT PROGRESS ===`)
    const omitted = sprintTaskCount - sprintTasks.length
    if (omitted > 0) {
      volatileParts.push(`(${omitted} tareas anteriores omitidas por espacio — mostrando las ${MAX_SPRINT_TASKS_LISTED} mas recientes)`)
    }
    for (const t of sprintTasks.reverse()) {
      const res = t.resultado ? ` → ${t.resultado.substring(0, 120)}` : ''
      volatileParts.push(`[${t.status}] ${t.taskCode}: ${t.title}${res}`)
    }
  }

  // Task — 100% unica en cada llamada, siempre al final, nunca truncada
  volatileParts.push(`\n=== TASK ===`)
  volatileParts.push(`[${task.taskCode}] ${task.taskTitle} (${task.priority})`)
  if (task.taskDescription) volatileParts.push(String(task.taskDescription))
  volatileParts.push(`Area: ${task.areaName || task.areaId}`)

  const volatileBlock = volatileParts.join('\n')
  let stableBlock = stableParts.join('\n')

  // El bloque estable absorbe el recorte si hace falta — el volatil (la
  // tarea en si) nunca se toca.
  const budgetForStable = MAX_CONTEXT_CHARS - volatileBlock.length - 60
  if (stableBlock.length > budgetForStable) {
    stableBlock = stableBlock.slice(0, Math.max(0, budgetForStable)) + '\n[... contexto estable truncado por limite de tamaño ...]'
  }

  return `${stableBlock}\n${volatileBlock}`
}
