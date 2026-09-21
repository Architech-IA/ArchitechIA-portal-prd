import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callOpenCode } from '@/lib/opencodeChat';
import { isAuthed } from '@/lib/apiAuth';
import { getDateFullUTC5, getTimeStrUTC5, getDateStrUTC5 } from '@/lib/timezone';

// Borrador de acta con IA a partir de lo que hay en el hub (agenda, contenido,
// pendientes). Solo devuelve texto: el usuario lo edita y el cliente lo guarda
// como PDF. La IA no debe inventar nada que no este en los datos.

function htmlATexto(html: string): string {
  return html
    .replace(/<\/(p|h[1-6]|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// hub.notas es HTML suelto (formato viejo) o JSON { tabs: [{ name, content }] }
function contenidoDelHub(notas: string): string {
  try {
    const v = JSON.parse(notas);
    if (v && Array.isArray(v.tabs)) {
      return v.tabs
        .map((t: { name?: string; content?: string }) => ({ n: t.name || 'Nota', c: htmlATexto(t.content || '') }))
        .filter((t: { c: string }) => t.c)
        .map((t: { n: string; c: string }) => `[${t.n}]\n${t.c}`)
        .join('\n\n');
    }
  } catch {}
  return htmlATexto(notas || '');
}

const SYSTEM = `Eres el secretario de una reunion en una empresa de tecnologia. Redactas el ACTA de la reunion en espanol, con tono formal y claro, usando UNICAMENTE la informacion que se te entrega.

Reglas:
- No inventes hechos, nombres, cifras, fechas ni acuerdos. Si algo no esta en los datos, no lo menciones o indica "No se registro".
- No conviertas ideas sueltas en decisiones. Solo lista como decision lo que las notas presenten como acuerdo o decision.
- Manten los nombres y terminos tecnicos tal como aparecen.
- Formato de salida: texto plano con esta marca minima: una linea "# Titulo" al inicio, "## Seccion" para cada seccion, "- " para cada elemento de lista. Sin tablas, sin negritas con asteriscos, sin bloques de codigo, sin emojis.
- Secciones, en este orden: "## Datos de la reunion" (fecha, hora, tipo, lugar, asistentes), "## Temas tratados" (siguiendo la agenda cuando exista), "## Desarrollo" (resumen de lo discutido segun el contenido), "## Decisiones y acuerdos", "## Pendientes" (cada uno con responsable y fecha limite si existen). Omite "Desarrollo" si no hay contenido; en las demas, si no hay datos, escribe "- No se registraron ...".
- Responde solo con el acta, sin comentarios previos ni posteriores.`;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthed(request))) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    select: { title: true, type: true, date: true, endDate: true, location: true, hub: true },
  });
  if (!meeting) return NextResponse.json({ error: 'Reunión no encontrada' }, { status: 404 });

  // El cliente manda el hub tal como lo ve (el autoguardado tiene ~1 s de retraso)
  let hub: { puntos?: { texto?: string }[]; notas?: string; decisiones?: { texto?: string }[] } = {};
  try { hub = JSON.parse(typeof body.hub === 'string' ? body.hub : meeting.hub || '{}'); } catch {}
  const acciones = await prisma.meetingAction.findMany({ where: { meetingId: id }, orderBy: { createdAt: 'asc' } });

  const puntos = (hub.puntos || []).map(p => (p.texto || '').trim()).filter(Boolean);
  const decisiones = (hub.decisiones || []).map(d => (d.texto || '').trim()).filter(Boolean);
  const contenido = contenidoDelHub(hub.notas || '');
  const asistentes: string[] = Array.isArray(body.asistentes) ? body.asistentes.filter((a: unknown) => typeof a === 'string') : [];
  const esDaily = meeting.type === 'INTERNAL_DAILY';

  const horario = `${getTimeStrUTC5(meeting.date)}${meeting.endDate ? ` a ${getTimeStrUTC5(meeting.endDate)}` : ''} (UTC-5)`;
  const datos = [
    `Titulo: ${meeting.title}`,
    `Fecha: ${getDateFullUTC5(meeting.date)} (${getDateStrUTC5(meeting.date)})`,
    `Horario: ${horario}`,
    `Tipo: ${typeof body.typeLabel === 'string' ? body.typeLabel : meeting.type}`,
    `Lugar: ${meeting.location || 'No especificado'}`,
    `Asistentes: ${esDaily ? 'ArchitechIA (equipo interno)' : asistentes.length ? asistentes.join(', ') : 'No registrados'}`,
    '',
    `AGENDA:\n${puntos.length ? puntos.map(p => `- ${p}`).join('\n') : '(sin puntos)'}`,
    '',
    `CONTENIDO (notas de la reunion):\n${contenido || '(vacio)'}`,
    '',
    `DECISIONES REGISTRADAS:\n${decisiones.length ? decisiones.map(d => `- ${d}`).join('\n') : '(ninguna)'}`,
    '',
    `PENDIENTES:\n${acciones.length
      ? acciones.map(a => `- ${a.texto} | responsable: ${a.responsable || 'sin asignar'} | fecha limite: ${a.fechaLimite ? getDateStrUTC5(a.fechaLimite) : 'sin fecha'} | estado: ${a.estado}`).join('\n')
      : '(ninguno)'}`,
  ].join('\n').slice(0, 24000);

  try {
    const texto = await callOpenCode(SYSTEM, datos, `acta-${id}`, { maxTokens: 3000, timeoutMs: 120_000 });
    return NextResponse.json({ texto: texto.trim() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'No se pudo generar el acta' }, { status: 502 });
  }
}
