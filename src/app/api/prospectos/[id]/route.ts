import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.empresa !== undefined) data.empresa = body.empresa;
  if (body.industria !== undefined) data.industria = body.industria;
  if (body.nicho !== undefined) data.nicho = body.nicho || null;
  if (body.contacto !== undefined) data.contacto = body.contacto || null;
  if (body.email !== undefined) data.email = body.email || null;
  if (body.telefono !== undefined) data.telefono = body.telefono || null;
  if (body.pais !== undefined) data.pais = body.pais || null;
  if (body.fuente !== undefined) data.fuente = body.fuente;
  if (body.estado !== undefined) data.estado = body.estado;
  if (body.prioridad !== undefined) data.prioridad = body.prioridad;
  if (body.notas !== undefined) data.notas = body.notas || null;
  if (body.userId !== undefined) data.userId = body.userId;

  const prospecto = await prisma.prospecto.update({
    where: { id }, data,
    include: { user: { select: { id: true, name: true } } },
  });

  const userId = (body.userId as string) || token?.sub;
  if (body.estado !== undefined) {
    await logActivity({
      type: 'STATUS_CHANGED', description: `cambió el estado del prospecto ${prospecto.empresa} a ${body.estado}`,
      entityType: 'prospecto', entityId: id, userId,
    });
  } else {
    await logActivity({
      type: 'UPDATED', description: `actualizó el prospecto ${prospecto.empresa}`,
      entityType: 'prospecto', entityId: id, userId,
    });
  }
  return NextResponse.json(prospecto);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const prospecto = await prisma.prospecto.findUnique({ where: { id }, select: { empresa: true } });
  await prisma.prospecto.delete({ where: { id } });
  await logActivity({
    type: 'UPDATED', description: `eliminó el prospecto ${prospecto?.empresa}`,
    entityType: 'prospecto', entityId: id, userId: token?.sub,
  });
  return NextResponse.json({ ok: true });
}
