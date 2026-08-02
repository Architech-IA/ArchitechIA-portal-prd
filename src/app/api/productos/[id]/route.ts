import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const body = await request.json();
  const { nombre, version, estado, descripcion, tecnologias, caracteristicas, icono, color } = body;
  try {
    const producto = await prisma.producto.update({
      where: { id },
      data: {
        nombre, version, estado, descripcion, icono, color,
        tecnologias: JSON.stringify(tecnologias),
        caracteristicas: JSON.stringify(caracteristicas),
      },
    });
    await logActivity({
      type: 'UPDATED', description: 'actualizó el producto  + nombre + ',
      entityType: 'producto', entityId: id, userId: token?.sub,
    });
    return NextResponse.json({ ...producto, tecnologias, caracteristicas });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  try {
    const producto = await prisma.producto.findUnique({ where: { id }, select: { nombre: true } });
    await prisma.producto.delete({ where: { id } });
    await logActivity({
      type: 'UPDATED', description: 'eliminó el producto  + producto?.nombre + ',
      entityType: 'producto', entityId: id, userId: token?.sub,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
