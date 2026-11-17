import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

// Series históricas reales para las tarjetas de métricas del Dashboard.
//   GET /api/dashboard/serie?kpi=resumen            -> mini-series (13 semanas) de las 4 tarjetas
//   GET /api/dashboard/serie?kpi=leads&dias=30|90|365 -> detalle para el popup
// Todo se agrupa por fecha de creación, en hora de Colombia (UTC-5).

type Kpi = 'leads' | 'proposals' | 'conversion' | 'projects';
const KPIS: Kpi[] = ['leads', 'proposals', 'conversion', 'projects'];
const DIA = 86_400_000;
const OFFSET = -5 * 3_600_000;

interface Item { id: string; titulo: string; estado: string; valor: number; fecha: Date; ganado: boolean; grupo: string }

const medianoche = (d: Date) => { const t = new Date(d.getTime() + OFFSET); return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()); };
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Escala de cubos (días / semanas / meses) terminando hoy; `previo` desplaza una ventana atrás.
function escala(dias: number, previo: boolean) {
  const hoy = medianoche(new Date());
  if (dias === 365) {
    const t = new Date(hoy);
    const base = t.getUTCFullYear() * 12 + t.getUTCMonth() - 11 - (previo ? 12 : 0);
    return {
      n: 12,
      indice: (d: Date) => { const l = new Date(medianoche(d)); return l.getUTCFullYear() * 12 + l.getUTCMonth() - base; },
      inicio: (i: number) => new Date(Date.UTC(Math.floor((base + i) / 12), (base + i) % 12, 1)),
      etiqueta: (i: number) => `${MES[(base + i) % 12]} ${String(Math.floor((base + i) / 12)).slice(2)}`,
    };
  }
  const tam = dias === 30 ? 1 : 7;
  const n = dias === 30 ? 30 : 13;
  const inicio0 = hoy - (n * tam - 1) * DIA - (previo ? n * tam * DIA : 0);
  return {
    n,
    indice: (d: Date) => Math.floor((medianoche(d) - inicio0) / (tam * DIA)),
    inicio: (i: number) => new Date(inicio0 + i * tam * DIA),
    etiqueta: (i: number) => { const f = new Date(inicio0 + i * tam * DIA); return `${f.getUTCDate()} ${MES[f.getUTCMonth()]}`; },
  };
}

async function cargar(kpi: Kpi): Promise<Item[]> {
  if (kpi === 'proposals') {
    const r = await prisma.proposal.findMany({ select: { id: true, title: true, status: true, amount: true, createdAt: true } });
    return r.map(p => ({ id: p.id, titulo: p.title, estado: p.status, valor: p.amount, fecha: p.createdAt, ganado: p.status === 'ACCEPTED', grupo: p.status }));
  }
  if (kpi === 'projects') {
    const r = await prisma.project.findMany({ select: { id: true, name: true, status: true, createdAt: true } });
    return r.map(p => ({ id: p.id, titulo: p.name, estado: p.status, valor: 0, fecha: p.createdAt, ganado: p.status === 'COMPLETED', grupo: p.status }));
  }
  const r = await prisma.lead.findMany({ select: { id: true, companyName: true, status: true, outcome: true, estimatedValue: true, source: true, createdAt: true } });
  return r.map(l => ({ id: l.id, titulo: l.companyName, estado: l.status, valor: l.estimatedValue, fecha: l.createdAt, ganado: l.status === 'RESULT' && l.outcome === 'WON', grupo: l.source || 'Sin fuente' }));
}

function serie(items: Item[], kpi: Kpi, dias: number) {
  const e = escala(dias, false);
  const n = Array(e.n).fill(0), valor = Array(e.n).fill(0), ganados = Array(e.n).fill(0);
  for (const it of items) {
    const i = e.indice(it.fecha);
    if (i < 0 || i >= e.n) continue;
    n[i]++; valor[i] += it.valor; if (it.ganado) ganados[i]++;
  }
  // Conversión: tasa acumulada (ganados / creados) hasta el final de cada cubo.
  let acumN = items.filter(it => e.indice(it.fecha) < 0).length;
  let acumG = items.filter(it => e.indice(it.fecha) < 0 && it.ganado).length;
  const tasa = n.map((c: number, i: number) => { acumN += c; acumG += ganados[i]; return acumN ? Math.round((acumG / acumN) * 1000) / 10 : 0; });
  return { e, n, valor, ganados, tasa, principal: kpi === 'conversion' ? tasa : n };
}

export async function GET(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const kpi = request.nextUrl.searchParams.get('kpi') ?? 'resumen';

  if (kpi === 'resumen') {
    const out: Record<string, number[]> = {};
    for (const k of KPIS) out[k] = serie(await cargar(k), k, 90).principal;
    return NextResponse.json(out);
  }
  if (!KPIS.includes(kpi as Kpi)) return NextResponse.json({ error: 'kpi inválido' }, { status: 400 });

  const d = Number(request.nextUrl.searchParams.get('dias'));
  const dias = d === 30 || d === 365 ? d : 90;
  const items = await cargar(kpi as Kpi);
  const s = serie(items, kpi as Kpi, dias);
  const prev = escala(dias, true);

  const enPeriodo = items.filter(it => { const i = s.e.indice(it.fecha); return i >= 0 && i < s.e.n; });
  const enPrevio = items.filter(it => { const i = prev.indice(it.fecha); return i >= 0 && i < prev.n; });
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const pico = s.n.indexOf(Math.max(...s.n));

  const conteo = (arr: Item[], f: (i: Item) => string) => {
    const m = new Map<string, number>();
    arr.forEach(i => m.set(f(i), (m.get(f(i)) ?? 0) + 1));
    return [...m.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad })).sort((a, b) => b.cantidad - a.cantidad);
  };

  const ganadosTot = items.filter(i => i.ganado).length;
  return NextResponse.json({
    kpi, dias,
    puntos: s.n.map((c: number, i: number) => ({
      etiqueta: s.e.etiqueta(i), inicio: s.e.inicio(i).toISOString(),
      n: c, valor: s.valor[i], ganados: s.ganados[i], tasa: s.tasa[i],
    })),
    resumen: {
      totalActual: items.length,
      periodo: enPeriodo.length,
      periodoPrevio: enPrevio.length,
      valorPeriodo: sum(s.valor),
      valorPrevio: enPrevio.reduce((a, i) => a + i.valor, 0),
      ganadosPeriodo: sum(s.ganados),
      tasaActual: items.length ? Math.round((ganadosTot / items.length) * 1000) / 10 : 0,
      promedio: Math.round((sum(s.n) / s.e.n) * 10) / 10,
      pico: { etiqueta: s.e.etiqueta(pico), n: s.n[pico] ?? 0 },
    },
    porEstado: conteo(enPeriodo, i => i.estado),
    porGrupo: kpi === 'leads' ? conteo(enPeriodo, i => i.grupo).slice(0, 6) : [],
    recientes: [...enPeriodo].sort((a, b) => b.fecha.getTime() - a.fecha.getTime()).slice(0, 8)
      .map(i => ({ id: i.id, titulo: i.titulo, estado: i.estado, valor: i.valor, fecha: i.fecha.toISOString() })),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
