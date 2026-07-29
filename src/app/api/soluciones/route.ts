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

function generateSolucionCode(nombre: string): string {
  // Extract initials from each word (ignoring articles/prepositions)
  const stopWords = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'a', 'en', 'por', 'para', 'con', 'the', 'of', 'and', '&'])
  const words = nombre.split(/\s+/).filter(w => w.length > 0 && !stopWords.has(w.toLowerCase()))
  const code = words.map(w => w[0].toUpperCase()).join('')
  return code.slice(0, 6) // max 6 chars
}

async function uniqueSolucionCode(base: string): Promise<string> {
  let candidate = base
  let suffix = 2
  while (true) {
    const existing = await prisma.solucion.findFirst({ where: { solucionCode: candidate }, select: { id: true } })
    if (!existing) return candidate
    candidate = base.slice(0, 5) + suffix
    suffix++
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nombre, descripcion, tipo, estado, valorEstimado, empresa, leadId, repositorio, arquitectura, planTrabajo, cronograma, solucionCode } = body;

  const resolvedCode = solucionCode
    ? solucionCode.toUpperCase()
    : await uniqueSolucionCode(generateSolucionCode(nombre))

  const solucion = await prisma.solucion.create({
    data: {
      nombre,
      descripcion: descripcion || null,
      tipo,
      estado: estado || 'ACTIVO',
      valorEstimado: parseFloat(valorEstimado) || 0,
      empresa: empresa || null,
      leadId: leadId || null,
      repositorio: repositorio || null,
      arquitectura: arquitectura || '[]',
      planTrabajo: planTrabajo || null,
      cronograma: cronograma || '[]',
      solucionCode: resolvedCode,
    },
    include: { lead: { select: { id: true, companyName: true, contactName: true, status: true } } },
  });

  return NextResponse.json(solucion);
}
