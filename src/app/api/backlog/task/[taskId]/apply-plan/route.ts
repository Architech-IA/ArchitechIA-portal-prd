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

  const planText = plan.planJson ? JSON.stringify(plan.planJson, null, 2) : (plan.resultado ?? '')

  try {
    const result = await dispatchTask(taskId, planText)
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
