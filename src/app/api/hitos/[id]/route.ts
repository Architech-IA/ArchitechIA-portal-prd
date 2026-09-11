import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { titulo, descripcion, fechaComprometida, fechaReal, estado } = body;

  try {
    const hito = await prisma.hito.update({
      where: { id },
      data: {
        ...(titulo !== undefined ? { titulo } : {}),
        ...(descripcion !== undefined ? { descripcion: descripcion || null } : {}),
        ...(fechaComprometida !== undefined ? { fechaComprometida: fechaComprometida ? new Date(fechaComprometida) : null } : {}),
        ...(fechaReal !== undefined ? { fechaReal: fechaReal ? new Date(fechaReal) : null } : {}),
        ...(estado !== undefined ? { estado } : {}),
      },
    });
    return NextResponse.json(hito);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar el hito' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.hito.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error al eliminar el hito' }, { status: 500 });
  }
}
