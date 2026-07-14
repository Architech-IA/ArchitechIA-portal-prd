import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const movimientos = await prisma.movimientoBancario.findMany({
    orderBy: { fecha: 'desc' },
  });
  return NextResponse.json(movimientos);
}

export async function POST(req: Request) {
  const body = await req.json();
  const mov = await prisma.movimientoBancario.create({
    data: {
      fecha: new Date(body.fecha),
      descripcion: body.descripcion,
      referencia: body.referencia || null,
      monto: parseFloat(body.monto) || 0,
      tipo: body.tipo,
      saldo: body.saldo ? parseFloat(body.saldo) : null,
      conciliado: body.conciliado || false,
      asientoId: body.asientoId || null,
      banco: body.banco || 'Principal',
    },
  });
  return NextResponse.json(mov, { status: 201 });
}
