// Lógica pura del Agente Agendador (sin base de datos ni red): se prueba con node:test.
// Todas las fechas "locales" son hora de Colombia (UTC-5), formato YYYY-MM-DDTHH:mm.
import { extraerObjeto, normalizar } from '../documentador/nucleo';
import { PLANTILLAS } from './plantillas';

export type Accion = 'crear' | 'mover' | 'editar' | 'cancelar' | 'consultar';

export const TIPOS_REUNION: Record<string, string> = {
  COMMERCIAL: 'Comercial', INTERNAL_DAILY: 'Interna (daily)', INTERNAL_WORKSHOP: 'Interna (taller)', ADVISORY: 'Asesoría', PROVIDER: 'Proveedor', OTHER: 'Otra',
};
export const ESTADOS_REUNION: Record<string, string> = { SCHEDULED: 'Programada', COMPLETED: 'Completada' };

export interface Propuesta {
  accion: Accion;
  titulo: string;
  inicio: string;       // crear/mover/editar: nuevo inicio
  duracionMin: number;
  duracionDada: boolean; // la persona indicó una duración (en editar, solo entonces se cambia)
  tipo: string;         // clave de TIPOS_REUNION o ''
  descripcion: string;
  estado: string;       // editar: SCHEDULED | COMPLETED o ''
  asistentes: string;
  lugar: string;
  enlace: string;
  reunionId: string;    // mover/cancelar: reunión afectada
  desde: string;        // consultar: YYYY-MM-DD
  hasta: string;
  termino: string;      // consultar: filtro por texto (cliente, título)
  plantilla: string;    // clave de PLANTILLAS ('daily') cuando la reunión es de una plantilla con valores fijos, o ''
  futuras: boolean;     // consultar: solo lo que aún no ha ocurrido (agendadas, programadas, pendientes, próximas)
  aclaracion: string;   // si falta información, qué preguntar
}

export interface ReunionLite {
  id: string; title: string; date: Date; endDate: Date | null; status?: string; attendees?: string | null;
  location?: string | null; link?: string | null; type?: string | null; description?: string | null;
}

const TZ = 'America/Bogota';
const OFFSET_MS = 5 * 3600_000;
const RE_INICIO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;

const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function inicioADate(local: string): Date { return new Date(`${local}:00-05:00`); }

// Date -> 'YYYY-MM-DDTHH:mm' en hora de Colombia
export function dateALocal(d: Date): string { return new Date(d.getTime() - OFFSET_MS).toISOString().slice(0, 16); }

export function finDe(inicio: string, duracionMin: number): string {
  return dateALocal(new Date(inicioADate(inicio).getTime() + duracionMin * 60_000));
}

export function parsearPropuesta(salida: string): Propuesta | null {
  const o = extraerObjeto(salida);
  if (!o) return null;
  const accion = txt(o.accion, 20).toLowerCase() as Accion;
  if (!['crear', 'mover', 'editar', 'cancelar', 'consultar'].includes(accion)) return null;
  const inicio = txt(o.inicio, 16);
  const dur = Number(o.duracionMin);
  const durOk = o.duracionMin !== '' && o.duracionMin != null && Number.isFinite(dur) && dur >= 15 && dur <= 480;
  const desde = txt(o.desde, 10), hasta = txt(o.hasta, 10);
  const tipo = txt(o.tipo, 30).toUpperCase();
  const estado = txt(o.estado, 20).toUpperCase();
  return {
    accion,
    titulo: txt(o.titulo, 120),
    inicio: RE_INICIO.test(inicio) && !Number.isNaN(inicioADate(inicio).getTime()) ? inicio : '',
    duracionMin: durOk ? Math.round(dur) : 60,
    duracionDada: durOk,
    tipo: tipo in TIPOS_REUNION ? tipo : '',
    descripcion: txt(o.descripcion, 1000),
    estado: estado in ESTADOS_REUNION ? estado : '',
    asistentes: txt(o.asistentes, 200),
    lugar: txt(o.lugar, 120),
    enlace: /^https?:\/\//i.test(txt(o.enlace, 300)) ? txt(o.enlace, 300) : '',
    reunionId: txt(o.reunionId, 60),
    desde: RE_DIA.test(desde) ? desde : '',
    hasta: RE_DIA.test(hasta) ? hasta : '',
    termino: txt(o.termino, 60),
    plantilla: txt(o.plantilla, 40).toLowerCase() in PLANTILLAS ? txt(o.plantilla, 40).toLowerCase() : '',
    futuras: o.futuras === true || o.futuras === 'true',
    aclaracion: txt(o.aclaracion, 300),
  };
}

const horaFmt = new Intl.DateTimeFormat('es-CO', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });

