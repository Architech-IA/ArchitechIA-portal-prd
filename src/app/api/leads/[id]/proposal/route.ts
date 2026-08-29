import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const proposal = await prisma.proposal.findFirst({
    where: { leadId: id },
    include: { tasks: { orderBy: { createdAt: 'asc' } }, documents: { select: { id: true, name: true, url: true, type: true, createdAt: true } }, user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(proposal)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { title, description, amount, conditions, status } = await req.json()

  const user = await prisma.user.findUnique({ where: { email: session.user.email! } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const existing = await prisma.proposal.findFirst({ where: { leadId: id } })
  let proposal
  if (existing) {
    proposal = await prisma.proposal.update({
      where: { id: existing.id },
      data: { title, description, amount: Number(amount) || 0, status: status ?? existing.status },
      include: { tasks: true, documents: { select: { id: true, name: true, url: true, type: true, createdAt: true } }, user: { select: { name: true } } },
    })
  } else {
    proposal = await prisma.proposal.create({
      data: { title, description, amount: Number(amount) || 0, leadId: id, userId: user.id },
      include: { tasks: true, documents: { select: { id: true, name: true, url: true, type: true, createdAt: true } }, user: { select: { name: true } } },
    })
  }
  return NextResponse.json(proposal)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { status } = await req.json()
  const existing = await prisma.proposal.findFirst({ where: { leadId: id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const updated = await prisma.proposal.update({
    where: { id: existing.id },
    data: { status, sentDate: status === 'SENT' ? new Date() : undefined, acceptedDate: status === 'ACCEPTED' ? new Date() : undefined },
    include: { tasks: true, documents: { select: { id: true, name: true, url: true, type: true, createdAt: true } }, user: { select: { name: true } } },
  })
  return NextResponse.json(updated)
}
