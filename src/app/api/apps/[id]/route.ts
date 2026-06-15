import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { parseJsonConfig, safeJsonStringify } from '@/lib/app-registry';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = await prisma.appInstance.findUnique({
    where: { id },
    include: {
      appType: true,
      owner: { select: { name: true } },
      lead: { select: { id: true, companyName: true } },
      proposal: { select: { id: true, title: true } },
      project: { select: { id: true, name: true } },
      cliente: { select: { id: true, nombre: true } },
    },
  });

  if (!app) {
    return NextResponse.json({ error: 'App no encontrada' }, { status: 404 });
  }

  return NextResponse.json({
    ...app,
    config: parseJsonConfig(app.config),
    appType: {
      ...app.appType,
      schema: parseJsonConfig(app.appType.schema),
      defaultConfig: parseJsonConfig(app.appType.defaultConfig),
    },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if ('name' in body) updateData.name = String(body.name).trim();
  if ('description' in body) updateData.description = body.description ? String(body.description).trim() : null;
  if ('status' in body) updateData.status = String(body.status);
  if ('leadId' in body) updateData.leadId = body.leadId || null;
  if ('proposalId' in body) updateData.proposalId = body.proposalId || null;
  if ('projectId' in body) updateData.projectId = body.projectId || null;
  if ('clienteId' in body) updateData.clienteId = body.clienteId || null;
  if ('config' in body) updateData.config = safeJsonStringify(body.config);

  const app = await prisma.appInstance.update({
    where: { id },
    data: updateData,
    include: {
      appType: true,
      owner: { select: { name: true } },
      lead: { select: { id: true, companyName: true } },
      proposal: { select: { id: true, title: true } },
      project: { select: { id: true, name: true } },
      cliente: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json({
    ...app,
    config: parseJsonConfig(app.config),
    appType: {
      ...app.appType,
      schema: parseJsonConfig(app.appType.schema),
      defaultConfig: parseJsonConfig(app.appType.defaultConfig),
    },
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  await prisma.appInstance.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
