import { StateGraph, Annotation, START, END } from '@langchain/langgraph'
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'
import { prisma } from '@/lib/prisma'
import { dispatchTask } from '@/lib/executor/taskDispatcher'

const POLL_INTERVAL_MS = 3000
const MAX_WAIT_MS = 10 * 60 * 1000 // techo duro por nodo: 10 min esperando el cierre real de una tarea

// DIRECT_URL (puerto 5432, sin pgbouncer) en vez de DATABASE_URL: el
// checkpointer corre su propio setup() con DDL y maneja su propio pool de
// conexiones — el pooler en modo transaccion (pgbouncer=true de DATABASE_URL)
// no es un buen fit para eso. Mismo Postgres, sin infraestructura nueva.
let checkpointerReady: Promise<PostgresSaver> | null = null
function getCheckpointer(): Promise<PostgresSaver> {
  if (!checkpointerReady) {
    checkpointerReady = (async () => {
      const conn = process.env.DIRECT_URL ?? process.env.DATABASE_URL!
      const saver = PostgresSaver.fromConnString(conn, { schema: 'langgraph' })
      await saver.setup()
      return saver
    })()
  }
  return checkpointerReady
}

const GraphState = Annotation.Root({
  results: Annotation<Record<string, string>>({
    reducer: (a, b) => ({ ...a, ...b }),
    default: () => ({}),
  }),
  // BUG REAL encontrado corriendo esto por primera vez con un plan real de
  // 17 tasks: antes, un nodo que no llegaba a DONE TIRABA una excepcion, y
  // eso rechazaba TODA la invocacion del grafo — incluso ramas totalmente
  // independientes (ej. la rama de marketing fallando frenaba en seco la
  // rama de desarrollo, que seguia corriendo de fondo en el worker pero
  // quedaba huerfana, sin que nadie disparara despues lo que dependia de
  // ella). Ahora un nodo que no llega a DONE marca su id aca en vez de
  // tirar, y sus HIJOS lo consultan para saltearse en cascada — pero las
  // ramas que no comparten ancestro con la que fallo siguen su curso normal.
  failed: Annotation<Record<string, boolean>>({
    reducer: (a, b) => ({ ...a, ...b }),
    default: () => ({}),
  }),
})

// DONE/FAILED/BLOCKED son los 3 estados terminales reales de una tarea (ver
// finalizeExecution en taskDispatcher.ts) — BLOCKED es el que usa el fix de
// conflictos de merge de esta misma sesion para "requiere intervencion
// humana". Sin tratarlo como terminal aca, una tarea BLOCKED hacia que esta
// funcion quedara poleando en vano hasta el timeout de 10 minutos en vez de
// cortar la cadena de inmediato con un error claro.
const TERMINAL_STATUSES = new Set(['DONE', 'FAILED', 'BLOCKED'])

