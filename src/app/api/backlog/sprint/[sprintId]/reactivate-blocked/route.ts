import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { runTaskChain } from '@/lib/executor/taskGraph'

// "🔓 Reactivar bloqueadas": hoy nada detecta automáticamente que una tarea
// BLOCKED puede reintentarse porque la tarea de la que dependía finalmente
// llegó a DONE — el botón "Disparar" del sprint solo toma BACKLOG
// (backlogTaskIds filtra por eso en el frontend) y runTaskChain trata
// BLOCKED como estado terminal (makeTaskNode, taskGraph.ts:125), nunca la
// vuelve a evaluar. Esto rompe ese estancamiento: busca las BLOCKED cuya
// dependencia real ya está DONE, las resetea a BACKLOG (única forma de que
// el grafo las vuelva a considerar), y dispara el mismo motor real de
// grafo (runTaskChain) con todo el BACKLOG actualizado del sprint — así
// una cadena de varias tareas bloqueadas en cascada se resuelve sola en una
// sola llamada, no una por una a mano.
export async function POST(req: NextRequest, { params }: { params: Promise<{ sprintId: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { sprintId } = await params

  const reactivatable = await prisma.$queryRawUnsafe<{ id: string; taskCode: string | null }[]>(
    `SELECT bi.id, bi."taskCode"
     FROM "BacklogItem" bi
     JOIN "BacklogItem" dep ON bi."dependsOnTaskId" = dep.id
     WHERE bi."sprintId" = $1 AND bi.status = 'BLOCKED' AND dep.status = 'DONE'`,
    sprintId
  )

  if (reactivatable.length === 0) {
    return NextResponse.json({ reactivated: 0, dispatched: 0 })
  }

  const ids = reactivatable.map((r) => r.id)
  // resultado se limpia: tenía el motivo de bloqueo viejo ("depende de la
  // tarea X, que no llegó a DONE") — dejarlo puesto confundiría en la
  // Sala de Control a una tarea que ya está en BACKLOG de nuevo, esperando
  // su turno real.
  await prisma.$executeRawUnsafe(
    `UPDATE "BacklogItem" SET status = 'BACKLOG', resultado = NULL WHERE id = ANY($1::text[])`,
    ids
  )

  // Cascada real: si esto desbloqueó a A, y A tenía a su vez una hija B que
  // seguía BLOCKED esperando a A, B no se toca en este mismo pase (su
  // dependencia, A, todavía no está DONE — recién se va a re-ejecutar
  // ahora). El usuario tiene que volver a apretar "Reactivar bloqueadas"
  // después de que A cierre para que se detecte a B. No se resuelve en un
  // solo pase porque eso requeriría simular el resultado de A antes de que
  // exista de verdad.
  const allBacklog = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "BacklogItem" WHERE "sprintId" = $1 AND status = 'BACKLOG'`,
    sprintId
  )
  const allIds = allBacklog.map((r) => r.id)

  // Igual que el "Disparar" normal del sprint: no se espera a que termine
  // toda la cadena (puede tardar minutos) — se lanza y el avance real se ve
  // vía el polling de 5s del grafo que ya está corriendo en el frontend.
  runTaskChain(allIds).catch((err) =>
    console.error(`[REACTIVATE_BLOCKED] Error en runTaskChain para sprint ${sprintId}:`, err)
  )

  return NextResponse.json({
    reactivated: ids.length,
    taskCodes: reactivatable.map((r) => r.taskCode),
    dispatched: allIds.length,
  })
}
