import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { AppTypeDefinition } from '@/lib/app-types';

export async function GET() {
  const types = await prisma.appType.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(
    types.map((t) => ({
      ...t,
      schema: t.schema as unknown as AppTypeDefinition['schema'],
      defaultConfig: t.defaultConfig as unknown as AppTypeDefinition['defaultConfig'],
    })),
  );
}
