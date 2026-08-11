import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity';
import { triggerSolutionProposal } from '@/lib/council-trigger';

const INTERN_SOLUTION_NAME = 'Portal Interno ArchitechIA';

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
      tipo: 'INTERN', estado: 'ACTIVO', valorEstimado: 0,
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
  const stopWords = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'a', 'en', 'por', 'para', 'con', 'the', 'of', 'and', '&'])
  const words = nombre.split(/\s+/).filter(w => w.length > 0 && !stopWords.has(w.toLowerCase()))
  return words.map(w => w[0].toUpperCase()).join('').slice(0, 6)
}

async function uniqueSolucionCode(base: string): Promise<string> {
  let candidate = base, suffix = 2
  while (true) {
    const existing = await prisma.solucion.findFirst({ where: { solucionCode: candidate }, select: { id: true } })
    if (!existing) return candidate
    candidate = base.slice(0, 5) + suffix; suffix++
  }
}

export async function POST(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const body = await request.json();
  const { nombre, descripcion, tipo, estado, valorEstimado, empresa, leadId, repositorio, arquitectura, planTrabajo, cronograma, solucionCode } = body;

  const resolvedCode = solucionCode ? solucionCode.toUpperCase() : await uniqueSolucionCode(generateSolucionCode(nombre))

  const solucion = await prisma.solucion.create({
    data: {
      nombre, descripcion: descripcion || null, tipo, estado: estado || 'ACTIVO',
      valorEstimado: parseFloat(valorEstimado) || 0, empresa: empresa || null,
      leadId: leadId || null, repositorio: repositorio || null,
      arquitectura: arquitectura || '[]', planTrabajo: planTrabajo || null,
      cronograma: cronograma || '[]', solucionCode: resolvedCode,
    },
    include: { lead: { select: { id: true, companyName: true, contactName: true, status: true } } },
  });
  await logActivity({
    type: 'CREATED', description: 'creó la solución ' + nombre,
    entityType: 'solucion', entityId: solucion.id, userId: token?.sub,
  });
  triggerSolutionProposal({ id: solucion.id, nombre: solucion.nombre, descripcion: solucion.descripcion, tipo: solucion.tipo }).catch(console.error);
  return NextResponse.json(solucion);
}
