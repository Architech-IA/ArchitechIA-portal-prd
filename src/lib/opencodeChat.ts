// Llamada de un solo turno a OpenCode Zen por HTTP directo, para rutas que
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

export async function callOpenCode(
  system: string,
  user: string,
  sessionId: string,
  opts: { maxTokens?: number; timeoutMs?: number } = {},
): Promise<string> {
  const res = await fetch(OPENCODE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENCODE_API_KEY ?? ''}`,
      'x-opencode-session': sessionId,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: opts.maxTokens ?? 4096,
    }),
    // nginx corta a los 180s (proxy_read_timeout), quedar por debajo.
    signal: AbortSignal.timeout(opts.timeoutMs ?? 150_000),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`El modelo respondió ${res.status}: ${detail.slice(0, 200)}`)
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) throw new Error('El modelo devolvió una respuesta vacía.')
  return content
}
