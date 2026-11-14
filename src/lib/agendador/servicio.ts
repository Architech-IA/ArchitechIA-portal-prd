// Booking Agent: interpreta pedidos de agenda en lenguaje natural y propone crear, mover o
// cancelar reuniones. Nunca escribe sin confirmación: cada cambio queda en AgendadorPropuesta y
// solo se aplica cuando la persona pulsa el botón (portal o Telegram). Consultar solo lee.
import { prisma } from '@/lib/prisma';
import { callOpenCodeMessages } from '@/lib/opencodeChat';
import { cargarHistorial, guardarTurno, olvidar } from '@/lib/agentes/memoria';
import { createCalendarEvent, updateCalendarEvent } from '@/lib/googleCalendar';
import { logActivity } from '@/lib/activity';
import { puedeActuar, reglasExtra } from '@/lib/agentes/config';
import { PLANTILLAS, hubConAgenda } from './plantillas';
import { aplicarPropuesta as aplicarBacklog } from '@/lib/backlog-agente/servicio';
import {
  parsearPropuesta, pideCrearConFecha, aplicarPlantilla, cambiosEditar, TIPOS_REUNION, limitesSemana, inicioADate, finDe, dateALocal, choques, propuestaATexto, agendaATexto, fechaLegible,
  type Propuesta, type ReunionLite,
} from './nucleo';

const OPC = { model: process.env.AGENDADOR_MODEL || 'deepseek-v4.1-flash' };

export interface Respuesta { texto: string; propuestaId?: string; botonAplicar?: string }

const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
function hoyBogota(): { dia: string; hora: string; semana: string } {
  const local = dateALocal(new Date());
  const d = new Date(`${local.slice(0, 10)}T12:00:00-05:00`);
  return { dia: local.slice(0, 10), hora: local.slice(11), semana: dias[d.getUTCDay()] };
}

async function reunionesCercanas(): Promise<ReunionLite[]> {
  const ahora = Date.now();
  const rs = await prisma.meeting.findMany({
    where: { date: { gte: new Date(ahora - 2 * 86_400_000), lte: new Date(ahora + 60 * 86_400_000) }, status: { not: 'CANCELLED' } },
    orderBy: { date: 'asc' }, take: 80,
    select: { id: true, title: true, date: true, endDate: true, status: true, attendees: true, location: true, link: true, type: true, description: true },
  });
  return rs;
}