export function fechaLegible(d: Date): string {
  const dia = new Intl.DateTimeFormat('es-CO', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(d);
  return `${dia}, ${horaFmt.format(d)}`;
}

// Semana de lunes a domingo que contiene a `dia` (YYYY-MM-DD), y la siguiente. Se calcula aquí para no depender del modelo.
export function limitesSemana(dia: string): { lunes: string; domingo: string; proxLunes: string; proxDomingo: string } {
  const d = new Date(`${dia}T12:00:00Z`);
  const desdeLunes = (d.getUTCDay() + 6) % 7; // lunes=0 ... domingo=6
  const f = (n: number) => new Date(d.getTime() + n * 86_400_000).toISOString().slice(0, 10);
  return { lunes: f(-desdeLunes), domingo: f(6 - desdeLunes), proxLunes: f(7 - desdeLunes), proxDomingo: f(13 - desdeLunes) };
}

export function diaLegible(dia: string): string {
  return new Date(`${dia}T12:00:00-05:00`).toLocaleDateString('es-CO', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
}

// Reuniones activas que se cruzan con [inicio, fin)
export function choques(inicio: Date, fin: Date, reuniones: ReunionLite[], ignorarId?: string): ReunionLite[] {
  return reuniones.filter(r => {
    if (r.id === ignorarId || r.status === 'CANCELLED') return false;
    const ri = r.date.getTime();
    const rf = (r.endDate ?? new Date(ri + 3600_000)).getTime();
    return ri < fin.getTime() && rf > inicio.getTime();
  });
}

export function agendaATexto(titulo: string, reuniones: ReunionLite[]): string {
  if (!reuniones.length) return `${titulo}\n\nNo hay reuniones.`;
  const porDia = new Map<string, ReunionLite[]>();
  for (const r of reuniones) { const k = dateALocal(r.date).slice(0, 10); porDia.set(k, [...(porDia.get(k) ?? []), r]); }
  const l: string[] = [titulo, ''];
  for (const [dia, rs] of porDia) {
    l.push(diaLegible(dia));
    for (const r of rs) l.push(`- ${horaFmt.format(r.date)}  ${r.title}${r.attendees ? ` (${r.attendees})` : ''}`);
    l.push('');
  }
  return l.join('\n').trim();
}

// Rellena con los valores fijos de la plantilla lo que la persona no dijo. Lo que sí dijo se respeta.
// En crear también pone el título de la plantilla si no hay; en editar nunca cambia el título.
export function aplicarPlantilla(p: Propuesta): Propuesta {
  const t = PLANTILLAS[p.plantilla];
  if (!t || (p.accion !== 'crear' && p.accion !== 'editar')) return p;
  return {
    ...p,
    // Al crear, si el título es solo «daily (de) ArchitechIA» (o está vacío) se usa el nombre fijo de la plantilla; uno con algo más se respeta
    titulo: p.accion === 'crear' && (!p.titulo || normalizar(p.titulo).replace(/\b(daily|de|del|el|la|architechia|intern|interna|interno|reunion)\b|[-:,.]/g, '').trim() === '') ? t.titulo : p.titulo,
    tipo: p.tipo || t.tipo,
    lugar: p.lugar || t.lugar,
    enlace: p.enlace || t.enlace,
    asistentes: p.asistentes || t.asistentes,
  };
}

const dur = (r: ReunionLite) => (r.endDate ? Math.round((r.endDate.getTime() - r.date.getTime()) / 60_000) : 60);

// Campos de una reunión existente que la propuesta «editar» realmente cambia (solo los que la persona indicó y difieren)
export function cambiosEditar(p: Propuesta, r: ReunionLite): { campo: string; antes: string; ahora: string; clave: string }[] {
  const c: { campo: string; antes: string; ahora: string; clave: string }[] = [];
  const v = (x: string | null | undefined) => (x && x.trim() ? x.trim() : '(vacío)');
  if (p.titulo && p.titulo !== r.title) c.push({ clave: 'title', campo: 'Título', antes: v(r.title), ahora: p.titulo });
  if (p.inicio && inicioADate(p.inicio).getTime() !== r.date.getTime()) c.push({ clave: 'inicio', campo: 'Cuándo', antes: fechaLegible(r.date), ahora: fechaLegible(inicioADate(p.inicio)) });
  if (p.duracionDada && p.duracionMin !== dur(r)) c.push({ clave: 'duracion', campo: 'Duración', antes: `${dur(r)} min`, ahora: `${p.duracionMin} min` });
  if (p.asistentes && p.asistentes !== (r.attendees ?? '')) c.push({ clave: 'attendees', campo: 'Asistentes', antes: v(r.attendees), ahora: p.asistentes });
  if (p.lugar && p.lugar !== (r.location ?? '')) c.push({ clave: 'location', campo: 'Lugar', antes: v(r.location), ahora: p.lugar });
  if (p.enlace && p.enlace !== (r.link ?? '')) c.push({ clave: 'link', campo: 'Enlace', antes: v(r.link), ahora: p.enlace });
  if (p.tipo && p.tipo !== (r.type ?? '')) c.push({ clave: 'type', campo: 'Tipo', antes: TIPOS_REUNION[r.type ?? ''] ?? v(r.type), ahora: TIPOS_REUNION[p.tipo] });
  if (p.descripcion && p.descripcion !== (r.description ?? '')) c.push({ clave: 'description', campo: 'Descripción', antes: v(r.description), ahora: p.descripcion });
  if (p.estado && p.estado !== (r.status ?? '')) c.push({ clave: 'status', campo: 'Estado', antes: ESTADOS_REUNION[r.status ?? ''] ?? v(r.status), ahora: ESTADOS_REUNION[p.estado] });
  return c;
}

export function propuestaATexto(p: Propuesta, anterior: ReunionLite | null, cruces: ReunionLite[]): string {
  const l: string[] = [];
  if (p.accion === 'editar' && anterior) {
    l.push('Propuesta: modificar reunión (aún no se ha cambiado nada)', '', `Reunión: ${anterior.title}`, ...cambiosEditar(p, anterior).map(x => `${x.campo}: ${x.antes} → ${x.ahora}`));
  } else if (p.accion === 'crear') {
    l.push('Propuesta: crear reunión (aún no se ha creado nada)', '', `Título: ${p.titulo}`, `Cuándo: ${fechaLegible(inicioADate(p.inicio))} (${p.duracionMin} min)`);
    if (p.tipo) l.push(`Tipo: ${TIPOS_REUNION[p.tipo]}`);
    if (p.estado) l.push(`Estado: ${ESTADOS_REUNION[p.estado]}`);
    l.push(`Asistentes: ${p.asistentes || 'Por confirmar'}`);
    if (inicioADate(p.inicio).getTime() < Date.now()) l.push('Nota: es una fecha pasada; se registra como reunión ya realizada.');
    if (p.lugar) l.push(`Lugar: ${p.lugar}`);
    if (p.enlace) l.push(`Enlace: ${p.enlace}`);
  } else if (p.accion === 'mover' && anterior) {
    l.push('Propuesta: mover reunión (aún no se ha cambiado nada)', '', `Reunión: ${anterior.title}`, `Antes: ${fechaLegible(anterior.date)}`, `Ahora: ${fechaLegible(inicioADate(p.inicio))}`);
  } else if (p.accion === 'cancelar' && anterior) {
    l.push('Propuesta: cancelar reunión (aún no se ha cancelado)', '', `Reunión: ${anterior.title}`, `Fecha: ${fechaLegible(anterior.date)}`);
  }
  if (p.plantilla && PLANTILLAS[p.plantilla] && (p.accion === 'crear' || p.accion === 'editar')) l.push('', `Se aplica la plantilla «${PLANTILLAS[p.plantilla].titulo}»: tipo, lugar, enlace, asistentes del equipo y agenda base.`);
  if (cruces.length) l.push('', 'Ojo, se cruza con:', ...cruces.map(c => `- ${c.title} (${fechaLegible(c.date)})`));
  return l.join('\n');
}

// ¿El mensaje empieza pidiendo agendar/crear/registrar algo y trae una fecha u hora? (no incluye «pon», que también sirve para editar)
export function pideCrearConFecha(texto: string): boolean {
  const n = normalizar(texto.trim()).replace(/^((hola|oye|hey|por favor|porfa|buenas)[ ,.!]*)+/, '').trim();
  return /^(agenda(r|me|nos)?|programa(r|me|nos)?|crea(r|me)?|registra(r|me)?)\b/.test(n)
    && /(\d|\b(hoy|manana|pasado manana|lunes|martes|miercoles|jueves|viernes|sabado|domingo|proxim[ao])\b)/.test(n);
}

// Atajo antes de gastar una llamada al modelo: ¿el mensaje pide algo de la agenda?
export function intencionAgenda(texto: string): boolean {
  const t = texto.trim();
  if (/^\/(agenda|hoy)\b/i.test(t)) return true;
  if (t.length > 300) return false;
  const n = normalizar(t).replace(/^((hola|oye|hey|por favor|porfa|buenas)[ ,.!]*)+/, '').trim();
  return /^(agenda(r|me|le|nos)?|programa(r|me|le|nos)?|reprograma(r|me|le)?|cancela(r|me|le)?|mueve|mover|muevela|pasa (la|el|mi) (reunion|cita|llamada)|aplaza(r|me)?|crea(r|me)? (una |la )?(reunion|cita|llamada)|pon(me|le)? (una )?(reunion|cita|llamada))\b/.test(n)
    || /\b(que (reuniones|citas|llamadas) tengo|que tengo (hoy|manana|esta semana|la proxima semana)|mi agenda|agenda de (hoy|manana|la semana)|que hay (hoy|manana) en (el )?calendario)\b/.test(n);
}
