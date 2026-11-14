// Plantillas de reunión: valores constantes compartidos por el panel de reuniones y el Booking Agent.
// Un solo lugar, para que ambos rellenen exactamente lo mismo.
export const DAILY_LINK = 'https://meet.google.com/usz-ysto-pcq';
export const EQUIPO = ['Daniel Martinez', 'Santiago Ortega', 'Freddy Orozco'];
export const AGENDA_DAILY = ['Qué hice desde la última daily', 'Qué haré hoy', 'Bloqueos e impedimentos'];

export interface PlantillaReunion { clave: string; titulo: string; tipo: string; lugar: string; enlace: string; asistentes: string; agenda: string[] }

export const PLANTILLAS: Record<string, PlantillaReunion> = {
  // La clave nombra al dueño de la daily: otro cliente tendrá su propia plantilla con sus propios valores.
  'daily-architechia': { clave: 'daily-architechia', titulo: 'Daily Intern - ArchitechIA', tipo: 'INTERNAL_DAILY', lugar: 'Virtual', enlace: DAILY_LINK, asistentes: EQUIPO.join(', '), agenda: AGENDA_DAILY },
};

// Agenda base en el hub (JSON {objetivo, puntos, notas, decisiones}). Devuelve el hub nuevo solo si aún no tiene puntos; si ya tiene, null.
export function hubConAgenda(hubActual: string | null | undefined, agenda: string[]): string | null {
  let h: { objetivo?: string; puntos?: { id: string; texto: string }[]; notas?: string; decisiones?: unknown[] } = {};
  try { if (hubActual) h = JSON.parse(hubActual) ?? {}; } catch { h = {}; }
  if (Array.isArray(h.puntos) && h.puntos.length) return null;
  const uid = () => Math.random().toString(36).slice(2, 10);
  return JSON.stringify({ objetivo: h.objetivo ?? '', notas: h.notas ?? '', decisiones: h.decisiones ?? [], puntos: agenda.map(texto => ({ id: uid(), texto })) });
}
