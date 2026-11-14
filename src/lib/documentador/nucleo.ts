// Lógica pura del Agente Documentador por Telegram (sin base de datos ni red): se prueba con node:test.
import { textoAHtml, htmlATextoPlano } from '../textoAHtml';
export interface Pendiente { texto: string; responsable: string; fechaLimite: string }
export interface Acta {
  resumen: string;
  hechos: string[];
  decisiones: string[];
  pendientes: Pendiente[];
  dudas: string[];
  reunionSugerida: string;
}

export type Intencion = 'nota' | 'consulta' | 'otro';

export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Cuántas veces cabe una palabra de estas en una pregunta sin aportar nada a la búsqueda
const VACIAS = new Set([
  'cual', 'cuales', 'cuando', 'como', 'donde', 'quien', 'quienes', 'que', 'quedo', 'quedaron', 'hay', 'tiene', 'tienen', 'tenemos',
  'dime', 'dame', 'sobre', 'acerca', 'respecto', 'ultima', 'ultimo', 'ultimas', 'ultimos', 'esta', 'estan', 'estoy', 'fue', 'fueron',
  'para', 'pero', 'porque', 'con', 'del', 'las', 'los', 'una', 'uno', 'unos', 'unas', 'por', 'esto', 'eso', 'ese', 'esa', 'mas', 'muy',
  'reunion', 'reuniones', 'pendiente', 'pendientes', 'acuerdo', 'acuerdos', 'decision', 'decisiones', 'decidimos', 'hablamos', 'dijimos',
  'decidio', 'decidieron', 'decidir', 'decide', 'acordo', 'acordaron', 'acordamos', 'acordar', 'hablo', 'hablaron', 'hablar', 'paso', 'pasa',
  'sucedio', 'quedamos', 'dijeron', 'planteo', 'plantearon', 'tratamos', 'trato', 'trataron', 'comento', 'comentaron', 'sabemos', 'puedes',
  'podemos', 'semana', 'ayer', 'hoy', 'pasada', 'pasado',
  'documento', 'documentos', 'proyecto', 'proyectos', 'project', 'cliente', 'clientes', 'primer', 'primero', 'dice', 'dicen', 'contiene', 'incluye', 'tiene',
  'resumen', 'resume', 'resumir', 'cuenta', 'cuentame', 'falta', 'faltan', 'abierto', 'abiertos', 'abierta', 'abiertas', 'mira', 'revisa',
]);

export function terminosDe(pregunta: string): { terminos: string[]; pidePendientes: boolean } {
  const n = normalizar(pregunta);
  const pidePendientes = /\b(pendiente|pendientes|falta|faltan|abierto|abiertos|abierta|abiertas|por hacer|quedo por|quedaron por)\b/.test(n);
  const orig = pregunta.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const vistos = new Set<string>();
  const terminos: string[] = [];
  for (const w of orig) {
    const nw = normalizar(w);
    if (nw.length < 4 || VACIAS.has(nw) || vistos.has(nw)) continue;
    vistos.add(nw);
    terminos.push(w);
  }
  return { terminos: terminos.slice(0, 6), pidePendientes };
}

// Atajo antes de gastar una llamada al modelo: una pregunta corta con signo de interrogación es consulta
export function intencionRapida(texto: string): Intencion | null {
  const t = texto.trim();
  if (/^\/consultar\b/i.test(t)) return 'consulta';
  if (/^\/nota\b/i.test(t)) return 'nota';
  // Preguntas sobre el propio bot: se contestan con la ayuda, no buscando en las reuniones
  const n = normalizar(t);
  if (t.length <= 120 && (/\b((sus|tus|las) funciones|que funciones (tiene|tienes)|que (puedes|sabes|haces)|como (funcionas|te uso|se usa)|para que (sirves|eres)|quien eres|que eres|ayuda|help|instrucciones|comandos)\b/.test(n) || /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|gracias)\W*$/.test(n))) return 'otro';
  if (t.length <= 250 && /[?¿]/.test(t)) return 'consulta';
  return null;
}

export function trocear(texto: string, max = 3800): string[] {
  if (texto.length <= max) return [texto];
  const partes: string[] = [];
  let resto = texto;
  while (resto.length > max) {
    let corte = resto.lastIndexOf('\n', max);
    if (corte < max * 0.5) corte = resto.lastIndexOf(' ', max);
    if (corte < max * 0.5) corte = max;
    partes.push(resto.slice(0, corte).trimEnd());
    resto = resto.slice(corte).trimStart();
  }
  if (resto) partes.push(resto);
  return partes;
}

export function extraerObjeto(t: string): Record<string, unknown> | null {
  const s = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { const o = JSON.parse(s.slice(a, b + 1)); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; } catch { return null; }
}

const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const lista = (v: unknown, max: number, n: number) => (Array.isArray(v) ? v : []).map(x => txt(x, max)).filter(Boolean).slice(0, n);

export function parsearActa(salida: string): Acta | null {
  const o = extraerObjeto(salida);
  if (!o) return null;
  const pendientes = (Array.isArray(o.pendientes) ? o.pendientes : []).map(p => {
    const x = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
    const f = txt(x.fechaLimite, 10);
    return { texto: txt(x.texto, 300), responsable: txt(x.responsable, 80), fechaLimite: /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : '' };
  }).filter(p => p.texto).slice(0, 15);
  const acta: Acta = {
    resumen: txt(o.resumen, 800),
    hechos: lista(o.hechos, 300, 15),
    decisiones: lista(o.decisiones, 300, 12),
    pendientes,
    dudas: lista(o.dudas, 300, 8),
    reunionSugerida: txt(o.reunionSugerida, 60),
  };
  if (!acta.resumen && !acta.hechos.length && !acta.decisiones.length && !acta.pendientes.length) return null;
  return acta;
}

