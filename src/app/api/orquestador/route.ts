import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { orquestar } from '@/lib/orquestador/servicio';

// Sage orquestador del portal: { mensaje } -> delega al agente que corresponda. Requiere sesión.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const u = session?.user as { id?: string; name?: string | null } | undefined;
  if (!u?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { mensaje?: string };
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : '';
  if (!mensaje) return NextResponse.json({ error: 'Falta el mensaje' }, { status: 400 });
  return NextResponse.json(await orquestar(mensaje, u.id, u.name || 'el equipo'));
}
