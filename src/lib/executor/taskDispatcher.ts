import path from 'path'
import { prisma } from '@/lib/prisma'
import { buildTaskContext } from '@/lib/context/buildTaskContext'
import { runVerifier } from '@/lib/executor/taskVerifier'
import { runRealCodeChecks } from '@/lib/executor/realChecks'
import { checkSprintCompletion } from '@/lib/executor/sprintMonitor'
import fs from 'fs'
import {
  ensureSprintIntegrationBranch, createTaskWorktree, commitAndMergeTask,
  discardTaskWorktree, taskWorktreePath as computeTaskWorktreePath,
  sprintWorktreePath as computeSprintWorktreePath, taskBranchName,
} from '@/lib/executor/gitWorktree'

const REPO_ROOT = path.resolve(process.cwd())

const OPENCODE_GO_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const OPENCODE_URL    = 'https://opencode.ai/zen/v1/chat/completions'
const OPENCODE_FALLBACK_MODEL = process.env.OPENCODE_EXECUTOR_MODEL ?? 'qwen3.7-max'

const HARNESS_API_URL = process.env.HARNESS_API_URL ?? 'http://127.0.0.1:8767'

// Resuelve el modelo OpenCode a usar para un agente segun su llmModel configurado.
// Si el agente tiene un modelo claude-* o no tiene nada configurado, cae al modelo
// global de fallback (el motor MASD nunca usa el CLI de claude para ejecutar).
function resolveOpenCodeModel(llmModel: string | null | undefined): { apiUrl: string; modelId: string } {
  if (llmModel?.startsWith('opencode-go/')) {
    return { apiUrl: OPENCODE_GO_URL, modelId: llmModel.slice('opencode-go/'.length) }
  }
  if (llmModel?.startsWith('opencode/')) {
    return { apiUrl: OPENCODE_URL, modelId: llmModel.slice('opencode/'.length) }
  }
  return { apiUrl: OPENCODE_GO_URL, modelId: OPENCODE_FALLBACK_MODEL }
}

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

