import { prisma } from '@/lib/prisma'
import { buildTaskContext } from '@/lib/context/buildTaskContext'
import { runVerifier } from '@/lib/executor/taskVerifier'
import { checkSprintCompletion } from '@/lib/executor/sprintMonitor'
import { exec } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, unlinkSync } from 'fs'
import { randomUUID } from 'crypto'

const execAsync = promisify(exec)

const CODE_AREAS = new Set([
  '947ca771-fe9e-4c3f-bfea-2ef2e27986c6', // Development
  '74b21d1d-0954-4757-a1fd-0fabed1e9e3a', // Infrastructure & DevOps
  '3695ed86-da91-4327-bdde-b14cfa8a10b5', // Quality & Testing
])

export type DispatchResult = {
  taskId: string
  taskCode: string
  agentId: string
  agentName: string
  strategy: 'CODE' | 'LLM'
  started: boolean
}

export async function resolveAgent(task: {
  id: string
  areaId: string | null
  assigneeId: string | null
  assigneeName: string | null
}): Promise<{ agentId: string; agentName: string; strategy: 'CODE' | 'LLM' }> {
  if (task.assigneeId && task.assigneeName) {
    const strategy = task.areaId && CODE_AREAS.has(task.areaId) ? 'CODE' : 'LLM'
    return { agentId: task.assigneeId, agentName: task.assigneeName, strategy }
  }

  if (task.areaId) {
    const [area] = await prisma.$queryRawUnsafe(
      `SELECT "defaultAgentId", "defaultAgentName", "executionStrategy" FROM "Area" WHERE id = $1`,
      task.areaId
    ) as { defaultAgentId: string | null; defaultAgentName: string | null; executionStrategy: string | null }[]

    if (area?.defaultAgentId) {
      return {
        agentId: area.defaultAgentId,
        agentName: area.defaultAgentName ?? 'Agent',
        strategy: (area.executionStrategy ?? 'LLM') as 'CODE' | 'LLM',
      }
    }
  }

  return { agentId: 'cmsii11qf0003l0w1jikaxygb', agentName: 'Orión', strategy: 'LLM' }
}

export async function dispatchTask(taskId: string): Promise<DispatchResult> {
  const [task] = await prisma.$queryRawUnsafe(
    `SELECT id, title, description, "taskCode", "areaId", "sprintId", "assigneeId", "assigneeName", status
     FROM "BacklogItem" WHERE id = $1`,
    taskId
  ) as {
    id: string; title: string; description: string | null;
    taskCode: string; areaId: string | null; sprintId: string | null;
    assigneeId: string | null; assigneeName: string | null; status: string
  }[]

  if (!task) throw new Error(`Task ${taskId} not found`)
  if (task.status === 'DONE') throw new Error(`Task ${taskId} ya está DONE`)

  const { agentId, agentName, strategy } = await resolveAgent(task)

  await prisma.$executeRawUnsafe(
    `UPDATE "BacklogItem" SET status='IN_PROGRESS', "fechaInicio"=NOW(), "fechaEjecucion"=NOW() WHERE id=$1`,
    taskId
  )

  const [exec_] = await prisma.$queryRawUnsafe(
    `INSERT INTO "TaskExecution" (id,"backlogItemId","agentId","agentName",status,"startedAt")
     VALUES (gen_random_uuid()::text,$1,$2,$3,'RUNNING',NOW()) RETURNING id`,
    taskId, agentId, agentName
  ) as { id: string }[]

  const context = await buildTaskContext(taskId)

  runExecutor({ taskId, execId: exec_.id, task, agentName, strategy, context })
    .catch(err => console.error(`[EXECUTOR] Task ${taskId} failed:`, err))

  return { taskId, taskCode: task.taskCode, agentId, agentName, strategy, started: true }
}

async function runExecutor(opts: {
  taskId: string
  execId: string
  task: { title: string; description: string | null; sprintId?: string | null }
  agentName: string
  strategy: 'CODE' | 'LLM'
  context: string
}) {
  const { taskId, execId, task, agentName, strategy, context } = opts
  const startMs = Date.now()

  const prompt = [
    context,
    '---',
    `Eres ${agentName}. Ejecuta la siguiente tarea:`,
    task.title,
    task.description ?? '',
  ].join('\n\n')

  // Write prompt to temp file — avoids all shell escaping issues
  const tmpFile = `/tmp/claude_prompt_${randomUUID()}.txt`
  writeFileSync(tmpFile, prompt, 'utf8')

  let resultSummary = ''
  let finalStatus = 'DONE'

  try {
    const timeout = strategy === 'CODE' ? 600_000 : 300_000
    const maxBuffer = strategy === 'CODE' ? 10 * 1024 * 1024 : 5 * 1024 * 1024

    const { stdout, stderr } = await execAsync(
      `claude --print < ${tmpFile}`,
      { timeout, maxBuffer }
    )
    resultSummary = (stdout || stderr || '(sin output)').trim().substring(0, 2000)
  } catch (err: unknown) {
    finalStatus = 'FAILED'
    resultSummary = `Error: ${err instanceof Error ? err.message : String(err)}`.substring(0, 2000)
  } finally {
    try { unlinkSync(tmpFile) } catch { /* ignore */ }
  }

  const durationMs = Date.now() - startMs

  // Update TaskExecution
  await prisma.$executeRawUnsafe(
    `UPDATE "TaskExecution"
     SET status=$2, "resultSummary"=$3, "finishedAt"=NOW(), "durationMs"=$4, "contextUsed"=$5
     WHERE id=$1`,
    execId, finalStatus, resultSummary, durationMs, context.substring(0, 4000)
  )

  // Run verifier
  let verifiedStatus = finalStatus
  if (finalStatus === 'DONE') {
    try {
      const verifierResult = await runVerifier({
        taskTitle: task.title,
        taskDescription: task.description,
        acceptanceCriteria: [], // populated from councilPlan when available
        resultSummary,
      })
      verifiedStatus = verifierResult.passed ? 'DONE' : 'FAILED'

      // Save checklist in TaskExecution artifacts
      await prisma.$executeRawUnsafe(
        `UPDATE "TaskExecution" SET artifacts=$2::jsonb WHERE id=$1`,
        execId, JSON.stringify(verifierResult.checklist)
      )
    } catch {
      // Verifier error → keep DONE
    }
  }

  // Update BacklogItem with final verified status
  await prisma.$executeRawUnsafe(
    `UPDATE "BacklogItem"
     SET status=$2, "fechaFin"=NOW(), resultado=$3
     WHERE id=$1`,
    taskId, verifiedStatus, resultSummary.substring(0, 500)
  )

  console.log(`[EXECUTOR] ${task.title} → ${verifiedStatus} (${Math.round(durationMs / 1000)}s)`)

  // Check if sprint is complete → REVIEW_PENDING
  if (task.sprintId) {
    try {
      await checkSprintCompletion(task.sprintId)
    } catch (err) {
      console.error('[SPRINT_MONITOR] Error:', err)
    }
  }
}
