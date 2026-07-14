import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.asientoContable.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asiento = await prisma.asientoContable.findUnique({
    where: { id },
    include: { lineas: { include: { cuenta: true } } },
  });
  if (!asiento) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(asiento);
}
