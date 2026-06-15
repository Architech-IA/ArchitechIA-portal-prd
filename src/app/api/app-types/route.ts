import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseJsonConfig } from '@/lib/app-registry';

export async function GET() {
  const types = await prisma.appType.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(
    types.map((t) => ({
      ...t,
      schema: parseJsonConfig(t.schema),
      defaultConfig: parseJsonConfig(t.defaultConfig),
    })),
  );
}
