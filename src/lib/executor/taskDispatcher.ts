import { prisma } from '@/lib/prisma'
import { buildTaskContext } from '@/lib/context/buildTaskContext'
import { exec } from 'child_process'
import { promisify } from 'util'

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
  // 1. Use task's explicit assignee
  if (task.assigneeId && task.assigneeName) {
    const strategy = task.areaId && CODE_AREAS.has(task.areaId) ? 'CODE' : 'LLM'
    return { agentId: task.assigneeId, agentName: task.assigneeName, strategy }
  }

  // 2. Use area's defaultAgent
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

  // 3. Fallback to Orión
  return {
    agentId: 'cmsii11qf0003l0w1jikaxygb',
    agentName: 'Orión',
    strategy: 'LLM',
  }
}

export async function dispatchTask(taskId: string): Promise<DispatchResult> {
  const [task] = await prisma.$queryRawUnsafe(
    `SELECT id, title, description, "taskCode", "areaId", "assigneeId", "assigneeName", status
     FROM "BacklogItem" WHERE id = $1`,
    taskId
  ) as {
    id: string; title: string; description: string | null;
    taskCode: string; areaId: string | null;
    assigneeId: string | null; assigneeName: string | null; status: string
  }[]

  if (!task) throw new Error(`Task ${taskId} not found`)
  if (task.status === 'DONE') throw new Error(`Task ${taskId} already DONE`)

  const { agentId, agentName, strategy } = await resolveAgent(task)

  // Mark task as IN_PROGRESS + fechaInicio
  await prisma.$executeRawUnsafe(
    `UPDATE "BacklogItem" SET status='IN_PROGRESS', "fechaInicio"=NOW() WHERE id=$1`,
    taskId
  )

  // Create TaskExecution record
  const [exec_] = await prisma.$queryRawUnsafe(
    `INSERT INTO "TaskExecution" (id,"backlogItemId","agentId","agentName",status,"startedAt")
     VALUES (gen_random_uuid()::text,$1,$2,$3,'RUNNING',NOW())
     RETURNING id`,
    taskId, agentId, agentName
  ) as { id: string }[]

  // Fire execution in background (non-blocking)
  const context = await buildTaskContext(taskId)
  runExecutor({ taskId, execId: exec_.id, task, agentId, agentName, strategy, context })
    .catch(err => console.error(`[EXECUTOR] Task ${taskId} failed:`, err))

  return {
    taskId,
    taskCode: task.taskCode,
    agentId,
    agentName,
    strategy,
    started: true,
  }
}

async function runExecutor(opts: {
  taskId: string
  execId: string
  task: { title: string; description: string | null }
  agentId: string
  agentName: string
  strategy: 'CODE' | 'LLM'
  context: string
}) {
  const { taskId, execId, task, agentName, strategy, context } = opts
  const startMs = Date.now()

  const prompt = `${context}\n\n---\nEjecuta la siguiente tarea como ${agentName}:\n${task.title}\n${task.description ?? ''}`

  let resultSummary = ''
  let finalStatus = 'DONE'

  try {
    if (strategy === 'CODE') {
      const { stdout, stderr } = await execAsync(
        `claude --print "${prompt.replace(/"/g, '\\"')}"`,
        { timeout: 600_000, maxBuffer: 10 * 1024 * 1024 }
      )
      resultSummary = (stdout || stderr || '(no output)').substring(0, 2000)
    } else {
      const { stdout, stderr } = await execAsync(
        `claude --print "${prompt.replace(/"/g, '\\"')}"`,
        { timeout: 300_000, maxBuffer: 5 * 1024 * 1024 }
      )
      resultSummary = (stdout || stderr || '(no output)').substring(0, 2000)
    }
  } catch (err: unknown) {
    finalStatus = 'FAILED'
    resultSummary = `Error: ${err instanceof Error ? err.message : String(err)}`.substring(0, 2000)
  }

  const durationMs = Date.now() - startMs

  // Update TaskExecution
  await prisma.$executeRawUnsafe(
    `UPDATE "TaskExecution"
     SET status=$2, "resultSummary"=$3, "finishedAt"=NOW(), "durationMs"=$4, "contextUsed"=$5
     WHERE id=$1`,
    execId, finalStatus, resultSummary, durationMs, context.substring(0, 4000)
  )

  // Update BacklogItem
  if (finalStatus === 'DONE') {
    await prisma.$executeRawUnsafe(
      `UPDATE "BacklogItem" SET status='DONE', "fechaFin"=NOW(), resultado=$2 WHERE id=$1`,
      taskId, resultSummary.substring(0, 500)
    )
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE "BacklogItem" SET status='FAILED', "fechaFin"=NOW(), resultado=$2 WHERE id=$1`,
      taskId, resultSummary.substring(0, 500)
    )
  }

  console.log(`[EXECUTOR] ${opts.task.title} → ${finalStatus} (${durationMs}ms)`)
}
