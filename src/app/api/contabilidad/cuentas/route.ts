import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const cuentas = await prisma.cuentaContable.findMany({
    orderBy: { codigo: 'asc' },
  });
  return NextResponse.json(cuentas);
}

export async function POST(req: Request) {
  const body = await req.json();
  const cuenta = await prisma.cuentaContable.create({
    data: {
      codigo: body.codigo,
      nombre: body.nombre,
      tipo: body.tipo,
      subtipo: body.subtipo || null,
      nivel: parseInt(body.nivel) || 1,
      cuentaPadreId: body.cuentaPadreId || null,
      activa: body.activa !== false,
      descripcion: body.descripcion || null,
    },
  });
  return NextResponse.json(cuenta, { status: 201 });
}
