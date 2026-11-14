// Lógica pura del Backlog Manager (sin base de datos ni red): se prueba con node:test.
// Crea y edita tareas y épicas del backlog y consulta tareas, sprints y épicas. Nunca aprueba sprints ni dispara ejecuciones.
import { extraerObjeto, normalizar } from '../documentador/nucleo';

export type Accion = 'consultar' | 'crear' | 'editar';
export type Entidad = 'tarea' | 'sprint' | 'epica';
export type Ejecutor = 'HUMANO' | 'AGENTE';

export const TIPOS_TAREA: Record<string, string> = {
  DESARROLLO: 'Desarrollo', TASK: 'Tarea', FEATURE: 'Feature', DOCUMENTACION: 'Documentación', IMPROVEMENT: 'Mejora',
  BUG: 'Bug', TESTING: 'Testing', TEST_QA: 'Test QA', INFRAESTRUCTURA: 'Infraestructura', RESEARCH: 'Investigación',
};
export const PRIORIDADES: Record<string, string> = { CRITICAL: 'Crítica', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
export const ESTADOS: Record<string, string> = {
  BACKLOG: 'Backlog', TODO: 'Por hacer', IN_PROGRESS: 'En curso', DONE: 'Hecha', BLOCKED: 'Bloqueada', FAILED: 'Fallida', CANCELLED: 'Cancelada',
};

export interface Campos {
  titulo: string; descripcion: string; tipo: string; prioridad: string;
  puntos: number | null; responsable: string; sprint: string; dependeDe: string;
  fechaInicio: string; fechaFin: string;
}
export interface Filtro {
  sprint: string; responsable: string; ejecutor: '' | Ejecutor; tipo: string; estado: string; texto: string;
  sinResponsable: boolean; epica: string; limite: number;
}
// Lo que el sistema resolvió contra la base de datos antes de guardar la propuesta
export interface Resuelto {
  tareaId?: string; epicaId?: string; sprintId?: string; sprintCodigo?: string | null; dependeId?: string; dependeCodigo?: string | null;
  asignadoId?: string | null; asignadoNombre?: string; ejecutor?: Ejecutor;
}
export interface Propuesta {
  agente: 'backlog-manager';
  accion: Accion; entidad: Entidad; buscar: string;
  campos: Campos; filtro: Filtro; aclaracion: string;
  resuelto: Resuelto;
}

const RE_DIA = /^\d{4}-\d{2}-\d{2}$/;
const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// Sinónimos en español que el modelo puede devolver en vez de la clave
const SINONIMOS: Record<string, string> = { ALTA: 'HIGH', MEDIA: 'MEDIUM', BAJA: 'LOW', CRITICA: 'CRITICAL', 'CRÍTICA': 'CRITICAL', DESARROLLO: 'DESARROLLO', PRUEBAS: 'TESTING', INFRA: 'INFRAESTRUCTURA', HECHA: 'DONE', BLOQUEADA: 'BLOCKED', EN_CURSO: 'IN_PROGRESS' };
const clave = (v: unknown, tabla: Record<string, string>) => {
  const k = txt(v, 30).toUpperCase().replace(/\s+/g, '_');
  if (k in tabla) return k;
  const s = SINONIMOS[k];
  return s && s in tabla ? s : '';
};

export function parsearPropuesta(salida: string): Propuesta | null {
  const o = extraerObjeto(salida);
  if (!o) return null;
  const accion = txt(o.accion, 20).toLowerCase() as Accion;
  const entidad = txt(o.entidad, 20).toLowerCase().replace('épica', 'epica') as Entidad;
  if (!['consultar', 'crear', 'editar'].includes(accion) || !['tarea', 'sprint', 'epica'].includes(entidad)) return null;
  const c = (o.campos && typeof o.campos === 'object' ? o.campos : {}) as Record<string, unknown>;
  const f = (o.filtro && typeof o.filtro === 'object' ? o.filtro : {}) as Record<string, unknown>;
  const pts = Number(c.puntos);
  const fi = txt(c.fechaInicio, 10), ff = txt(c.fechaFin, 10);
  const lim = Number(f.limite);
  const ej = txt(f.ejecutor, 10).toUpperCase();
  return {
    agente: 'backlog-manager', accion, entidad,
    buscar: txt(o.buscar, 120),
    campos: {
      titulo: txt(c.titulo, 200), descripcion: txt(c.descripcion, 2000),
      tipo: clave(c.tipo, TIPOS_TAREA), prioridad: clave(c.prioridad, PRIORIDADES),
      puntos: Number.isFinite(pts) && pts >= 1 && pts <= 100 ? Math.round(pts) : null,
      responsable: txt(c.responsable, 80), sprint: txt(c.sprint, 80), dependeDe: txt(c.dependeDe, 120),
      fechaInicio: RE_DIA.test(fi) ? fi : '', fechaFin: RE_DIA.test(ff) ? ff : '',
    },
    filtro: {
      sprint: txt(f.sprint, 80), responsable: txt(f.responsable, 80),
      ejecutor: ej === 'HUMANO' || ej === 'AGENTE' ? ej : '',
      tipo: clave(f.tipo, TIPOS_TAREA), estado: clave(f.estado, ESTADOS), texto: txt(f.texto, 80),
      sinResponsable: f.sinResponsable === true || f.sinResponsable === 'true',
      epica: txt(f.epica, 80), limite: Number.isFinite(lim) && lim >= 1 && lim <= 30 ? Math.round(lim) : 15,
    },
    aclaracion: txt(o.aclaracion, 300),
    resuelto: {},
  };
}

// Clave de permiso que se muestra en el control de agentes
export function accionPermiso(p: Pick<Propuesta, 'accion' | 'entidad'>): string {
  if (p.accion === 'consultar') return 'consultar';
  if (p.entidad === 'tarea') return p.accion === 'crear' ? 'crear_tarea' : 'editar_tarea';
  if (p.entidad === 'epica') return p.accion === 'crear' ? 'crear_epica' : 'editar_epica';
  return 'sprint_no_disponible';
}

// ¿Quién ejecuta la tarea? Se deduce del responsable: un agente del portal es AGENTE; una persona, HUMANO.
export interface Persona { id: string | null; name: string; tipo: Ejecutor }

export function resolverPersona(nombre: string, personas: Persona[]): { persona?: Persona; candidatos: Persona[] } {
  const q = normalizar(nombre).trim();
  if (!q) return { candidatos: [] };
  const exacto = personas.filter(p => normalizar(p.name) === q);
  if (exacto.length === 1) return { persona: exacto[0], candidatos: [] };
  const parcial = personas.filter(p => { const n = normalizar(p.name); return n.includes(q) || q.includes(n) || n.split(' ').some(w => w === q); });
  if (parcial.length === 1) return { persona: parcial[0], candidatos: [] };
  return { candidatos: parcial.slice(0, 5) };
}

export interface Referencia { id: string; titulo: string; codigo?: string | null }

// Busca por código exacto o por las palabras del título. Si hay un solo candidato (o un código exacto), es ese.
export function resolverReferencia<T extends Referencia>(items: T[], consulta: string): { elegido?: T; candidatos: T[] } {
  const q = normalizar(consulta).trim();
  if (!q) return { candidatos: [] };
  const porCodigo = items.filter(i => i.codigo && normalizar(i.codigo) === q);
  if (porCodigo.length === 1) return { elegido: porCodigo[0], candidatos: [] };
  const exacto = items.filter(i => normalizar(i.titulo) === q);
  if (exacto.length === 1) return { elegido: exacto[0], candidatos: [] };
  const palabras = q.split(/\s+/).filter(w => w.length >= 3);
  const todos = palabras.length ? items.filter(i => { const t = normalizar(`${i.titulo} ${i.codigo ?? ''}`); return palabras.every(w => t.includes(w)); }) : [];
  if (todos.length === 1) return { elegido: todos[0], candidatos: [] };
  return { candidatos: todos.slice(0, 6) };
}

export interface TareaLite {
  id: string; taskCode: string | null; title: string; type: string | null; priority: string | null; status: string; points: number | null;
  assigneeName: string | null; ejecutor: string | null; sprintCodigo?: string | null; description?: string | null;
}

export const etiquetaEjecutor = (e: string | null | undefined) => (e === 'AGENTE' ? 'agente' : e === 'HUMANO' ? 'humano' : 'sin definir');

export function tareaLinea(t: TareaLite): string {
  const resp = t.assigneeName ? `${t.assigneeName} (${etiquetaEjecutor(t.ejecutor)})` : 'sin responsable';
  return `- ${t.taskCode ? t.taskCode + ' · ' : ''}${t.title} | ${ESTADOS[t.status] ?? t.status} | ${PRIORIDADES[t.priority ?? ''] ?? t.priority ?? '-'} | ${t.points ?? '-'} pts | ${resp}`;
}

export function tareasATexto(titulo: string, filas: TareaLite[], total: number): string {
  if (!filas.length) return `${titulo}\n\nNo hay tareas con ese criterio.`;
  const pie = total > filas.length ? `\n\nMuestro ${filas.length} de ${total}. Pídeme que filtre más (por sprint, responsable o estado) para acotar.` : '';
  return `${titulo} (${total})\n\n${filas.map(tareaLinea).join('\n')}${pie}`;
}

export interface Cambio { campo: string; antes: string; ahora: string }
const v = (x: string | number | null | undefined) => (x === null || x === undefined || x === '' ? '(vacío)' : String(x));

// Cambios de una edición de tarea: solo lo que la persona pidió y difiere de lo actual
export function cambiosTarea(p: Propuesta, t: TareaLite): Cambio[] {
  const c = p.campos, r = p.resuelto, l: Cambio[] = [];
  if (c.titulo && c.titulo !== t.title) l.push({ campo: 'Título', antes: v(t.title), ahora: c.titulo });
  if (c.descripcion && c.descripcion !== (t.description ?? '')) l.push({ campo: 'Descripción', antes: v(t.description), ahora: c.descripcion });
  if (c.tipo && c.tipo !== t.type) l.push({ campo: 'Tipo', antes: v(TIPOS_TAREA[t.type ?? ''] ?? t.type), ahora: TIPOS_TAREA[c.tipo] });
  if (c.prioridad && c.prioridad !== t.priority) l.push({ campo: 'Prioridad', antes: v(PRIORIDADES[t.priority ?? ''] ?? t.priority), ahora: PRIORIDADES[c.prioridad] });
  if (c.puntos !== null && c.puntos !== t.points) l.push({ campo: 'Puntos', antes: v(t.points), ahora: String(c.puntos) });
  if (r.asignadoNombre && r.asignadoNombre !== t.assigneeName) l.push({ campo: 'Responsable', antes: v(t.assigneeName), ahora: `${r.asignadoNombre} (${etiquetaEjecutor(r.ejecutor)})` });
  if (r.sprintId && r.sprintCodigo !== t.sprintCodigo) l.push({ campo: 'Sprint', antes: v(t.sprintCodigo), ahora: v(r.sprintCodigo) });
  if (r.dependeId) l.push({ campo: 'Depende de', antes: '', ahora: v(r.dependeCodigo) });
  return l;
}

export function propuestaATexto(p: Propuesta, previa: TareaLite | null, epicaPrevia: { nombre: string } | null): string {
  const c = p.campos, r = p.resuelto, l: string[] = [];
  if (p.entidad === 'tarea' && p.accion === 'crear') {
    l.push('Propuesta: crear tarea (aún no se ha creado nada)', '', `Título: ${c.titulo}`);
    l.push(`Tipo: ${TIPOS_TAREA[c.tipo || 'TASK']}${c.tipo ? '' : ' (por defecto)'}`);
    l.push(`Prioridad: ${PRIORIDADES[c.prioridad || 'MEDIUM']}${c.prioridad ? '' : ' (por defecto)'}`);
    l.push(`Puntos: ${c.puntos ?? 'sin definir'}`);
    l.push(`Responsable: ${r.asignadoNombre ? `${r.asignadoNombre} (${etiquetaEjecutor(r.ejecutor)})` : 'sin asignar'}`);
    l.push(`Sprint: ${r.sprintId ? r.sprintCodigo ?? 'sin código' : 'ninguno (queda en el backlog)'}`);
    if (r.dependeId) l.push(`Depende de: ${r.dependeCodigo}`);
    if (c.descripcion) l.push(`Descripción: ${c.descripcion}`);
    l.push('Estado: Backlog');
  } else if (p.entidad === 'tarea' && p.accion === 'editar' && previa) {
    l.push('Propuesta: modificar tarea (aún no se ha cambiado nada)', '', `Tarea: ${previa.taskCode ? previa.taskCode + ' · ' : ''}${previa.title}`, ...cambiosTarea(p, previa).map(x => `${x.campo}: ${x.antes} → ${x.ahora}`));
  } else if (p.entidad === 'epica' && p.accion === 'crear') {
    l.push('Propuesta: crear épica (aún no se ha creado nada)', '', `Nombre: ${c.titulo}`, `Prioridad: ${PRIORIDADES[c.prioridad || 'MEDIUM']}${c.prioridad ? '' : ' (por defecto)'}`);
    if (c.descripcion) l.push(`Descripción: ${c.descripcion}`);
    if (c.fechaInicio || c.fechaFin) l.push(`Fechas: ${c.fechaInicio || '?'} a ${c.fechaFin || '?'}`);
  } else if (p.entidad === 'epica' && p.accion === 'editar' && epicaPrevia) {
    l.push('Propuesta: modificar épica (aún no se ha cambiado nada)', '', `Épica: ${epicaPrevia.nombre}`);
    if (c.titulo) l.push(`Nombre: → ${c.titulo}`);
    if (c.prioridad) l.push(`Prioridad: → ${PRIORIDADES[c.prioridad]}`);
    if (c.descripcion) l.push(`Descripción: → ${c.descripcion}`);
    if (c.fechaInicio) l.push(`Inicio: → ${c.fechaInicio}`);
    if (c.fechaFin) l.push(`Fin: → ${c.fechaFin}`);
  }
  return l.join('\n');
}

export function hayCambiosEpica(p: Propuesta): boolean {
  const c = p.campos;
  return !!(c.titulo || c.prioridad || c.descripcion || c.fechaInicio || c.fechaFin);
}
