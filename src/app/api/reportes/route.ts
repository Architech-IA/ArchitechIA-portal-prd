import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const hoy = new Date();

  const [allLeads, allProposals, allProjects, registros, topSocios] = await Promise.all([
    prisma.lead.findMany({
      select: { id: true, status: true, outcome: true, estimatedValue: true, createdAt: true, source: true, userId: true },
    }),
    prisma.proposal.findMany({
      select: { id: true, status: true, amount: true, createdAt: true, userId: true },
    }),
    prisma.project.findMany({
      select: { id: true, status: true, priority: true, progress: true, createdAt: true },
    }),
    prisma.registroFinanciero.findMany({
      where: { tipo: 'ingreso', estado: { not: 'cancelado' } },
      select: { monto: true, fecha: true, categoria: true },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, role: true,
        _count: { select: { leads: true, proposals: true } } },
      take: 6,
    }),
  ]);

  // ── KPIs globales
  const totalLeads       = allLeads.length;
  const leadsGanados     = allLeads.filter(l => l.status === 'RESULT' && l.outcome === 'WON').length;
  const leadsPerdidos    = allLeads.filter(l => l.status === 'RESULT' && l.outcome === 'LOST').length;
  const winRate          = totalLeads > 0 ? Math.round((leadsGanados / totalLeads) * 100) : 0;
  const avgDealSize      = leadsGanados > 0
    ? Math.round(allLeads.filter(l => l.status === 'RESULT' && l.outcome === 'WON').reduce((a, l) => a + l.estimatedValue, 0) / leadsGanados)
    : 0;
  const totalPipeline    = allLeads.filter(l => !(l.status === 'RESULT' && l.outcome === 'LOST')).reduce((a, l) => a + l.estimatedValue, 0);

  const totalProposals   = allProposals.length;
  const propAceptadas    = allProposals.filter(p => p.status === 'ACCEPTED').length;
  const acceptanceRate   = totalProposals > 0 ? Math.round((propAceptadas / totalProposals) * 100) : 0;

  const totalIngresos    = registros.reduce((a, r) => a + r.monto, 0);

  // ── Revenue por mes (últimos 6)
  const revenueMensual = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy);
    d.setMonth(hoy.getMonth() - (5 - i));
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const ini = `${y}-${String(m).padStart(2, '0')}-01`;
    const fin = `${y}-${String(m).padStart(2, '0')}-31`;
    return {
      mes:      d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
      ingresos: registros.filter(r => r.fecha >= ini && r.fecha <= fin).reduce((a, r) => a + r.monto, 0),
      deals:    allLeads.filter(l => l.status === 'RESULT' && l.outcome === 'WON' && l.createdAt >= new Date(ini) && l.createdAt <= new Date(fin + 'T23:59:59')).length,
    };
  });

  // ── Pipeline por etapa
  // RESULT reemplaza a WON/LOST como fase real — pero se sigue reportando
  // Ganado/Perdido como filas separadas del embudo (calculadas a partir de
  // outcome, no de status) para no perder ese desglose en el reporte.
  const ETAPAS = ['NEW','CONTACTED','DIAGNOSIS','DEMO_VALIDATION','PROPOSAL_SENT','NEGOTIATION'];
  const ETAPA_ES: Record<string, string> = {
    NEW: 'Nuevo', CONTACTED: 'Contactado', DIAGNOSIS: 'Diagnóstico',
    DEMO_VALIDATION: 'Demo', PROPOSAL_SENT: 'Propuesta', NEGOTIATION: 'Negociación',
  };
  const pipelineEtapas = [
    ...ETAPAS.map(s => ({
      status: s, label: ETAPA_ES[s],
      count: allLeads.filter(l => l.status === s).length,
      valor: allLeads.filter(l => l.status === s).reduce((a, l) => a + l.estimatedValue, 0),
    })),
    {
      status: 'RESULT_WON', label: 'Ganado',
      count: allLeads.filter(l => l.status === 'RESULT' && l.outcome === 'WON').length,
      valor: allLeads.filter(l => l.status === 'RESULT' && l.outcome === 'WON').reduce((a, l) => a + l.estimatedValue, 0),
    },
    {
      status: 'RESULT_LOST', label: 'Perdido',
      count: allLeads.filter(l => l.status === 'RESULT' && l.outcome === 'LOST').length,
      valor: allLeads.filter(l => l.status === 'RESULT' && l.outcome === 'LOST').reduce((a, l) => a + l.estimatedValue, 0),
    },
    {
      status: 'RESULT_PENDING', label: 'Resultado (sin definir)',
      count: allLeads.filter(l => l.status === 'RESULT' && !l.outcome).length,
      valor: allLeads.filter(l => l.status === 'RESULT' && !l.outcome).reduce((a, l) => a + l.estimatedValue, 0),
    },
  ].filter(e => e.count > 0);

  // ── Revenue por categoría
  const catMap: Record<string, number> = {};
  for (const r of registros) { catMap[r.categoria] = (catMap[r.categoria] || 0) + r.monto; }
  const revenueCategorias = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([cat, total]) => ({ cat, total }));

  // ── Propuestas por estado
  const propEstados = ['DRAFT','SENT','UNDER_REVIEW','ACCEPTED','REJECTED'].map(s => ({
    status: s, count: allProposals.filter(p => p.status === s).length,
    valor:  allProposals.filter(p => p.status === s).reduce((a, p) => a + p.amount, 0),
  }));

  return NextResponse.json({
    kpis: { totalLeads, leadsGanados, leadsPerdidos, winRate, avgDealSize, totalPipeline,
            totalProposals, propAceptadas, acceptanceRate, totalIngresos },
    revenueMensual,
    pipelineEtapas,
    revenueCategorias,
    propEstados,
    topSocios,
  });
}
