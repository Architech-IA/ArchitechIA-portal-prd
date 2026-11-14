import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sesionCorreo } from '@/lib/correo/sesion';
import { fijarCategoria, marcarRevisado } from '@/lib/correo/servicio';

type Ctx = { params: Promise<{ id: string }> };

async function permitido(req: NextRequest, id: string) {
  const s = await sesionCorreo(req);
  if (!s) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  const m = await prisma.externalMessage.findUnique({ where: { id }, select: { userId: true } });
  if (!m) return { error: NextResponse.json({ error: 'No encontrado' }, { status: 404 }) };
  if (m.userId !== s.userId && !s.admin) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }) };
  return { s };
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const p = await permitido(req, id);
  if (p.error) return p.error;
  const m = await prisma.externalMessage.findUnique({
    where: { id },
    include: { acciones: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
  return NextResponse.json(m);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const p = await permitido(req, id);
  if (p.error) return p.error;
  const body = await req.json().catch(() => ({}));
  try {
    if ('categoriaId' in body) await fijarCategoria(id, p.s!.userId, body.categoriaId || null);
    if (typeof body.revisado === 'boolean' && !('categoriaId' in body)) await marcarRevisado(id, p.s!.userId, body.revisado);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
