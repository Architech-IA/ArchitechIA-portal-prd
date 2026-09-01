import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { compare, hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const userId = token.sub;

  const [user, leadsCount, proposalsCount, projectsCount, recentActivity] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true, googleAccessToken: true, microsoftAccessToken: true },
    }),
    prisma.lead.count({ where: { userId } }),
    prisma.proposal.count({ where: { userId } }),
    prisma.project.count({ where: { users: { some: { userId } } } }),
    prisma.activity.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  const pipelineValue = await prisma.lead.aggregate({
    where: { userId, status: { notIn: ['LOST'] } },
    _sum: { estimatedValue: true },
  });

  const leadsGanados = await prisma.lead.count({ where: { userId, status: 'WON' } });

  return NextResponse.json({
    user: { ...user, googleConnected: !!(user?.googleAccessToken), microsoftConnected: !!(user?.microsoftAccessToken) },
    stats: {
      leads:         leadsCount,
      proposals:     proposalsCount,
      projects:      projectsCount,
      pipelineValue: pipelineValue._sum.estimatedValue || 0,
      leadsGanados,
    },
    recentActivity,
  });
}

export async function PUT(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const userId = token.sub;
  const body = await request.json();
  const { action, name, email, avatar, currentPassword, newPassword } = body;

  // ── Update profile info (name, email, avatar) ──
  if (action === 'updateProfile') {
    const data: Record<string, string> = {};
    if (name !== undefined) data.name = name;
    if (avatar !== undefined) data.avatar = avatar || null;

    if (email !== undefined) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) {
        return NextResponse.json({ error: 'El email ya está en uso' }, { status: 400 });
      }
      data.email = email;
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, role: true, avatar: true, createdAt: true },
    });

    return NextResponse.json({ success: true, user: updated });
  }

  // ── Change password ──
  if (action === 'changePassword') {
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Contraseña actual y nueva son requeridas' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const passwordOk = await compare(currentPassword, user.password);
    if (!passwordOk) {
      return NextResponse.json({ error: 'Contraseña actual incorrecta' }, { status: 400 });
    }

    const hashed = await hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed },
    });

    return NextResponse.json({ success: true });
  }

  // ── Disconnect Google Calendar ──
  if (action === 'disconnectGoogle') {
    await prisma.user.update({
      where: { id: userId },
      data: { googleAccessToken: null, googleRefreshToken: null, googleTokenExpiry: null, googleCalendarId: null },
    });
    return NextResponse.json({ success: true });
  }

  // ── Disconnect Microsoft 365 ──
  if (action === 'disconnectMicrosoft') {
    await prisma.user.update({
      where: { id: userId },
      data: {
        microsoftAccessToken: null,
        microsoftRefreshToken: null,
        microsoftTokenExpiry: null,
        microsoftAccountEmail: null,
      },
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
}
