import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: proposalId } = await params
  const stage = req.nextUrl.searchParams.get('stage')
  const docId = req.nextUrl.searchParams.get('docId')

  if (docId) {
    const doc = await prisma.proposalDocument.findFirst({ where: { id: docId, proposalId } })
    if (!doc) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(doc)
  }

  const docs = await prisma.proposalDocument.findMany({
    where: { proposalId, ...(stage ? { stage } : {}) },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json(docs)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id: proposalId } = await params
  const { name, url, type, stage } = await req.json()

  if (!name || !url) return NextResponse.json({ error: 'name y url son requeridos' }, { status: 400 })

  if (url.startsWith('data:')) {
    const size = Math.round((url.length * 3) / 4)
    if (size > MAX_SIZE) return NextResponse.json({ error: 'Archivo muy grande (máx 10MB)' }, { status: 400 })
  }

  const doc = await prisma.proposalDocument.create({
    data: { proposalId, name, url, type: type || 'otro', stage: stage || null },
  })

  return NextResponse.json(doc)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: proposalId } = await params
  const { docId } = await req.json()

  await prisma.proposalDocument.deleteMany({ where: { id: docId, proposalId } })
  return NextResponse.json({ ok: true })
}
