import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { parseJsonConfig } from '@/lib/app-registry';

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const appTypeId = searchParams.get('appTypeId');
  const search = searchParams.get('q');
  const category = searchParams.get('category');

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (appTypeId) where.appTypeId = appTypeId;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }
  if (category) {
    where.appType = { category };
  }

  const apps = await prisma.appInstance.findMany({
    where,
    include: {
      appType: true,
      owner: { select: { name: true } },
      lead: { select: { companyName: true } },
      proposal: { select: { title: true } },
      project: { select: { name: true } },
      cliente: { select: { nombre: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(
    apps.map((a) => ({
      ...a,
      config: parseJsonConfig(a.config),
      appType: {
        ...a.appType,
        schema: parseJsonConfig(a.appType.schema),
        defaultConfig: parseJsonConfig(a.appType.defaultConfig),
      },
    })),
  );
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, appTypeId, leadId, proposalId, projectId, clienteId } = body;

  if (!name?.trim() || !appTypeId) {
    return NextResponse.json(
      { error: 'Nombre y tipo de app son obligatorios' },
      { status: 400 },
    );
  }

  const appType = await prisma.appType.findUnique({ where: { id: appTypeId } });
  if (!appType) {
    return NextResponse.json({ error: 'Tipo de app no encontrado' }, { status: 404 });
  }

  let slug = typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim().toLowerCase() : slugify(name);
  if (!slug) slug = `app-${Date.now()}`;

  let uniqueSlug = slug;
  let counter = 1;
  while (await prisma.appInstance.findUnique({ where: { slug: uniqueSlug } })) {
    uniqueSlug = `${slug}-${counter}`;
    counter += 1;
  }

  const app = await prisma.appInstance.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      slug: uniqueSlug,
      appTypeId,
      status: 'DRAFT',
      config: appType.defaultConfig,
      leadId: leadId || null,
      proposalId: proposalId || null,
      projectId: projectId || null,
      clienteId: clienteId || null,
      ownerId: token.sub as string,
    },
    include: {
      appType: true,
      owner: { select: { name: true } },
    },
  });

  return NextResponse.json(
    {
      ...app,
      config: parseJsonConfig(app.config),
      appType: {
        ...app.appType,
        schema: parseJsonConfig(app.appType.schema),
        defaultConfig: parseJsonConfig(app.appType.defaultConfig),
      },
    },
    { status: 201 },
  );
}
