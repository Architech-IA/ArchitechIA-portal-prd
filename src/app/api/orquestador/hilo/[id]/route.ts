import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Estado de un trabajo delegado (Presales + Documentador) y su registro de traspasos.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;
  const hilo = await prisma.agenteHilo.findUnique({ where: { id } });
  if (!hilo || hilo.userId !== userId) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const traspasos = await prisma.agenteTraspaso.findMany({ where: { hiloId: id }, orderBy: { createdAt: 'asc' }, select: { de: true, a: true, tipo: true, ronda: true, createdAt: true } });
  return NextResponse.json({ estado: hilo.estado, resultado: hilo.resultado, traspasos });
}
