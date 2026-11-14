import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sesionCorreo } from '@/lib/correo/sesion';

/** Buzones conectados: el propio, o todos si es administrador. Nunca devuelve tokens. */
export async function GET(req: NextRequest) {
  const s = await sesionCorreo(req);
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const users = await prisma.user.findMany({
    where: s.admin ? {} : { id: s.userId },
    select: { id: true, name: true, email: true, microsoftAccessToken: true, microsoftAccountEmail: true, microsoftLastSyncAt: true, googleAccessToken: true },
  });
  const conteos = await prisma.externalMessage.groupBy({ by: ['userId'], where: { deletedAt: null }, _count: { _all: true } });
  const n = new Map(conteos.map((c) => [c.userId, c._count._all]));
  const cuentas = users.flatMap((u) => {
    const out: { usuario: string; proveedor: string; correo: string; ultimaSync: Date | null; mensajes: number }[] = [];
    if (u.microsoftAccessToken)
      out.push({ usuario: u.name, proveedor: 'MICROSOFT', correo: u.microsoftAccountEmail ?? u.email, ultimaSync: u.microsoftLastSyncAt, mensajes: n.get(u.id) ?? 0 });
    return out;
  });
  const microsoftConfigurado = !!process.env.MICROSOFT_CLIENT_ID;
  return NextResponse.json({ cuentas, microsoftConfigurado });
}
