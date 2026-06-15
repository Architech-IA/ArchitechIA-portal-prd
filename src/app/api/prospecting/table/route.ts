import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const city     = searchParams.get('city') || undefined
  const category = searchParams.get('category') || undefined
  const converted = searchParams.get('converted')

  const results = await prisma.prospectorResult.findMany({
    where: {
      ...(city     ? { city:     { contains: city } } : {}),
      ...(category ? { category: { contains: category } } : {}),
      ...(converted !== null ? { convertedToLead: converted === 'true' } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(results)
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const tokenData = token as any
  const userId   = tokenData.sub   ?? 'unknown'
  const userName = tokenData.name  ?? tokenData.email ?? 'unknown'

  const { places, city, category } = await request.json()
  if (!places?.length) return NextResponse.json({ error: 'Sin datos' }, { status: 400 })

  let saved = 0
  let duplicates = 0

  for (const p of places) {
    try {
      await prisma.prospectorResult.upsert({
        where:  { placeId: p.placeId },
        update: { city, category, savedById: userId, savedByName: userName },
        create: {
          placeId:      p.placeId,
          name:         p.name,
          address:      p.address || null,
          phone:        p.phone   || null,
          website:      p.website || null,
          rating:       p.rating  ?? null,
          totalRatings: p.totalRatings ?? 0,
          types:        p.types?.length ? JSON.stringify(p.types) : null,
          lat:          p.lat ?? null,
          lng:          p.lng ?? null,
          city,
          category,
          savedById:   userId,
          savedByName: userName,
        },
      })
      saved++
    } catch {
      duplicates++
    }
  }

  return NextResponse.json({ saved, duplicates })
}

export async function PATCH(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id, convertedToLead } = await request.json()
  const result = await prisma.prospectorResult.update({
    where: { id },
    data:  { convertedToLead },
  })
  return NextResponse.json(result)
}

export async function DELETE(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await request.json()
  await prisma.prospectorResult.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

