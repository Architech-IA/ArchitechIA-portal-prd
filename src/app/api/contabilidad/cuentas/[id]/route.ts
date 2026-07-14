import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const cuenta = await prisma.cuentaContable.update({
    where: { id },
    data: {
      codigo: body.codigo,
      nombre: body.nombre,
      tipo: body.tipo,
      subtipo: body.subtipo || null,
      nivel: parseInt(body.nivel) || 1,
      cuentaPadreId: body.cuentaPadreId || null,
      activa: body.activa !== false,
      descripcion: body.descripcion || null,
    },
  });
  return NextResponse.json(cuenta);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.cuentaContable.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
