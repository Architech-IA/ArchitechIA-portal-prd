// Lógica pura de la colaboración Presales + Documentador (sin base de datos ni red): se prueba con node:test.
import { extraerObjeto } from '../documentador/nucleo';

export const MAX_RONDAS = 3;

export interface Seccion { titulo: string; puntos: string[] }
export interface ContenidoTecnico { titulo: string; secciones: Seccion[]; porConfirmar: string[]; fuentes: string[] }
export interface Comentario { seccion: string; comentario: string }
export interface Revision { veredicto: 'aprobar' | 'ajustar'; comentarios: Comentario[] }

const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const lista = (v: unknown, max: number, n: number) => (Array.isArray(v) ? v : []).map(x => txt(x, max)).filter(Boolean).slice(0, n);

// Lo que Presales entrega al Documentador: contenido técnico estructurado, no texto final.
export function parsearContenido(salida: string): ContenidoTecnico | null {
  const o = extraerObjeto(salida);
  if (!o) return null;
  const secciones = (Array.isArray(o.secciones) ? o.secciones : []).map(s => {
    const x = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    return { titulo: txt(x.titulo, 120), puntos: lista(x.puntos, 500, 20) };
  }).filter(s => s.titulo && s.puntos.length).slice(0, 15);
  if (!secciones.length) return null;
  return { titulo: txt(o.titulo, 150), secciones, porConfirmar: lista(o.porConfirmar, 300, 20), fuentes: lista(o.fuentes, 200, 15) };
}

// Revisión de Presales sobre el borrador del Documentador. Si no se entiende, no se aprueba.
export function parsearRevision(salida: string): Revision {
  const o = extraerObjeto(salida);
  if (!o) return { veredicto: 'ajustar', comentarios: [{ seccion: 'General', comentario: 'No pude interpretar la revisión; revisar el borrador completo contra el contenido técnico.' }] };
  const comentarios = (Array.isArray(o.comentarios) ? o.comentarios : []).map(c => {
    const x = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
    return { seccion: txt(x.seccion, 120) || 'General', comentario: txt(x.comentario, 500) };
  }).filter(c => c.comentario).slice(0, 12);
  const aprueba = txt(o.veredicto, 20).toLowerCase().startsWith('aprob');
  // Aprobar con comentarios pendientes es contradictorio: se trata como ajustar.
  return aprueba && comentarios.length === 0 ? { veredicto: 'aprobar', comentarios: [] } : { veredicto: 'ajustar', comentarios };
}

export function contenidoATexto(c: ContenidoTecnico): string {
  const l: string[] = [c.titulo ? `# ${c.titulo}` : ''];
  for (const s of c.secciones) l.push(`## ${s.titulo}`, ...s.puntos.map(p => `- ${p}`), '');
  if (c.porConfirmar.length) l.push('## Por confirmar', ...c.porConfirmar.map(p => `- ${p}`), '');
  if (c.fuentes.length) l.push('## Fuentes', ...c.fuentes.map(p => `- ${p}`));
  return l.filter((x, i) => x !== '' || i > 0).join('\n').trim();
}

export function comentariosATexto(cs: Comentario[]): string {
  return cs.map((c, i) => `${i + 1}. [${c.seccion}] ${c.comentario}`).join('\n');
}

// El borrador debe ser HTML del editor; se quitan fences, scripts, estilos, iframes y atributos on*.
export function limpiarHtml(salida: string): string | null {
  let h = salida.trim().replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/, '').trim();
  h = h.replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1>/gi, '').replace(/<(script|style|iframe|object|embed)\b[^>]*\/?>/gi, '');
  h = h.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1=$2#$2');
  return /<(h[1-6]|p|ul|ol|table|div)\b/i.test(h) && h.length >= 40 ? h : null;
}

export type AgenteId = 'booking-agent' | 'documentador' | 'presales' | 'backlog-manager' | 'ninguno';
export interface Ruta { agente: AgenteId; tarea: string; solucionId: string; entregableClave: string; aclaracion: string }

// Decisión del orquestador: a qué agente delegar. Lo desconocido se trata como «ninguno».
export function parsearRuta(salida: string): Ruta | null {
  const o = extraerObjeto(salida);
  if (!o) return null;
  const a = txt(o.agente, 30).toLowerCase();
  const agente: AgenteId = a === 'booking-agent' || a === 'documentador' || a === 'presales' || a === 'backlog-manager' ? a : 'ninguno';
  return { agente, tarea: txt(o.tarea, 600), solucionId: txt(o.solucionId, 60), entregableClave: txt(o.entregableClave, 80), aclaracion: txt(o.aclaracion, 300) };
}

// Una propuesta comercial es el documento de la fase «propuesta», o cualquier documento que el pedido llame propuesta/cotización/oferta.
export function esPropuestaComercial(faseClave: string, entregableClave: string, pedido: string): boolean {
  const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return n(faseClave) === 'propuesta' || /propuesta|cotizacion|oferta/.test(n(entregableClave)) || /\b(propuesta|cotizacion|oferta)\b/.test(n(pedido));
}
