import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO, sesionVisible } from '@/lib/proyectos/auth'
import { AREA_IDS } from '@/lib/proyectos/modelo'
import { publicarEnSesion } from '@/lib/proyectos/suscripciones'

export const dynamic = 'force-dynamic'

// Aplica el plan aprobado: crea las tareas en el backlog del proyecto (estado BACKLOG, listas para el
// despachador del Motor Agéntico) y deja constancia en la sesión.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id, sid } = await params
  const s = await sesionVisible(id, sid, u)
  if (!s) return NO_ENCONTRADO('Sesión')
  const b = await req.json().catch(() => ({})) as { tareas?: { title?: string; description?: string; priority?: string; areaSlug?: string }[]; sprintId?: string }
  const tareas = (Array.isArray(b.tareas) ? b.tareas : []).slice(0, 30)
    .map(t => ({ title: String(t.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 140), description: String(t.description ?? '').trim().slice(0, 2000), priority: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(t.priority)) ? String(t.priority) : 'MEDIUM', areaSlug: String(t.areaSlug ?? 'dev') }))
    .filter(t => t.title.length >= 4)
  if (tareas.length === 0) return NextResponse.json({ error: 'No hay tareas válidas para crear' }, { status: 400 })

  let sprintId: string | null = null
  if (b.sprintId) {
    const sp = await prisma.sprint.findFirst({ where: { id: b.sprintId, solucionId: id }, select: { id: true } })
    if (!sp) return NextResponse.json({ error: 'El sprint no pertenece a este proyecto' }, { status: 400 })
    sprintId = sp.id
  }

  const creadas = await prisma.$transaction(tareas.map(t => prisma.backlogItem.create({
    data: { title: t.title, description: t.description || null, type: 'TASK', priority: t.priority, status: 'BACKLOG', solucionId: id, sprintId, areaId: AREA_IDS[t.areaSlug] ?? AREA_IDS.dev },
    select: { id: true, title: true },
  })))
  await publicarEnSesion(sid, `✅ **Plan aplicado por ${u.nombre}:** se crearon ${creadas.length} tarea(s) en el backlog del proyecto (estado BACKLOG, sin asignar):\n${creadas.map(c => `- ${c.title}`).join('\n')}`, { origen: 'plan', tareaIds: creadas.map(c => c.id) })
  return NextResponse.json({ creadas }, { status: 201 })
}
