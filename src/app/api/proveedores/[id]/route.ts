import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const proveedor = await prisma.proveedor.update({
    where: { id },
    data: {
      nombre: body.nombre,
      tipo: body.tipo,
      contacto: body.contacto || null,
      email: body.email || null,
      telefono: body.telefono || null,
      pais: body.pais || null,
      website: body.website || null,
      estado: body.estado,
      notas: body.notas || null,
    },
  });
  return NextResponse.json(proveedor);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.proveedor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
