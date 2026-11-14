import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sesionCorreo } from '@/lib/correo/sesion';

/** Desactiva la regla (no se borra, para poder auditar qué decidió). */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await sesionCorreo(req);
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!s.admin) return NextResponse.json({ error: 'Solo un administrador cambia reglas' }, { status: 403 });
  const r = await prisma.correoRegla.findUnique({ where: { id } });
  if (!r) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  await prisma.correoRegla.update({ where: { id }, data: { activa: false, patron: r.patron + '#off-' + Date.now() } });
  return NextResponse.json({ ok: true });
}
