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

export async function GET() {
  const iniciativas = await prisma.iniciativa.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(iniciativas.map(i => ({ ...i, tecnologias: parseTec(i.tecnologias) })))
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json()
  const { nombre, descripcion, categoria, estado, prioridad, sector, problema, beneficios, tecnologias, costoMin, costoMax, tiempoEstimado, roiEstimado, color } = body

  if (!nombre?.trim() || !descripcion?.trim()) {
    return NextResponse.json({ error: 'Nombre y descripción son obligatorios' }, { status: 400 })
  }

  const iniciativa = await prisma.iniciativa.create({
    data: {
      nombre, descripcion, categoria: categoria || 'IA/ML', estado: estado || 'IDEA',
      prioridad: prioridad || 'MEDIA', sector: sector || null, problema: problema || null,
      beneficios: beneficios || null,
      tecnologias: JSON.stringify(Array.isArray(tecnologias) ? tecnologias : []),
      costoMin: costoMin != null && costoMin !== '' ? Number(costoMin) : null,
      costoMax: costoMax != null && costoMax !== '' ? Number(costoMax) : null,
      tiempoEstimado: tiempoEstimado?.trim() || null, roiEstimado: roiEstimado || null,
      color: color || 'from-orange-500 to-red-600',
      responsable: (token.name as string) || null,
      responsableId: (token.id as string) || null,
    },
  })
  await logActivity({
    type: 'CREATED', description: 'creó la iniciativa ' + nombre,
    entityType: 'iniciativa', entityId: iniciativa.id, userId: token.sub,
  })
  return NextResponse.json({ ...iniciativa, tecnologias: parseTec(iniciativa.tecnologias) })
}
