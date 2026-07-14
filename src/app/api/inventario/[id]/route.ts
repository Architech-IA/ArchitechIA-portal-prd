import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const activo = await prisma.activo.update({
    where: { id },
    data: {
      nombre: body.nombre,
      tipo: body.tipo,
      categoria: body.categoria || null,
      estado: body.estado,
      valor: parseFloat(body.valor) || 0,
      moneda: body.moneda || 'USD',
      fechaAdquisicion: body.fechaAdquisicion ? new Date(body.fechaAdquisicion) : null,
      fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : null,
      proveedorNombre: body.proveedorNombre || null,
      responsable: body.responsable || null,
      ubicacion: body.ubicacion || null,
      serial: body.serial || null,
      notas: body.notas || null,
    },
  });
  return NextResponse.json(activo);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.activo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
