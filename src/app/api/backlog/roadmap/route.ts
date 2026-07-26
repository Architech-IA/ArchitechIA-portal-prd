import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAuthed } from '@/lib/apiAuth'

export async function GET() {
  const roadmaps = await prisma.roadmap.findMany({
    include: {
      epics: {
        include: {
          sprints: {
            include: { _count: { select: { items: true } } },
          },
          _count: { select: { sprints: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: [{ year: 'asc' }, { createdAt: 'asc' }],
  })
  return NextResponse.json(roadmaps)
}

export async function POST(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { name, description, quarter, year, color } = await request.json()
  const roadmap = await prisma.roadmap.create({
    data: { name, description: description || null, quarter: quarter || null, year: year ? Number(year) : null, color: color || '#7F77DD' },
    include: { epics: true },
  })
  return NextResponse.json(roadmap)
}

export async function PUT(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { id, ...data } = await request.json()
  const roadmap = await prisma.roadmap.update({ where: { id }, data })
  return NextResponse.json(roadmap)
}

export async function DELETE(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
  await prisma.roadmap.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
