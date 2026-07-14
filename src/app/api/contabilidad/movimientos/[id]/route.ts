import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const mov = await prisma.movimientoBancario.update({
    where: { id },
    data: {
      conciliado: body.conciliado,
      asientoId: body.asientoId || null,
      descripcion: body.descripcion,
      referencia: body.referencia || null,
    },
  });
  return NextResponse.json(mov);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.movimientoBancario.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