const porConfirmar = (v: string) => v || 'Por confirmar';

// Texto plano que se manda por Telegram
export function actaATelegram(a: Acta): string {
  const l: string[] = ['Propuesta de acta (aún no se ha guardado nada)', ''];
  if (a.resumen) l.push('Resumen', a.resumen, '');
  if (a.hechos.length) l.push('Hechos', ...a.hechos.map(x => `- ${x}`), '');
  if (a.decisiones.length) l.push('Decisiones', ...a.decisiones.map(x => `- ${x}`), '');
  if (a.pendientes.length) l.push('Pendientes', ...a.pendientes.map(p => `- ${p.texto} | quién: ${porConfirmar(p.responsable)} | cuándo: ${porConfirmar(p.fechaLimite)}`), '');
  if (a.dudas.length) l.push('Dudas por confirmar', ...a.dudas.map(x => `- ${x}`), '');
  return l.join('\n').trim();
}

// Markdown que se guarda como pestaña de notas de la reunión
export function actaAMarkdown(a: Acta, fuente: string): string {
  const l: string[] = [];
  if (a.resumen) l.push('## Resumen', a.resumen, '');
  if (a.hechos.length) l.push('## Hechos', ...a.hechos.map(x => `- ${x}`), '');
  if (a.decisiones.length) l.push('## Decisiones', ...a.decisiones.map(x => `- ${x}`), '');
  if (a.pendientes.length) l.push('## Pendientes', ...a.pendientes.map(p => `- ${p.texto} (quién: ${porConfirmar(p.responsable)}; cuándo: ${porConfirmar(p.fechaLimite)})`), '');
  if (a.dudas.length) l.push('## Por confirmar', ...a.dudas.map(x => `- ${x}`), '');
  l.push(`*${fuente}*`);
  return l.join('\n');
}

type Pestana = { id: string; name: string; content: string };
type Item = { id: string; texto: string };

// Añade la pestaña de notas y las decisiones nuevas al hub (JSON) de la reunión sin tocar lo demás.
export function fusionarEnHub(hubRaw: string | null | undefined, nueva: { titulo: string; markdown: string; decisiones: string[] }, uid: () => string): { hub: string; decisionesNuevas: number } {
  let h: Record<string, unknown> = {};
  try { const v = JSON.parse(hubRaw || '{}'); if (v && typeof v === 'object' && !Array.isArray(v)) h = v; } catch {}
  const notasRaw = typeof h.notas === 'string' ? h.notas : '';
  let tabs: Pestana[] = [];
  try { const v = JSON.parse(notasRaw); if (v && Array.isArray(v.tabs)) tabs = v.tabs; } catch {}
  if (tabs.length === 0 && notasRaw.trim()) tabs = [{ id: uid(), name: 'General', content: notasRaw }];
  tabs = [...tabs, { id: uid(), name: nueva.titulo, content: textoAHtml(nueva.markdown) }];

  const dec: Item[] = (Array.isArray(h.decisiones) ? h.decisiones : []) as Item[];
  const ya = new Set(dec.map(d => normalizar(String(d?.texto ?? '')).trim()));
  const agregar = nueva.decisiones.filter(d => d.trim() && !ya.has(normalizar(d).trim()));
  const decisiones = [...dec, ...agregar.map(texto => ({ id: uid(), texto }))];
  return { hub: JSON.stringify({ ...h, notas: JSON.stringify({ tabs }), decisiones }), decisionesNuevas: agregar.length };
}

// Texto legible del hub de una reunión (agenda, notas y decisiones) para dárselo al modelo
export function hubATexto(raw: unknown): { puntos: string[]; notas: string; decisiones: string[] } {
  let h: { puntos?: { texto?: string }[]; notas?: string; decisiones?: { texto?: string }[] } = {};
  try { h = JSON.parse(typeof raw === 'string' && raw ? raw : '{}'); } catch {}
  const items = (v?: { texto?: string }[]) => (Array.isArray(v) ? v : []).map(x => (x.texto || '').trim()).filter(Boolean);
  const notasRaw = typeof h.notas === 'string' ? h.notas : '';
  let notas = '';
  try {
    const v = JSON.parse(notasRaw);
    if (v && Array.isArray(v.tabs)) notas = v.tabs.map((t: { name?: string; content?: string }) => ({ n: t.name || 'Nota', c: htmlATextoPlano(t.content || '').trim() })).filter((t: { c: string }) => t.c).map((t: { n: string; c: string }) => `[${t.n}]\n${t.c}`).join('\n\n');
    else notas = htmlATextoPlano(notasRaw).trim();
  } catch { notas = htmlATextoPlano(notasRaw).trim(); }
  return { puntos: items(h.puntos), notas, decisiones: items(h.decisiones) };
}

export function usuariosPermitidos(env: string | undefined): Set<string> {
  return new Set((env || '').split(',').map(s => s.trim()).filter(Boolean));
}
