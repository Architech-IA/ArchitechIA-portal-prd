/**
 * Barrel export — punto único de importación para el módulo AI.
 *
 * Uso: import { callLlm, getDashboard, ... } from '@/lib/ai';
 */

// Cost configuration & pricing
export {
  MODEL_PRICING,
  getConfig,
  computeCost,
  estimateTokens,
  type ModelPricing,
  type CostConfig,
} from './costConfig';

// Circuit breaker
export {
  BreakerState,
  canExecute,
  recordSuccess,
  recordFailure,
  resetBreaker,
  resetAllBreakers,
  getBreakerSnapshot,
  getAllBreakerSnapshots,
  type BreakerConfig,
  type BreakerSnapshot,
} from './circuitBreaker';

// Cost tracker
export {
  preFlightCheck,
  recordCost,
  getDashboard,
  getEmailCost,
  type CostRecord,
  type CostAlert,
  type AlertLevel,
  type PreFlightResult,
  type CostDashboard,
} from './costTracker';

// Cost monitor (orchestrator)
export {
  validate,
  recordCompleted,
  recordFailed,
  onCostAlert,
  type ValidateParams,
  type ValidationResult,
  type CompletedParams,
  type FailedParams,
} from './costMonitor';

// LLM wrapper
export {
  callLlm,
  type LlmMessage,
  type LlmProvider,
  type LlmProviderResult,
  type CallLlmParams,
  type CallLlmResult,
} from './llmWrapper';
