import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const solucionId = request.nextUrl.searchParams.get('solucionId');
  if (!solucionId) return NextResponse.json({ error: 'solucionId requerido' }, { status: 400 });

  const hitos = await prisma.hito.findMany({
    where: { solucionId },
    orderBy: { fechaComprometida: 'asc' },
  });
  return NextResponse.json(hitos);
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const { solucionId, titulo, descripcion, fechaComprometida, fechaReal, estado } = body;
  if (!solucionId || !titulo?.trim()) {
    return NextResponse.json({ error: 'solucionId y titulo son requeridos' }, { status: 400 });
  }

  const hito = await prisma.hito.create({
    data: {
      solucionId, titulo: titulo.trim(),
      descripcion: descripcion || null,
      fechaComprometida: fechaComprometida ? new Date(fechaComprometida) : null,
      fechaReal: fechaReal ? new Date(fechaReal) : null,
      estado: estado || 'PENDIENTE',
    },
  });
  return NextResponse.json(hito);
}
