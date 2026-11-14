import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { proponer, aplicarPropuesta, descartarPropuesta, nuevaConversacion } from '@/lib/agendador/servicio';

// Chat del Booking Agent en el portal. Requiere sesión (el proxy ya protege /api).
// { mensaje } -> propone (o responde una consulta); { propuestaId, accion: 'aplicar'|'descartar' } -> confirma.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { mensaje?: string; propuestaId?: string; accion?: string; nueva?: boolean };
  if (body.nueva) { await nuevaConversacion(userId, 'portal'); return NextResponse.json({ texto: 'Conversación reiniciada.' }); }

  if (body.propuestaId) {
    if (body.accion === 'aplicar') return NextResponse.json({ texto: await aplicarPropuesta(body.propuestaId) });
    if (body.accion === 'descartar') return NextResponse.json({ texto: await descartarPropuesta(body.propuestaId) });
    return NextResponse.json({ error: 'acción inválida' }, { status: 400 });
  }
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : '';
  if (!mensaje) return NextResponse.json({ error: 'Falta el mensaje' }, { status: 400 });
  return NextResponse.json(await proponer(mensaje, userId, 'portal'));
}
