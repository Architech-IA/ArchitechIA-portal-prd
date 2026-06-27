import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';

export async function GET() {
  const leads = await prisma.lead.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      solucion: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(leads);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { companyName, contactName, email, phone, status, source, estimatedValue, scope, repository, notes, userId, tipo, solucionAsociada } = body;

  const lead = await prisma.lead.create({
    data: { companyName, contactName, email, phone, status, source,
      estimatedValue: parseFloat(estimatedValue) || 0, scope: scope || null, repository: repository || null, notes, userId, tipo: tipo || null, solucionAsociada: solucionAsociada || null },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  // Crear cliente automáticamente si no existe
  const existingCliente = await prisma.cliente.findFirst({
    where: { nombre: { equals: companyName } },
  });
  if (!existingCliente) {
    await prisma.cliente.create({
      data: {
        nombre: companyName,
        contacto: contactName || '',
        email: email || '',
        industria: '',
        pais: '',
        estado: 'Activo',
        valorTotal: parseFloat(estimatedValue) || 0,
      },
    });
  }

  // Crear solución asociada automáticamente si aplica
  if (solucionAsociada) {
    const tipoMap: Record<string, string> = {
      Project: 'PROJECT',
      Demo: 'DEMO',
      Partnership: 'PARTNERSHIP',
      Products: 'PRODUCT',
      Intern: 'INTERN',
    };
    await prisma.solucion.create({
      data: {
        nombre: `${companyName} — ${solucionAsociada}`,
        descripcion: scope || null,
        tipo: tipoMap[solucionAsociada] || 'PROJECT',
        valorEstimado: parseFloat(estimatedValue) || 0,
        leadId: lead.id,
      },
    });
  }

  await logActivity({
    type: 'CREATED', description: `creó el lead ${companyName}`,
    entityType: 'lead', entityId: lead.id, userId, leadId: lead.id,
  });

  return NextResponse.json(lead);
}