export async function proponer(mensaje: string, userId: string, canal: 'portal' | 'telegram'): Promise<Respuesta> {
  const activo = await puedeActuar('booking-agent', '*');
  if (!activo.ok) return { texto: activo.motivo };
  const reuniones = await reunionesCercanas();
  const h = hoyBogota();
  const sem = limitesSemana(h.dia);
  const lista = reuniones.map(r => `${r.id} | ${dateALocal(r.date).replace('T', ' ')} | ${r.title} | ${r.attendees || '-'} | ${r.type || '-'} | ${r.location || '-'} | ${r.link || '-'}`).join('\n') || '(ninguna)';
  const system = `Eres el Booking Agent de ArchiTechIA. Conviertes el pedido de una persona del equipo sobre el calendario en un JSON. Hoy es ${h.semana} ${h.dia} y son las ${h.hora} (hora de Colombia, UTC-5). Resuelve fechas relativas («mañana», «el jueves», «la próxima semana») contra hoy; si dice solo un día de la semana, es el próximo que llegue.
La semana va siempre de lunes a domingo. «Esta semana» o «la semana actual» es del lunes ${sem.lunes} al domingo ${sem.domingo}, completa, aunque ya hayan pasado días. «La próxima semana» es del lunes ${sem.proxLunes} al domingo ${sem.proxDomingo}.

Reuniones próximas (id | inicio | título | asistentes | tipo | lugar | enlace):
${lista}

Devuelve SOLO un JSON con estas claves:
{"accion":"crear|mover|editar|cancelar|consultar","titulo":"","inicio":"YYYY-MM-DDTHH:mm","duracionMin":"","asistentes":"","lugar":"","enlace":"","tipo":"","descripcion":"","estado":"","reunionId":"","desde":"YYYY-MM-DD","hasta":"YYYY-MM-DD","termino":"","futuras":false,"plantilla":"","aclaracion":""}
Reglas (la primera es la más importante):
- Si el mensaje empieza con «agenda», «agéndame», «programa», «crea», «pon» o «registra» y trae una fecha y hora, la acción es SIEMPRE crear y "inicio" es esa fecha y hora, aunque ya exista en la lista una reunión con el mismo nombre (por ejemplo la daily se repite todos los días: la de ayer no es la nueva). Nunca respondas editar a un mensaje así.
- crear: son obligatorios inicio, titulo, tipo, estado y lugar; duración (60 si no la dicen), asistentes, enlace y descripción son opcionales y nunca los inventes. «Una reunión con Nexora» nombra al cliente en el título; no es la lista de asistentes: deja asistentes vacío salvo que den nombres de personas. Rellena tipo, estado y lugar SOLO si la persona los dijo o se desprenden de lo que dijo: «agenda/programa» implica estado SCHEDULED; «registra la reunión que tuve/ya hicimos» implica COMPLETED; «virtual/por Meet/Teams» implica lugar «Virtual». Si falta alguno, déjalo vacío (el sistema se lo pedirá a la persona). El lugar puede ser «Presencial», «Virtual» o una dirección. Se pueden registrar reuniones que ya ocurrieron (fecha pasada) sin objetar; usa la fecha que indique la persona y, si dice «ayer» o «el lunes pasado», resuélvela hacia atrás. Duración 60 si no la dicen. Asistentes y lugar solo si los mencionan; nunca inventes correos, enlaces ni nombres.
- plantilla: pon "daily-architechia" SOLO cuando la reunión es la daily del equipo de ArchitechIA (dicen «la daily de ArchitechIA», «daily architechia», «daily intern»), tanto para crearla como para editar una existente. Si dicen solo «daily» sin aclarar de quién, o es la daily de otro cliente, deja plantilla vacía (no es esta plantilla) y pide los datos normales. El sistema rellena los datos fijos de esa daily (tipo, lugar, enlace, asistentes del equipo, agenda base): no los pongas tú, deja esos campos vacíos salvo que la persona dé otros distintos. Con esa plantilla, para crear solo te falta la fecha, la hora y el estado.
- tipo (opcional): COMMERCIAL (comercial), INTERNAL_DAILY (interna/daily), INTERNAL_WORKSHOP (taller interno), ADVISORY (asesoría), PROVIDER (proveedor) u OTHER (otra). Al crear sin que lo digan, déjalo vacío.
- editar: cambia datos de una reunión que ya existe (título, asistentes, lugar, enlace, tipo, descripción, estado SCHEDULED o COMPLETED, duración, y también la fecha si la piden). Usa reunionId de la lista y llena SOLO los campos que la persona pidió cambiar; los demás van vacíos (en duracionMin pon el número solo si piden cambiar la duración; si no, déjalo vacío). Si piden cambiar cualquier dato que no sea solo la fecha y hora, usa editar, nunca mover. Si la persona da datos adicionales (tipo, lugar, asistentes, enlace...) sobre una reunión que ya existe en la lista, incluida la que se acaba de crear en esta conversación, usa editar con su reunionId; nunca crees una reunión repetida. Pero si la reunión aún NO existe (no aparece en la lista y en la conversación solo se está pidiendo o completando su creación, por ejemplo la persona responde con el tipo o el lugar que le pediste), sigue con accion crear y combina todo lo dicho; no uses editar.
- mover: solo cambia la fecha y hora. reunionId de la lista (la que mejor coincida por título, cliente o fecha) e inicio nuevo. cancelar: reunionId.
- consultar: desde y hasta (YYYY-MM-DD, ambos incluidos; «hoy» es desde=hasta=hoy; «esta semana» es del lunes al domingo de la semana actual, completa; solo si piden «lo que queda de la semana» o «desde hoy», empieza hoy) y termino si filtran por cliente o título. Pon futuras:true cuando pidan las reuniones «agendadas», «programadas», «pendientes», «próximas», «por venir» o «lo que falta» (solo se muestra lo que aún no ha ocurrido, desde este momento); futuras:false si piden la agenda de un periodo en general, lo que ya pasó, un historial o las de una fecha pasada.
- Si falta un dato imprescindible (la fecha u hora para crear, o no está claro cuál reunión mover o cancelar), pon en "aclaracion" una pregunta corta y deja lo demás vacío.
- Si no entiendes que sea un pedido de agenda, accion "consultar" con aclaracion explicando qué puedes hacer.`;
  const clave = `${canal}:${userId}`;
  const historial = await cargarHistorial('booking-agent', clave);
  const conMemoria = historial.length ? `${system}

Historial reciente de esta conversación (mensajes anteriores de la persona y tus JSON anteriores): úsalo para entender lo que dice ahora. Si la persona responde a una aclaración tuya, combina su respuesta con el pedido anterior (por ejemplo, completa la fecha de la reunión que ya había nombrado). Si dice «esa», «la anterior» o «muévela», se refiere a la reunión del último JSON. Devuelve siempre el JSON completo, no solo lo nuevo.` : system;
  let salida = '';
  const reglas = await reglasExtra('booking-agent');
  const llamar = (texto: string) => callOpenCodeMessages(conMemoria + reglas, [...historial, { role: 'user', content: texto.slice(0, 1500) }], 'agendador', { ...OPC, maxTokens: 3000, timeoutMs: 120_000 });
  try {
    salida = await llamar(mensaje);
    // Si el mensaje pide agendar algo nuevo y el modelo lo confundió con editar una reunión parecida, se le corrige una vez
    if (parsearPropuesta(salida)?.accion === 'editar' && pideCrearConFecha(mensaje)) {
      salida = await llamar(`${mensaje}\n\n[Aviso del sistema: este mensaje pide crear una reunión NUEVA con la fecha y hora indicadas. Responde accion "crear" con ese inicio, aunque exista otra reunión con el mismo nombre en otra fecha.]`);
    }
  }
  catch (e) { console.error('[agendador] modelo:', e); return { texto: 'No pude interpretar el pedido ahora mismo. Inténtalo de nuevo en un momento.' }; }
  const parseada = parsearPropuesta(salida);
  const p = parseada && aplicarPlantilla(parseada); // si es de una plantilla (daily), el sistema rellena los campos fijos
  if (!p) return { texto: 'No entendí qué quieres hacer en la agenda. Prueba, por ejemplo: «agenda una reunión con Nexora el jueves a las 3 pm», «mueve la demo al viernes a las 10» o «qué tengo hoy».' };
  // Protección contra duplicados: «crear» con el mismo título y la misma hora de una reunión que ya existe es en realidad editarla
  if (p.accion === 'crear' && p.inicio) {
    const igual = (t: string) => t.trim().toLowerCase();
    const existente = reuniones.find(r => r.date.getTime() === inicioADate(p.inicio).getTime() && igual(r.title) === igual(p.titulo));
    if (existente) { p.accion = 'editar'; p.reunionId = existente.id; p.titulo = ''; p.inicio = ''; }
  }
  await guardarTurno('booking-agent', clave, mensaje, JSON.stringify(p));
  if (p.aclaracion) return { texto: p.aclaracion };
  const permiso = await puedeActuar('booking-agent', p.accion);
  if (!permiso.ok) return { texto: permiso.motivo };

  if (p.accion === 'consultar') return { texto: await consultar(p) };

  // Crear exige inicio, título, tipo, estado y lugar; lo demás es opcional y se puede añadir después con «editar»
  if (p.accion === 'crear') {
    const faltan = [!p.titulo && 'el título', !p.inicio && 'la fecha y hora de inicio', !p.tipo && 'el tipo', !p.estado && 'el estado', !p.lugar && 'el lugar'].filter(Boolean) as string[];
    if (faltan.length) {
      const pistas = [
        !p.tipo && `Tipo: ${Object.values(TIPOS_REUNION).join(', ')}.`,
        !p.estado && 'Estado: Programada (aún por ocurrir) o Completada (ya ocurrió).',
        !p.lugar && 'Lugar: Presencial, Virtual o la dirección.',
      ].filter(Boolean);
      const lista = faltan.length > 1 ? `${faltan.slice(0, -1).join(', ')} y ${faltan[faltan.length - 1]}` : faltan[0];
      return { texto: `Para crear la reunión me falta ${lista}.${pistas.length ? '\n\n' + pistas.join('\n') : ''}\n\nLa duración, los asistentes, el enlace y la descripción son opcionales; los puedes dar ahora o añadirlos después.` };
    }
  }

  if ((p.accion === 'crear' || p.accion === 'mover') && !p.inicio) return { texto: 'Necesito la fecha y la hora exactas. ¿Para cuándo?' };
  if (p.accion === 'mover' && inicioADate(p.inicio).getTime() < Date.now() - 5 * 60_000) return { texto: `Esa fecha (${fechaLegible(inicioADate(p.inicio))}) ya pasó. ¿Para cuándo la quieres?` };
  if (p.accion === 'editar' && !p.reunionId) return { texto: 'No tengo claro qué reunión modificar. Dime el título o el cliente y la fecha.' };

  let anterior: ReunionLite | null = null;
  if (p.accion === 'mover' || p.accion === 'cancelar' || p.accion === 'editar') {
    anterior = reuniones.find(r => r.id === p.reunionId) ?? null;
    if (!anterior) return { texto: 'No encuentro esa reunión en el calendario. Dime el título o el cliente y la fecha.' };
  }
  if (p.accion === 'editar' && !cambiosEditar(p, anterior!).length) return { texto: `«${anterior!.title}» ya tiene esos datos; no hay nada que cambiar.` };
  const cruces = p.accion === 'cancelar' || (p.accion === 'editar' && !p.inicio) ? [] : choques(inicioADate(p.inicio), inicioADate(finDe(p.inicio, p.duracionMin)), reuniones, anterior?.id);

  const fila = await prisma.agendadorPropuesta.create({ data: { canal, userId, datos: JSON.stringify(p) } });
  const verbo = { crear: 'Crear reunión', mover: 'Mover reunión', editar: 'Aplicar cambios', cancelar: 'Cancelar reunión', consultar: '' }[p.accion];
  return { texto: propuestaATexto(p, anterior, cruces), propuestaId: fila.id, botonAplicar: verbo };
}

