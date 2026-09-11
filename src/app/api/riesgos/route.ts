import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const solucionId = request.nextUrl.searchParams.get('solucionId');
  if (!solucionId) return NextResponse.json({ error: 'solucionId requerido' }, { status: 400 });

  const riesgos = await prisma.riesgo.findMany({
    where: { solucionId },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(riesgos);
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const { solucionId, titulo, descripcion, severidad, probabilidad, mitigacion, estado, responsable } = body;
  if (!solucionId || !titulo?.trim()) {
    return NextResponse.json({ error: 'solucionId y titulo son requeridos' }, { status: 400 });
  }

  const riesgo = await prisma.riesgo.create({
    data: {
      solucionId, titulo: titulo.trim(),
      descripcion: descripcion || null,
      severidad: severidad || 'MEDIA',
      probabilidad: probabilidad || 'MEDIA',
      mitigacion: mitigacion || null,
      estado: estado || 'ABIERTO',
      responsable: responsable || null,
    },
  });
  return NextResponse.json(riesgo);
}
