import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const INTERN_SOLUTION_NAME = 'Portal Interno ArchitechIA';

/**
 * Garantiza que exista la solución interna base. Se ejecuta de forma perezosa
 * en el GET de soluciones; tras la primera corrida ya existe y no hace nada.
 */
async function ensureInternSolution(): Promise<void> {
  const existing = await prisma.solucion.findFirst({
    where: { tipo: 'INTERN', nombre: INTERN_SOLUTION_NAME },
    select: { id: true },
  });
  if (existing) return;

  await prisma.solucion.create({
    data: {
      nombre: INTERN_SOLUTION_NAME,
      descripcion: 'Solución interna que agrupa el portal, herramientas y plataformas de ArchiTechIA.',
      tipo: 'INTERN',
      estado: 'ACTIVO',
      valorEstimado: 0,
    },
  });
}

export async function GET(request: NextRequest) {
  await ensureInternSolution();

  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get('tipo');

  const soluciones = await prisma.solucion.findMany({
    where: tipo ? { tipo } : undefined,
    include: { lead: { select: { id: true, companyName: true, contactName: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(soluciones);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nombre, descripcion, tipo, estado, valorEstimado, leadId, repositorio, arquitectura } = body;

  const solucion = await prisma.solucion.create({
    data: {
      nombre,
      descripcion: descripcion || null,
      tipo,
      estado: estado || 'ACTIVO',
      valorEstimado: parseFloat(valorEstimado) || 0,
      leadId: leadId || null,
      repositorio: repositorio || null,
      arquitectura: arquitectura || '[]',
    },
    include: { lead: { select: { id: true, companyName: true, contactName: true, status: true } } },
  });

  return NextResponse.json(solucion);
}
