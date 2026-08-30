import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: {
      leads: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!cliente) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(cliente);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const body = await request.json();
  const { nombre, industria, contacto, email, pais, estado, valorTotal } = body;
  try {
    const cliente = await prisma.cliente.update({
      where: { id },
      data: { nombre, industria, contacto, email, pais, estado, valorTotal: parseFloat(valorTotal) || 0 },
    });
    await logActivity({
      type: 'UPDATED', description: `actualizó el cliente ${nombre}`,
      entityType: 'cliente', entityId: id, userId: token?.sub,
    });
    return NextResponse.json(cliente);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  try {
    const cliente = await prisma.cliente.findUnique({ where: { id }, select: { nombre: true } });
    await prisma.cliente.delete({ where: { id } });
    await logActivity({
      type: 'UPDATED', description: `eliminó el cliente ${cliente?.nombre}`,
      entityType: 'cliente', entityId: id, userId: token?.sub,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
