import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Guardado del hub de la reunion (agenda, notas, decisiones). Endpoint aparte
// del PUT general a proposito: el hub se autoguarda cada pocos segundos y el
// PUT general dispara Google Calendar y una entrada de actividad por cada
// llamada — no queremos eso en cada pulsacion de tecla.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.hub !== 'string') return NextResponse.json({ error: 'hub requerido' }, { status: 400 });
  try {
    const meeting = await prisma.meeting.update({ where: { id }, data: { hub: body.hub }, select: { id: true, updatedAt: true } });
    return NextResponse.json(meeting);
  } catch {
    return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  }
}
