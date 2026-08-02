import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const { status } = await request.json();

  const milestone = await prisma.milestone.update({
    where: { id },
    data: { status, completedDate: status === 'COMPLETED' ? new Date() : null },
  });

  const type = status === 'COMPLETED' ? 'MILESTONE_COMPLETED' : 'STATUS_CHANGED';
  await logActivity({
    type, description: `cambió el estado del hito ${milestone.name} a ${status}`,
    entityType: 'milestone', entityId: id, userId: token.sub,
    projectId: milestone.projectId,
  });
  return NextResponse.json(milestone);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { id } = await params;
  const milestone = await prisma.milestone.findUnique({ where: { id }, select: { name: true, projectId: true } });
  await prisma.milestone.delete({ where: { id } });
  await logActivity({
    type: 'UPDATED', description: `eliminó el hito ${milestone?.name}`,
    entityType: 'milestone', entityId: id, userId: token.sub,
    projectId: milestone?.projectId,
  });
  return NextResponse.json({ ok: true });
}
