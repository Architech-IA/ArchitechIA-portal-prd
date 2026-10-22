/**
 * Configuración de unit economics y pricing para llamadas LLM.
 *
 * Cada modelo tiene precios por 1M tokens de input/output (USD).
 * Los umbrales de gasto se leen de env vars con defaults sensatos
 * para el MVP del Sprint 3.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ModelPricing {
  /** Costo USD por 1M tokens de input */
  inputPer1M: number;
  /** Costo USD por 1M tokens de output */
  outputPer1M: number;
}

export interface CostConfig {
  /** Cap USD por email completo (todas las llamadas de un email) */
  maxPerEmail: number;
  /** Cap USD por una única llamada LLM (completion) */
  maxPerCompletion: number;
  /** Cap de tokens por llamada */
  maxTokens: number;
  /** Budget diario total USD */
  dailyBudget: number;
  /** Budget semanal total USD */
  weeklyBudget: number;
  /** Budget mensual total USD */
  monthlyBudget: number;
  /** Modelo por defecto */
  defaultModel: string;
}

// ---------------------------------------------------------------------------
// Tabla de pricing (USD por 1M tokens)
// Fuente: precios de lista de OpenAI y Anthropic a la fecha de implementación.
// ---------------------------------------------------------------------------

export const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.60 },
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
  'gpt-4o-2024-11-20': { inputPer1M: 2.5, outputPer1M: 10.0 },
  'claude-3-5-haiku-20241022': { inputPer1M: 0.25, outputPer1M: 1.25 },
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.0, outputPer1M: 15.0 },
};

// ---------------------------------------------------------------------------
// Helpers de env
// ---------------------------------------------------------------------------

function envFloat(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envString(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Retorna la configuración de costos desde env vars (con defaults).
 * Se recalcula por llamada para permitir hot-swap de envs sin restart.
 */
export function getConfig(): CostConfig {
  return {
    maxPerEmail: envFloat('AI_COST_MAX_PER_EMAIL', 0.02),
    maxPerCompletion: envFloat('AI_COST_MAX_PER_COMPLETION', 0.05),
    maxTokens: envInt('AI_COST_MAX_TOKENS', 4000),
    dailyBudget: envFloat('AI_COST_DAILY_BUDGET', 10.0),
    weeklyBudget: envFloat('AI_COST_WEEKLY_BUDGET', 50.0),
    monthlyBudget: envFloat('AI_COST_MONTHLY_BUDGET', 150.0),
    defaultModel: envString('AI_DEFAULT_MODEL', 'gpt-4o-mini'),
  };
}

/**
 * Calcula el costo en USD para una cantidad dada de tokens de input/output.
 * Si el modelo no está en la tabla, usa pricing de gpt-4o como fallback conservador.
 */
export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['gpt-4o'];
  return (
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M
  );
}

/**
 * Estima tokens a partir del texto (~4 chars por token, heurística estándar).
 * Nunca retorna 0 para que la validación pre-flight siempre tenga algo que evaluar.
 */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
