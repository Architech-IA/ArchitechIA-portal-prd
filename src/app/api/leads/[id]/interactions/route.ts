import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const activities = await prisma.activity.findMany({
    where: { leadId: id, type: { in: ['CALL', 'EMAIL', 'MEETING', 'WHATSAPP'] } },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(activities)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { type, description, date } = await req.json()

  const user = await prisma.user.findUnique({ where: { email: session.user.email! } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const activity = await prisma.activity.create({
    data: {
      type,
      description,
      entityType: 'lead',
      entityId: id,
      userId: user.id,
      leadId: id,
      date: date ? new Date(date) : new Date(),
    },
    include: { user: { select: { name: true } } },
  })
  return NextResponse.json(activity)
}
