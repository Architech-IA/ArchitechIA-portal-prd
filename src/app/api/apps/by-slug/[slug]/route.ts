import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseJsonConfig } from '@/lib/app-registry';

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = await prisma.appInstance.findUnique({
    where: { slug },
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
