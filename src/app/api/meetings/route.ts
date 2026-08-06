import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { parseUTC5, parseUTC5Nullable } from '@/lib/timezone';
import { createCalendarEvent } from '@/lib/googleCalendar';
import { logActivity } from '@/lib/activity';

export async function GET() {
  const meetings = await prisma.meeting.findMany({
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { date: 'desc' },
  });
  return NextResponse.json(meetings);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string })?.id;

  const body = await request.json();
  const { title, description, type, date, endDate, location, link, attendees, status, notes, actaFile, actaFileName, userId } = body;

  // Usar userId de la sesión del servidor; si no hay sesión, caer al body (compatibilidad)
  const resolvedUserId = sessionUserId || userId;

  if (!resolvedUserId) {
    return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 });
  }

  const meeting = await prisma.meeting.create({
    data: {
      title, description, type: type || 'INTERNAL',
      date: parseUTC5(date),
      endDate: parseUTC5Nullable(endDate),
      location: location || null, link: link || null,
      attendees: attendees || null, status: status || 'SCHEDULED',
      notes: notes || null, actaFile: actaFile || null,
      actaFileName: actaFileName || null,
      userId: resolvedUserId,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  createCalendarEvent(resolvedUserId, meeting.id, title, description || null, meeting.date, meeting.endDate, meeting.location, meeting.attendees, meeting.link).catch(() => {});

  await logActivity({
    type: 'CREATED', description: `creó la reunión ${title}`,
    entityType: 'meeting', entityId: meeting.id, userId: resolvedUserId,
  });
  return NextResponse.json(meeting);
}
