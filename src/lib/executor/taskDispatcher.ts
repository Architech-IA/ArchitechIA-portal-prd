import { prisma } from '@/lib/prisma'
import { buildTaskContext } from '@/lib/context/buildTaskContext'
import { runVerifier } from '@/lib/executor/taskVerifier'
import { runRealCodeChecks } from '@/lib/executor/realChecks'
import { checkSprintCompletion } from '@/lib/executor/sprintMonitor'
import { resolveRepoConfig } from '@/lib/executor/repoConfig'
import { emitTraceEvent } from '@/lib/executor/traceEvents'
import fs from 'fs'
import {
  ensureSprintIntegrationBranch, createTaskWorktree, commitAndMergeTask,
  discardTaskWorktree, taskWorktreePath as computeTaskWorktreePath,
  sprintWorktreePath as computeSprintWorktreePath, taskBranchName,
  MergeConflictError,
} from '@/lib/executor/gitWorktree'

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

export async function dispatchTask(taskId: string, extraGuidance?: string): Promise<DispatchResult> {
  const [task] = await prisma.$queryRawUnsafe(
    `SELECT bi.id, bi.title, bi.description, bi."taskCode", bi."areaId", bi."sprintId",
            bi."assigneeId", bi."assigneeName", bi.status, bi."dependsOnTaskId", bi."solucionId",
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
    dependsOnTaskId: string | null; solucionId: string | null;
    sprintCode: string | null; dependsOnTaskCode: string | null;
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

  await emitTraceEvent(taskId, exec_.id, 'info', `tarea despachada — agente ${agentName}, estrategia ${strategy}`)

  const context = await buildTaskContext(taskId)
  await emitTraceEvent(taskId, exec_.id, 'info', `contexto armado (buildTaskContext) — ${context.length.toLocaleString('es-AR')} caracteres`)

  const systemPrompt = agentProfile.systemPrompt
    ?? `Eres ${agentName}, agente de ArchiTechIA ejecutando una tarea del Motor Agéntico SDD.`
  const userPrompt = [
    context,
    '---',
    `Ejecuta la siguiente tarea:`,
    task.title,
    task.description ?? '',
    // Guia adicional real: si esta re-ejecucion viene de "Ejecutar plan" (ver
    // /api/backlog/task/[id]/apply-plan), el plan propuesto por el mini-agente
    // de diagnostico (investigo el repo real antes de proponerlo) se inyecta
    // aca para que el agente CODE que realmente escribe el codigo lo siga en
    // vez de re-investigar todo desde cero y potencialmente llegar a otra
    // conclusion distinta a la que el usuario ya revisó y aprobó.
    extraGuidance ? `---\nPlan de remediación aprobado a seguir:\n${extraGuidance}` : '',
  ].join('\n\n')

  const { apiUrl, modelId } = resolveOpenCodeModel(agentProfile.llmModel)

  // Para tareas CODE dentro de un sprint: aislar la ejecucion en su propio
  // git worktree/branch, ramificado de la rama de integracion del sprint (o
  // de la rama de la tarea de la que depende, si ya existe — asi ve sus
  // archivos reales, no solo su resultado en texto). El worker escribe ahi,
  // nunca en el working tree principal donde corre el servidor en vivo.
  //
  // El repo LOCAL contra el que se opera ya no es siempre el del portal:
  // se resuelve segun la Solucion de la tarea (resolveRepoConfig) — si esa
  // Solucion se definio como producto/demo independiente en el Kickoff
  // (Orion pregunta este dimensionamiento, ver chat/route.ts), el repo
  // real puede ser uno recien creado/clonado aparte, y ahi es donde se crea
  // la rama de integracion del sprint y el worktree de esta tarea.
  let repoPath: string | undefined
  if (strategy === 'CODE' && task.sprintCode) {
    const { repoPath: targetRepoRoot } = await resolveRepoConfig(task.solucionId)
    const { branch: sprintBranch } = await ensureSprintIntegrationBranch(task.sprintCode, targetRepoRoot)
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
    const { worktreePath } = await createTaskWorktree(task.taskCode, baseRef, targetRepoRoot)
    repoPath = worktreePath
    await emitTraceEvent(taskId, exec_.id, 'info', `worktree creado — rama ${taskBranchName(task.taskCode)} desde ${baseRef}`)
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
    await emitTraceEvent(taskId, exec_.id, 'run', `encolada en el Harness (agente ${agentProfile.slug ?? agentName.toLowerCase()}) — esperando ejecución real`)
  } catch (err) {
    console.error(`[DISPATCH] No se pudo encolar en el Harness para ${taskId}:`, err)
    await emitTraceEvent(taskId, exec_.id, 'fail', `no se pudo encolar en el Harness: ${err instanceof Error ? err.message : String(err)}`)
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
    `SELECT bi.id, bi.title, bi.description, bi."sprintId", bi."taskCode", bi."solucionId", s."sprintCode"
     FROM "BacklogItem" bi LEFT JOIN "Sprint" s ON bi."sprintId" = s.id
     WHERE bi.id = $1`,
    taskId
  ) as { id: string; title: string; description: string | null; sprintId: string | null; taskCode: string; solucionId: string | null; sprintCode: string | null }[]

  if (!task) throw new Error(`Task ${taskId} not found`)

  // El repo LOCAL de esta tarea (portal, o uno independiente si su Solucion
  // se definio asi en el Kickoff — ver repoConfig.ts). Se resuelve una sola
  // vez acá y se reusa como fallback de codeCheckRoot y como repoRoot para
  // commitAndMergeTask/discardTaskWorktree mas abajo.
  const { repoPath: taskRepoRoot } = await resolveRepoConfig(task.solucionId)

  // Si esta tarea corrio en su propio worktree (CODE dentro de un sprint),
  // los chequeos reales deben correr AHI, no en el repo principal — el
  // archivo que escribio el agente vive en el worktree, no en el working
  // tree principal. BUG REAL encontrado probando el auto-dispatch con
  // tareas sin taskCode (cualquier BacklogItem creado fuera del flujo de
  // aprobacion del Consejo, ej. a mano desde el Backlog o via API directa):
  // computeTaskWorktreePath llamaba a path.join con null y tiraba "The
  // 'path' argument must be of type string" — esto rompia finalizeExecution
  // ENTERO para cualquier tarea sin taskCode, no solo el chequeo de codigo,
  // dejando la tarea varada en RUNNING/IN_PROGRESS para siempre (el
  // callback del worker fallaba con 500 antes de llegar a actualizar el
  // estado).
  const taskWtPath = task.taskCode ? computeTaskWorktreePath(task.taskCode) : null
  const usedWorktree = taskWtPath ? fs.existsSync(taskWtPath) : false
  const codeCheckRoot = usedWorktree && taskWtPath ? taskWtPath : taskRepoRoot

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
    if (codeCheck.ran) {
      await emitTraceEvent(taskId, execId, codeCheck.passed ? 'check' : 'fail',
        codeCheck.passed
          ? 'tsc --noEmit — 0 errores en los archivos tocados'
          : `tsc --noEmit — ${codeCheck.errors.length} error(es) real(es)`)
    }
    if (codeCheck.ran && !codeCheck.passed) {
      verifiedStatus = 'FAILED'
      checklist = [{
        criterion: 'El código escrito compila (tsc --noEmit)',
        passed: false,
        reason: `Errores reales de TypeScript en los archivos que esta tarea escribió:\n${codeCheck.errors.join('\n')}`,
      }]
    } else {
      try {
        // BUG REAL encontrado en produccion: sin esto, el verificador solo
        // veia el resumen en prosa del agente, sin saber que el codigo REAL
        // ya se escribio a disco y ya paso tsc — rechazaba resumenes
        // honestos y correctos (ej. "OAuth2 M365 — Endpoints de API") con
        // motivos como "no incluye el codigo fuente", cuando el codigo ya
        // estaba escrito y compilado en el repo real. Se le pasa la lista
        // real de archivos escritos (del toolLog, no de lo que el agente
        // DICE que escribio) y si el compilador ya confirmo que compilan.
        const filesWritten = (toolLog ?? [])
          .filter((t) => t.tool === 'write_file')
          .map((t) => (t.args as { rel_path?: string })?.rel_path)
          .filter((p): p is string => Boolean(p))

        const verifierResult = await runVerifier({
          taskTitle: task.title,
          taskDescription: task.description,
          acceptanceCriteria: [], // populada desde councilPlan cuando exista
          resultSummary,
          codeCompiled: codeCheck.ran,
          filesWritten,
        })
        verifiedStatus = verifierResult.passed ? 'DONE' : 'FAILED'
        checklist = verifierResult.checklist
        if (codeCheck.ran) {
          checklist = [{ criterion: 'El código escrito compila (tsc --noEmit)', passed: true, reason: 'Verificado con el compilador real' }, ...checklist]
        }
        await emitTraceEvent(taskId, execId, verifierResult.passed ? 'check' : 'fail',
          `verificador semántico — ${verifierResult.passed ? 'PASSED' : 'FAILED'} (${checklist.filter((c) => (c as { passed?: boolean }).passed).length}/${checklist.length} criterios)`)
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

  // resultSummary ya viene acotado desde el worker (6000 chars) — no hace
  // falta volver a truncarlo aca. Antes se guardaba con .substring(0,500),
  // lo que cortaba a la mitad resultados reales y completos (visto en vivo
  // con la landing de Atlas: su resumen real terminaba en un guion suelto,
  // no porque el modelo lo cortara, sino porque esta linea lo hacia).
  let finalResultado = resultSummary

  // Si la tarea corrio en su propio worktree: si quedo DONE, commitea y
  // mergea sus cambios a la rama de integracion del sprint (nunca a main
  // directo). Si quedo FAILED (por el verificador o por un error real de
  // compilacion), se descarta el worktree sin mergear nada.
  //
  // IMPORTANTE: si el merge tiene un CONFLICTO REAL (dos tareas del mismo
  // sprint tocaron el mismo archivo de forma incompatible), la tarea NO
  // puede quedar como DONE — seria mentir sobre el estado real: el codigo
  // paso la verificacion pero nunca llego a la rama de integracion. Se
  // marca BLOCKED (estado valido para "requiere intervencion humana", no
  // "fallo por mala calidad") con el detalle exacto de que archivos
  // chocaron y en que rama quedo el trabajo para resolverlo a mano. Antes
  // esto se tragaba en un catch silencioso y la tarea quedaba DONE aunque
  // su codigo nunca se integrara.
  if (usedWorktree && task.sprintCode && taskWtPath) {
    if (verifiedStatus === 'DONE') {
      try {
        const sprintWtPath = computeSprintWorktreePath(task.sprintCode)
        await commitAndMergeTask({
          taskCode: task.taskCode,
          taskWorktreePath: taskWtPath,
          taskBranch: taskBranchName(task.taskCode),
          sprintWorktreePath: sprintWtPath,
          repoRoot: taskRepoRoot,
        })
        await emitTraceEvent(taskId, execId, 'info', `merge a la rama de integración del sprint — sin conflictos`)
      } catch (err) {
        if (err instanceof MergeConflictError) {
          verifiedStatus = 'BLOCKED'
          await emitTraceEvent(taskId, execId, 'fail', `conflicto real de merge — archivos: ${err.conflictedFiles.join(', ') || '(sin detalle)'}`)
          finalResultado = [
            resultSummary,
            '',
            '⚠️ CONFLICTO REAL DE MERGE — el código pasó verificación pero NO se integró a la rama del sprint.',
            `Archivos en conflicto: ${err.conflictedFiles.join(', ') || '(sin detalle)'}`,
            `El trabajo quedó intacto en la rama ${err.taskBranch} — requiere resolución manual (probablemente otra tarea de este sprint tocó el mismo archivo).`,
          ].join('\n')
        } else {
          console.error(`[GIT] Error inesperado mergeando worktree de ${task.taskCode}:`, err)
          verifiedStatus = 'BLOCKED'
          finalResultado = [
            resultSummary,
            '',
            `⚠️ Error inesperado integrando el código a la rama del sprint: ${err instanceof Error ? err.message : String(err)} — requiere revisión manual.`,
          ].join('\n')
        }
      }
    } else {
      await discardTaskWorktree(taskWtPath, taskRepoRoot).catch((err) =>
        console.error(`[GIT] Error descartando worktree de ${task.taskCode}:`, err)
      )
      await emitTraceEvent(taskId, execId, 'info', 'worktree descartado — no se mergeó nada')
    }
  }

  await emitTraceEvent(taskId, execId, verifiedStatus === 'DONE' ? 'check' : 'fail', `estado final: ${verifiedStatus}`)

  await prisma.$executeRawUnsafe(
    `UPDATE "BacklogItem"
     SET status=$2, "fechaFin"=NOW(), resultado=$3
     WHERE id=$1`,
    taskId, verifiedStatus, finalResultado
  )

  // Alerta real en el portal para una tarea que se intento ejecutar de
  // verdad y no llego a DONE. Bug de UX real reportado por el usuario:
  // hasta ahora esto solo se veia cavando en los logs de PM2 — el motivo
  // real (ej. el agente de codigo choco con el limite de pasos de
  // herramientas) quedaba invisible en el portal, indistinguible de
  // cualquier otro tipo de fallo salvo que alguien abriera la task y
  // leyera el campo resultado. No se notifica el "saltar en cascada" por
  // dependencia fallida (eso ya queda visible como BLOCKED con motivo en
  // el tablero, y notificar cada task salteada inundaria de ruido por un
  // solo fallo real de raiz) — solo la tarea que de verdad se ejecuto y
  // no llego a DONE.
  if (verifiedStatus === 'FAILED' || verifiedStatus === 'BLOCKED') {
    const isStepLimit = resultSummary.includes('se alcanzo el limite de pasos de herramientas')
      || resultSummary.includes('se alcanzó el límite de pasos de herramientas')
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Notification" (id, "userId", type, title, message, link, "createdAt")
         VALUES (gen_random_uuid()::text, 'system', $1, $2, $3, '/backlog', NOW())`,
        isStepLimit ? 'warning' : 'error',
        isStepLimit
          ? `Agente sin terminar: ${task.title}`
          : `Tarea ${verifiedStatus === 'BLOCKED' ? 'bloqueada' : 'fallida'}: ${task.title}`,
        isStepLimit
          ? `El agente de código llegó al límite de pasos de herramientas sin terminar (${task.taskCode ?? taskId}). Puede necesitar más pasos o una tarea más chica.`
          : finalResultado.slice(0, 300),
      )
    } catch (err) {
      console.error('[EXECUTOR] No se pudo crear la notificación de fallo:', err)
    }
  }

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
