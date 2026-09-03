import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { generateSolucionCode, uniqueSolucionCode } from '@/lib/solucionCode';

async function isAdmin(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const role = (token as { role?: string })?.role;
  return role === 'ADMIN' || role === 'SUPERADMIN';
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const tipoMap: Record<string, string> = {
    Project: 'PROJECT',
    Demo: 'DEMO',
    Partnership: 'PARTNERSHIP',
    Products: 'PRODUCT',
  };

  // Leads con solucionAsociada pero sin solución creada
  const leads = await prisma.lead.findMany({
    where: {
      solucionAsociada: { not: null },
      solucion: { is: null },
    },
  });

  let created = 0;
  for (const lead of leads) {
    if (!lead.solucionAsociada) continue;
    const nombre = `${lead.companyName} — ${lead.solucionAsociada}`;
    // Toda Solucion debe tener solucionCode — este endpoint era, junto con
    // council/proposals y plan/approve, uno de los 3 lugares que la creaban
    // sin codigo (ver src/lib/solucionCode.ts).
    const solucionCode = await uniqueSolucionCode(generateSolucionCode(nombre));
    await prisma.solucion.create({
      data: {
        nombre,
        descripcion: lead.scope || null,
        tipo: tipoMap[lead.solucionAsociada] || 'PROJECT',
        valorEstimado: lead.estimatedValue || 0,
        leadId: lead.id,
        solucionCode,
      },
    });
    created++;
  }

  return NextResponse.json({ created, total: leads.length });
}
