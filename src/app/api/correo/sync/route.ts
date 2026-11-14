import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sesionCorreo } from '@/lib/correo/sesion';
import { clasificarPendientes } from '@/lib/correo/servicio';
import { syncMicrosoftMessages } from '@/lib/microsoftGraph';

/** Trae el correo nuevo del buzón conectado del usuario y clasifica lo pendiente. Solo lectura. */
export async function POST(req: NextRequest) {
  const s = await sesionCorreo(req);
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const u = await prisma.user.findUnique({ where: { id: s.userId }, select: { microsoftAccessToken: true } });
  let sincronizados = 0;
  let aviso: string | null = null;
  if (u?.microsoftAccessToken) {
    try {
      const st = await syncMicrosoftMessages(s.userId);
      sincronizados = st.created + st.updated;
    } catch (e) {
      aviso = 'No se pudo leer el buzón de Microsoft: ' + (e instanceof Error ? e.message : 'error desconocido');
    }
  } else {
    aviso = 'Todavía no hay un buzón conectado. Conecta uno en Perfil.';
  }
  const c = await clasificarPendientes(s.userId);
  return NextResponse.json({ sincronizados, ...c, aviso });
}
