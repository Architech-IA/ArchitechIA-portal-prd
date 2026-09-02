import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'
import { runTaskChain } from '@/lib/executor/taskGraph'
import crypto from 'crypto'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthed(req)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id } = await params

  const [proposal] = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "CouncilProposal" WHERE id = $1`, id
  )
  if (!proposal) return NextResponse.json({ error: 'Propuesta no encontrada' }, { status: 404 })
  if (proposal.status !== 'PLAN_READY') {
    return NextResponse.json({ error: `Plan no listo (status: ${proposal.status})` }, { status: 400 })
  }

  const plan = proposal.metadata?.councilPlan
  if (!plan) return NextResponse.json({ error: 'No hay plan en metadata' }, { status: 400 })

  const created: { epics: string[]; sprints: string[]; tasks: number } = { epics: [], sprints: [], tasks: 0 }
  const allTaskIds: string[] = []

  // Mapea el "localId" que Orion le puso a cada task dentro del plan (ej.
  // "s1-t1") al id REAL del BacklogItem una vez creado — asi dependsOnLocalId
  // se puede resolver a un dependsOnTaskId de verdad. Solo puede resolver
  // dependencias hacia tasks YA creadas (el plan las procesa en orden), lo
  // cual coincide con la instruccion que se le dio a Orion de no depender de
  // tasks futuras.
  const localIdToRealId = new Map<string, string>()

  try {
    // 1. Resolve or create Solution
    // BUG REAL encontrado en produccion: Solucion.id usa @default(cuid())
    // en el schema de Prisma, pero eso es un default que aplica el CLIENTE
    // de Prisma (prisma.solucion.create()) — un INSERT con SQL crudo como
    // este no lo dispara, y el INSERT fallaba con "id" NULL (NOT NULL
    // violation) cada vez que el plan no traia un solucionId existente.
    // Se genera el id explicitamente. Tambien se corrige 'PRODUCTO' (no es
    // uno de los tipos validos: PROJECT, DEMO, PARTNERSHIP, PRODUCT) por
    // 'PRODUCT'.
    //
    // "repositorio" viene del dimensionamiento que Orion pregunta en el
    // Kickoff (chat/route.ts) y que extract/route.ts estructura: si la
    // solucion es un modulo del portal, queda 'portal-architechia'; si es
    // un producto/demo independiente, el nombre de repo sugerido. El motor
    // de dispatch (taskGraph/gitWorktree) todavia solo sabe operar contra
    // portal-architechia — este campo por ahora solo deja el dato
    // registrado para que a futuro se pueda usar para crear/desplegar en
    // un repo separado.
    let solucionId: string | null = plan.solucionId ?? null
    if (!solucionId && plan.solucionPropuesta?.name) {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO "Solucion" (id, nombre, descripcion, estado, tipo, repositorio, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'ACTIVO', 'PRODUCT', $4, NOW(), NOW())
         RETURNING id`,
        crypto.randomUUID(),
        plan.solucionPropuesta.name,
        plan.solucionPropuesta.description ?? null,
        plan.solucionPropuesta.repositorio ?? 'portal-architechia'
      )
      solucionId = rows[0]?.id ?? null
    }

    // 2. Create Epic
    let epicId: string | null = null
    if (plan.epic?.name) {
      const epicRows = await prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO "Epic" (id, name, description, status, priority, "solucionId", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, 'ACTIVE', 'HIGH', $3, NOW())
         RETURNING id`,
        plan.epic.name,
        plan.epic.description ?? null,
        solucionId
      )
      epicId = epicRows[0]?.id ?? null
      if (epicId) created.epics.push(epicId)
    }

    // 3. Create Sprints + Tasks
    for (const sp of (plan.sprints ?? [])) {
      // Resolve area
      let areaId: string | null = null
      const areaSlug: string = sp.areaSlug ?? ''
      if (areaSlug.startsWith('new:')) {
        const newSlug = areaSlug.replace('new:', '').trim().replace(/\s+/g, '-').toLowerCase()
        const existing = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id FROM "Area" WHERE slug = $1 LIMIT 1`, newSlug
        )
        if (existing[0]) {
          areaId = existing[0].id
        } else {
          const areaRows = await prisma.$queryRawUnsafe<any[]>(
            `INSERT INTO "Area" (name, slug, color) VALUES ($1, $2, '#6366f1') RETURNING id`,
            newSlug.charAt(0).toUpperCase() + newSlug.slice(1), newSlug
          )
          areaId = areaRows[0]?.id ?? null
        }
      } else if (areaSlug) {
        const areaRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id FROM "Area" WHERE slug = $1 LIMIT 1`, areaSlug
        )
        areaId = areaRows[0]?.id ?? null
      }

      // Build sprintCode
      let sprintCodeVal = 'SP'
      if (solucionId) {
        const solRows = await prisma.$queryRawUnsafe<any[]>(
          `SELECT "solucionCode" FROM "Solucion" WHERE id = $1 LIMIT 1`, solucionId
        )
        if (solRows[0]?.solucionCode) sprintCodeVal = solRows[0].solucionCode
      }
      let epicNumStr = '0000'
      if (epicId && solucionId) {
        const epicsInSol = await prisma.$queryRawUnsafe<any[]>(
          `SELECT id FROM "Epic" WHERE "solucionId" = $1 ORDER BY "createdAt" ASC`, solucionId
        )
        const idx = (epicsInSol as any[]).findIndex((e: any) => e.id === epicId) + 1
        if (idx > 0) epicNumStr = String(idx).padStart(4, '0')
      }
      const sprintCountRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(*)::int as cnt FROM "Sprint" WHERE "solucionId" = $1`, solucionId
      )
      const sprintNum = String(Number((sprintCountRows[0] as any)?.cnt ?? 0) + 1).padStart(4, '0')
      const sprintCodeFinal = `${sprintCodeVal}-${epicNumStr}-${sprintNum}`

      const sprintRows = await prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO "Sprint" (id, name, goal, status, "epicId", "solucionId", "ownerAreaId", "responsibleId", "responsibleName", "sprintCode")
         VALUES (gen_random_uuid()::text, $1, $2, 'PLANNED', $3, $4, $5, 'agent_orion_001', 'Consejo', $6)
         RETURNING id`,
        sp.name ?? 'Sprint', sp.goal ?? null, epicId, solucionId, areaId, sprintCodeFinal
      )
      const sprintId = sprintRows[0]?.id ?? null
      if (sprintId) created.sprints.push(sprintId)

      // Create Tasks
      for (const task of (sp.tasks ?? [])) {
        let taskAreaId: string | null = areaId
        const taskAreaSlug: string = task.areaSlug ?? ''
        if (taskAreaSlug && taskAreaSlug !== areaSlug) {
          if (taskAreaSlug.startsWith('new:')) {
            const newSlug = taskAreaSlug.replace('new:', '').trim().replace(/\s+/g, '-').toLowerCase()
            const existing = await prisma.$queryRawUnsafe<any[]>(
              `SELECT id FROM "Area" WHERE slug = $1 LIMIT 1`, newSlug
            )
            if (existing[0]) {
              taskAreaId = existing[0].id
            } else {
              const areaRows = await prisma.$queryRawUnsafe<any[]>(
                `INSERT INTO "Area" (name, slug, color) VALUES ($1, $2, '#6366f1') RETURNING id`,
                newSlug.charAt(0).toUpperCase() + newSlug.slice(1), newSlug
              )
              taskAreaId = areaRows[0]?.id ?? null
            }
          } else {
            const areaRows = await prisma.$queryRawUnsafe<any[]>(
              `SELECT id FROM "Area" WHERE slug = $1 LIMIT 1`, taskAreaSlug
            )
            taskAreaId = areaRows[0]?.id ?? null
          }
        }

        // Resolve agent if specified
        let agentId: string | null = null
        let agentName: string | null = null
        if (task.agentSlug && !task.agentSlug.startsWith('new:')) {
          const agentRows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, name FROM "Agent" WHERE slug = $1 LIMIT 1`, task.agentSlug
          )
          if (agentRows[0]) { agentId = agentRows[0].id; agentName = agentRows[0].name }
        }

        // Resolver dependsOnLocalId a un dependsOnTaskId real. Solo puede
        // apuntar a una task ya creada en esta misma corrida (el plan se
        // procesa en el mismo orden en que Orion lo escribio, y se le pidio
        // explicitamente que no dependiera de tasks futuras). Si el localId
        // no se encuentra (Orion se equivoco o referencio algo que no
        // existe), se ignora en vez de romper la creacion del resto del
        // backlog — mejor una tarea sin dependencia que un plan entero que
        // falla a mitad de camino.
        const dependsOnTaskId: string | null = task.dependsOnLocalId
          ? localIdToRealId.get(task.dependsOnLocalId) ?? null
          : null

        const newTaskId = crypto.randomUUID()
        await prisma.$executeRawUnsafe(
          `INSERT INTO "BacklogItem"
           (id, title, description, status, priority, type, "areaId", "sprintId", "solucionId",
            "createdByAgentId", "createdByAgentName", "assigneeId", "assigneeName", "updatedAt", "taskCode",
            "dependsOnTaskId")
           VALUES ($1,$2,$3,'BACKLOG',$4,'TASK',$5,$6,$7,'agent_orion_001','Consejo',$8,$9,NOW(),$10,$11)`,
          newTaskId,
          task.title ?? 'Task',
          task.description ?? task.rationaleArea ?? null,
          task.priority ?? 'MEDIUM',
          taskAreaId,
          sprintId,
          solucionId,
          agentId,
          agentName,
          sprintCodeFinal ? `${sprintCodeFinal}-${String(created.tasks + 1).padStart(3, '0')}` : null,
          dependsOnTaskId
        )
        if (task.localId) localIdToRealId.set(task.localId, newTaskId)
        allTaskIds.push(newTaskId)
        created.tasks++
      }
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "CouncilProposal"
       SET status = 'EXECUTING',
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           "updatedAt" = NOW()
       WHERE id = $1`,
      id,
      JSON.stringify({ executionResult: created, solucionId, epicId })
    )

    // Auto-dispatch: en vez de dejar las tasks recien creadas esperando que
    // alguien las tome a mano desde el Backlog, se disparan solas respetando
    // su grafo real de dependencias (dependsOnTaskId) via el motor MASD ya
    // existente (runTaskChain). Fire-and-forget porque un plan completo
    // puede tardar minutos/horas en ejecutarse — la respuesta HTTP de esta
    // ruta no puede esperar eso, igual que runPlanningEngine en plan/start.
    // Esto NO mergea nada a main solo: las tareas CODE se integran a la
    // rama del sprint, y recien cuando el sprint entero cierra se abre un PR
    // (openSprintPR en sprintMonitor.ts) que siempre espera revision humana.
    if (allTaskIds.length > 0) {
      runTaskChain(allTaskIds).catch((err) =>
        console.error(`[Plan/approve] Error en auto-dispatch de la propuesta ${id}:`, err)
      )
    }

    return NextResponse.json({ ok: true, created, epicId, solucionId, autoDispatched: allTaskIds.length })

  } catch (err: any) {
    console.error('[Plan/approve] Error:', err)
    return NextResponse.json({ error: err.message ?? 'Error creando backlog' }, { status: 500 })
  }
}
