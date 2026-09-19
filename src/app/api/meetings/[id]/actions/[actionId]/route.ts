import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseUTC5Nullable } from '@/lib/timezone';

const ESTADOS = ['PENDIENTE', 'EN_CURSO', 'HECHA'];

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; actionId: string }> }) {
  const { id, actionId } = await params;
  const body = await request.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof body.texto === 'string') data.texto = body.texto;
  if (body.responsable !== undefined) data.responsable = body.responsable || null;
  if (body.fechaLimite !== undefined) data.fechaLimite = body.fechaLimite ? parseUTC5Nullable(`${body.fechaLimite}T23:59`) : null;
  if (body.estado !== undefined) {
    if (!ESTADOS.includes(body.estado)) return NextResponse.json({ error: 'estado inválido' }, { status: 400 });
    data.estado = body.estado;
  }
  const existing = await prisma.meetingAction.findFirst({ where: { id: actionId, meetingId: id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  const action = await prisma.meetingAction.update({ where: { id: actionId }, data });
  return NextResponse.json(action);
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; actionId: string }> }) {
  const { id, actionId } = await params;
  const existing = await prisma.meetingAction.findFirst({ where: { id: actionId, meetingId: id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
  await prisma.meetingAction.delete({ where: { id: actionId } });
  return NextResponse.json({ ok: true });
}
