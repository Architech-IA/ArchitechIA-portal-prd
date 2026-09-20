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

async function pedirAlModelo(system: string, mensajes: Turno[], sessionId: string, opts: Opts): Promise<string> {
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
    return content
  }
  throw new Error('No se pudo obtener respuesta del modelo.')
}

export async function callOpenCode(system: string, user: string, sessionId: string, opts: Opts = {}): Promise<string> {
  return pedirAlModelo(system, [{ role: 'user', content: user }], sessionId, opts)
}

// Igual que callOpenCode pero con historial de conversacion (turnos user/assistant),
// para chats de varios turnos (asistente de IA del Hub de Lead).
export async function callOpenCodeMessages(system: string, mensajes: Turno[], sessionId: string, opts: Opts = {}): Promise<string> {
  return pedirAlModelo(system, mensajes, sessionId, opts)
}
