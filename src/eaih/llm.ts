/**
 * Cliente genérico de LLM para el Executive AI Inbox & Hub.
 *
 * Soporta triaje, resumen de hilos y redacción asistida. Reutiliza el
 * endpoint OpenCode.ai ya presente en el repositorio, sin embeber
 * credenciales en el código.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

class LLMError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'LLMError';
  }
}

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new LLMError(`Missing environment variable: ${key}`);
  }
  return value;
}

/**
 * Envía un prompt de chat al LLM configurado.
 *
 * Ejemplo de uso:
 * ```ts
 * const { content } = await callLLM([
 *   { role: 'system', content: 'Resume el hilo de correos.' },
 *   { role: 'user', content: threadText },
 * ]);
 * ```
 */
export async function callLLM(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
  const apiUrl = getEnv('LLM_API_URL');
  const apiKey = getEnv('LLM_API_KEY');
  const model = options.model ?? process.env.LLM_MODEL ?? 'opencodes';

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 1024,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'unknown error');
    throw new LLMError(`LLM request failed (${response.status}): ${text}`);
  }

  const data = await response.json();

  // Compatible con la forma de respuesta de OpenAI / OpenCode.ai
  const choice = data.choices?.[0];
  const content = choice?.message?.content ?? choice?.text ?? '';

  return {
    content: typeof content === 'string' ? content : JSON.stringify(content),
    usage: data.usage,
  };
}

/**
 * Resume un hilo de correos en un párrafo corto, sin inventar información.
 */
export async function summarizeThread(emailBodies: string[], options?: LLMOptions): Promise<string> {
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content:
        'Eres un asistente ejecutivo. Resume el siguiente hilo de correos en 2-3 oraciones claras. No inventes datos ni acciones no explícitas en el texto. Responde en español.',
    },
    {
      role: 'user',
      content: emailBodies.join('\n\n---\n\n'),
    },
  ];

  const { content } = await callLLM(messages, { temperature: 0.2, ...options });
  return content.trim();
}

/**
 * Clasifica un correo por prioridad y sugiere una acción recomendada.
 */
export async function triageEmail(
  subject: string,
  body: string,
  sender: string,
  options?: LLMOptions
): Promise<{ priority: 'HIGH' | 'MEDIUM' | 'LOW'; action: string; reason: string }> {
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `Eres un asistente ejecutivo experto en triaje de correos. Analiza el correo y responde ÚNICAMENTE con un JSON válido de esta forma:
{
  "priority": "HIGH" | "MEDIUM" | "LOW",
  "action": "Responder" | "Revisar" | "Delegar" | "Archivar" | "Agendar",
  "reason": "una frase corta justificando la decisión"
}
No incluyas markdown ni explicaciones adicionales.`,
    },
    {
      role: 'user',
      content: `De: ${sender}\nAsunto: ${subject}\n\n${body}`,
    },
  ];

  const { content } = await callLLM(messages, { temperature: 0.1, ...options });

  try {
    const parsed = JSON.parse(content);
    return {
      priority: parsed.priority ?? 'MEDIUM',
      action: parsed.action ?? 'Revisar',
      reason: parsed.reason ?? 'Sin justificación disponible',
    };
  } catch {
    return {
      priority: 'MEDIUM',
      action: 'Revisar',
      reason: 'No se pudo parsear la respuesta del modelo.',
    };
  }
}

/**
 * Genera un borrador de respuesta profesional a partir del contexto del hilo.
 */
export async function draftReply(
  threadBodies: string[],
  tone: 'formal' | 'cordial' | 'breve' = 'cordial',
  options?: LLMOptions
): Promise<string> {
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: `Eres un asistente ejecutivo. Redacta un borrador de respuesta en español con tono ${tone}. No inventes información; usa solo el contexto proporcionado.`,
    },
    {
      role: 'user',
      content: threadBodies.join('\n\n---\n\n'),
    },
  ];

  const { content } = await callLLM(messages, { temperature: 0.4, ...options });
  return content.trim();
}
