import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sesionCorreo } from '@/lib/correo/sesion';

export async function GET(req: NextRequest) {
  const s = await sesionCorreo(req);
  if (!s) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const c = await prisma.correoCategoria.findMany({ where: { activa: true }, orderBy: { orden: 'asc' } });
  return NextResponse.json(c);
}
