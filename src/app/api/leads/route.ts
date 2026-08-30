import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';

export async function GET() {
  const leads = await prisma.lead.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      solucion: { select: { id: true } },
      cliente: { select: { id: true, nombre: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(leads);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { companyName, contactName, email, phone, status, source, estimatedValue, scope, repository, notes, userId, tipo, solucionAsociada } = body;

  // Vincula con un Cliente existente (por nombre) o crea uno nuevo — nunca duplicado sin relación
  let cliente = await prisma.cliente.findFirst({
    where: { nombre: { equals: companyName, mode: 'insensitive' } },
  });
  if (!cliente) {
    cliente = await prisma.cliente.create({
      data: {
        nombre: companyName,
        contacto: contactName || '',
        email: email || '',
        industria: 'Sin especificar',
        pais: 'Sin especificar',
        estado: 'Activo',
        valorTotal: parseFloat(estimatedValue) || 0,
      },
    });
  }

  const lead = await prisma.lead.create({
    data: { companyName, contactName, email, phone, status, source,
      estimatedValue: parseFloat(estimatedValue) || 0, scope: scope || null, repository: repository || null, notes, userId, tipo: tipo || null, solucionAsociada: solucionAsociada || null,
      clienteId: cliente.id },
    include: { user: { select: { id: true, name: true, email: true } }, cliente: { select: { id: true, nombre: true } } },
  });

  await logActivity({
    type: 'CREATED', description: `creó el lead ${companyName}`,
    entityType: 'lead', entityId: lead.id, userId, leadId: lead.id,
  });

  return NextResponse.json(lead);
}
