import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { parseUTC5, parseUTC5Nullable } from '@/lib/timezone';
import { updateCalendarEvent, deleteCalendarEvent } from '@/lib/googleCalendar';
import { logActivity } from '@/lib/activity';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const body = await request.json();

  try {
    const existing = await prisma.meeting.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description || null;
    if (body.type !== undefined) data.type = body.type;
    if (body.date !== undefined) data.date = parseUTC5(body.date);
    if (body.endDate !== undefined) data.endDate = body.endDate ? parseUTC5Nullable(body.endDate) : null;
    if (body.location !== undefined) data.location = body.location || null;
    if (body.link !== undefined) data.link = body.link || null;
    if (body.attendees !== undefined) data.attendees = body.attendees || null;
    if (body.status !== undefined) data.status = body.status;
    if (body.notes !== undefined) data.notes = body.notes || null;
    if (body.actaFile !== undefined) data.actaFile = body.actaFile || null;
    if (body.actaFileName !== undefined) data.actaFileName = body.actaFileName || null;

    const meeting = await prisma.meeting.update({
      where: { id }, data,
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (body.status || body.title || body.date || body.description || body.location || body.link || body.attendees || body.endDate) {
      updateCalendarEvent(existing.userId, meeting.id, meeting.title, meeting.description, meeting.date, meeting.endDate, meeting.location, meeting.attendees, meeting.link, meeting.status).catch(() => {});
    }

    const userId = existing.userId || token?.sub;
    if (body.status !== undefined) {
      await logActivity({
        type: 'STATUS_CHANGED', description: `cambió el estado de la reunión ${meeting.title} a ${body.status}`,
        entityType: 'meeting', entityId: id, userId,
      });
    } else {
      await logActivity({
        type: 'UPDATED', description: `actualizó la reunión ${meeting.title}`,
        entityType: 'meeting', entityId: id, userId,
      });
    }
    return NextResponse.json(meeting);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken({ req: _request, secret: process.env.NEXTAUTH_SECRET });
  try {
    const meeting = await prisma.meeting.findUnique({ where: { id } });
    if (!meeting) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

    deleteCalendarEvent(meeting.userId, meeting.id).catch(() => {});
    await prisma.meeting.delete({ where: { id } });
    await logActivity({
      type: 'UPDATED', description: `eliminó la reunión ${meeting.title}`,
      entityType: 'meeting', entityId: id, userId: meeting.userId || token?.sub,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
