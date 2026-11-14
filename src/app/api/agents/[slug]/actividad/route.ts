import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Últimos traspasos de un agente (lo que recibió y lo que entregó) y su pedido de origen.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const traspasos = await prisma.agenteTraspaso.findMany({
    where: { OR: [{ de: slug }, { a: slug }] },
    orderBy: { createdAt: 'desc' }, take: 10,
    select: { de: true, a: true, tipo: true, ronda: true, createdAt: true, hilo: { select: { pedido: true, estado: true } } },
  });
  const total = await prisma.agenteTraspaso.count({ where: { OR: [{ de: slug }, { a: slug }] } });
  return NextResponse.json({ total, traspasos });
}
