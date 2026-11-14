import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sesionCorreo } from '@/lib/correo/sesion';

export async function GET(req: NextRequest) {
  const s = await sesionCorreo(req);
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const categoria = sp.get('categoria'); // id | 'sin' | null
  const revisado = sp.get('revisado'); // 'si' | 'no' | null
  const q = (sp.get('q') ?? '').trim();
  const todos = s.admin && sp.get('todos') === '1';

  const base = { deletedAt: null, isDraft: false, ...(todos ? {} : { userId: s.userId }) };
  const where = {
    ...base,
    ...(categoria === 'sin' ? { categoriaId: null } : categoria ? { categoriaId: categoria } : {}),
    ...(revisado === 'si' ? { revisado: true } : revisado === 'no' ? { revisado: false } : {}),
    ...(q
      ? {
          OR: [
            { subject: { contains: q, mode: 'insensitive' as const } },
            { sender: { contains: q, mode: 'insensitive' as const } },
            { bodyPreview: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [mensajes, porCategoria, sinRevisar] = await Promise.all([
    prisma.externalMessage.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: 200,
      select: {
        id: true, provider: true, subject: true, sender: true, senderName: true, bodyPreview: true,
        receivedAt: true, isRead: true, importance: true, hasAttachments: true,
        categoriaId: true, categoriaOrigen: true, confianza: true, motivo: true, revisado: true,
      },
    }),
    prisma.externalMessage.groupBy({ by: ['categoriaId'], where: base, _count: { _all: true } }),
    prisma.externalMessage.count({ where: { ...base, revisado: false } }),
  ]);

  const conteos: Record<string, number> = {};
  for (const g of porCategoria) conteos[g.categoriaId ?? 'sin'] = g._count._all;
  return NextResponse.json({ mensajes, conteos, sinRevisar });
}
