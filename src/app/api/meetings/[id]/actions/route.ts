import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseUTC5Nullable } from '@/lib/timezone';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actions = await prisma.meetingAction.findMany({ where: { meetingId: id }, orderBy: { createdAt: 'asc' } });
  return NextResponse.json(actions);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const texto = typeof body.texto === 'string' ? body.texto.trim() : '';
  if (!texto) return NextResponse.json({ error: 'texto requerido' }, { status: 400 });
  const meeting = await prisma.meeting.findUnique({ where: { id }, select: { id: true } });
  if (!meeting) return NextResponse.json({ error: 'Reunión no encontrada' }, { status: 404 });
  const action = await prisma.meetingAction.create({
    data: {
      meetingId: id,
      texto,
      responsable: body.responsable || null,
      // fechaLimite llega como "YYYY-MM-DD" (fecha local UTC-5)
      fechaLimite: body.fechaLimite ? parseUTC5Nullable(`${body.fechaLimite}T23:59`) : null,
    },
  });
  return NextResponse.json(action);
}
