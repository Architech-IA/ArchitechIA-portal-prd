import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 30_000;

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const userId = (token as { sub?: string })?.sub;

  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data, {
      headers: { 'X-Cache': 'HIT' },
    });
  }

  const hoy = new Date();
  const hace7dias  = new Date(hoy); hace7dias.setDate(hoy.getDate() - 7);
  const hace5dias  = new Date(hoy); hace5dias.setDate(hoy.getDate() - 5);
  const en7dias    = new Date(hoy); en7dias.setDate(hoy.getDate() + 7);
  const hace6meses = new Date(hoy); hace6meses.setMonth(hoy.getMonth() - 6);

  const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`;
  const finMes    = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-31`;

  // Ronda 1: todas las queries independientes en paralelo
  const myDayQueries = userId ? [
    prisma.lead.findMany({
      where: { userId, status: { in: ['NEW', 'CONTACTED'] } },
      select: { id: true, companyName: true, contactName: true, status: true, updatedAt: true },
      orderBy: { updatedAt: 'asc' }, take: 5,
    }),
    prisma.proposal.findMany({
      where: { userId, status: { in: ['DRAFT', 'SENT', 'UNDER_REVIEW'] } },
      select: { id: true, title: true, status: true, amount: true, createdAt: true },
      orderBy: { createdAt: 'desc' }, take: 5,
    }),
  ] : [Promise.resolve([]), Promise.resolve([])];

  const [
    allLeads, allProposals, allProjects, activityCount,
    topSocios, registros, recentActivities,
    backlogItems, sprint,
    registrosPendientes,
    myLeads, myProposals,
  ] = await Promise.all([
    prisma.lead.findMany({
      select: { id: true, companyName: true, status: true, estimatedValue: true,
                updatedAt: true, source: true, createdAt: true },
    }),
    prisma.proposal.findMany({
      select: { id: true, title: true, status: true, amount: true, sentDate: true, createdAt: true },
    }),
    prisma.project.findMany({
      select: { id: true, name: true, status: true, priority: true,
                progress: true, endDate: true, createdAt: true },
    }),
    prisma.activity.count(),
    prisma.user.findMany({
      select: { id: true, name: true, role: true,
        _count: { select: { leads: true, proposals: true, projects: true } } },
      orderBy: { leads: { _count: 'desc' } },
      take: 4,
    }),
    prisma.registroFinanciero.findMany({
      where: { tipo: 'ingreso', estado: { not: 'cancelado' },
        fecha: { gte: `${hace6meses.getFullYear()}-${String(hace6meses.getMonth() + 1).padStart(2, '0')}-01` } },
      select: { id: true, concepto: true, monto: true, moneda: true, tipo: true, fecha: true, estado: true },
    }),
    prisma.activity.findMany({
      take: 8, orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true } } },
    }),
    prisma.backlogItem.findMany({ select: { status: true, type: true, points: true } }),
    prisma.sprint.findFirst({ where: { status: 'ACTIVE' }, select: { id: true, name: true, endDate: true } }),
    prisma.registroFinanciero.findMany({
      where: { estado: 'pendiente' },
      select: { id: true, concepto: true, monto: true, moneda: true, tipo: true },
      take: 5,
    }),
    ...myDayQueries,
  ]);

  // Ronda 2: solo sprintItems depende del resultado anterior
  const sprintItems = sprint
    ? await prisma.backlogItem.findMany({ where: { sprintId: sprint.id } })
    : [];

  // Backlog stats
  const backlogStats = {
    total: backlogItems.length,
    pendientes: backlogItems.filter((i: any) => i.status === 'BACKLOG').length,
    enProgreso: backlogItems.filter((i: any) => i.status === 'IN_PROGRESS').length,
    completados: backlogItems.filter((i: any) => i.status === 'DONE').length,
    puntosTotales: backlogItems.reduce((a: number, i: any) => a + (i.points || 0), 0),
    sprintActivo: sprint ? { name: sprint.name, endDate: sprint.endDate, items: sprintItems.length } : null,
    sprintBurndown: sprint ? sprintItems.map((i: any) => ({ status: i.status, points: i.points || 0 })) : [],
  };

  const myDay = {
    leadsContactar: (myLeads as any[]).map(l => ({ id: l.id, companyName: l.companyName, contactName: l.contactName, status: l.status, updatedAt: l.updatedAt })),
    propuestasPendientes: (myProposals as any[]).map(p => ({ id: p.id, title: p.title, status: p.status, amount: p.amount })),
    tareasVencidas: [],
  };

  const leads     = allLeads.length;
  const proposals = allProposals.length;
  const projects  = allProjects.length;

  const totalEstimatedValue = allLeads.reduce((a, l) => a + l.estimatedValue, 0);
  const leadsGanados        = allLeads.filter(l => l.status === 'WON').length;
  const conversionRate      = leads > 0 ? Math.round((leadsGanados / leads) * 100) : 0;

  const leadsByStatus     = groupCount(allLeads,     'status');
  const proposalsByStatus = groupCount(allProposals, 'status');
  const projectsByStatus  = groupCount(allProjects,  'status');
  const industriaLeads    = groupCount(allLeads,     'source');

  const leadsInactivos = allLeads
    .filter(l => !['WON', 'LOST'].includes(l.status) && l.updatedAt < hace7dias)
    .slice(0, 5)
    .map(l => ({ id: l.id, companyName: l.companyName, status: l.status, updatedAt: l.updatedAt }));

  const propuestasSinRespuesta = allProposals
    .filter(p => p.status === 'SENT' && p.sentDate && new Date(p.sentDate) < hace5dias)
    .slice(0, 5)
    .map(p => ({ id: p.id, title: p.title, amount: p.amount, sentDate: p.sentDate }));

  const proximosDeadlines = allProjects
    .filter(p => !['COMPLETED','CANCELLED'].includes(p.status) && p.endDate && new Date(p.endDate) >= hoy && new Date(p.endDate) <= en7dias)
    .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())
    .slice(0, 5)
    .map(p => ({ id: p.id, name: p.name, endDate: p.endDate, progress: p.progress, priority: p.priority }));

  const ETAPAS_EMBUDO = ['NEW','CONTACTED','DIAGNOSIS','QUALIFIED','DEMO_VALIDATION','PROPOSAL_SENT','NEGOTIATION','WON'];
  const embudo = ETAPAS_EMBUDO.map(status => ({
    status,
    count: allLeads.filter(l => l.status === status).length,
    valor: allLeads.filter(l => l.status === status).reduce((a, l) => a + l.estimatedValue, 0),
  }));

  const ingresosMes = registros.filter(r => r.fecha >= inicioMes && r.fecha <= finMes).reduce((a, r) => a + r.monto, 0);
  const metaMensual = 30000;

  const tendencias = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy);
    d.setMonth(hoy.getMonth() - (5 - i));
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const ini = `${y}-${String(m).padStart(2, '0')}-01`;
    const fin = `${y}-${String(m).padStart(2, '0')}-31`;
    return {
      mes:      new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'short' }),
      leads:    allLeads.filter(l => l.createdAt >= new Date(ini) && l.createdAt <= new Date(fin + 'T23:59:59')).length,
      proyectos: allProjects.filter(p => p.createdAt >= new Date(ini) && p.createdAt <= new Date(fin + 'T23:59:59')).length,
      ingresos: registros.filter(r => r.fecha >= ini && r.fecha <= fin).reduce((a, r) => a + r.monto, 0),
    };
  });

  const result = {
    counts: { leads, proposals, projects, activities: activityCount },
    leadsByStatus, proposalsByStatus, projectsByStatus,
    totalEstimatedValue, conversionRate, leadsGanados,
    leadsInactivos, propuestasSinRespuesta, proximosDeadlines,
    topSocios, embudo, industriaLeads,
    metaMensual, ingresosMes, registrosPendientes,
    recentActivities, tendencias, myDay,
    staleLeads: leadsInactivos, backlogStats,
  };

  cache = { data: result, ts: Date.now() };

  return NextResponse.json(result, {
    headers: { 'X-Cache': 'MISS' },
  });
}

function groupCount<T extends Record<string, unknown>>(arr: T[], key: keyof T) {
  const map: Record<string, number> = {};
  for (const item of arr) {
    const val = String(item[key]);
    map[val] = (map[val] || 0) + 1;
  }
  return Object.entries(map).map(([status, _count]) => ({ status, _count }));
}
