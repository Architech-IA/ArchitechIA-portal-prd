import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { name, projectId, dueDate } = await request.json();
  if (!name || !projectId) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });

  const milestone = await prisma.milestone.create({
    data: { name, projectId, dueDate: dueDate ? new Date(dueDate) : null, status: 'PENDING' },
  });
  await logActivity({
    type: 'CREATED', description: `creó el hito ${name}`,
    entityType: 'milestone', entityId: milestone.id, userId: token.sub,
    projectId,
  });
  return NextResponse.json(milestone);
}
