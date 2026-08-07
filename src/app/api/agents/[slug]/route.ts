import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const agent = await prisma.agent.findUnique({ where: { slug } })
  if (!agent) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  return NextResponse.json(agent)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = await req.json()
  const agent = await prisma.agent.update({ where: { slug }, data: body })
  return NextResponse.json(agent)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  await prisma.agent.update({ where: { slug }, data: { status: 'INACTIVE' } })
  return NextResponse.json({ ok: true })
}
