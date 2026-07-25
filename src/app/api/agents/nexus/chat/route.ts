import { NextRequest, NextResponse } from 'next/server';
import { isAuthed } from '@/lib/apiAuth';

const NEXUS = { port: 8642, key: 'nexus-portal-key-a1b2c3d4e5f6' };

export async function POST(request: NextRequest) {
  if (!await isAuthed(request)) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const body = await request.json();
  const { message, sessionId, model } = body;
  if (!message) return NextResponse.json({ error: 'message requerido' }, { status: 400 });

  const host = process.env.HERMES_HOST ?? '172.16.0.1';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${NEXUS.key}`,
  };
  if (sessionId) headers['X-Hermes-Session-Id'] = sessionId;

  const upstream = await fetch(`http://${host}:${NEXUS.port}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || 'kimi-k2.5',
      messages: [{ role: 'user', content: message }],
      stream: true,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json({ error: text }, { status: upstream.status });
  }

  const outSessionId = upstream.headers.get('X-Hermes-Session-Id') ?? sessionId ?? null;
  const responseHeaders: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };
  if (outSessionId) responseHeaders['X-Hermes-Session-Id'] = outSessionId;

  return new Response(upstream.body, { headers: responseHeaders });
}
