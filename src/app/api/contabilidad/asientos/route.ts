import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const asientos = await prisma.asientoContable.findMany({
    include: { lineas: { include: { cuenta: true } } },
    orderBy: { numero: 'desc' },
  });
  return NextResponse.json(asientos);
}

export async function POST(req: Request) {
  const body = await req.json();

  // Validate partida doble
  const totalDebe = body.lineas.reduce((s: number, l: { debe: number }) => s + (parseFloat(String(l.debe)) || 0), 0);
  const totalHaber = body.lineas.reduce((s: number, l: { haber: number }) => s + (parseFloat(String(l.haber)) || 0), 0);
  if (Math.abs(totalDebe - totalHaber) > 0.01) {
    return NextResponse.json({ error: 'El asiento no cuadra: Debe ≠ Haber' }, { status: 400 });
  }

  const count = await prisma.asientoContable.count();
  const asiento = await prisma.asientoContable.create({
    data: {
      numero: count + 1,
      fecha: new Date(body.fecha),
      descripcion: body.descripcion,
      referencia: body.referencia || null,
      estado: body.estado || 'CONFIRMADO',
      tipo: body.tipo || 'MANUAL',
      creadoPor: body.creadoPor || null,
      lineas: {
        create: body.lineas.map((l: { cuentaId: string; descripcion?: string; debe: number; haber: number }) => ({
          cuentaId: l.cuentaId,
          descripcion: l.descripcion || null,
          debe: parseFloat(String(l.debe)) || 0,
          haber: parseFloat(String(l.haber)) || 0,
        })),
      },
    },
    include: { lineas: { include: { cuenta: true } } },
  });
  return NextResponse.json(asiento, { status: 201 });
}