async function waitForTaskCompletion(taskId: string): Promise<{ status: string; resultado: string | null }> {
  const start = Date.now()
  while (Date.now() - start < MAX_WAIT_MS) {
    const [row] = await prisma.$queryRawUnsafe(
      `SELECT status, resultado FROM "BacklogItem" WHERE id = $1`, taskId
    ) as { status: string; resultado: string | null }[]
    if (TERMINAL_STATUSES.has(row.status)) return row
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  throw new Error(`Timeout esperando el cierre de la tarea ${taskId} (>${MAX_WAIT_MS}ms)`)
}

// parentId es el UNICO padre de esta tarea DENTRO del conjunto que se esta
// corriendo (dependsOnTaskId es siempre un solo id) — null si es una raiz.
function makeTaskNode(taskId: string, parentId: string | null) {
  return async (state: { failed: Record<string, boolean> }) => {
    if (parentId && state.failed[parentId]) {
      // El padre de esta tarea no llego a DONE — no tiene sentido
      // dispatchearla. Se propaga el fallo (sus propios hijos, si tiene,
      // tambien se van a saltear en cascada), pero SIN tirar una excepcion
      // que frene otras ramas del grafo que no comparten este ancestro.
      //
      // BUG REAL encontrado probando esto con el plan completo: este
      // "saltear en cascada" solo vivia en el estado en memoria del grafo —
      // la BacklogItem de la tarea saltada se quedaba en BACKLOG para
      // siempre, indistinguible en el tablero de "nunca se intento". Se deja
      // en BLOCKED con el motivo explicito, visible para quien mire el
      // Backlog.
      await prisma.$executeRawUnsafe(
        `UPDATE "BacklogItem" SET status = 'BLOCKED', resultado = $2 WHERE id = $1 AND status = 'BACKLOG'`,
        taskId,
        `No se ejecutó: depende de la tarea ${parentId}, que no llegó a DONE (falló, quedó bloqueada, o dependía a su vez de otra que falló).`
      )
      return { failed: { [taskId]: true } }
    }

    // Resumible: si esta funcion se re-corre sobre una tarea que ya quedo en
    // un estado terminal (ej. re-disparar el mismo conjunto de ids despues
    // de que otra rama fallara y cortara una corrida anterior), no hay que
    // repetir el trabajo. Y si quedo IN_PROGRESS de una corrida anterior que
    // alcanzo a dispatchearla pero el grafo se corto antes de esperar su
    // cierre, hay que esperarla — nunca volver a llamar a dispatchTask()
    // sobre algo que ya tiene un worktree/branch o una llamada al LLM en
    // curso, eso duplicaria el trabajo.
    const [current] = await prisma.$queryRawUnsafe(
      `SELECT status, resultado FROM "BacklogItem" WHERE id = $1`, taskId
    ) as { status: string; resultado: string | null }[]

    if (current.status === 'DONE') {
      return { results: { [taskId]: current.resultado ?? '' } }
    }
    if (current.status === 'FAILED' || current.status === 'BLOCKED') {
      return { failed: { [taskId]: true } }
    }
    if (current.status === 'BACKLOG') {
      await dispatchTask(taskId)
    }

    const { status, resultado } = await waitForTaskCompletion(taskId)
    if (status !== 'DONE') {
      return { failed: { [taskId]: true } }
    }
    return { results: { [taskId]: resultado ?? '' } }
  }
}

/**
 * Corre el grafo REAL de dependencias de un conjunto de tareas — no asume
 * una cadena lineal por el orden del array, lo arma leyendo el
 * dependsOnTaskId real de cada una en la base:
 *   - una tarea sin dependsOnTaskId (o cuyo dependsOnTaskId apunta a algo
 *     fuera de este conjunto, ej. una tarea de un sprint anterior ya
 *     cerrado) arranca desde START — puede haber varias en paralelo (ramas
 *     independientes del plan, ej. la rama de dev y la de marketing).
 *   - una tarea cuyo dependsOnTaskId SI esta en el conjunto espera a que esa
 *     tarea padre termine.
 *   - una tarea de la que ninguna otra del conjunto depende es una hoja y
 *     cierra hacia END.
 * Cada nodo dispara la tarea real via dispatchTask() (el mismo camino que usa
 * el endpoint de produccion /api/executor/dispatch), espera su cierre real en
 * la base, y deja su resultado en el estado compartido del grafo.
 *
 * El feed-forward del CONTENIDO real entre tareas lo hace buildTaskContext
 * automaticamente via BacklogItem.dependsOnTaskId — este grafo solo decide
 * el ORDEN/paralelismo y espera cada cierre real; no vuelve a pasar el
 * contenido a mano.
 */
export async function runTaskChain(taskIds: string[]): Promise<Record<string, string>> {
  if (taskIds.length === 0) return {}

  const idSet = new Set(taskIds)
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, "dependsOnTaskId" FROM "BacklogItem" WHERE id = ANY($1::text[])`,
    taskIds
  ) as { id: string; dependsOnTaskId: string | null }[]
  const dependsOn = new Map(rows.map((r) => [r.id, r.dependsOnTaskId]))

  const childrenOf = new Map<string, string[]>()
  const roots: string[] = []
  for (const id of taskIds) {
    const parent = dependsOn.get(id) ?? null
    if (parent && idSet.has(parent)) {
      if (!childrenOf.has(parent)) childrenOf.set(parent, [])
      childrenOf.get(parent)!.push(id)
    } else {
      roots.push(id)
    }
  }
  const hasChildren = new Set(childrenOf.keys())
  const leaves = taskIds.filter((id) => !hasChildren.has(id))

  const builder = new StateGraph(GraphState)
  for (const id of taskIds) {
    const parent = dependsOn.get(id) ?? null
    builder.addNode(id, makeTaskNode(id, parent && idSet.has(parent) ? parent : null))
  }
  for (const id of roots) builder.addEdge(START, id as never)
  for (const [parent, children] of childrenOf) {
    for (const child of children) builder.addEdge(parent as never, child as never)
  }
  for (const id of leaves) builder.addEdge(id as never, END)

  // BUG REAL encontrado en produccion reintentando un plan real de 3 tasks
  // encadenadas: el thread_id era estable (derivado solo de taskIds[0]), asi
  // que CADA re-invocacion de runTaskChain sobre el mismo conjunto de ids
  // reusaba el checkpoint guardado en Postgres de la corrida ANTERIOR — el
  // grafo "recordaba" que un nodo ya habia resuelto en failed (ej. porque su
  // padre habia fallado la primera vez) y nunca volvia a evaluarlo, aunque
  // la resumibilidad que agregamos en makeTaskNode (chequear el status REAL
  // en la base antes de decidir que hacer) sea correcta — nunca llegaba a
  // ejecutarse porque LangGraph ni siquiera volvia a correr ese nodo. Visto
  // en vivo: tras arreglar y re-dispatchear la tarea padre a DONE, la tarea
  // hija seguia quedando BLOCKED de la corrida vieja en vez de re-intentar.
  // Fix: thread_id unico por invocacion (no por conjunto de tasks), asi cada
  // llamada arranca el grafo de cero y la UNICA fuente de verdad sobre el
  // estado de cada tarea es la base de datos real (que es exactamente lo que
  // makeTaskNode ya chequea) — el checkpointer solo sirve para sobrevivir un
  // crash DENTRO de una misma invocacion, no para "recordar" entre llamadas.
  const checkpointer = await getCheckpointer()
  const graph = builder.compile({ checkpointer })
  const threadId = `chain-${taskIds[0]}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const finalState = await graph.invoke({}, { configurable: { thread_id: threadId } })
  return finalState.results
}
