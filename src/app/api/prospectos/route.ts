import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';

export async function GET() {
  const prospectos = await prisma.prospecto.findMany({
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(prospectos);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { empresa, industria, nicho, contacto, email, telefono, pais, fuente, estado, prioridad, notas, userId } = body;

  const prospecto = await prisma.prospecto.create({
    data: {
      empresa, industria, nicho: nicho || null, contacto: contacto || null,
      email: email || null, telefono: telefono || null, pais: pais || null,
      fuente: fuente || 'LinkedIn', estado: estado || 'Identificado',
      prioridad: prioridad || 'Media', notas: notas || null, userId,
    },
    include: { user: { select: { id: true, name: true } } },
  });
  await logActivity({
    type: 'CREATED', description: `creó el prospecto ${empresa}`,
    entityType: 'prospecto', entityId: prospecto.id, userId,
  });
  return NextResponse.json(prospecto);
}