async function consultar(p: Propuesta): Promise<string> {
  const h = hoyBogota();
  const desde = p.desde || h.dia;
  const hasta = p.hasta || desde;
  const inicioRango = new Date(`${desde}T00:00:00-05:00`);
  const where: Record<string, unknown> = {
    date: { gte: p.futuras ? new Date(Math.max(inicioRango.getTime(), Date.now())) : inicioRango, lte: new Date(`${hasta}T23:59:59-05:00`) },
    status: p.futuras ? { notIn: ['CANCELLED', 'COMPLETED'] } : { not: 'CANCELLED' },
  };
  if (p.termino) where.OR = [{ title: { contains: p.termino, mode: 'insensitive' } }, { attendees: { contains: p.termino, mode: 'insensitive' } }, { description: { contains: p.termino, mode: 'insensitive' } }];
  const rs = await prisma.meeting.findMany({ where, orderBy: { date: 'asc' }, take: 40, select: { id: true, title: true, date: true, endDate: true, status: true, attendees: true } });
  const cab = p.futuras ? `Reuniones agendadas (pendientes) hasta el ${hasta}` : desde === hasta ? `Agenda del ${desde}` : `Agenda del ${desde} al ${hasta}`;
  return agendaATexto(p.termino ? `${cab} (${p.termino})` : cab, rs);
}

