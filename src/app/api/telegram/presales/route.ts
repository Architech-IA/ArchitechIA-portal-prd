import { NextRequest, NextResponse, after } from 'next/server';
import { usuariosPermitidos } from '@/lib/documentador/nucleo';
import { transcribir } from '@/lib/documentador/servicio';
import { clienteTelegram } from '@/lib/documentador/telegram';
import { orquestar, AYUDA_PRESALES } from '@/lib/orquestador/servicio';

// Webhook del bot de Telegram del Presales Engineer (bot propio). Variables: PRESALES_TG_TOKEN, PRESALES_TG_SECRET,
// PRESALES_TG_USERS (ids de Telegram) y PRESALES_USER_ID (usuario del portal; si falta, AGENDADOR_USER_ID).
// Pides preparar o mejorar un documento de proyecto; Presales y el Documentador trabajan en segundo plano y,
// al terminar, el bot te avisa. El resultado queda como propuesta en el editor del proyecto (nunca se guarda solo).

const tg = clienteTelegram('PRESALES_TG_TOKEN');
const MAX_AUDIO_SEG = 120;
const vistos: number[] = [];

function yaVisto(id: number): boolean {
  if (vistos.includes(id)) return true;
  vistos.push(id);
  if (vistos.length > 200) vistos.shift();
  return false;
}

export async function POST(request: NextRequest) {
  const secreto = process.env.PRESALES_TG_SECRET;
  if (!secreto || request.headers.get('x-telegram-bot-api-secret-token') !== secreto) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }
  const u = await request.json().catch(() => null) as Record<string, any> | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!u || typeof u.update_id !== 'number') return NextResponse.json({ ok: true });
  if (yaVisto(u.update_id)) return NextResponse.json({ ok: true });
  after(() => procesar(u).catch(e => console.error('[presales] error:', e)));
  return NextResponse.json({ ok: true });
}

async function procesar(u: Record<string, any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const m = u.message;
  if (!m || m.chat?.type !== 'private') return;
  const chat = m.chat.id as number;
  const permitidos = usuariosPermitidos(process.env.PRESALES_TG_USERS);
  if (!permitidos.has(String(m.from?.id))) {
    await tg.enviar(chat, 'Este asistente es solo para el equipo de ArchiTechIA. Tu usuario no está autorizado.');
    return;
  }
  const userId = process.env.PRESALES_USER_ID || process.env.AGENDADOR_USER_ID;
  if (!userId) { await tg.enviar(chat, 'El asistente no está configurado (falta PRESALES_USER_ID).'); return; }

  try {
    let texto = '';
    const audio = m.voice || m.audio;
    if (audio) {
      if ((audio.duration ?? 0) > MAX_AUDIO_SEG) { await tg.enviar(chat, 'El audio es muy largo (máximo 2 minutos). Resume tu pedido.'); return; }
      await tg.enviar(chat, 'Recibido. Estoy transcribiendo tu audio; te escribo en un momento.');
      await tg.escribiendo(chat);
      const { buf, nombre } = await tg.descargar(audio.file_id);
      texto = (await transcribir(buf, nombre)) || '';
      if (!texto) { await tg.enviar(chat, 'No logré entender el audio. Inténtalo de nuevo o escríbeme el pedido.'); return; }
      await tg.enviar(chat, `Entendí: «${texto.slice(0, 500)}»`);
    } else {
      texto = typeof m.text === 'string' ? m.text.trim() : '';
    }
    if (!texto) { await tg.enviar(chat, 'Escríbeme qué documento quieres preparar o mejorar, o envíame una nota de voz.'); return; }
    if (/^\/(start|ayuda|help)\b/i.test(texto) || /^(hola|buenas|hey|gracias)\W*$/i.test(texto)) { await tg.enviar(chat, AYUDA_PRESALES); return; }

    await tg.escribiendo(chat);
    const nombre = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') || 'el equipo';
    // Ya estamos en segundo plano (after): el trabajo largo se espera aquí mismo, después de avisar que empezó.
    let trabajo: (() => Promise<void>) | null = null;
    const r = await orquestar(texto, userId, nombre, f => { trabajo = f; }, {
      soloPresales: true,
      alTerminar: async t => { await tg.enviar(chat, t); },
    });
    await tg.enviar(chat, r.texto);
    if (trabajo) { await tg.escribiendo(chat); await (trabajo as () => Promise<void>)(); }
  } catch (e) {
    console.error('[presales] fallo atendiendo mensaje:', e);
    await tg.enviar(chat, 'Tuve un problema procesando tu mensaje. Inténtalo de nuevo en un momento.');
  }
}
