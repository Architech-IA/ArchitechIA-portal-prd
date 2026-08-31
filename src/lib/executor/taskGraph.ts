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
})

async function waitForTaskCompletion(taskId: string): Promise<{ status: string; resultado: string | null }> {
  const start = Date.now()
  while (Date.now() - start < MAX_WAIT_MS) {
    const [row] = await prisma.$queryRawUnsafe(
      `SELECT status, resultado FROM "BacklogItem" WHERE id = $1`, taskId
    ) as { status: string; resultado: string | null }[]
    if (row.status === 'DONE' || row.status === 'FAILED') return row
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  throw new Error(`Timeout esperando el cierre de la tarea ${taskId} (>${MAX_WAIT_MS}ms)`)
}

function makeTaskNode(taskId: string) {
  return async () => {
    await dispatchTask(taskId)
    const { status, resultado } = await waitForTaskCompletion(taskId)
    if (status !== 'DONE') {
      throw new Error(`Tarea ${taskId} terminó en ${status}, no se puede continuar la cadena`)
    }
    return { results: { [taskId]: resultado ?? '' } }
  }
}

/**
 * Corre un grafo lineal de tareas: taskIds[0] -> taskIds[1] -> ... -> taskIds[n].
 * Cada nodo dispara la tarea real via dispatchTask() (el mismo camino que usa
 * el endpoint de produccion /api/executor/dispatch), espera su cierre real en
 * la base, y deja su resultado en el estado compartido del grafo.
 *
 * El feed-forward del CONTENIDO real entre tareas lo hace buildTaskContext
 * automaticamente via BacklogItem.dependsOnTaskId — cada taskId de la cadena
 * (salvo el primero) debe tener su dependsOnTaskId seteado al anterior antes
 * de llamar a esto. El grafo solo decide el ORDEN y espera cada cierre real;
 * no vuelve a pasar el contenido a mano como se hizo en la prueba manual.
 */
export async function runTaskChain(taskIds: string[]): Promise<Record<string, string>> {
  if (taskIds.length === 0) return {}

  const builder = new StateGraph(GraphState)
  for (const id of taskIds) {
    builder.addNode(id, makeTaskNode(id))
  }
  builder.addEdge(START, taskIds[0] as never)
  for (let i = 0; i < taskIds.length - 1; i++) {
    builder.addEdge(taskIds[i] as never, taskIds[i + 1] as never)
  }
  builder.addEdge(taskIds[taskIds.length - 1] as never, END)

  const checkpointer = await getCheckpointer()
  const graph = builder.compile({ checkpointer })
  const finalState = await graph.invoke({}, { configurable: { thread_id: `chain-${taskIds[0]}` } })
  return finalState.results
}
