import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { agentesFuncionales } from '@/lib/orquestador/registroDatos';

// Agentes del directorio con su área real (por areaId) y si tienen función real en el portal.
export async function GET() {
  const agentes = await prisma.agent.findMany({ orderBy: { name: 'asc' }, select: { slug: true, name: true, role: true, status: true, llmModel: true, areaId: true, personality: true } });
  const registro = await agentesFuncionales();
  return NextResponse.json(agentes.map(a => ({ ...a, funcional: registro[a.slug] ?? null })));
}
