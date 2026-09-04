import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { dispatchTask } from '@/lib/executor/taskDispatcher'

// "Ejecutar plan": segunda instancia del flujo Explicar → Proponer plan →
// Ejecutar. A diferencia de /plan (solo lectura), esto SÍ dispara una
// ejecución real — reusa dispatchTask (el mismo mecanismo del botón
// "Disparar" manual de la Sala de Control: worktree aislado, agente CODE
// real, verificador, merge) pasándole el plan ya revisado por el usuario
// como guía adicional, para que el agente que escribe el código siga el
// plan aprobado en vez de re-investigar desde cero y potencialmente llegar
// a otra conclusión.
export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { taskId } = await params
  const { execId } = await req.json().catch(() => ({}))
  if (!execId) return NextResponse.json({ error: 'execId requerido (el plan a ejecutar)' }, { status: 400 })

  const rows = await prisma.$queryRawUnsafe<{ status: string; resultado: string | null; planJson: unknown }[]>(
    `SELECT status, resultado, "planJson" FROM "TaskRemediationPlan" WHERE "execId" = $1 AND "taskId" = $2`,
    execId, taskId
  )
  const plan = rows[0]
  if (!plan) return NextResponse.json({ error: 'Plan no encontrado' }, { status: 404 })
  if (plan.status !== 'DONE') return NextResponse.json({ error: 'El plan todavía no está listo' }, { status: 400 })

  // Defensa en profundidad: la UI ya oculta el botón "Ejecutar plan" cuando
  // automatizable=false, pero este endpoint no puede confiar solo en eso —
  // un llamado directo (curl, otro cliente) tiene que chocar con el mismo
  // bloqueo. Si el agente investigador determinó que el plan requiere una
  // acción humana (reunión, aprobación de negocio, etc.), no tiene sentido
  // gastar una ejecución real completa que va a terminar en el mismo lugar.
  const planObj = plan.planJson as { automatizable?: boolean; motivoNoAutomatizable?: string } | null
  if (planObj && planObj.automatizable === false) {
    return NextResponse.json({
      error: `Este plan no es automatizable: ${planObj.motivoNoAutomatizable ?? 'requiere una acción humana antes de poder ejecutarse.'}`,
    }, { status: 409 })
  }

  const planText = plan.planJson ? JSON.stringify(plan.planJson, null, 2) : (plan.resultado ?? '')

  // BUG REAL identificado por el usuario: buildTaskContext() (lo que arma
  // dispatchTask para cualquier tarea) nunca trae el resultado ORIGINAL de
  // la propia tarea — solo trae el resultado de tareas hermanas y de la
  // dependencia. El agente que ejecuta el plan solo veía el resumen que el
  // investigador parafraseó, nunca el error/motivo de bloqueo crudo tal
  // cual quedó guardado. Si el plan es ambiguo en algún paso, no había forma
  // de volver al texto original para desambiguar. Se trae ese resultado
  // crudo acá y se antepone al plan en el extraGuidance.
  const [taskRow] = await prisma.$queryRawUnsafe<{ resultado: string | null; status: string }[]>(
    `SELECT resultado, status FROM "BacklogItem" WHERE id = $1`, taskId
  )
  const extraGuidance = [
    taskRow?.resultado
      ? `ERROR / MOTIVO DE BLOQUEO ORIGINAL de esta tarea (texto crudo tal cual lo guardó el motor, antes de que se propusiera el plan):\n${taskRow.resultado}`
      : null,
    planText,
  ].filter(Boolean).join('\n\n---\n\n')

  try {
    const result = await dispatchTask(taskId, extraGuidance)
    await prisma.$executeRawUnsafe(
      `UPDATE "TaskRemediationPlan" SET "appliedAt" = NOW(), "updatedAt" = NOW() WHERE "execId" = $1`,
      execId
    )
    return NextResponse.json(result, { status: 202 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
