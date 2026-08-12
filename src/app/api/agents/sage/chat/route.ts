import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await request.json()
  const { message, sessionId } = body
  if (!message) return NextResponse.json({ error: 'message requerido' }, { status: 400 })

  // Resolve userId for persistent identity
  const user = await prisma.user.findFirst({ where: { email: { not: undefined } }, select: { id: true } })
  const channelId = sessionId ?? user?.id ?? 'hub-anonymous'

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3003'
  const upstream = await fetch(`${baseUrl}/api/orion/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: request.headers.get('cookie') ?? '' },
    body: JSON.stringify({ message, channelType: 'hub', channelId, stream: true }),
  })

  if (!upstream.ok) {
    return NextResponse.json({ error: await upstream.text() }, { status: upstream.status })
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
