/**
 * State machine genérica de circuit breaker para proteger llamadas LLM.
 *
 * Estados:
 *   CLOSED  → funciona normalmente; tras N fallos consecutivos pasa a OPEN
 *   OPEN    → rechaza llamadas; tras cooldown pasa a HALF_OPEN
 *   HALF_OPEN → permite 1 intento; si tiene éxito → CLOSED, si falla → OPEN
 *
 * Singleton por key: sobrevive hot-reloads gracias a globalThis.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export enum BreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface BreakerConfig {
  /** Fallos consecutivos para abrir el breaker */
  failureThreshold: number;
  /** Tiempo en ms antes de pasar de OPEN a HALF_OPEN */
  cooldownMs: number;
  /** Éxitos consecutivos en HALF_OPEN para cerrar */
  successThreshold: number;
}

export interface BreakerSnapshot {
  key: string;
  state: BreakerState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureAt: number | null;
  openedAt: number | null;
  config: BreakerConfig;
}

// ---------------------------------------------------------------------------
// Singleton storage en globalThis (persiste entre requests / hot-reloads)
// ---------------------------------------------------------------------------

interface BreakerInternal {
  state: BreakerState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureAt: number | null;
  openedAt: number | null;
  config: BreakerConfig;
}

const GLOBAL_KEY = '__circuitBreakers';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map<string, BreakerInternal>();
const breakers: Map<string, BreakerInternal> = g[GLOBAL_KEY];

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function defaultConfig(): BreakerConfig {
  return {
    failureThreshold: envInt('AI_CB_FAILURE_THRESHOLD', 3),
    cooldownMs: envInt('AI_CB_COOLDOWN_MS', 60_000),
    successThreshold: 2,
  };
}

// ---------------------------------------------------------------------------
// Funciones internas
// ---------------------------------------------------------------------------

function getOrCreate(key: string): BreakerInternal {
  if (!breakers.has(key)) {
    breakers.set(key, {
      state: BreakerState.CLOSED,
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      lastFailureAt: null,
      openedAt: null,
      config: defaultConfig(),
    });
  }
  return breakers.get(key)!;
}

function maybeTransitionToHalfOpen(breaker: BreakerInternal): void {
  if (breaker.state === BreakerState.OPEN && breaker.openedAt) {
    if (Date.now() - breaker.openedAt >= breaker.config.cooldownMs) {
      breaker.state = BreakerState.HALF_OPEN;
      breaker.consecutiveSuccesses = 0;
    }
  }
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Retorna true si se puede ejecutar una llamada (breaker no está OPEN).
 */
export function canExecute(key: string): boolean {
  const b = getOrCreate(key);
  maybeTransitionToHalfOpen(b);
  return b.state !== BreakerState.OPEN;
}

/**
 * Registra un éxito. En HALF_OPEN acumula para llegar a successThreshold.
 */
export function recordSuccess(key: string): void {
  const b = getOrCreate(key);
  if (b.state === BreakerState.HALF_OPEN) {
    b.consecutiveSuccesses += 1;
    if (b.consecutiveSuccesses >= b.config.successThreshold) {
      // Cerrar el breaker
      b.state = BreakerState.CLOSED;
      b.consecutiveFailures = 0;
      b.consecutiveSuccesses = 0;
      b.openedAt = null;
    }
  } else {
    // En CLOSED, un éxito resetea el contador de fallos
    b.consecutiveFailures = 0;
  }
}

/**
 * Registra un fallo. Si alcanza el threshold → abre el breaker.
 */
export function recordFailure(key: string): void {
  const b = getOrCreate(key);
  b.lastFailureAt = Date.now();
  b.consecutiveSuccesses = 0;

  if (b.state === BreakerState.HALF_OPEN) {
    // Cualquier fallo en HALF_OPEN reabre
    b.state = BreakerState.OPEN;
    b.openedAt = Date.now();
    b.consecutiveFailures += 1;
  } else {
    b.consecutiveFailures += 1;
    if (b.consecutiveFailures >= b.config.failureThreshold) {
      b.state = BreakerState.OPEN;
      b.openedAt = Date.now();
    }
  }
}

/**
 * Reseta un breaker a estado CLOSED sin importar su historial.
 */
export function resetBreaker(key: string): void {
  const b = getOrCreate(key);
  b.state = BreakerState.CLOSED;
  b.consecutiveFailures = 0;
  b.consecutiveSuccesses = 0;
  b.lastFailureAt = null;
  b.openedAt = null;
}

/**
 * Resetea todos los breakers.
 */
export function resetAllBreakers(): void {
  for (const key of breakers.keys()) {
    resetBreaker(key);
  }
}

/**
 * Snapshot del estado actual de un breaker (para dashboard / API).
 */
export function getBreakerSnapshot(key: string): BreakerSnapshot {
  const b = getOrCreate(key);
  maybeTransitionToHalfOpen(b);
  return {
    key,
    state: b.state,
    consecutiveFailures: b.consecutiveFailures,
    consecutiveSuccesses: b.consecutiveSuccesses,
    lastFailureAt: b.lastFailureAt,
    openedAt: b.openedAt,
    config: { ...b.config },
  };
}

/**
 * Snapshots de todos los breakers activos.
 */
export function getAllBreakerSnapshots(): BreakerSnapshot[] {
  // Forzar transiciones en todos antes de reportar
  for (const key of breakers.keys()) {
    maybeTransitionToHalfOpen(breakers.get(key)!);
  }
  return Array.from(breakers.keys()).map(getBreakerSnapshot);
}
