import { prisma } from '@/lib/prisma'

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

  const parts: string[] = []

  // SDD Hierarchy
  parts.push(`=== SDD HIERARCHY ===`)
  parts.push(`SOLUTION: [${task.solucionCode}] ${task.solNombre}`)
  if (task.solDescripcion) parts.push(`  ${task.solDescripcion}`)
  parts.push(`EPIC: ${task.epicName}`)
  if (task.epicDescription) parts.push(`  ${task.epicDescription}`)
  parts.push(`SPRINT: [${task.sprintCode}] ${task.sprintName}`)
  if (task.sprintGoal) parts.push(`  Goal: ${task.sprintGoal}`)

  // Task
  parts.push(`\n=== TASK ===`)
  parts.push(`[${task.taskCode}] ${task.taskTitle} (${task.priority})`)
  if (task.taskDescription) parts.push(String(task.taskDescription))
  parts.push(`Area: ${task.areaName || task.areaId}`)

  // Sprint progress: done + pending tasks
  const sprintTasks = await prisma.$queryRawUnsafe(`
    SELECT "taskCode", title, status, resultado
    FROM "BacklogItem"
    WHERE "sprintId" = $1 AND id != $2
    ORDER BY status, "createdAt"
  `, task.sprintId, taskId) as { taskCode: string; title: string; status: string; resultado: string | null }[]

  if (sprintTasks.length > 0) {
    parts.push(`\n=== SPRINT PROGRESS ===`)
    for (const t of sprintTasks) {
      const res = t.resultado ? ` → ${t.resultado.substring(0, 200)}` : ''
      parts.push(`[${t.status}] ${t.taskCode}: ${t.title}${res}`)
    }
  }

  // Council debate (planning messages round=10)
  const councilMsgs = await prisma.$queryRawUnsafe(`
    SELECT dm."agentSlug", dm.content, dm."createdAt"
    FROM "DebateMessage" dm
    JOIN "CouncilProposal" cp ON dm."proposalId" = cp.id
    WHERE cp."solucionId" = $1 AND dm.round = 10
    ORDER BY dm."createdAt" DESC
    LIMIT 3
  `, task.solId) as { agentSlug: string; content: string }[]

  if (councilMsgs.length > 0) {
    parts.push(`\n=== COUNCIL DEBATE (PLANNING) ===`)
    for (const m of councilMsgs.reverse()) {
      parts.push(`[${m.agentSlug}]: ${m.content.substring(0, 400)}`)
    }
  }

  // Area execution history
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
    parts.push(`\n=== AREA EXECUTION HISTORY ===`)
    for (const h of areaHistory) {
      const dur = h.durationMs ? ` (${Math.round(h.durationMs / 1000)}s)` : ''
      const res = h.resultSummary ? h.resultSummary.substring(0, 200) : '—'
      parts.push(`${h.agentName}${dur}: ${res}`)
    }
  }

  // Previous sprint summary
  const prevSprint = await prisma.$queryRawUnsafe(`
    SELECT metadata FROM "Sprint"
    WHERE "epicId" = $1 AND status = 'CLOSED' AND id != $2
    ORDER BY "createdAt" DESC LIMIT 1
  `, task.epicId, task.sprintId) as { metadata: Record<string, unknown> | null }[]

  if (prevSprint.length > 0 && prevSprint[0].metadata) {
    const summary = (prevSprint[0].metadata as Record<string, unknown>).summary
    if (summary) {
      parts.push(`\n=== PREVIOUS SPRINT SUMMARY ===`)
      parts.push(String(summary).substring(0, 500))
    }
  }

  return parts.join('\n')
}
