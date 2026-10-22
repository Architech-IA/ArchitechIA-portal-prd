/**
 * Orquestador que integra circuit breaker + cost tracker en un punto
 * de entrada único para todas las llamadas LLM.
 *
 * Punto de uso:
 *   const check = costMonitor.validate({ model, estimatedTokens, emailId });
 *   if (!check.allowed) throw new Error(check.reason);
 *   // ... ejecutar LLM ...
 *   costMonitor.recordCompleted({ callId, model, ... });
 */

import {
  canExecute,
  recordSuccess as cbRecordSuccess,
  recordFailure as cbRecordFailure,
  getBreakerSnapshot,
  getAllBreakerSnapshots,
} from './circuitBreaker';
import {
  preFlightCheck,
  recordCost,
  getDashboard,
  getEmailCost,
  type CostRecord,
  type CostAlert,
  type PreFlightResult,
} from './costTracker';
import { getConfig } from './costConfig';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidateParams {
  model: string;
  estimatedTokens: number;
  emailId?: string;
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  breakerOpen?: boolean;
}

export interface CompletedParams {
  callId: string;
  model: string;
  emailId?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export interface FailedParams {
  key: string;
  error?: unknown;
}

// ---------------------------------------------------------------------------
// Alert callbacks (listeners externos para notificaciones, emails, etc.)
// ---------------------------------------------------------------------------

type AlertCallback = (alert: CostAlert) => void;

const GLOBAL_KEY = '__costMonitorCallbacks';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = [] as AlertCallback[];
const alertListeners: AlertCallback[] = g[GLOBAL_KEY];

/**
 * Registra un listener externo que recibe cada alerta de costo.
 * Útil para enviar notificaciones (email, Telegram, webhook).
 */
export function onCostAlert(callback: AlertCallback): () => void {
  alertListeners.push(callback);
  // Retorna función para desregistrar
  return () => {
    const idx = alertListeners.indexOf(callback);
    if (idx !== -1) alertListeners.splice(idx, 1);
  };
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Pre-flight: combina circuit breaker + cost tracker para decidir si
 * una llamada LLM puede ejecutarse.
 */
export function validate(params: ValidateParams): ValidationResult {
  const breakerKey = `llm:${params.model}`;

  // 1. Circuit breaker check
  if (!canExecute(breakerKey)) {
    const snapshot = getBreakerSnapshot(breakerKey);
    return {
      allowed: false,
      reason: `Circuit breaker OPEN for ${params.model} (failures: ${snapshot.consecutiveFailures})`,
      breakerOpen: true,
    };
  }

  // 2. Cost pre-flight check
  const config = getConfig();
  const costCheck = preFlightCheck({
    estimatedTokens: params.estimatedTokens,
    model: params.model,
    emailId: params.emailId,
    config,
  });

  if (!costCheck.allowed) {
    return {
      allowed: false,
      reason: costCheck.reason,
      breakerOpen: false,
    };
  }

  return { allowed: true };
}

/**
 * Registra una llamada completada exitosamente en breaker y tracker.
 */
export function recordCompleted(params: CompletedParams): void {
  const breakerKey = `llm:${params.model}`;
  cbRecordSuccess(breakerKey);

  const record: CostRecord = {
    callId: params.callId,
    model: params.model,
    emailId: params.emailId,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    costUsd: params.costUsd,
    timestamp: Date.now(),
    durationMs: params.durationMs,
  };
  const config = getConfig();
  recordCost(record, config);
}

/**
 * Registra una llamada fallida (solo actualiza el circuit breaker).
 */
export function recordFailed(params: FailedParams): void {
  cbRecordFailure(params.key);
}

// ---------------------------------------------------------------------------
// Re-exportaciones de conveniencia para acceso rápido al dashboard
// ---------------------------------------------------------------------------

export { getDashboard, getEmailCost, getAllBreakerSnapshots };
