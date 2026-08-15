import { NextRequest, NextResponse } from 'next/server'
import { isAuthed } from '@/lib/apiAuth'

export async function POST(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const { message, sessionId } = body
  if (!message?.trim()) return NextResponse.json({ error: 'message requerido' }, { status: 400 })

  // Usar el userId del token de sesión para persistencia correcta por usuario
  const { getToken } = await import('next-auth/jwt')
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  const channelId = sessionId ?? (token?.sub as string | undefined) ?? (token?.id as string | undefined) ?? 'oficina-anonymous'

  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3003'
  const upstream = await fetch(`${baseUrl}/api/orion/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: request.headers.get('cookie') ?? '' },
    body: JSON.stringify({ message: message.trim(), channelType: 'hub', channelId, stream: false }),
  })

  if (!upstream.ok) {
    return NextResponse.json({ error: await upstream.text() }, { status: upstream.status })
  }

  const data = await upstream.json()
  return NextResponse.json({ reply: data.reply })
}
