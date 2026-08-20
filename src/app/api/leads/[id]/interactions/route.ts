import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const activities = await prisma.activity.findMany({
    where: { leadId: id, type: { in: ['CALL', 'EMAIL', 'MEETING', 'WHATSAPP'] } },
    include: {
      user: { select: { name: true } },
      meeting: { select: { id: true, title: true, type: true, status: true, date: true, endDate: true, link: true, attendees: true, location: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(activities)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { type, description, date, meetingId } = await req.json()

  const user = await prisma.user.findUnique({ where: { email: session.user.email! } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // If linking a meeting, derive description and date from the meeting
  let resolvedDescription = description
  let resolvedDate = date ? new Date(date) : new Date()
  if (meetingId) {
    const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } })
    if (meeting) {
      resolvedDescription = resolvedDescription || meeting.title
      resolvedDate = meeting.date
    }
  }

  const activity = await prisma.activity.create({
    data: {
      type: type || 'MEETING',
      description: resolvedDescription,
      entityType: 'lead',
      entityId: id,
      userId: user.id,
      leadId: id,
      date: resolvedDate,
      ...(meetingId ? { meetingId } : {}),
    },
    include: {
      user: { select: { name: true } },
      meeting: { select: { id: true, title: true, type: true, status: true, date: true, endDate: true, link: true, attendees: true, location: true } },
    },
  })
  return NextResponse.json(activity)
}
