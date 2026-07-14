import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const solicitud = await prisma.solicitudVacacion.update({
    where: { id },
    data: {
      estado: body.estado,
      aprobadoPor: body.aprobadoPor || null,
      notas: body.notas || null,
    },
    include: { empleado: true },
  });
  return NextResponse.json(solicitud);
}
