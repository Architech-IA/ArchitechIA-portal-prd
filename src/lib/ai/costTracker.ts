/**
 * Tracker in-memory de costos de llamadas LLM.
 *
 * - Pre-flight checks: valida si una llamada está dentro de presupuesto.
 * - Post-flight recording: registra costos y dispara alertas.
 * - Dashboard: agregados por día/semana/mes y top emails por costo.
 *
 * Singleton vía globalThis; buffer circular para evitar memory leaks.
 */

import { getConfig, computeCost, type CostConfig } from './costConfig';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertLevel = 'WARNING' | 'CRITICAL' | 'BUDGET_EXCEEDED';

export interface CostRecord {
  callId: string;
  model: string;
  emailId?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  timestamp: number;
  durationMs: number;
}

export interface CostAlert {
  level: AlertLevel;
  message: string;
  timestamp: number;
  context: Record<string, unknown>;
}

export interface PreFlightResult {
  allowed: boolean;
  reason?: string;
}

export interface CostDashboard {
  totals: {
    day: { cost: number; calls: number };
    week: { cost: number; calls: number };
    month: { cost: number; calls: number };
  };
  limits: {
    dailyBudget: number;
    weeklyBudget: number;
    monthlyBudget: number;
    maxPerEmail: number;
    maxPerCompletion: number;
  };
  recentAlerts: CostAlert[];
  topEmailsByCost: Array<{ emailId: string; totalCost: number; calls: number }>;
  recentRecords: CostRecord[];
}

