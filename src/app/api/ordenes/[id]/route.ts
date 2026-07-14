import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const orden = await prisma.ordenCompra.update({
    where: { id },
    data: {
      concepto: body.concepto,
      descripcion: body.descripcion || null,
      monto: parseFloat(body.monto) || 0,
      moneda: body.moneda || 'USD',
      estado: body.estado,
      proveedorId: body.proveedorId,
      fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : null,
      fechaPago: body.fechaPago ? new Date(body.fechaPago) : null,
      categoria: body.categoria || null,
      aprobadoPor: body.aprobadoPor || null,
      notas: body.notas || null,
    },
    include: { proveedor: true },
  });
  return NextResponse.json(orden);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.ordenCompra.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
