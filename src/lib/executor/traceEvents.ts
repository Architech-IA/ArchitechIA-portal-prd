import { prisma } from '@/lib/prisma'

export type TraceEventKind = 'info' | 'write' | 'check' | 'run' | 'fail'

/**
 * Guarda un evento de traza para la "Sala de Control" (grafo + log en vivo
 * de una task, ver src/app/(portal)/control/[sprintId]/page.tsx). Nunca
 * tira excepción: un fallo guardando el log NO puede romper la ejecución
 * real de la tarea que está narrando — es observabilidad, no parte del
 * ciclo de vida crítico.
 *
 * Se llama desde dos lugares: código TS (taskDispatcher.ts, gitWorktree.ts,
 * sprintMonitor.ts — hitos gruesos: worktree creado, code check, verificador,
 * merge, cierre de sprint) directo vía esta función, y masd_worker.py (Python,
 * proceso separado) vía POST a /api/executor/event — que internamente hace
 * el mismo INSERT.
 */
export async function emitTraceEvent(
  taskId: string,
  execId: string | null,
  kind: TraceEventKind,
  message: string
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "TaskExecutionEvent" (id, "taskId", "execId", kind, message, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())`,
      taskId, execId, kind, message
    )
  } catch (err) {
    console.error('[TRACE_EVENT] No se pudo guardar el evento de traza (no bloqueante):', err)
  }
}
