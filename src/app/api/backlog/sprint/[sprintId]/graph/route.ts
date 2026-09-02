import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Datos para la "Sala de Control" (src/app/(portal)/control/[sprintId]/page.tsx):
// el sprint + todas sus tasks con su dependsOnTaskId real, la duracion de
// ejecucion si ya corrio, y el nombre del agente — todo lo que hace falta
// para dibujar el grafo de dependencias del motor MASD (mismo grafo que
// arma taskGraph.ts para la orquestacion real) y colorearlo por estado.
export async function GET(req: NextRequest, { params }: { params: Promise<{ sprintId: string }> }) {
  const { sprintId } = await params

  const [sprint] = await prisma.$queryRawUnsafe<{
    id: string; name: string; goal: string | null; sprintCode: string | null; status: string;
    epicName: string | null; solucionNombre: string | null;
  }[]>(
    `SELECT s.id, s.name, s.goal, s."sprintCode", s.status,
            e.name as "epicName", sol.nombre as "solucionNombre"
     FROM "Sprint" s
     LEFT JOIN "Epic" e ON s."epicId" = e.id
     LEFT JOIN "Solucion" sol ON s."solucionId" = sol.id
     WHERE s.id = $1`,
    sprintId
  )
  if (!sprint) return NextResponse.json({ error: 'Sprint no encontrado' }, { status: 404 })

  const tasks = await prisma.$queryRawUnsafe<{
    id: string; taskCode: string | null; title: string; status: string;
    assigneeName: string | null; dependsOnTaskId: string | null;
    execId: string | null; startedAt: Date | null; finishedAt: Date | null;
  }[]>(
    `SELECT bi.id, bi."taskCode", bi.title, bi.status, bi."assigneeName", bi."dependsOnTaskId",
            te.id as "execId", te."startedAt", te."finishedAt"
     FROM "BacklogItem" bi
     LEFT JOIN LATERAL (
       SELECT id, "startedAt", "finishedAt" FROM "TaskExecution"
       WHERE "backlogItemId" = bi.id ORDER BY "startedAt" DESC LIMIT 1
     ) te ON true
     WHERE bi."sprintId" = $1
     ORDER BY bi."createdAt" ASC`,
    sprintId
  )

  return NextResponse.json({
    sprint: {
      id: sprint.id,
      name: sprint.name,
      goal: sprint.goal,
      sprintCode: sprint.sprintCode,
      status: sprint.status,
      epicName: sprint.epicName,
      solucionNombre: sprint.solucionNombre,
    },
    tasks: tasks.map((t) => ({
      id: t.id,
      taskCode: t.taskCode,
      title: t.title,
      status: t.status,
      assigneeName: t.assigneeName,
      dependsOnTaskId: t.dependsOnTaskId,
      execId: t.execId,
      startedAt: t.startedAt,
      finishedAt: t.finishedAt,
    })),
  })
}
