import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
  const body = await request.json();
  const { title, description, type, date, endDate, location, link, attendees, status, notes, actaFile, actaFileName, userId } = body;

  const meeting = await prisma.meeting.create({
    data: {
      title, description, type: type || 'INTERNAL',
      date: parseUTC5(date),
      endDate: parseUTC5Nullable(endDate),
      location: location || null, link: link || null,
      attendees: attendees || null, status: status || 'SCHEDULED',
      notes: notes || null, actaFile: actaFile || null,
      actaFileName: actaFileName || null, userId,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  createCalendarEvent(userId, meeting.id, title, description || null, meeting.date, meeting.endDate, meeting.location, meeting.attendees, meeting.link).catch(() => {});

  await logActivity({
    type: 'CREATED', description: `creó la reunión ${title}`,
    entityType: 'meeting', entityId: meeting.id, userId,
  });
  return NextResponse.json(meeting);
}
