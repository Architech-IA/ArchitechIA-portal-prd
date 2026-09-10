import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const { status, outcome } = await request.json();

  try {
    const lead = await prisma.lead.update({
      where: { id },
      // outcome (WON/LOST) es un campo de la fase RESULT, no una fase en si
      // — se limpia si el drag-and-drop del pipeline mueve la card a
      // cualquier otra columna que no sea RESULT.
      data: { status, outcome: status === 'RESULT' ? (outcome ?? null) : null },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json(lead);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al actualizar estado' }, { status: 500 });
  }
}