// ---------------------------------------------------------------------------
// Helpers de tiempo (UTC)
// ---------------------------------------------------------------------------

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(ts: number): number {
  const d = new Date(ts);
  const day = d.getUTCDay(); // 0=Sun
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

const GLOBAL_KEY = '__costTracker';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;

interface TrackerState {
  records: CostRecord[];
  alerts: CostAlert[];
  /** Acumulado por emailId para pre-flight */
  emailAccumulated: Map<string, number>;
}

if (!g[GLOBAL_KEY]) {
  g[GLOBAL_KEY] = {
    records: [],
    alerts: [],
    emailAccumulated: new Map(),
  } as TrackerState;
}
const state: TrackerState = g[GLOBAL_KEY];

const MAX_RECORDS = 1000;
const MAX_ALERTS = 200;

// ---------------------------------------------------------------------------
// Pre-flight checks
// ---------------------------------------------------------------------------

/**
 * Valida si una llamada LLM está permitida antes de ejecutarla.
 * Revisa: cap por completion, cap de tokens, acumulado por email,
 * budgets diario/semanal/mensual.
 */
export function preFlightCheck(params: {
  estimatedTokens: number;
  model: string;
  emailId?: string;
  config?: CostConfig;
}): PreFlightResult {
  const config = params.config ?? getConfig();
  const now = Date.now();
  const estimatedCost = computeCost(params.model, params.estimatedTokens, params.estimatedTokens);

  // 1. Cap por completion (estimación worst-case: todos tokens de output)
  const worstCaseCost = computeCost(params.model, 0, params.estimatedTokens);
  if (worstCaseCost > config.maxPerCompletion) {
    return {
      allowed: false,
      reason: `Estimated cost $${worstCaseCost.toFixed(4)} exceeds per-completion cap $${config.maxPerCompletion}`,
    };
  }

  // 2. Cap de tokens
  if (params.estimatedTokens > config.maxTokens) {
    return {
      allowed: false,
      reason: `Estimated ${params.estimatedTokens} tokens exceeds cap of ${config.maxTokens}`,
    };
  }

  // 3. Acumulado por email
  if (params.emailId) {
    const accumulated = state.emailAccumulated.get(params.emailId) ?? 0;
    if (accumulated + worstCaseCost > config.maxPerEmail) {
      return {
        allowed: false,
        reason: `Email ${params.emailId} accumulated $${accumulated.toFixed(4)} + est $${worstCaseCost.toFixed(4)} would exceed cap $${config.maxPerEmail}`,
      };
    }
  }

  // 4. Budget diario
  const dayStart = startOfDay(now);
  const dayCost = aggregateCost(dayStart, now);
  if (dayCost + worstCaseCost > config.dailyBudget) {
    return {
      allowed: false,
      reason: `Daily cost $${dayCost.toFixed(4)} + est $${worstCaseCost.toFixed(4)} would exceed budget $${config.dailyBudget}`,
    };
  }

  // 5. Budget semanal
  const weekStart = startOfWeek(now);
  const weekCost = aggregateCost(weekStart, now);
  if (weekCost + worstCaseCost > config.weeklyBudget) {
    return {
      allowed: false,
      reason: `Weekly cost $${weekCost.toFixed(4)} + est $${worstCaseCost.toFixed(4)} would exceed budget $${config.weeklyBudget}`,
    };
  }

  // 6. Budget mensual
  const monthStart = startOfMonth(now);
  const monthCost = aggregateCost(monthStart, now);
  if (monthCost + worstCaseCost > config.monthlyBudget) {
    return {
      allowed: false,
      reason: `Monthly cost $${monthCost.toFixed(4)} + est $${worstCaseCost.toFixed(4)} would exceed budget $${config.monthlyBudget}`,
    };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Post-flight recording
// ---------------------------------------------------------------------------

/**
 * Registra el costo de una llamada completada y dispara alertas si corresponde.
 */
export function recordCost(record: CostRecord, config?: CostConfig): void {
  const cfg = config ?? getConfig();

  // Dedup por callId
  if (state.records.some((r) => r.callId === record.callId)) return;

  state.records.push(record);

  // Acumular por email
  if (record.emailId) {
    const prev = state.emailAccumulated.get(record.emailId) ?? 0;
    state.emailAccumulated.set(record.emailId, prev + record.costUsd);
  }

  // Trim buffer circular
  if (state.records.length > MAX_RECORDS) {
    state.records.splice(0, state.records.length - MAX_RECORDS);
  }

  // Verificar thresholds de alerta
  const now = Date.now();
  const dayStart = startOfDay(now);
  const dayCost = aggregateCost(dayStart, now);
  const weekStart = startOfWeek(now);
  const weekCost = aggregateCost(weekStart, now);
  const monthStart = startOfMonth(now);
  const monthCost = aggregateCost(monthStart, now);

  // Helper para emitir alerta con dedup
  const emitAlert = (level: AlertLevel, message: string, context: Record<string, unknown>) => {
    const recent = state.alerts.find(
      (a) => a.level === level && a.context['key'] === context['key'] && now - a.timestamp < 60_000,
    );
    if (!recent) {
      const alert: CostAlert = { level, message, timestamp: now, context };
      state.alerts.push(alert);
      if (state.alerts.length > MAX_ALERTS) {
        state.alerts.splice(0, state.alerts.length - MAX_ALERTS);
      }
    }
  };

  // Daily budget
  if (dayCost > cfg.dailyBudget) {
    emitAlert('BUDGET_EXCEEDED', `Daily budget exceeded: $${dayCost.toFixed(2)} / $${cfg.dailyBudget}`, {
      key: 'daily',
      cost: dayCost,
      budget: cfg.dailyBudget,
    });
  } else if (dayCost > cfg.dailyBudget * 0.9) {
    emitAlert('CRITICAL', `Daily cost at ${(dayCost / cfg.dailyBudget) * 100}%: $${dayCost.toFixed(2)} / $${cfg.dailyBudget}`, {
      key: 'daily',
      cost: dayCost,
      budget: cfg.dailyBudget,
    });
  } else if (dayCost > cfg.dailyBudget * 0.7) {
    emitAlert('WARNING', `Daily cost at ${(dayCost / cfg.dailyBudget) * 100}%: $${dayCost.toFixed(2)} / $${cfg.dailyBudget}`, {
      key: 'daily',
      cost: dayCost,
      budget: cfg.dailyBudget,
    });
  }

  // Weekly budget
  if (weekCost > cfg.weeklyBudget) {
    emitAlert('BUDGET_EXCEEDED', `Weekly budget exceeded: $${weekCost.toFixed(2)} / $${cfg.weeklyBudget}`, {
      key: 'weekly',
      cost: weekCost,
      budget: cfg.weeklyBudget,
    });
  } else if (weekCost > cfg.weeklyBudget * 0.9) {
    emitAlert('CRITICAL', `Weekly cost at ${(weekCost / cfg.weeklyBudget) * 100}%: $${weekCost.toFixed(2)} / $${cfg.weeklyBudget}`, {
      key: 'weekly',
      cost: weekCost,
      budget: cfg.weeklyBudget,
    });
  } else if (weekCost > cfg.weeklyBudget * 0.7) {
    emitAlert('WARNING', `Weekly cost at ${(weekCost / cfg.weeklyBudget) * 100}%: $${weekCost.toFixed(2)} / $${cfg.weeklyBudget}`, {
      key: 'weekly',
      cost: weekCost,
      budget: cfg.weeklyBudget,
    });
  }

  // Monthly budget
  if (monthCost > cfg.monthlyBudget) {
    emitAlert('BUDGET_EXCEEDED', `Monthly budget exceeded: $${monthCost.toFixed(2)} / $${cfg.monthlyBudget}`, {
      key: 'monthly',
      cost: monthCost,
      budget: cfg.monthlyBudget,
    });
  } else if (monthCost > cfg.monthlyBudget * 0.9) {
    emitAlert('CRITICAL', `Monthly cost at ${(monthCost / cfg.monthlyBudget) * 100}%: $${monthCost.toFixed(2)} / $${cfg.monthlyBudget}`, {
      key: 'monthly',
      cost: monthCost,
      budget: cfg.monthlyBudget,
    });
  } else if (monthCost > cfg.monthlyBudget * 0.7) {
    emitAlert('WARNING', `Monthly cost at ${(monthCost / cfg.monthlyBudget) * 100}%: $${monthCost.toFixed(2)} / $${cfg.monthlyBudget}`, {
      key: 'monthly',
      cost: monthCost,
      budget: cfg.monthlyBudget,
    });
  }

  // Email per-cap
  if (record.emailId) {
    const emailTotal = state.emailAccumulated.get(record.emailId) ?? 0;
    if (emailTotal > cfg.maxPerEmail) {
      emitAlert('BUDGET_EXCEEDED', `Email ${record.emailId} exceeded cap: $${emailTotal.toFixed(4)} / $${cfg.maxPerEmail}`, {
        key: `email:${record.emailId}`,
        cost: emailTotal,
        budget: cfg.maxPerEmail,
      });
    } else if (emailTotal > cfg.maxPerEmail * 0.9) {
      emitAlert('CRITICAL', `Email ${record.emailId} at ${(emailTotal / cfg.maxPerEmail) * 100}% of cap: $${emailTotal.toFixed(4)}`, {
        key: `email:${record.emailId}`,
        cost: emailTotal,
        budget: cfg.maxPerEmail,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function getDashboard(): CostDashboard {
  const config = getConfig();
  const now = Date.now();
  const dayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  // Agregados
  const dayRecords = state.records.filter((r) => r.timestamp >= dayStart);
  const weekRecords = state.records.filter((r) => r.timestamp >= weekStart);
  const monthRecords = state.records.filter((r) => r.timestamp >= monthStart);

  const sumCost = (records: CostRecord[]) => records.reduce((s, r) => s + r.costUsd, 0);

  // Top emails por costo
  const emailMap = new Map<string, { totalCost: number; calls: number }>();
  for (const r of state.records) {
    if (r.emailId) {
      const entry = emailMap.get(r.emailId) ?? { totalCost: 0, calls: 0 };
      entry.totalCost += r.costUsd;
      entry.calls += 1;
      emailMap.set(r.emailId, entry);
    }
  }
  const topEmails = Array.from(emailMap.entries())
    .map(([emailId, data]) => ({ emailId, ...data }))
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 20);

  return {
    totals: {
      day: { cost: sumCost(dayRecords), calls: dayRecords.length },
      week: { cost: sumCost(weekRecords), calls: weekRecords.length },
      month: { cost: sumCost(monthRecords), calls: monthRecords.length },
    },
    limits: {
      dailyBudget: config.dailyBudget,
      weeklyBudget: config.weeklyBudget,
      monthlyBudget: config.monthlyBudget,
      maxPerEmail: config.maxPerEmail,
      maxPerCompletion: config.maxPerCompletion,
    },
    recentAlerts: [...state.alerts].reverse().slice(0, 50),
    topEmailsByCost: topEmails,
    recentRecords: [...state.records].reverse().slice(0, 50),
  };
}

/**
 * Retorna el costo acumulado de un email específico.
 */
export function getEmailCost(emailId: string): number {
  return state.emailAccumulated.get(emailId) ?? 0;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function aggregateCost(from: number, to: number): number {
  return state.records
    .filter((r) => r.timestamp >= from && r.timestamp < to)
    .reduce((sum, r) => sum + r.costUsd, 0);
}
