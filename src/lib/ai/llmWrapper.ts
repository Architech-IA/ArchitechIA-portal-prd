/**
 * Wrapper práctico para llamadas LLM con pipeline completo de:
 *   1. Estimación de tokens
 *   2. Pre-flight validation (circuit breaker + costos)
 *   3. Ejecución via provider abstracto
 *   4. Post-flight recording de costos
 *
 * Uso:
 *   const result = await callLlm({ prompt: '...', model: 'gpt-4o-mini' });
 *
 * Para tests, inyectar un provider mock:
 *   await callLlm({ prompt: '...', provider: mockFn });
 */

import { computeCost, getConfig, estimateTokens } from './costConfig';
import * as costMonitor from './costMonitor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmProviderResult {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export type LlmProvider = (
  messages: LlmMessage[],
  model: string,
  maxTokens?: number,
) => Promise<LlmProviderResult>;

export interface CallLlmParams {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  emailId?: string;
  maxTokens?: number;
  /** Inyección de provider custom (para tests o proveedores alternativos) */
  provider?: LlmProvider;
}

export interface CallLlmResult {
  content: string;
  costUsd: number;
  tokensUsed: { input: number; output: number };
}

// ---------------------------------------------------------------------------
// Default provider: OpenAI-compatible API
// ---------------------------------------------------------------------------

async function defaultProvider(
  messages: LlmMessage[],
  model: string,
  maxTokens?: number,
): Promise<LlmProviderResult> {
  const config = getConfig();
  const baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.3,
  };
  if (maxTokens) body.max_tokens = maxTokens;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  if (!choice?.message?.content) {
    throw new Error('LLM returned empty response');
  }

  return {
    content: choice.message.content,
    usage: data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens ?? 0,
          completion_tokens: data.usage.completion_tokens ?? 0,
          total_tokens: data.usage.total_tokens ?? 0,
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Call ID generator
// ---------------------------------------------------------------------------

let callCounter = 0;
function generateCallId(): string {
  callCounter += 1;
  return `llm_${Date.now()}_${callCounter}`;
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Ejecuta una llamada LLM con el pipeline completo de validación y tracking.
 */
export async function callLlm(params: CallLlmParams): Promise<CallLlmResult> {
  const config = getConfig();
  const model = params.model ?? config.defaultModel;
  const provider = params.provider ?? defaultProvider;
  const maxTokens = params.maxTokens ?? config.maxTokens;
  const callId = generateCallId();

  // 1. Construir messages
  const messages: LlmMessage[] = [];
  if (params.systemPrompt) {
    messages.push({ role: 'system', content: params.systemPrompt });
  }
  messages.push({ role: 'user', content: params.prompt });

  // 2. Estimar tokens
  const fullText = messages.map((m) => m.content).join(' ');
  const estimatedTokens = estimateTokens(fullText);

  // 3. Pre-flight validation
  const validation = costMonitor.validate({
    model,
    estimatedTokens,
    emailId: params.emailId,
  });

  if (!validation.allowed) {
    throw new Error(`LLM call blocked: ${validation.reason}`);
  }

  // 4. Ejecutar llamada
  const startMs = Date.now();
  try {
    const result = await provider(messages, model, maxTokens);
    const durationMs = Date.now() - startMs;

    // 5. Calcular costos con tokens reales (o estimados si no hay usage)
    const inputTokens = result.usage?.prompt_tokens ?? estimatedTokens;
    const outputTokens = result.usage?.completion_tokens ?? Math.ceil(estimatedTokens * 0.3);
    const costUsd = computeCost(model, inputTokens, outputTokens);

    // 6. Post-flight: registrar costo y éxito
    costMonitor.recordCompleted({
      callId,
      model,
      emailId: params.emailId,
      inputTokens,
      outputTokens,
      costUsd,
      durationMs,
    });

    return {
      content: result.content,
      costUsd,
      tokensUsed: { input: inputTokens, output: outputTokens },
    };
  } catch (error) {
    // Post-flight: registrar fallo en circuit breaker
    costMonitor.recordFailed({
      key: `llm:${model}`,
      error,
    });
    throw error;
  }
}
