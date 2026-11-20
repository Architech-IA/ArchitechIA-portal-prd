// Conector de los bots de Telegram con el gateway (portalhub). Solo registra: los bots siguen autorizando a su gente con su
// lista y entregando sus respuestas; el gateway guarda el hilo, la memoria y la trazabilidad. Nunca rompe al bot: si el
// gateway no responde, se registra el error y el bot sigue como si nada.
const BASE = process.env.PORTALHUB_URL || 'http://127.0.0.1:3100';

// Qué agente atiende cada bot (por la variable de su token).
export const AGENTE_DE_TOKEN: Record<string, string> = {
  DOCUMENTADOR_TG_TOKEN: 'documentador',
  AGENDADOR_TG_TOKEN: 'booking-agent',
  BACKLOG_TG_TOKEN: 'backlog-manager',
  PRESALES_TG_TOKEN: 'presales',
};

async function llamar(ruta: string, cuerpo: Record<string, unknown>): Promise<boolean> {
  const clave = process.env.INTERNAL_API_KEY;
  if (!clave) return false;
  try {
    const r = await fetch(`${BASE}${ruta}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': clave }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(4000) });
    if (!r.ok) console.error('[gateway] respondió', r.status, 'en', ruta);
    return r.ok;
  } catch (e) {
    console.error('[gateway] no pude llamar', ruta, e instanceof Error ? e.message : e);
    return false;
  }
}

type Mensaje = { message_id?: number; text?: string; voice?: unknown; audio?: unknown; chat?: { id?: number }; from?: { id?: number; first_name?: string; last_name?: string; username?: string } };

/** Registra lo que escribió la persona. Se espera (es rápido) para que la respuesta del bot encuentre ya el hilo. */
export async function registrarEntradaTelegram(agente: string, m: Mensaje): Promise<void> {
  if (!m.from?.id || !m.chat?.id) return;
  const nombre = [m.from.first_name, m.from.last_name].filter(Boolean).join(' ') || m.from.username || `Telegram ${m.from.id}`;
  const texto = (typeof m.text === 'string' && m.text.trim()) || (m.voice || m.audio ? '[nota de voz]' : '[mensaje sin texto]');
  await llamar('/api/gateway/entrada', {
    canal: 'TELEGRAM', externoId: String(m.from.id), nombre, agente, texto,
    canalHiloId: String(m.chat.id), canalMensajeId: m.message_id !== undefined ? String(m.message_id) : undefined,
    yaAutorizado: true,
  });
}

/** Registra lo que el bot ya le contestó a la persona (sin esperar). */
export function registrarSalidaTelegram(agente: string, chat: string | number, texto: string): void {
  void llamar('/api/gateway/salida', {
    canal: 'TELEGRAM', canalHiloId: String(chat), agente, texto: texto || '(sin contenido)', accion: 'responder',
    decision: 'Respuesta del bot de Telegram', entregado: true,
  });
}
