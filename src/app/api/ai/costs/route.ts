/**
 * GET  /api/ai/costs — Dashboard de costos, circuit breakers, o costo por email
 * POST /api/ai/costs — Reset de breakers (admin)
 *
 * Query params (GET):
 *   ?view=dashboard  — vista completa (default)
 *   ?view=breakers   — solo snapshots de circuit breakers
 *   ?emailId=xxx     — costo acumulado de un email específico
 *
 * Body (POST):
 *   { action: 'reset-breaker', key: string }  — resetea un breaker
 *   { action: 'reset-all' }                   — resetea todos
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthed } from '@/lib/apiAuth';
import {
  getDashboard,
  getAllBreakerSnapshots,
  getEmailCost,
  resetBreaker,
  resetAllBreakers,
} from '@/lib/ai';

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!(await isAuthed(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') ?? 'dashboard';
  const emailId = searchParams.get('emailId');

  // Vista por email específico
  if (emailId) {
    const cost = getEmailCost(emailId);
    return NextResponse.json({ emailId, accumulatedCostUsd: cost });
  }

  // Vista solo breakers
  if (view === 'breakers') {
    const breakers = getAllBreakerSnapshots();
    return NextResponse.json({ breakers });
  }

  // Dashboard completo (default)
  const dashboard = getDashboard();
  const breakers = getAllBreakerSnapshots();
  return NextResponse.json({ ...dashboard, breakers });
}

// ---------------------------------------------------------------------------
// POST — Admin actions
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!(await isAuthed(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { action?: string; key?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.action === 'reset-all') {
    resetAllBreakers();
    return NextResponse.json({ ok: true, message: 'All circuit breakers reset' });
  }

  if (body.action === 'reset-breaker' && body.key) {
    resetBreaker(body.key);
    return NextResponse.json({ ok: true, message: `Breaker "${body.key}" reset` });
  }

  return NextResponse.json(
    { error: 'Invalid action. Use "reset-breaker" with key, or "reset-all".' },
    { status: 400 },
  );
}