async function loadAgentProfile(agentId: string): Promise<{ llmModel: string | null; systemPrompt: string | null; slug: string | null }> {
  const [agent] = await prisma.$queryRawUnsafe(
    `SELECT "llmModel", "systemPrompt", slug FROM "Agent" WHERE id = $1`,
    agentId
  ) as { llmModel: string | null; systemPrompt: string | null; slug: string | null }[]
  return agent ?? { llmModel: null, systemPrompt: null, slug: null }
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
    `SELECT bi.id, bi.title, bi.description, bi."taskCode", bi."areaId", bi."sprintId",
            bi."assigneeId", bi."assigneeName", bi.status, bi."dependsOnTaskId",
            s."sprintCode", dep."taskCode" as "dependsOnTaskCode"
     FROM "BacklogItem" bi
     LEFT JOIN "Sprint" s ON bi."sprintId" = s.id
     LEFT JOIN "BacklogItem" dep ON bi."dependsOnTaskId" = dep.id
     WHERE bi.id = $1`,
    taskId
  ) as {
    id: string; title: string; description: string | null;
    taskCode: string; areaId: string | null; sprintId: string | null;
    assigneeId: string | null; assigneeName: string | null; status: string;
    dependsOnTaskId: string | null; sprintCode: string | null; dependsOnTaskCode: string | null;
  }[]

  if (!task) throw new Error(`Task ${taskId} not found`)
  if (task.status === 'DONE') throw new Error(`Task ${taskId} ya está DONE`)

  const { agentId, agentName, strategy } = await resolveAgent(task)
  const agentProfile = await loadAgentProfile(agentId)

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

  const systemPrompt = agentProfile.systemPrompt
    ?? `Eres ${agentName}, agente de ArchiTechIA ejecutando una tarea del Motor Agéntico SDD.`
  const userPrompt = [
    context,
    '---',
    `Ejecuta la siguiente tarea:`,
    task.title,
    task.description ?? '',
  ].join('\n\n')

  const { apiUrl, modelId } = resolveOpenCodeModel(agentProfile.llmModel)

  // Para tareas CODE dentro de un sprint: aislar la ejecucion en su propio
  // git worktree/branch, ramificado de la rama de integracion del sprint (o
  // de la rama de la tarea de la que depende, si ya existe — asi ve sus
  // archivos reales, no solo su resultado en texto). El worker escribe ahi,
  // nunca en el working tree principal donde corre el servidor en vivo.
  let repoPath: string | undefined
  if (strategy === 'CODE' && task.sprintCode) {
    const { branch: sprintBranch } = await ensureSprintIntegrationBranch(task.sprintCode)
    let baseRef = sprintBranch
    if (task.dependsOnTaskCode) {
      const depBranch = taskBranchName(task.dependsOnTaskCode)
      const depWtStillExists = fs.existsSync(computeTaskWorktreePath(task.dependsOnTaskCode))
      // Si el worktree de la dependencia ya no existe, es porque cerro y se
      // mergeo al sprint branch (commitAndMergeTask lo borra al mergear) —
      // en ese caso alcanza con ramificar del sprint branch, que ya tiene
      // sus cambios.
      baseRef = depWtStillExists ? depBranch : sprintBranch
    }
    const { worktreePath } = await createTaskWorktree(task.taskCode, baseRef)
    repoPath = worktreePath
  }

  // Empuja la tarea al Harness (cola con concurrencia limitada por N workers,
  // reintentos y dead-letter queue) en vez de ejecutar directo aqui.
  try {
    await fetch(`${HARNESS_API_URL}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'masd_task',
        agent: agentProfile.slug ?? agentName.toLowerCase(),
        priority: 'MEDIUM',
        payload: {
          taskId,
          execId: exec_.id,
          strategy,
          apiUrl,
          modelId,
          systemPrompt,
          userPrompt,
          contextPreview: context.substring(0, 4000),
          repoPath,
        },
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err) {
    console.error(`[DISPATCH] No se pudo encolar en el Harness para ${taskId}:`, err)
    // Revertir estado si ni siquiera se pudo encolar
    await prisma.$executeRawUnsafe(`UPDATE "BacklogItem" SET status='BACKLOG' WHERE id=$1`, taskId)
    await prisma.$executeRawUnsafe(
      `UPDATE "TaskExecution" SET status='FAILED', "resultSummary"=$2, "finishedAt"=NOW() WHERE id=$1`,
      exec_.id, `Error encolando en Harness: ${err instanceof Error ? err.message : String(err)}`
    )
    throw err
  }

  return { taskId, taskCode: task.taskCode, agentId, agentName, strategy, started: true }
}

/**
 * Recibe el resultado ya generado (por el worker del Harness) y cierra el
 * ciclo de vida de la tarea: verificacion, actualizacion de BacklogItem,
 * y chequeo de cierre de sprint. Llamado desde /api/executor/complete.
 */
export async function finalizeExecution(opts: {
  taskId: string
  execId: string
  finalStatus: 'DONE' | 'FAILED'
  resultSummary: string
  durationMs: number
  contextUsed?: string
  toolLog?: { tool: string; args: Record<string, unknown>; resultPreview: string }[]
}) {
  const { taskId, execId, finalStatus, resultSummary, durationMs, contextUsed, toolLog } = opts

  const [task] = await prisma.$queryRawUnsafe(
    `SELECT bi.id, bi.title, bi.description, bi."sprintId", bi."taskCode", s."sprintCode"
     FROM "BacklogItem" bi LEFT JOIN "Sprint" s ON bi."sprintId" = s.id
     WHERE bi.id = $1`,
    taskId
  ) as { id: string; title: string; description: string | null; sprintId: string | null; taskCode: string; sprintCode: string | null }[]

  if (!task) throw new Error(`Task ${taskId} not found`)

  // Si esta tarea corrio en su propio worktree (CODE dentro de un sprint),
  // los chequeos reales deben correr AHI, no en REPO_ROOT — el archivo que
  // escribio el agente vive en el worktree, no en el working tree principal.
  const taskWtPath = computeTaskWorktreePath(task.taskCode)
  const usedWorktree = fs.existsSync(taskWtPath)
  const codeCheckRoot = usedWorktree ? taskWtPath : REPO_ROOT

  await prisma.$executeRawUnsafe(
    `UPDATE "TaskExecution"
     SET status=$2, "resultSummary"=$3, "finishedAt"=NOW(), "durationMs"=$4, "contextUsed"=$5
     WHERE id=$1`,
    execId, finalStatus, resultSummary, durationMs, (contextUsed ?? '').substring(0, 4000)
  )

  let verifiedStatus: string = finalStatus
  let checklist: unknown[] = []
  if (finalStatus === 'DONE') {
    // Paso 1: chequeo REAL de codigo (no opinion de un LLM). Si la tarea
    // escribio algun .ts/.tsx, se corre tsc --noEmit de verdad sobre el
    // repo. Antes de esto, "testing" de una tarea CODE era unicamente un
    // modelo leyendo el resultado y opinando — nunca se compilaba nada.
    // Si el compilador real dice que hay errores en los archivos que esta
    // tarea toco, se marca FAILED de una y no se gasta una llamada mas al
    // verificador semantico: un error de compilacion es un hecho objetivo,
    // no algo que un LLM tenga que opinar.
    const codeCheck = await runRealCodeChecks(toolLog, codeCheckRoot)
    if (codeCheck.ran && !codeCheck.passed) {
      verifiedStatus = 'FAILED'
      checklist = [{
        criterion: 'El código escrito compila (tsc --noEmit)',
        passed: false,
        reason: `Errores reales de TypeScript en los archivos que esta tarea escribió:\n${codeCheck.errors.join('\n')}`,
      }]
    } else {
      try {
        const verifierResult = await runVerifier({
          taskTitle: task.title,
          taskDescription: task.description,
          acceptanceCriteria: [], // populada desde councilPlan cuando exista
          resultSummary,
        })
        verifiedStatus = verifierResult.passed ? 'DONE' : 'FAILED'
        checklist = verifierResult.checklist
        if (codeCheck.ran) {
          checklist = [{ criterion: 'El código escrito compila (tsc --noEmit)', passed: true, reason: 'Verificado con el compilador real' }, ...checklist]
        }
      } catch (err) {
        // El verificador no debería tirar excepción (taskVerifier.ts ya
        // atrapa sus propios errores), pero si pasa algo inesperado no nos
        // quedamos en DONE por default — eso es exactamente el bug que
        // estabamos corrigiendo.
        verifiedStatus = 'FAILED'
        checklist = [{ criterion: 'Verificación', passed: false, reason: `Error inesperado del verificador: ${err instanceof Error ? err.message : String(err)} — requiere revisión manual` }]
      }
    }
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "TaskExecution" SET artifacts=$2::jsonb WHERE id=$1`,
    execId, JSON.stringify({ checklist, toolLog: toolLog ?? [] })
  )

  // Si la tarea corrio en su propio worktree: si quedo DONE, commitea y
  // mergea sus cambios a la rama de integracion del sprint (nunca a main
  // directo). Si quedo FAILED (por el verificador o por un error real de
  // compilacion), se descarta el worktree sin mergear nada — la rama de la
  // tarea queda para inspeccion manual si hace falta.
  if (usedWorktree && task.sprintCode) {
    try {
      if (verifiedStatus === 'DONE') {
        const sprintWtPath = computeSprintWorktreePath(task.sprintCode)
        await commitAndMergeTask({
          taskCode: task.taskCode,
          taskWorktreePath: taskWtPath,
          taskBranch: taskBranchName(task.taskCode),
          sprintWorktreePath: sprintWtPath,
        })
      } else {
        await discardTaskWorktree(taskWtPath)
      }
    } catch (err) {
      console.error(`[GIT] Error mergeando/descartando worktree de ${task.taskCode}:`, err)
    }
  }

  // resultSummary ya viene acotado desde el worker (6000 chars) — no hace
  // falta volver a truncarlo aca. Antes se guardaba con .substring(0,500),
  // lo que cortaba a la mitad resultados reales y completos (visto en vivo
  // con la landing de Atlas: su resumen real terminaba en un guion suelto,
  // no porque el modelo lo cortara, sino porque esta linea lo hacia).
  await prisma.$executeRawUnsafe(
    `UPDATE "BacklogItem"
     SET status=$2, "fechaFin"=NOW(), resultado=$3
     WHERE id=$1`,
    taskId, verifiedStatus, resultSummary
  )

  console.log(`[EXECUTOR] ${task.title} → ${verifiedStatus} (${Math.round(durationMs / 1000)}s)`)

  if (task.sprintId) {
    try {
      await checkSprintCompletion(task.sprintId)
    } catch (err) {
      console.error('[SPRINT_MONITOR] Error:', err)
    }
  }

  return { verifiedStatus }
}
