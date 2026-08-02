import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';

export async function GET() {
  const clientes = await prisma.cliente.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(clientes);
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const body = await request.json();
  const { nombre, industria, contacto, email, pais, estado, valorTotal } = body;
  const cliente = await prisma.cliente.create({
    data: { nombre, industria, contacto, email, pais, estado, valorTotal: parseFloat(valorTotal) || 0 },
  });
  await logActivity({
    type: 'CREATED', description: `creó el cliente ${nombre}`,
    entityType: 'cliente', entityId: cliente.id, userId: token?.sub,
  });
  return NextResponse.json(cliente);
}
