import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { places } = await request.json()
  if (!places?.length) return NextResponse.json({ error: 'No se enviaron prospectos' }, { status: 400 })

  const created = []
  const skipped = []

  for (const place of places) {
    // Evitar duplicados por nombre de empresa en Clientes
    const exists = await prisma.cliente.findFirst({
      where: { nombre: { equals: place.name } },
    })

    if (exists) {
      skipped.push(place.name)
      continue
    }

    // Detectar industria desde los tipos de Google Places
    const types: string[] = place.types ?? []
    const industria = types
      .filter((t: string) => !['establishment', 'point_of_interest', 'food'].includes(t))
      .slice(0, 1)
      .map((t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()))
      .join('') || 'Sin clasificar'

    await prisma.cliente.create({
      data: {
        nombre:     place.name,
        industria,
        contacto:   '',
        email:      place.website ? `web: ${place.website}` : '',
        pais:       'Colombia',
        estado:     'Activo',
        valorTotal: 0,
      },
    })

    created.push(place.name)
  }

  return NextResponse.json({
    created: created.length,
    skipped: skipped.length,
    skippedNames: skipped,
  })
}

