import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const { title, description, type, priority, status, points, projectId, assigneeId, assigneeName } = body

  const item = await prisma.backlogItem.update({
    where: { id },
    data: {
      title, description: description || null, type, priority, status,
      points: points ? Number(points) : null,
      // Solo actualiza el proyecto si viene en el body (no lo borra por accidente).
      ...(projectId !== undefined ? { projectId: projectId || null } : {}),
      assigneeId: assigneeId || null, assigneeName: assigneeName || null,
    },
    include: { project: { select: { id: true, name: true } } },
  })
  return NextResponse.json(item)
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  await prisma.backlogItem.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
