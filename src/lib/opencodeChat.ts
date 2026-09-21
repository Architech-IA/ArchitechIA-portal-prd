// Llamada a OpenCode Zen por HTTP directo, para rutas que
// antes ejecutaban la CLI `claude` con exec(). Esa CLI depende de una sesion
// de login en el VPS que se vence ("Not logged in"), y cuando eso pasa la
// funcion se rompe en silencio para el usuario. Mismo criterio que ya se
// aplico a las rutas del Consejo y a los generadores del PRD.
//
// Convenciones de la API (ya pisadas antes): el modelo va SIN prefijo de
// proveedor, y el header x-opencode-session es obligatorio (un id estable
// por conversacion/recurso alcanza).
const OPENCODE_URL = 'https://opencode.ai/zen/go/v1/chat/completions'
const MODEL = 'qwen3.7-max'

type Opts = { maxTokens?: number; timeoutMs?: number }
type Turno = { role: 'user' | 'assistant'; content: string }

// El proveedor del modelo aplica un filtro de contenido a la SALIDA y a veces da falsos
// positivos: responde 400 con "data_inspection_failed ... Output data may contain
// inappropriate content" para un mismo pedido que en otro intento pasa bien. Se reintenta
// una vez (la respuesta cambia entre intentos) y, si vuelve a fallar, se explica con claridad.
const esFiltroDeContenido = (detalle: string) => /data_inspection_failed|inappropriate content/i.test(detalle)

// Uso real que reporta el proveedor. cachedTokens = parte del prompt que se reutilizó de la caché
// de prefijo (más barata y rápida); reasoningTokens = tokens que el modelo gastó pensando antes de responder.
export interface UsoModelo { promptTokens: number; cachedTokens: number; completionTokens: number; reasoningTokens: number }

function leerUso(u: unknown): UsoModelo | null {
  if (!u || typeof u !== 'object') return null
  const x = u as { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number }; completion_tokens_details?: { reasoning_tokens?: number } }
  if (typeof x.prompt_tokens !== 'number') return null
  return {
    promptTokens: x.prompt_tokens,
    cachedTokens: x.prompt_tokens_details?.cached_tokens ?? 0,
    completionTokens: x.completion_tokens ?? 0,
    reasoningTokens: x.completion_tokens_details?.reasoning_tokens ?? 0,
  }
}

async function pedirAlModeloDetalle(system: string, mensajes: Turno[], sessionId: string, opts: Opts): Promise<{ content: string; usage: UsoModelo | null }> {
  const MAX_INTENTOS = 2
  for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
    const res = await fetch(OPENCODE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENCODE_API_KEY ?? ''}`,
        'x-opencode-session': sessionId,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'system', content: system }, ...mensajes],
        max_tokens: opts.maxTokens ?? 4096,
      }),
      // nginx corta a los 180s (proxy_read_timeout), quedar por debajo.
      signal: AbortSignal.timeout(opts.timeoutMs ?? 150_000),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      if (esFiltroDeContenido(detail)) {
        console.error(`[opencodeChat] filtro de contenido del proveedor (intento ${intento}/${MAX_INTENTOS})`)
        if (intento < MAX_INTENTOS) continue
        throw new Error('El filtro de contenido del proveedor de IA bloqueó la respuesta (es un falso positivo intermitente). Vuelve a intentarlo o reformula un poco el pedido.')
      }
      throw new Error(`El modelo respondió ${res.status}: ${detail.slice(0, 200)}`)
    }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) throw new Error('El modelo devolvió una respuesta vacía.')
    return { content, usage: leerUso(data?.usage) }
  }
  throw new Error('No se pudo obtener respuesta del modelo.')
}

async function pedirAlModelo(system: string, mensajes: Turno[], sessionId: string, opts: Opts): Promise<string> {
  return (await pedirAlModeloDetalle(system, mensajes, sessionId, opts)).content
}

export async function callOpenCode(system: string, user: string, sessionId: string, opts: Opts = {}): Promise<string> {
  return pedirAlModelo(system, [{ role: 'user', content: user }], sessionId, opts)
}

// Igual que callOpenCodeMessages pero devuelve tambien el uso de tokens y de caché (para medir costo y velocidad).
export async function callOpenCodeMessagesConUso(system: string, mensajes: Turno[], sessionId: string, opts: Opts = {}): Promise<{ content: string; usage: UsoModelo | null }> {
  return pedirAlModeloDetalle(system, mensajes, sessionId, opts)
}

// Igual que callOpenCode pero con historial de conversacion (turnos user/assistant),
// para chats de varios turnos (asistente de IA del Hub de Lead).
export async function callOpenCodeMessages(system: string, mensajes: Turno[], sessionId: string, opts: Opts = {}): Promise<string> {
  return pedirAlModelo(system, mensajes, sessionId, opts)
}
