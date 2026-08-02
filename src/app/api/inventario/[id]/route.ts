import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const body = await request.json();
  const activo = await prisma.activo.update({
    where: { id },
    data: {
      nombre: body.nombre, tipo: body.tipo, categoria: body.categoria || null,
      estado: body.estado, valor: parseFloat(body.valor) || 0, moneda: body.moneda || 'USD',
      fechaAdquisicion: body.fechaAdquisicion ? new Date(body.fechaAdquisicion) : null,
      fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : null,
      proveedorNombre: body.proveedorNombre || null, responsable: body.responsable || null,
      ubicacion: body.ubicacion || null, serial: body.serial || null, notas: body.notas || null,
    },
  });
  await logActivity({
    type: 'UPDATED', description: 'actualizó el activo  + body.nombre + ',
    entityType: 'activo', entityId: id, userId: token?.sub,
  });
  return NextResponse.json(activo);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const activo = await prisma.activo.findUnique({ where: { id }, select: { nombre: true } });
  await prisma.activo.delete({ where: { id } });
  await logActivity({
    type: 'UPDATED', description: 'eliminó el activo  + activo?.nombre + ',
    entityType: 'activo', entityId: id, userId: token?.sub,
  });
  return NextResponse.json({ ok: true });
}
