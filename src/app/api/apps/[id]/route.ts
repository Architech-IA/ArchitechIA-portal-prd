import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';
import type { AppInstance, AppTypeDefinition } from '@/lib/app-types';

const include = {
  appType: true, owner: { select: { name: true } },
  lead: { select: { id: true, companyName: true } }, proposal: { select: { id: true, title: true } },
  project: { select: { id: true, name: true } }, cliente: { select: { id: true, nombre: true } },
};

function mapApp(app: { appType: Record<string, unknown>; config: unknown; [key: string]: unknown }) {
  return {
    ...app,
    config: app.config as unknown as AppInstance['config'],
    appType: { ...app.appType, schema: app.appType.schema as unknown as AppTypeDefinition['schema'], defaultConfig: app.appType.defaultConfig as unknown as AppTypeDefinition['defaultConfig'] },
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await prisma.appInstance.findUnique({ where: { id }, include });
  if (!app) return NextResponse.json({ error: 'App no encontrada' }, { status: 404 });
  return NextResponse.json(mapApp(app as Parameters<typeof mapApp>[0]));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const updateData: Record<string, unknown> = {};
  if ('name' in body) updateData.name = String(body.name).trim();
  if ('description' in body) updateData.description = body.description ? String(body.description).trim() : null;
  if ('status' in body) updateData.status = String(body.status);
  if ('leadId' in body) updateData.leadId = body.leadId || null;
  if ('proposalId' in body) updateData.proposalId = body.proposalId || null;
  if ('projectId' in body) updateData.projectId = body.projectId || null;
  if ('clienteId' in body) updateData.clienteId = body.clienteId || null;
  if ('config' in body) updateData.config = body.config as never;

  const app = await prisma.appInstance.update({ where: { id }, data: updateData, include });

  if (body.status !== undefined) {
    await logActivity({
      type: 'STATUS_CHANGED', description: 'cambió el estado de la app  + app.name +  a ' + body.status,
      entityType: 'app', entityId: id, userId: token.sub,
    });
  } else {
    await logActivity({
      type: 'UPDATED', description: 'actualizó la app  + app.name + ',
      entityType: 'app', entityId: id, userId: token.sub,
    });
  }
  return NextResponse.json(mapApp(app as Parameters<typeof mapApp>[0]));
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const app = await prisma.appInstance.findUnique({ where: { id }, select: { name: true } });
  await prisma.appInstance.delete({ where: { id } });
  await logActivity({
    type: 'UPDATED', description: 'eliminó la app  + app?.name + ',
    entityType: 'app', entityId: id, userId: token.sub,
  });
  return NextResponse.json({ ok: true });
}
