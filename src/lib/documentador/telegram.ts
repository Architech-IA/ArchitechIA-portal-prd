// Cliente mínimo de la API de bots de Telegram. Cada agente tiene su propio bot (su propio token):
// clienteTelegram('VARIABLE_DEL_TOKEN') devuelve las funciones atadas a ese bot.
import { trocear } from './nucleo';

export type Boton = { texto: string; dato: string };

export function clienteTelegram(variableToken: string) {
  const token = () => process.env[variableToken] || '';
  const api = (metodo: string) => `https://api.telegram.org/bot${token()}/${metodo}`;

  async function llamar(metodo: string, cuerpo: Record<string, unknown>): Promise<{ ok: boolean; result?: unknown; description?: string }> {
    const r = await fetch(api(metodo), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(20_000) });
    return r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }));
  }

  // Texto plano (sin parse_mode, para que ningún carácter rompa el mensaje); los botones van en el último trozo.
  async function enviar(chatId: string | number, texto: string, botones?: Boton[][]): Promise<void> {
    const partes = trocear(texto || '(sin contenido)');
    for (let i = 0; i < partes.length; i++) {
      const ultimo = i === partes.length - 1;
      await llamar('sendMessage', {
        chat_id: chatId, text: partes[i], disable_web_page_preview: true,
        ...(ultimo && botones ? { reply_markup: { inline_keyboard: botones.map(f => f.map(b => ({ text: b.texto.slice(0, 60), callback_data: b.dato }))) } } : {}),
      });
    }
  }

  async function escribiendo(chatId: string | number): Promise<void> {
    await llamar('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
  }

  async function responderBoton(id: string, texto?: string): Promise<void> {
    await llamar('answerCallbackQuery', { callback_query_id: id, ...(texto ? { text: texto.slice(0, 190) } : {}) }).catch(() => {});
  }

  async function quitarBotones(chatId: string | number, mensajeId: number): Promise<void> {
    await llamar('editMessageReplyMarkup', { chat_id: chatId, message_id: mensajeId, reply_markup: { inline_keyboard: [] } }).catch(() => {});
  }

  async function descargar(fileId: string): Promise<{ buf: Buffer; nombre: string }> {
    const info = await llamar('getFile', { file_id: fileId }) as { ok: boolean; result?: { file_path?: string }; description?: string };
    const ruta = info.result?.file_path;
    if (!info.ok || !ruta) throw new Error(info.description || 'Telegram no entregó el archivo');
    const r = await fetch(`https://api.telegram.org/file/bot${token()}/${ruta}`, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) throw new Error(`descarga ${r.status}`);
    return { buf: Buffer.from(await r.arrayBuffer()), nombre: ruta.split('/').pop() || 'audio.ogg' };
  }

  return { llamar, enviar, escribiendo, responderBoton, quitarBotones, descargar };
}

// Bot del Agente Documentador (compatibilidad con el código existente)
export const { llamar, enviar, escribiendo, responderBoton, quitarBotones, descargar } = clienteTelegram('DOCUMENTADOR_TG_TOKEN');
