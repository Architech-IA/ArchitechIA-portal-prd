import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { titulo, descripcion, severidad, probabilidad, mitigacion, estado, responsable } = body;

  try {
    const riesgo = await prisma.riesgo.update({
      where: { id },
      data: {
        ...(titulo !== undefined ? { titulo } : {}),
        ...(descripcion !== undefined ? { descripcion: descripcion || null } : {}),
        ...(severidad !== undefined ? { severidad } : {}),
        ...(probabilidad !== undefined ? { probabilidad } : {}),
        ...(mitigacion !== undefined ? { mitigacion: mitigacion || null } : {}),
        ...(estado !== undefined ? { estado } : {}),
        ...(responsable !== undefined ? { responsable: responsable || null } : {}),
      },
    });
    return NextResponse.json(riesgo);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar el riesgo' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { id } = await params;
  try {
    await prisma.riesgo.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error al eliminar el riesgo' }, { status: 500 });
  }
}
