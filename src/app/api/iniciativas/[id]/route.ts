import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity'

function parseTec(value: string): string[] {
  try {
    const arr = JSON.parse(value)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { nombre, descripcion, categoria, estado, prioridad, sector, problema, beneficios, tecnologias, costoMin, costoMax, tiempoEstimado, roiEstimado, color } = body

  try {
    const iniciativa = await prisma.iniciativa.update({
      where: { id },
      data: {
        nombre, descripcion, categoria, estado, prioridad,
        sector: sector || null, problema: problema || null, beneficios: beneficios || null,
        ...(tecnologias !== undefined ? { tecnologias: JSON.stringify(Array.isArray(tecnologias) ? tecnologias : []) } : {}),
        costoMin: costoMin != null && costoMin !== '' ? Number(costoMin) : null,
        costoMax: costoMax != null && costoMax !== '' ? Number(costoMax) : null,
        tiempoEstimado: tiempoEstimado?.trim() || null, roiEstimado: roiEstimado || null,
        ...(color ? { color } : {}),
      },
    })
    if (body.estado !== undefined) {
      await logActivity({
        type: 'STATUS_CHANGED', description: 'cambió el estado de la iniciativa ' + nombre + ' a ' + estado,
        entityType: 'iniciativa', entityId: id, userId: token.sub,
      })
    } else {
      await logActivity({
        type: 'UPDATED', description: 'actualizó la iniciativa ' + nombre,
        entityType: 'iniciativa', entityId: id, userId: token.sub,
      })
    }
    return NextResponse.json({ ...iniciativa, tecnologias: parseTec(iniciativa.tecnologias) })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  const role = (token as { role?: string })?.role
  if (role !== 'SUPERADMIN') {
    return NextResponse.json(
      { error: 'Solo el Super Admin puede eliminar iniciativas. Envía una solicitud de eliminación.' },
      { status: 403 },
    )
  }

  const { id } = await params
  try {
    const iniciativa = await prisma.iniciativa.findUnique({ where: { id }, select: { nombre: true } })
    await prisma.iniciativa.delete({ where: { id } })
    await logActivity({
      type: 'UPDATED', description: 'eliminó la iniciativa ' + iniciativa?.nombre,
      entityType: 'iniciativa', entityId: id, userId: token?.sub,
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
