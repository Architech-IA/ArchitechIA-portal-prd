import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

const INTERNO_NAME = 'ArchiTechIA — Interno'

/**
 * Garantiza que exista el proyecto "Interno" (para tareas que no son de un
 * proyecto de cliente) y reasigna ahí cualquier tarea huérfana. Se ejecuta de
 * forma perezosa en el GET: tras la primera corrida, el updateMany afecta 0
 * filas, así que el costo es mínimo. Devuelve el id del proyecto Interno.
 */
async function ensureInternoAndBackfill(): Promise<string> {
  let interno = await prisma.project.findFirst({
    where: { name: INTERNO_NAME },
    select: { id: true },
  })
  if (!interno) {
    interno = await prisma.project.create({
      data: {
        name: INTERNO_NAME,
        description:
          'Tareas internas no asociadas a un proyecto de cliente (administración, marketing, mejoras del portal, etc.).',
      },
      select: { id: true },
    })
  }
  await prisma.backlogItem.updateMany({
    where: { projectId: null },
    data: { projectId: interno.id },
  })
  return interno.id
}

export async function GET() {
  await ensureInternoAndBackfill()

  const items = await prisma.backlogItem.findMany({
    include: {
      project: { select: { id: true, name: true } },
      solucion: { select: { id: true, nombre: true, tipo: true } },
      sprint: { select: { id: true, sprintCode: true, name: true } },
    },
    orderBy: [{ status: 'asc' }, { priority: 'asc' }, { order: 'asc' }],
  })
  return NextResponse.json(items)
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { title, description, type, priority, status, points, projectId, solucionId, assigneeId, assigneeName, sprintId } = body

  if (!solucionId) {
    return NextResponse.json({ error: 'La solución asociada es obligatoria' }, { status: 400 })
  }

  // El proyecto es obligatorio: si no llega, se asigna al proyecto Interno.
  const resolvedProjectId = projectId || (await ensureInternoAndBackfill())

  // Auto-generate taskCode if assigning to a sprint
  let taskCode: string | null = null
  if (sprintId) {
    const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, select: { sprintCode: true } })
    const count = await prisma.backlogItem.count({ where: { sprintId } })
    taskCode = sprint?.sprintCode ? `${sprint.sprintCode}-T${count + 1}` : null
  }

  const item = await prisma.backlogItem.create({
    data: {
      title,
      description: description || null,
      type,
      priority,
      status: status || 'BACKLOG',
      points: points ? Number(points) : null,
      projectId: resolvedProjectId,
      solucionId,
      assigneeId: assigneeId || null,
      assigneeName: assigneeName || null,
      sprintId: sprintId || null,
      taskCode,
    },
    include: {
      project: { select: { id: true, name: true } },
      solucion: { select: { id: true, nombre: true, tipo: true } },
      sprint: { select: { id: true, sprintCode: true, name: true } },
    },
  })
  return NextResponse.json(item)
}
