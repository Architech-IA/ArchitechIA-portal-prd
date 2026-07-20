import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { id } = await params
  const { resultado } = await request.json()

  const item = await prisma.backlogItem.update({
    where: { id },
    data: { resultado: resultado ?? null },
  })
  return NextResponse.json({ ok: true, resultado: item.resultado })
}