// Empezar de cero: olvida el contexto de la conversación de esa persona en ese canal
export async function nuevaConversacion(userId: string, canal: 'portal' | 'telegram'): Promise<void> {
  await olvidar('booking-agent', `${canal}:${userId}`);
}

export async function aplicarPropuesta(propuestaId: string): Promise<string> {
  // Las propuestas del Backlog Manager comparten la tabla; las aplica su propio servicio (el panel de Sage confirma por esta ruta)
  const previa = await prisma.agendadorPropuesta.findUnique({ where: { id: propuestaId }, select: { datos: true } });
  if (previa?.datos.includes('"agente":"backlog-manager"')) return aplicarBacklog(propuestaId);
  const tomada = await prisma.agendadorPropuesta.updateMany({ where: { id: propuestaId, estado: 'PENDIENTE' }, data: { estado: 'APLICANDO' } });
  if (tomada.count === 0) return 'Esta propuesta ya se aplicó o se descartó.';
  const fila = await prisma.agendadorPropuesta.findUnique({ where: { id: propuestaId } });
  if (!fila) return 'No encuentro la propuesta.';
  let p: Propuesta;
  try { p = JSON.parse(fila.datos); } catch { return 'La propuesta está dañada.'; }
  const permiso = await puedeActuar('booking-agent', p.accion);
  if (!permiso.ok) { await prisma.agendadorPropuesta.update({ where: { id: propuestaId }, data: { estado: 'BLOQUEADA' } }); return permiso.motivo; }
  try {
    if (p.accion === 'crear') {
      const inicio = inicioADate(p.inicio);
      const fin = inicioADate(finDe(p.inicio, p.duracionMin));
      const m = await prisma.meeting.create({
        data: { title: p.titulo, type: p.tipo || 'OTHER', description: p.descripcion || null, date: inicio, endDate: fin, location: p.lugar || null, link: p.enlace || null, attendees: p.asistentes || null, status: p.estado || 'SCHEDULED', hub: PLANTILLAS[p.plantilla] ? hubConAgenda(null, PLANTILLAS[p.plantilla].agenda) : null, userId: fila.userId },
      });
      createCalendarEvent(fila.userId, m.id, m.title, null, m.date, m.endDate, m.location, m.attendees, m.link).catch(() => {});
      await logActivity({ type: 'CREATED', description: `creó la reunión ${m.title} (Booking Agent)`, entityType: 'meeting', entityId: m.id, userId: fila.userId });
      await prisma.agendadorPropuesta.update({ where: { id: propuestaId }, data: { estado: 'APLICADA' } });
      return `Listo. Reunión creada: ${m.title}, ${fechaLegible(m.date)}.`;
    }
    const previa = await prisma.meeting.findUnique({ where: { id: p.reunionId } });
    if (!previa) { await prisma.agendadorPropuesta.update({ where: { id: propuestaId }, data: { estado: 'ERROR' } }); return 'Esa reunión ya no existe.'; }
    if (p.accion === 'editar') {
      const cambios = cambiosEditar(p, previa);
      if (!cambios.length) { await prisma.agendadorPropuesta.update({ where: { id: propuestaId }, data: { estado: 'APLICADA' } }); return `«${previa.title}» ya tenía esos datos; no cambió nada.`; }
      const duracion = previa.endDate ? Math.round((previa.endDate.getTime() - previa.date.getTime()) / 60_000) : 60;
      const nuevoInicio = p.inicio ? inicioADate(p.inicio) : previa.date;
      const nuevaDur = p.duracionDada ? p.duracionMin : duracion;
      const data: Record<string, unknown> = {};
      if (p.titulo) data.title = p.titulo;
      if (p.asistentes) data.attendees = p.asistentes;
      if (p.lugar) data.location = p.lugar;
      if (p.enlace) data.link = p.enlace;
      if (p.tipo) data.type = p.tipo;
      if (p.descripcion) data.description = p.descripcion;
      if (p.estado) data.status = p.estado;
      if (p.inicio || p.duracionDada) { data.date = nuevoInicio; data.endDate = new Date(nuevoInicio.getTime() + nuevaDur * 60_000); }
      const plantilla = PLANTILLAS[p.plantilla];
      const hubNuevo = plantilla ? hubConAgenda(previa.hub, plantilla.agenda) : null; // solo si el hub aún no tiene agenda
      if (hubNuevo) data.hub = hubNuevo;
      const m = await prisma.meeting.update({ where: { id: previa.id }, data });
      updateCalendarEvent(m.userId, m.id, m.title, m.description, m.date, m.endDate, m.location, m.attendees, m.link, m.status).catch(() => {});
      await logActivity({ type: 'UPDATED', description: `modificó la reunión ${m.title}: ${cambios.map(c => c.campo).join(', ')} (Booking Agent)`, entityType: 'meeting', entityId: m.id, userId: fila.userId });
      await prisma.agendadorPropuesta.update({ where: { id: propuestaId }, data: { estado: 'APLICADA' } });
      return `Listo. «${m.title}» actualizada: ${cambios.map(c => `${c.campo.toLowerCase()}: ${c.ahora}`).join('; ')}.`;
    }
    if (p.accion === 'mover') {
      const duracion = previa.endDate ? Math.round((previa.endDate.getTime() - previa.date.getTime()) / 60_000) : 60;
      const inicio = inicioADate(p.inicio);
      const fin = inicioADate(finDe(p.inicio, duracion));
      const m = await prisma.meeting.update({ where: { id: previa.id }, data: { date: inicio, endDate: fin } });
      updateCalendarEvent(m.userId, m.id, m.title, m.description, m.date, m.endDate, m.location, m.attendees, m.link, m.status).catch(() => {});
      await logActivity({ type: 'UPDATED', description: `movió la reunión ${m.title} (Booking Agent)`, entityType: 'meeting', entityId: m.id, userId: fila.userId });
      await prisma.agendadorPropuesta.update({ where: { id: propuestaId }, data: { estado: 'APLICADA' } });
      return `Listo. «${m.title}» ahora es ${fechaLegible(m.date)}.`;
    }
    const m = await prisma.meeting.update({ where: { id: previa.id }, data: { status: 'CANCELLED' } });
    updateCalendarEvent(m.userId, m.id, m.title, m.description, m.date, m.endDate, m.location, m.attendees, m.link, m.status).catch(() => {});
    await logActivity({ type: 'STATUS_CHANGED', description: `canceló la reunión ${m.title} (Booking Agent)`, entityType: 'meeting', entityId: m.id, userId: fila.userId });
    await prisma.agendadorPropuesta.update({ where: { id: propuestaId }, data: { estado: 'APLICADA' } });
    return `Listo. Reunión cancelada: ${m.title}.`;
  } catch (e) {
    console.error('[agendador] aplicar:', e);
    await prisma.agendadorPropuesta.update({ where: { id: propuestaId }, data: { estado: 'ERROR' } }).catch(() => {});
    return 'No pude aplicar el cambio. No se modificó nada que yo sepa; revisa el calendario.';
  }
}

export async function descartarPropuesta(propuestaId: string): Promise<string> {
  const r = await prisma.agendadorPropuesta.updateMany({ where: { id: propuestaId, estado: 'PENDIENTE' }, data: { estado: 'DESCARTADA' } });
  return r.count ? 'Descartado. No se cambió nada.' : 'Esta propuesta ya se aplicó o se descartó.';
}
