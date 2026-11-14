import { NextRequest, NextResponse, after } from 'next/server';
import { usuariosPermitidos, intencionRapida, actaATelegram } from '@/lib/documentador/nucleo';
import { clasificarIntencion, proponerActa, guardarPropuesta, descartarPropuesta, responderConsulta, transcribir } from '@/lib/documentador/servicio';
import { enviar, escribiendo, responderBoton, quitarBotones, descargar } from '@/lib/documentador/telegram';

// Webhook del bot de Telegram del Agente Documentador. Telegram exige respuesta rápida:
// se contesta 200 de inmediato y el trabajo (transcribir, modelo) sigue en segundo plano.
// Solo atiende a las personas de DOCUMENTADOR_TG_USERS y verifica el secreto del webhook.

const MAX_AUDIO_SEG = 600;
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const vistos: number[] = [];

const AYUDA = `Soy el Agente Documentador de ArchiTechIA.

1. Envíame una nota de voz (o un texto) contando lo que pasó en una reunión. Te devuelvo una propuesta de acta con hechos, decisiones y pendientes, y tú eliges en qué reunión guardarla. No se guarda nada hasta que pulses el botón.
2. Pregúntame por lo ya documentado: «¿qué quedó pendiente con VAIGEN?», «¿qué se decidió con Nexora?», «¿qué dice el briefing de La Promotora Seguros?». Respondo solo con lo que está en las reuniones, pendientes, clientes, proyectos, documentos de fase (briefings, etc.) y memoria de proyecto del portal, y cito la fuente.

Comandos: /nota texto (fuerza el modo acta) y /consultar pregunta (fuerza el modo consulta).`;

function yaVisto(id: number): boolean {
  if (vistos.includes(id)) return true;
  vistos.push(id);
  if (vistos.length > 200) vistos.shift();
  return false;
}

export async function POST(request: NextRequest) {
  const secreto = process.env.DOCUMENTADOR_TG_SECRET;
  if (!secreto || request.headers.get('x-telegram-bot-api-secret-token') !== secreto) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  const u = await request.json().catch(() => null) as Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!u || typeof u.update_id !== 'number') return NextResponse.json({ ok: true });
  if (yaVisto(u.update_id)) return NextResponse.json({ ok: true });
  after(() => procesar(u).catch(e => console.error('[documentador] error:', e)));
  return NextResponse.json({ ok: true });
}

async function procesar(u: Record<string, any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const permitidos = usuariosPermitidos(process.env.DOCUMENTADOR_TG_USERS);

  if (u.callback_query) {
    const q = u.callback_query;
    const chat = q.message?.chat?.id;
    if (!permitidos.has(String(q.from?.id)) || !chat) { await responderBoton(q.id, 'No autorizado'); return; }
    const [accion, propuestaId, idx] = String(q.data || '').split(':');
    if (accion === 'g' && propuestaId) {
      await responderBoton(q.id, 'Guardando...');
      if (q.message?.message_id) await quitarBotones(chat, q.message.message_id);
      await enviar(chat, await guardarPropuesta(propuestaId, Number(idx)));
    } else if (accion === 'd' && propuestaId) {
      await responderBoton(q.id);
      if (q.message?.message_id) await quitarBotones(chat, q.message.message_id);
      await enviar(chat, await descartarPropuesta(propuestaId));
    } else await responderBoton(q.id);
    return;
  }

  const m = u.message;
  if (!m || m.chat?.type !== 'private') return;
  const chat = m.chat.id as number;
  if (!permitidos.has(String(m.from?.id))) {
    await enviar(chat, 'Este asistente es solo para el equipo de ArchiTechIA. Tu usuario no está autorizado.');
    return;
  }

  try {
    const audio = m.voice || m.audio || (m.document?.mime_type?.startsWith('audio/') ? m.document : null);
    if (audio) {
      if ((audio.duration ?? 0) > MAX_AUDIO_SEG) { await enviar(chat, 'El audio es muy largo (máximo 10 minutos). Divídelo en partes.'); return; }
      if ((audio.file_size ?? 0) > MAX_AUDIO_BYTES) { await enviar(chat, 'El audio pesa demasiado (máximo 15 MB).'); return; }
      const minutos = Math.max(1, Math.ceil(((audio.duration ?? 30) * 1.8 + 60) / 60));
      await enviar(chat, `Recibido. Estoy transcribiendo el audio en el servidor; calculo unos ${minutos} minuto(s). Te escribo cuando esté listo.`);
      await escribiendo(chat);
      const { buf, nombre } = await descargar(audio.file_id);
      const texto = await transcribir(buf, nombre);
      if (!texto) { await enviar(chat, 'No logré entender el audio. Inténtalo de nuevo con menos ruido o envía el texto.'); return; }
      await enviar(chat, `Transcripción (revísala, puede tener errores de nombres o cifras):\n\n${texto.slice(0, 3000)}`);
      await atender(chat, texto);
      return;
    }
    const texto = typeof m.text === 'string' ? m.text.trim() : '';
    if (!texto) { await enviar(chat, 'Envíame una nota de voz o un texto.'); return; }
    if (/^\/(start|ayuda|help)\b/i.test(texto)) { await enviar(chat, AYUDA); return; }
    await atender(chat, texto.replace(/^\/(nota|consultar)\s*/i, '').trim() || texto, intencionRapida(texto));
  } catch (e) {
    console.error('[documentador] fallo atendiendo mensaje:', e);
    await enviar(chat, 'Tuve un problema procesando tu mensaje. Inténtalo de nuevo en un momento.');
  }
}

async function atender(chat: number, texto: string, forzada: 'nota' | 'consulta' | 'otro' | null = null) {
  await escribiendo(chat);
  const intencion = forzada ?? intencionRapida(texto) ?? await clasificarIntencion(texto);
  if (intencion === 'otro') { await enviar(chat, AYUDA); return; }  if (intencion === 'consulta') { await enviar(chat, await responderConsulta(String(chat), texto)); return; }

  const r = await proponerActa(String(chat), texto);
  if ('error' in r) { await enviar(chat, r.error); return; }
  const botones = r.candidatas.map((c, i) => [{ texto: `Guardar en: ${c.title} (${c.date})`, dato: `g:${r.propuestaId}:${i}` }]);
  botones.push([{ texto: 'Descartar', dato: `d:${r.propuestaId}` }]);
  const aviso = r.candidatas.length
    ? `Elige la reunión donde guardarla (la primera es la que más se parece).`
    : 'No hay reuniones recientes en el portal donde guardarla. Crea la reunión en el calendario y vuelve a enviar la nota.';
  await enviar(chat, `${actaATelegram(r.acta)}\n\n${aviso}`, r.candidatas.length ? botones : [[{ texto: 'Descartar', dato: `d:${r.propuestaId}` }]]);
}
