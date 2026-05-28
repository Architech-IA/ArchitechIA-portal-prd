import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = token.sub as string;
  const userEmail = token.email as string;
  const userName = token.name as string;

  const now = new Date();
  const in14days = new Date(now);
  in14days.setDate(now.getDate() + 14);

  const [myLeads, myProjectUsers, myBacklog, upcomingMeetings] = await Promise.all([
    prisma.lead.findMany({
      where: { userId },
      select: {
        id: true, companyName: true, contactName: true,
        status: true, estimatedValue: true, updatedAt: true, source: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.projectUser.findMany({
      where: { userId },
      include: {
        project: {
          select: {
            id: true, name: true, status: true, priority: true,
            progress: true, endDate: true, description: true,
          },
        },
      },
    }),
    prisma.backlogItem.findMany({
      where: {
        assigneeId: userId,
        status: { not: 'DONE' },
      },
      select: {
        id: true, title: true, type: true, priority: true,
        status: true, points: true, projectId: true,
        project: { select: { name: true } },
      },
      orderBy: [{ status: 'asc' }, { priority: 'desc' }],
    }),
    prisma.meeting.findMany({
      where: {
        date: { gte: now, lte: in14days },
        OR: [
          { userId },
          { attendees: { contains: userEmail } },
          { attendees: { contains: userName } },
        ],
      },
      select: {
        id: true, title: true, type: true, date: true,
        endDate: true, location: true, link: true, attendees: true, status: true,
      },
      orderBy: { date: 'asc' },
      take: 10,
    }),
  ]);

  const myProjects = myProjectUsers.map(pu => ({ ...pu.project, projectRole: pu.role }));

  const activeLeads = myLeads.filter(l => !['WON', 'LOST'].includes(l.status));
  const pipelineValue = activeLeads.reduce((a, l) => a + l.estimatedValue, 0);
  const backlogInProgress = myBacklog.filter(i => i.status === 'IN_PROGRESS').length;

  return NextResponse.json({
    user: { id: userId, email: userEmail, name: userName },
    kpis: {
      leadsActivos: activeLeads.length,
      proyectos: myProjects.length,
      backlogPendientes: myBacklog.length,
      backlogInProgress,
      reunionesPróximas: upcomingMeetings.length,
      pipelineValue,
    },
    myLeads,
    myProjects,
    myBacklog,
    upcomingMeetings,
  });
}
