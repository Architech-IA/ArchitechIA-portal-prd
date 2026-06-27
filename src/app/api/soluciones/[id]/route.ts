import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const solucion = await prisma.solucion.findUnique({
    where: { id },
    include: { lead: { select: { id: true, companyName: true, contactName: true, status: true } } },
  });
  if (!solucion) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  return NextResponse.json(solucion);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { nombre, descripcion, tipo, estado, valorEstimado, leadId, repositorio, arquitectura } = body;

  try {
    const solucion = await prisma.solucion.update({
      where: { id },
      data: {
        nombre,
        descripcion: descripcion || null,
        tipo,
        estado: estado || 'ACTIVO',
        valorEstimado: parseFloat(valorEstimado) || 0,
        leadId: leadId || null,
        ...(repositorio !== undefined ? { repositorio: repositorio || null } : {}),
        ...(arquitectura !== undefined ? { arquitectura: arquitectura || '[]' } : {}),
      },
      include: { lead: { select: { id: true, companyName: true, contactName: true, status: true } } },
    });
    return NextResponse.json(solucion);
  } catch {
    return NextResponse.json({ error: 'Error al actualizar la solución' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.solucion.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error al eliminar la solución' }, { status: 500 });
  }
}
