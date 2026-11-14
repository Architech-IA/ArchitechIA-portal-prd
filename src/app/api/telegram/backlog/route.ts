import { NextRequest, NextResponse, after } from 'next/server';
import { usuariosPermitidos } from '@/lib/documentador/nucleo';
import { transcribir } from '@/lib/documentador/servicio';
import { clienteTelegram } from '@/lib/documentador/telegram';
import { descartarPropuesta } from '@/lib/agendador/servicio';
import { proponer, aplicarPropuesta, nuevaConversacion } from '@/lib/backlog-agente/servicio';

// Webhook del bot de Telegram del Backlog Manager (bot propio).
// Variables: BACKLOG_TG_TOKEN, BACKLOG_TG_SECRET, BACKLOG_TG_USERS (ids de Telegram), BACKLOG_USER_ID (usuario del portal).
// Responde 200 de inmediato y sigue en segundo plano. Nada se cambia sin pulsar el botón.

const tg = clienteTelegram('BACKLOG_TG_TOKEN');
const MAX_AUDIO_SEG = 120;
const vistos: number[] = [];

const AYUDA = `Soy el Backlog Manager de ArchiTechIA. Manejo el backlog del portal.

- Consultar: «qué tareas están sin responsable», «qué hay en el sprint MASD-0001», «tareas de los agentes bloqueadas», «qué épicas hay»
- Crear una tarea: «crea una tarea: documentar la API, prioridad alta, responsable Daniel»
- Modificar una tarea: «pasa la tarea MASD-0001-003 a Atlas y súbela a prioridad crítica»
- Crear o modificar una épica: «crea la épica Portal de clientes»

Cada tarea es de una persona (humano) o de un agente. Te propongo el cambio y solo se aplica cuando pulsas el botón. No apruebo sprints, no cambio estados ni borro nada: eso se hace desde el Backlog del portal. Todavía no creo ni edito sprints.

Recuerdo lo último de la conversación unos 15 minutos. Escribe /nuevo para empezar de cero.`;

function yaVisto(id: number): boolean {
  if (vistos.includes(id)) return true;
  vistos.push(id);
  if (vistos.length > 200) vistos.shift();
  return false;
}

export async function POST(request: NextRequest) {
  const secreto = process.env.BACKLOG_TG_SECRET;
  if (!secreto || request.headers.get('x-telegram-bot-api-secret-token') !== secreto) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  const u = await request.json().catch(() => null) as Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!u || typeof u.update_id !== 'number') return NextResponse.json({ ok: true });
  if (yaVisto(u.update_id)) return NextResponse.json({ ok: true });
  after(() => procesar(u).catch(e => console.error('[backlog-manager] error:', e)));
  return NextResponse.json({ ok: true });
}

async function procesar(u: Record<string, any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const permitidos = usuariosPermitidos(process.env.BACKLOG_TG_USERS);
  const userId = process.env.BACKLOG_USER_ID;

  if (u.callback_query) {
    const q = u.callback_query;
    const chat = q.message?.chat?.id;
    if (!permitidos.has(String(q.from?.id)) || !chat) { await tg.responderBoton(q.id, 'No autorizado'); return; }
    const [accion, propuestaId] = String(q.data || '').split(':');
    if (accion === 'a' && propuestaId) {
      await tg.responderBoton(q.id, 'Aplicando...');
      if (q.message?.message_id) await tg.quitarBotones(chat, q.message.message_id);
      await tg.enviar(chat, await aplicarPropuesta(propuestaId));
    } else if (accion === 'x' && propuestaId) {
      await tg.responderBoton(q.id);
      if (q.message?.message_id) await tg.quitarBotones(chat, q.message.message_id);
      await tg.enviar(chat, await descartarPropuesta(propuestaId));
    } else await tg.responderBoton(q.id);
    return;
  }

  const m = u.message;
  if (!m || m.chat?.type !== 'private') return;
  const chat = m.chat.id as number;
  if (!permitidos.has(String(m.from?.id))) {
    await tg.enviar(chat, 'Este asistente es solo para el equipo de ArchiTechIA. Tu usuario no está autorizado.');
    return;
  }
  if (!userId) { await tg.enviar(chat, 'El backlog no está configurado (falta BACKLOG_USER_ID).'); return; }

  try {
    let texto = '';
    const audio = m.voice || m.audio;
    if (audio) {
      if ((audio.duration ?? 0) > MAX_AUDIO_SEG) { await tg.enviar(chat, 'El audio es muy largo para un pedido (máximo 2 minutos).'); return; }
      await tg.enviar(chat, 'Recibido. Estoy transcribiendo tu audio; te escribo en un momento.');
      await tg.escribiendo(chat);
      const { buf, nombre } = await tg.descargar(audio.file_id);
      texto = (await transcribir(buf, nombre)) || '';
      if (!texto) { await tg.enviar(chat, 'No logré entender el audio. Inténtalo de nuevo o escríbeme el pedido.'); return; }
      await tg.enviar(chat, `Entendí: «${texto.slice(0, 500)}»`);
    } else {
      texto = typeof m.text === 'string' ? m.text.trim() : '';
    }
    if (!texto) { await tg.enviar(chat, 'Escríbeme tu pedido sobre el backlog o envíame una nota de voz.'); return; }
    if (/^\/(nuevo|reiniciar)\b/i.test(texto)) { await nuevaConversacion(userId, 'telegram'); await tg.enviar(chat, 'Listo, empezamos de cero: ya no recuerdo lo anterior.'); return; }
    if (/^\/(start|ayuda|help)\b/i.test(texto) || /^(hola|buenas|hey|gracias)\W*$/i.test(texto)) { await tg.enviar(chat, AYUDA); return; }

    await tg.escribiendo(chat);
    const r = await proponer(texto, userId, 'telegram');
    await tg.enviar(chat, r.texto, r.propuestaId ? [[{ texto: r.botonAplicar || 'Aplicar', dato: `a:${r.propuestaId}` }], [{ texto: 'Descartar', dato: `x:${r.propuestaId}` }]] : undefined);
  } catch (e) {
    console.error('[backlog-manager] fallo atendiendo mensaje:', e);
    await tg.enviar(chat, 'Tuve un problema procesando tu mensaje. Inténtalo de nuevo en un momento.');
  }
}
