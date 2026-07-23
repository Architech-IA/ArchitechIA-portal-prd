import { NextRequest, NextResponse } from 'next/server';
import { isAuthed } from '@/lib/apiAuth';

const NEXUS = { port: 8642, key: 'nexus-portal-key-a1b2c3d4e5f6' };

export async function POST(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const body = await request.json();
  const { message, sessionId } = body;
  if (!message) return NextResponse.json({ error: 'message requerido' }, { status: 400 });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${NEXUS.key}`,
  };
  if (sessionId) headers['X-Hermes-Session-Id'] = sessionId;

  const res = await fetch(`http://172.16.0.1:${NEXUS.port}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'hermes-agent',
      messages: [{ role: 'user', content: message }],
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const data = await res.json();
  const sessionIdOut = res.headers.get('X-Hermes-Session-Id') ?? sessionId ?? null;
  return NextResponse.json({
    reply: data.choices?.[0]?.message?.content ?? '',
    sessionId: sessionIdOut,
  });
}
