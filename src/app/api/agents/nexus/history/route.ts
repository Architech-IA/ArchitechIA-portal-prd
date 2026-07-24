import { NextRequest, NextResponse } from 'next/server';
import { isAuthed } from '@/lib/apiAuth';

const NEXUS = { port: 8642, key: 'nexus-portal-key-a1b2c3d4e5f6' };

export async function GET(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  const res = await fetch(`http://172.16.0.1:${NEXUS.port}/api/sessions`, {
    headers: { 'Authorization': `Bearer ${NEXUS.key}` },
  });
  if (!res.ok) return NextResponse.json({ sessions: [] });
  const data = await res.json();

  if (sessionId) {
    const msgRes = await fetch(`http://172.16.0.1:${NEXUS.port}/api/sessions/${sessionId}/messages`, {
      headers: { 'Authorization': `Bearer ${NEXUS.key}` },
    });
    if (!msgRes.ok) return NextResponse.json({ messages: [] });
    const msgData = await msgRes.json(); return NextResponse.json({ messages: msgData.data ?? [] });
  }

  return NextResponse.json({ sessions: data.data ?? [] });
}
