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
    // Evitar duplicados: si ya existe un Cliente con Lead asociado, saltar
    let cliente = await prisma.cliente.findFirst({
      where: { nombre: { equals: place.name, mode: 'insensitive' } },
    })

    if (cliente) {
      const existingLead = await prisma.lead.findFirst({ where: { clienteId: cliente.id } })
      if (existingLead) {
        skipped.push(place.name)
        continue
      }
    }

    if (!cliente) {
      // Detectar industria desde los tipos de Google Places
      const types: string[] = place.types ?? []
      const industria = types
        .filter((t: string) => !['establishment', 'point_of_interest', 'food'].includes(t))
        .slice(0, 1)
        .map((t: string) => t.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()))
        .join('') || 'Sin clasificar'

      cliente = await prisma.cliente.create({
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
    }

    // Crear el Lead vinculado (nunca un Cliente huerfano sin Lead)
    const lead = await prisma.lead.create({
      data: {
        companyName: place.name,
        contactName: '',
        email: cliente.email || '',
        phone: place.phone || null,
        status: 'NEW',
        source: 'Prospecting',
        estimatedValue: 0,
        userId: token.id as string,
        clienteId: cliente.id,
      },
    })

    created.push(lead.companyName)
  }

  return NextResponse.json({
    created: created.length,
    skipped: skipped.length,
    skippedNames: skipped,
  })
}
