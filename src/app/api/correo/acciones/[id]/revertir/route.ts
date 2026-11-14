import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sesionCorreo } from '@/lib/correo/sesion';
import { revertirAccion } from '@/lib/correo/servicio';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await sesionCorreo(req);
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const a = await prisma.correoAccion.findUnique({ where: { id }, include: { mensaje: { select: { userId: true } } } });
  if (!a) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  if (a.mensaje.userId !== s.userId && !s.admin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    await revertirAccion(id);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
