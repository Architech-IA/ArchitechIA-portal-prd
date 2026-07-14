import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const desde = searchParams.get('desde');
  const hasta = searchParams.get('hasta');

  const whereLinea = desde || hasta ? {
    asiento: {
      fecha: {
        ...(desde ? { gte: new Date(desde) } : {}),
        ...(hasta ? { lte: new Date(hasta + 'T23:59:59') } : {}),
      },
    },
  } : {};

  const cuentas = await prisma.cuentaContable.findMany({
    where: { activa: true },
    include: {
      lineas: {
        where: whereLinea,
      },
    },
    orderBy: { codigo: 'asc' },
  });

  // Compute balance per account
  const result = cuentas.map(c => {
    const totalDebe = c.lineas.reduce((s, l) => s + l.debe, 0);
    const totalHaber = c.lineas.reduce((s, l) => s + l.haber, 0);
    let saldo = 0;
    // Normal balance by account type
    if (['ACTIVO', 'GASTO'].includes(c.tipo)) {
      saldo = totalDebe - totalHaber;
    } else {
      saldo = totalHaber - totalDebe;
    }
    return { ...c, totalDebe, totalHaber, saldo };
  });

  // Totals by type
  const totals = {
    ACTIVO: result.filter(c => c.tipo === 'ACTIVO').reduce((s, c) => s + c.saldo, 0),
    PASIVO: result.filter(c => c.tipo === 'PASIVO').reduce((s, c) => s + c.saldo, 0),
    PATRIMONIO: result.filter(c => c.tipo === 'PATRIMONIO').reduce((s, c) => s + c.saldo, 0),
    INGRESO: result.filter(c => c.tipo === 'INGRESO').reduce((s, c) => s + c.saldo, 0),
    GASTO: result.filter(c => c.tipo === 'GASTO').reduce((s, c) => s + c.saldo, 0),
  };
  const utilidad = totals.INGRESO - totals.GASTO;

  return NextResponse.json({ cuentas: result, totals, utilidad });
}
