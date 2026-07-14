import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const empleado = await prisma.empleadoRRHH.update({
    where: { id },
    data: {
      nombre: body.nombre,
      email: body.email,
      cargo: body.cargo,
      departamento: body.departamento,
      tipo: body.tipo,
      estado: body.estado,
      salarioBase: parseFloat(body.salarioBase) || 0,
      moneda: body.moneda || 'USD',
      fechaIngreso: new Date(body.fechaIngreso),
      fechaBaja: body.fechaBaja ? new Date(body.fechaBaja) : null,
      pais: body.pais || null,
      notas: body.notas || null,
    },
  });
  return NextResponse.json(empleado);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.empleadoRRHH.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
