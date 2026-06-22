import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';

async function isAdmin(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const role = (token as { role?: string })?.role;
  return role === 'ADMIN' || role === 'SUPERADMIN';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!lead) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { companyName, contactName, email, phone, status, source, estimatedValue, scope, repository, notes, userId, tipo, solucionAsociada } = body;

  try {
    const prev = await prisma.lead.findUnique({ where: { id }, select: { status: true } });
    const lead = await prisma.lead.update({
      where: { id },
      data: { companyName, contactName, email, phone: phone || null, status, source,
        estimatedValue: parseFloat(estimatedValue) || 0, scope: scope || null, repository: repository || null, notes: notes || null, userId, tipo: tipo || null, solucionAsociada: solucionAsociada || null },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    // Crear o actualizar solución asociada
    if (solucionAsociada) {
      const tipoMap: Record<string, string> = {
        Project: 'PROJECT',
        Demo: 'DEMO',
        Partnership: 'PARTNERSHIP',
        Products: 'PRODUCT',
        Intern: 'INTERN',
      };
      await prisma.solucion.upsert({
        where: { leadId: id },
        create: {
          nombre: `${companyName} — ${solucionAsociada}`,
          descripcion: scope || null,
          tipo: tipoMap[solucionAsociada] || 'PROJECT',
          valorEstimado: parseFloat(estimatedValue) || 0,
          leadId: id,
        },
        update: {
          nombre: `${companyName} — ${solucionAsociada}`,
          descripcion: scope || null,
          tipo: tipoMap[solucionAsociada] || 'PROJECT',
          valorEstimado: parseFloat(estimatedValue) || 0,
        },
      });
    } else {
      // Si se quitó la solución asociada, eliminar la solución existente
      await prisma.solucion.deleteMany({ where: { leadId: id } });
    }

    const actorId = (token as { sub?: string })?.sub || userId;
    if (prev?.status !== status) {
      await logActivity({ type: 'STATUS_CHANGED',
        description: `cambió el estado de ${companyName} a ${status}`,
        entityType: 'lead', entityId: id, userId: actorId, leadId: id });
    } else {
      await logActivity({ type: 'UPDATED', description: `actualizó el lead ${companyName}`,
        entityType: 'lead', entityId: id, userId: actorId, leadId: id });
    }

    return NextResponse.json(lead);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al actualizar el lead' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const lead = await prisma.lead.findUnique({ where: { id }, select: { companyName: true } });
    await prisma.activity.deleteMany({ where: { leadId: id } });
    await prisma.proposal.updateMany({ where: { leadId: id }, data: { leadId: null } });
    await prisma.lead.delete({ where: { id } });

    const actorId = (token as { sub?: string })?.sub || 'unknown';
    await logActivity({ type: 'UPDATED', description: `eliminó el lead ${lead?.companyName}`,
      entityType: 'lead', entityId: id, userId: actorId });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Error al eliminar el lead' }, { status: 500 });
  }
}
