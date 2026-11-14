import { NextRequest, NextResponse } from 'next/server';
import { isAuthed } from '@/lib/apiAuth';

// Transcribe un audio corto (indicaciones dictadas al Agente Documentador) con el
// Whisper del propio servidor. El audio no sale a ningún servicio externo.
const WHISPER_URL = 'http://localhost:9200';
const MAX_BYTES = 6 * 1024 * 1024;

export async function POST(request: NextRequest) {
  if (!(await isAuthed(request))) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('audio');
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'No llegó ningún audio' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'El audio es demasiado largo' }, { status: 413 });

  const fd = new FormData();
  fd.append('file', file, file.name || 'audio.webm');
  fd.append('model', 'Systran/faster-whisper-small');
  fd.append('language', 'es');
  fd.append('response_format', 'json');
  try {
    const res = await fetch(`${WHISPER_URL}/v1/audio/transcriptions`, { method: 'POST', body: fd, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) return NextResponse.json({ error: 'No se pudo transcribir el audio' }, { status: 502 });
    const d = await res.json() as { text?: string };
    const texto = (d.text || '').trim();
    if (!texto) return NextResponse.json({ error: 'No se entendió el audio; inténtalo de nuevo' }, { status: 422 });
    return NextResponse.json({ texto });
  } catch {
    return NextResponse.json({ error: 'El servicio de transcripción no respondió' }, { status: 502 });
  }
}
