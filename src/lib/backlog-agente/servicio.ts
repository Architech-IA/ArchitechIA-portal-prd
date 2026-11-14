// Backlog Manager: interpreta pedidos sobre el backlog en lenguaje natural. Consulta tareas, sprints y épicas, y propone crear o
// editar tareas y épicas. Nunca escribe sin confirmación (cada cambio queda en AgendadorPropuesta con agente 'backlog-manager' y se
// aplica solo al pulsar el botón). No aprueba sprints, no cambia estados ni dispara ejecuciones del motor de desarrollo.
import { prisma } from '@/lib/prisma';
import { callOpenCodeMessages } from '@/lib/opencodeChat';
import { cargarHistorial, guardarTurno, olvidar } from '@/lib/agentes/memoria';
import { logActivity } from '@/lib/activity';
import { puedeActuar, reglasExtra } from '@/lib/agentes/config';
import { normalizar } from '../documentador/nucleo';
import {
  parsearPropuesta, accionPermiso, resolverPersona, resolverReferencia, tareasATexto, cambiosTarea, propuestaATexto, hayCambiosEpica,
  TIPOS_TAREA, PRIORIDADES, ESTADOS, type Propuesta, type Persona, type TareaLite,
} from './nucleo';

const OPC = { model: process.env.BACKLOG_MODEL || 'deepseek-v4.1-flash' };
const AGENTE = 'backlog-manager';
const ORION_AGENT_ID = 'cmsii11qf0003l0w1jikaxygb';
const BACKLOG_HUB_AREA_ID = 'area_backlog_hub_001';

export interface Respuesta { texto: string; propuestaId?: string; botonAplicar?: string }

interface SprintLite { id: string; sprintCode: string | null; name: string; status: string; epicId: string | null }
interface EpicaLite { id: string; name: string; status: string; priority: string }

async function personas(): Promise<Persona[]> {
  const [us, ags] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true }, take: 60 }),
    prisma.agent.findMany({ select: { id: true, name: true }, take: 60 }),
  ]);
  return [
    ...us.map(u => ({ id: u.id, name: u.name, tipo: 'HUMANO' as const })),
    ...ags.map(a => ({ id: a.id, name: a.name, tipo: 'AGENTE' as const })),
    { id: null, name: 'Claude', tipo: 'AGENTE' as const },
  ];
}

const SEL_TAREA = { id: true, taskCode: true, title: true, type: true, priority: true, status: true, points: true, assigneeName: true, description: true, sprint: { select: { sprintCode: true } } } as const;

// Fila de tarea + ejecutor (columna nueva; se lee aparte porque el cliente tipado puede no conocerla aún)
async function aTarea(rows: { id: string; taskCode: string | null; title: string; type: string | null; priority: string | null; status: string; points: number | null; assigneeName: string | null; description: string | null; sprint: { sprintCode: string | null } | null }[], pers: Persona[]): Promise<TareaLite[]> {
  if (!rows.length) return [];
  const ej = await prisma.$queryRaw<{ id: string; ejecutor: string | null }[]>`select id, ejecutor from "BacklogItem" where id = any(${rows.map(r => r.id)})`;
  const m = new Map(ej.map(e => [e.id, e.ejecutor]));
  return rows.map(r => ({
    id: r.id, taskCode: r.taskCode, title: r.title, type: r.type, priority: r.priority, status: r.status, points: r.points,
    assigneeName: r.assigneeName, description: r.description, sprintCodigo: r.sprint?.sprintCode ?? null,
    ejecutor: m.get(r.id) ?? (r.assigneeName ? (pers.find(p => normalizar(p.name) === normalizar(r.assigneeName ?? ''))?.tipo ?? null) : null),
  }));
}

export async function proponer(mensaje: string, userId: string, canal: 'portal' | 'telegram'): Promise<Respuesta> {
  const activo = await puedeActuar(AGENTE, '*');
  if (!activo.ok) return { texto: activo.motivo };

  const [sprints, epicas, pers] = await Promise.all([
    prisma.sprint.findMany({ where: { status: { not: 'COMPLETED' } }, orderBy: { createdAt: 'desc' }, take: 25, select: { id: true, sprintCode: true, name: true, status: true, epicId: true } }),
    prisma.epic.findMany({ orderBy: { createdAt: 'desc' }, take: 30, select: { id: true, name: true, status: true, priority: true } }),
    personas(),
  ]);
  const hoy = new Date().toISOString().slice(0, 10);
  const system = `Eres el Backlog Manager de ArchiTechIA. Conviertes el pedido de una persona del equipo sobre el backlog en un JSON. Hoy es ${hoy}.
Qué puedes hacer: consultar tareas, sprints y épicas; crear y editar TAREAS; crear y editar ÉPICAS. No puedes crear ni editar sprints, aprobarlos, cambiar el estado de una tarea, borrar ni ejecutar nada: si lo piden, accion "consultar" con "aclaracion" explicando que eso se hace desde el Backlog del portal.

Sprints abiertos (id | código | nombre | estado):
${sprints.map(s => `${s.id} | ${s.sprintCode ?? '-'} | ${s.name} | ${s.status}`).join('\n') || '(ninguno)'}
Épicas (nombre | estado):
${epicas.map(e => `${e.name} | ${e.status}`).join('\n') || '(ninguna)'}
Personas (responsables posibles): ${pers.filter(p => p.tipo === 'HUMANO').map(p => p.name).join(', ')}.
Agentes (también pueden ser responsables): ${pers.filter(p => p.tipo === 'AGENTE').map(p => p.name).join(', ')}.

Devuelve SOLO un JSON:
{"accion":"consultar|crear|editar","entidad":"tarea|sprint|epica","buscar":"","campos":{"titulo":"","descripcion":"","tipo":"","prioridad":"","puntos":"","responsable":"","sprint":"","dependeDe":"","fechaInicio":"","fechaFin":""},"filtro":{"sprint":"","responsable":"","ejecutor":"","tipo":"","estado":"","texto":"","sinResponsable":false,"epica":"","limite":15},"aclaracion":""}
Reglas:
- tipo (tareas): ${Object.keys(TIPOS_TAREA).join(', ')}. prioridad: ${Object.keys(PRIORIDADES).join(', ')} (CRITICAL crítica, HIGH alta, MEDIUM media, LOW baja). estado (solo para filtrar): ${Object.keys(ESTADOS).join(', ')}.
- crear tarea: "titulo" obligatorio. Tipo, prioridad, puntos, responsable, sprint y dependeDe solo si la persona los dijo; nunca los inventes ni preguntes por ellos: si hay título, devuelve la propuesta con "aclaracion" vacía y lo no dicho queda con valores por defecto (se puede ajustar después). Quita de "titulo" las palabras que son otro dato (por ejemplo «prioridad alta» o «responsable Daniel»). "sprint" es el código o el nombre de un sprint de la lista. "responsable" es una persona o agente de las listas.
- crear épica: "titulo" es el nombre de la épica; opcionales descripcion, prioridad, fechaInicio y fechaFin (YYYY-MM-DD).
- editar: en "buscar" va el código de la tarea (por ejemplo MASD-0001-001) o las palabras clave de su título, o el nombre de la épica. En "campos" van SOLO los datos que piden cambiar; el resto vacío. Para cambiar el responsable pon "responsable".
- consultar: usa "filtro". ejecutor HUMANO si piden tareas de personas, AGENTE si piden tareas que hacen los agentes o las internas. "sinResponsable" true para tareas sin asignar. "texto" para buscar palabras en el título. Para «qué hay en el sprint X» pon filtro.sprint. Para consultar sprints o épicas pon entidad "sprint" o "epica".
- Si falta un dato imprescindible (el título al crear, o no está claro qué tarea editar), pon en "aclaracion" una pregunta corta.
- Si das por hecho que una respuesta completa un pedido anterior, combina todo y devuelve el JSON completo.`;

  const clave = `${canal}:${userId}`;
  const historial = await cargarHistorial(AGENTE, clave);
  const conMemoria = historial.length ? `${system}

Historial reciente de esta conversación (mensajes de la persona y tus JSON anteriores): úsalo para entender lo que dice ahora. Si responde a una aclaración tuya, combina su respuesta con el pedido anterior. Si dice «esa» o «la anterior», se refiere a la tarea o épica del último JSON.` : system;
  let salida = '';
  try { salida = await callOpenCodeMessages(conMemoria + await reglasExtra(AGENTE), [...historial, { role: 'user', content: mensaje.slice(0, 1500) }], 'backlog-manager', { ...OPC, maxTokens: 3000, timeoutMs: 120_000 }); }
  catch (e) { console.error('[backlog-manager] modelo:', e); return { texto: 'No pude interpretar el pedido ahora mismo. Inténtalo de nuevo en un momento.' }; }
  const p = parsearPropuesta(salida);
  if (!p) return { texto: 'No entendí qué quieres hacer en el backlog. Prueba, por ejemplo: «qué tareas están sin responsable», «crea una tarea: documentar la API, prioridad alta» o «pasa la tarea MASD-0001-001 a Daniel».' };
  await guardarTurno(AGENTE, clave, mensaje, JSON.stringify(p));
  // Al crear con título no se pregunta por lo opcional (tipo, sprint, puntos...): se propone con valores por defecto y se ajusta después
  const creaConTitulo = p.accion === 'crear' && p.entidad !== 'sprint' && !!p.campos.titulo;
  if (p.aclaracion && !creaConTitulo) return { texto: p.aclaracion };
  const permiso = await puedeActuar(AGENTE, accionPermiso(p));
  if (!permiso.ok) return { texto: permiso.motivo };

  if (p.accion === 'consultar') return { texto: await consultar(p, sprints, epicas, pers) };
  if (p.entidad === 'sprint') return { texto: 'Crear o editar sprints todavía no se puede hacer desde aquí; hazlo desde el Backlog del portal. Sí puedo consultarlos, y crear o editar tareas y épicas.' };

  // --- épicas ---
  if (p.entidad === 'epica') {
    if (p.accion === 'crear') {
      if (!p.campos.titulo) return { texto: '¿Cómo se llama la épica?' };
      if (epicas.some(e => normalizar(e.name) === normalizar(p.campos.titulo))) return { texto: `Ya existe una épica llamada «${p.campos.titulo}». ¿Quieres modificarla?` };
      return guardar(p, userId, canal, propuestaATexto(p, null, null), 'Crear épica');
    }
    const r = resolverReferencia(epicas.map(e => ({ id: e.id, titulo: e.name })), p.buscar || p.campos.titulo);
    if (!r.elegido) return { texto: r.candidatos.length ? `¿Cuál épica? Encontré: ${r.candidatos.map(c => `«${c.titulo}»`).join(', ')}.` : 'No encuentro esa épica. Dime su nombre.' };
    p.resuelto.epicaId = r.elegido.id;
    if (p.buscar && p.campos.titulo && normalizar(p.buscar) === normalizar(p.campos.titulo)) p.campos.titulo = '';
    if (!hayCambiosEpica(p)) return { texto: `Dime qué quieres cambiar de la épica «${r.elegido.titulo}» (nombre, prioridad, descripción o fechas).` };
    return guardar(p, userId, canal, propuestaATexto(p, null, { nombre: r.elegido.titulo }), 'Aplicar cambios');
  }

  // --- tareas: resolver responsable, sprint y dependencia ---
  const dudas = await resolverReferencias(p, sprints, pers);
  if (dudas) return { texto: dudas };

  if (p.accion === 'crear') {
    if (!p.campos.titulo) return { texto: '¿Cuál es el título de la tarea?' };
    return guardar(p, userId, canal, propuestaATexto(p, null, null), 'Crear tarea');
  }
  const previa = await buscarTarea(p.buscar || p.campos.titulo, pers);
  if (!('tarea' in previa)) return { texto: previa.texto };
  const t = previa.tarea;
  if (t.status === 'IN_PROGRESS') return { texto: `«${t.title}» se está ejecutando ahora; no la modifico hasta que termine.` };
  p.resuelto.tareaId = t.id;
  if (p.buscar && normalizar(p.buscar) === normalizar(p.campos.titulo)) p.campos.titulo = '';
  if (!cambiosTarea(p, t).length) return { texto: `«${t.title}» ya tiene esos datos, o no me dijiste qué cambiar. Dime qué quieres modificar (título, tipo, prioridad, puntos, responsable, sprint o descripción).` };
  return guardar(p, userId, canal, propuestaATexto(p, t, null), 'Aplicar cambios');
}

// Responsable, sprint y dependencia contra las listas reales. Devuelve una pregunta si algo no se pudo identificar.
async function resolverReferencias(p: Propuesta, sprints: SprintLite[], pers: Persona[]): Promise<string | null> {
  const c = p.campos;
  if (c.responsable) {
    const r = resolverPersona(c.responsable, pers);
    if (!r.persona) return r.candidatos.length ? `¿Cuál responsable? Encontré: ${r.candidatos.map(x => x.name).join(', ')}.` : `No encuentro a «${c.responsable}» entre las personas ni los agentes. ¿Quién será el responsable?`;
    p.resuelto.asignadoId = r.persona.id; p.resuelto.asignadoNombre = r.persona.name; p.resuelto.ejecutor = r.persona.tipo;
  }
  if (c.sprint) {
    const r = resolverReferencia(sprints.map(s => ({ id: s.id, titulo: s.name, codigo: s.sprintCode })), c.sprint);
    if (!r.elegido) return r.candidatos.length ? `¿Cuál sprint? Encontré: ${r.candidatos.map(x => x.codigo ?? x.titulo).join(', ')}.` : `No encuentro el sprint «${c.sprint}» entre los abiertos.`;
    p.resuelto.sprintId = r.elegido.id; p.resuelto.sprintCodigo = r.elegido.codigo ?? null;
  }
  if (c.dependeDe) {
    const d = await buscarTarea(c.dependeDe, pers);
    if (!('tarea' in d)) return `Sobre la dependencia: ${d.texto}`;
    p.resuelto.dependeId = d.tarea.id; p.resuelto.dependeCodigo = d.tarea.taskCode ?? d.tarea.title;
  }
  return null;
}

// Busca una tarea por código o por las palabras de su título directamente en la base de datos
async function buscarTarea(consulta: string, pers: Persona[]): Promise<{ tarea: TareaLite } | { texto: string }> {
  const q = consulta.trim();
  if (!q) return { texto: 'No me quedó claro qué tarea. Dime su código o su título.' };
  const palabras = normalizar(q).split(/\s+/).filter(w => w.length >= 3).slice(0, 5);
  const rows = await prisma.backlogItem.findMany({
    where: { OR: [{ taskCode: { equals: q, mode: 'insensitive' } }, ...(palabras.length ? [{ AND: palabras.map(w => ({ title: { contains: w, mode: 'insensitive' as const } })) }] : [])] },
    orderBy: { updatedAt: 'desc' }, take: 8, select: SEL_TAREA,
  });
  const tareas = await aTarea(rows, pers);
  const r = resolverReferencia(tareas.map(t => ({ id: t.id, titulo: t.title, codigo: t.taskCode })), q);
  const elegida = r.elegido ? tareas.find(t => t.id === r.elegido!.id) : tareas.length === 1 ? tareas[0] : undefined;
  if (elegida) return { tarea: elegida };
  if (!tareas.length) return { texto: `No encuentro ninguna tarea con «${q}». Dime el código o el título.` };
  return { texto: `Encontré varias tareas parecidas. ¿Cuál es?\n${tareas.slice(0, 6).map(t => `- ${t.taskCode ?? 'sin código'} · ${t.title}`).join('\n')}\nDame el código.` };
}

async function guardar(p: Propuesta, userId: string, canal: string, texto: string, boton: string): Promise<Respuesta> {
  const fila = await prisma.agendadorPropuesta.create({ data: { canal, userId, datos: JSON.stringify(p) } });
  return { texto, propuestaId: fila.id, botonAplicar: boton };
}

async function consultar(p: Propuesta, sprints: SprintLite[], epicas: EpicaLite[], pers: Persona[]): Promise<string> {
  const f = p.filtro;
  if (p.entidad === 'sprint') {
    const rs = await prisma.sprint.findMany({ where: f.texto ? { OR: [{ name: { contains: f.texto, mode: 'insensitive' } }, { sprintCode: { contains: f.texto, mode: 'insensitive' } }] } : undefined, orderBy: { createdAt: 'desc' }, take: f.limite, select: { sprintCode: true, name: true, status: true, startDate: true, endDate: true, _count: { select: { items: true } } } });
    if (!rs.length) return 'No hay sprints con ese criterio.';
    return `Sprints (${rs.length})\n\n${rs.map(s => `- ${s.sprintCode ?? ''} · ${s.name} | ${s.status} | ${s._count.items} tareas${s.endDate ? ` | cierra ${s.endDate.toISOString().slice(0, 10)}` : ''}`).join('\n')}`;
  }
  if (p.entidad === 'epica') {
    const rs = await prisma.epic.findMany({ where: f.texto ? { name: { contains: f.texto, mode: 'insensitive' } } : undefined, orderBy: { createdAt: 'desc' }, take: f.limite, select: { name: true, status: true, priority: true, _count: { select: { sprints: true } } } });
    if (!rs.length) return 'No hay épicas con ese criterio.';
    return `Épicas (${rs.length})\n\n${rs.map(e => `- ${e.name} | ${e.status} | ${PRIORIDADES[e.priority] ?? e.priority} | ${e._count.sprints} sprints`).join('\n')}`;
  }
  const where: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];
  if (f.sprint) {
    const r = resolverReferencia(sprints.map(s => ({ id: s.id, titulo: s.name, codigo: s.sprintCode })), f.sprint);
    if (!r.elegido) return r.candidatos.length ? `¿Cuál sprint? Encontré: ${r.candidatos.map(x => x.codigo ?? x.titulo).join(', ')}.` : `No encuentro el sprint «${f.sprint}» entre los abiertos.`;
    and.push({ sprintId: r.elegido.id });
  }
  if (f.epica) {
    const r = resolverReferencia(epicas.map(e => ({ id: e.id, titulo: e.name })), f.epica);
    if (!r.elegido) return `No encuentro la épica «${f.epica}».`;
    and.push({ sprint: { epicId: r.elegido.id } });
  }
  if (f.responsable) {
    const r = resolverPersona(f.responsable, pers);
    if (!r.persona) return r.candidatos.length ? `¿Cuál responsable? Encontré: ${r.candidatos.map(x => x.name).join(', ')}.` : `No encuentro a «${f.responsable}».`;
    and.push({ assigneeName: { equals: r.persona.name, mode: 'insensitive' } });
  }
  if (f.sinResponsable) and.push({ OR: [{ assigneeName: null }, { assigneeName: '' }] });
  if (f.tipo) and.push({ type: f.tipo });
  if (f.estado) and.push({ status: f.estado });
  if (f.texto) and.push({ title: { contains: f.texto, mode: 'insensitive' } });
  if (f.ejecutor) {
    const nombres = pers.filter(x => x.tipo === f.ejecutor).map(x => x.name);
    and.push({ assigneeName: { in: nombres, mode: 'insensitive' } });
  }
  if (and.length) where.AND = and;
  const [total, rows] = await Promise.all([
    prisma.backlogItem.count({ where }),
    prisma.backlogItem.findMany({ where, orderBy: [{ updatedAt: 'desc' }], take: f.limite, select: SEL_TAREA }),
  ]);
  const titulo = [f.sprint && `sprint ${f.sprint}`, f.responsable && `de ${f.responsable}`, f.ejecutor && `de ${f.ejecutor === 'AGENTE' ? 'agentes' : 'personas'}`, f.sinResponsable && 'sin responsable', f.estado && ESTADOS[f.estado], f.tipo && TIPOS_TAREA[f.tipo], f.texto && `«${f.texto}»`].filter(Boolean).join(', ');
  return tareasATexto(`Tareas${titulo ? ` (${titulo})` : ''}`, await aTarea(rows, pers), total);
}

export async function nuevaConversacion(userId: string, canal: 'portal' | 'telegram'): Promise<void> {
  await olvidar(AGENTE, `${canal}:${userId}`);
}

function codigoLibre(base: string, n: number, usados: Set<string>): string {
  let i = n; let c = `${base}-${String(i).padStart(3, '0')}`;
  while (usados.has(c)) { i += 1; c = `${base}-${String(i).padStart(3, '0')}`; }
  return c;
}

export async function aplicarPropuesta(propuestaId: string): Promise<string> {
  const tomada = await prisma.agendadorPropuesta.updateMany({ where: { id: propuestaId, estado: 'PENDIENTE' }, data: { estado: 'APLICANDO' } });
  if (tomada.count === 0) return 'Esta propuesta ya se aplicó o se descartó.';
  const fila = await prisma.agendadorPropuesta.findUnique({ where: { id: propuestaId } });
  if (!fila) return 'No encuentro la propuesta.';
  let p: Propuesta;
  try { p = JSON.parse(fila.datos); } catch { return 'La propuesta está dañada.'; }
  const marcar = (estado: string) => prisma.agendadorPropuesta.update({ where: { id: propuestaId }, data: { estado } });
  const permiso = await puedeActuar(AGENTE, accionPermiso(p));
  if (!permiso.ok) { await marcar('BLOQUEADA'); return permiso.motivo; }
  const r = p.resuelto ?? {};
  const c = p.campos;
  try {
    if (p.entidad === 'epica') {
      if (p.accion === 'crear') {
        const e = await prisma.epic.create({ data: { name: c.titulo, description: c.descripcion || null, priority: c.prioridad || 'MEDIUM', startDate: c.fechaInicio ? new Date(`${c.fechaInicio}T00:00:00Z`) : null, endDate: c.fechaFin ? new Date(`${c.fechaFin}T00:00:00Z`) : null } });
        await logActivity({ type: 'CREATED', description: `creó la épica ${e.name} (Backlog Manager)`, entityType: 'epic', entityId: e.id, userId: fila.userId });
        await marcar('APLICADA');
        return `Listo. Épica creada: ${e.name}.`;
      }
      if (!r.epicaId) { await marcar('ERROR'); return 'No identifiqué la épica.'; }
      const e = await prisma.epic.update({ where: { id: r.epicaId }, data: {
        ...(c.titulo ? { name: c.titulo } : {}), ...(c.descripcion ? { description: c.descripcion } : {}), ...(c.prioridad ? { priority: c.prioridad } : {}),
        ...(c.fechaInicio ? { startDate: new Date(`${c.fechaInicio}T00:00:00Z`) } : {}), ...(c.fechaFin ? { endDate: new Date(`${c.fechaFin}T00:00:00Z`) } : {}),
      } });
      await logActivity({ type: 'UPDATED', description: `modificó la épica ${e.name} (Backlog Manager)`, entityType: 'epic', entityId: e.id, userId: fila.userId });
      await marcar('APLICADA');
      return `Listo. Épica «${e.name}» actualizada.`;
    }

    if (p.accion === 'crear') {
      let taskCode: string | null = null;
      if (r.sprintId) {
        const sp = await prisma.sprint.findUnique({ where: { id: r.sprintId }, select: { sprintCode: true } });
        if (sp?.sprintCode) {
          const existentes = await prisma.backlogItem.findMany({ where: { taskCode: { startsWith: sp.sprintCode + '-' } }, select: { taskCode: true } });
          taskCode = codigoLibre(sp.sprintCode, existentes.length + 1, new Set(existentes.map(x => x.taskCode ?? '')));
        }
      }
      const esOrion = r.asignadoId === ORION_AGENT_ID || /orion/i.test(r.asignadoNombre ?? '');
      const t = await prisma.backlogItem.create({ data: {
        title: c.titulo, description: c.descripcion || null, type: c.tipo || 'TASK', priority: c.prioridad || 'MEDIUM', status: 'BACKLOG',
        points: c.puntos, assigneeId: r.asignadoId ?? null, assigneeName: r.asignadoNombre ?? null, sprintId: r.sprintId ?? null, taskCode,
        dependsOnTaskId: r.dependeId ?? null, areaId: esOrion ? BACKLOG_HUB_AREA_ID : null,
      } });
      if (r.ejecutor) await prisma.$executeRaw`update "BacklogItem" set ejecutor = ${r.ejecutor} where id = ${t.id}`;
      await logActivity({ type: 'CREATED', description: `creó el ítem de backlog ${t.title}${taskCode ? ` (${taskCode})` : ''} (Backlog Manager)`, entityType: 'backlogItem', entityId: t.id, userId: fila.userId });
      await marcar('APLICADA');
      return `Listo. Tarea creada: ${taskCode ? taskCode + ' · ' : ''}${t.title}.`;
    }

    if (!r.tareaId) { await marcar('ERROR'); return 'No identifiqué la tarea.'; }
    const previa = await prisma.backlogItem.findUnique({ where: { id: r.tareaId }, select: { id: true, status: true, sprintId: true, taskCode: true, title: true } });
    if (!previa) { await marcar('ERROR'); return 'Esa tarea ya no existe.'; }
    if (previa.status === 'IN_PROGRESS') { await marcar('BLOQUEADA'); return `«${previa.title}» pasó a ejecutarse mientras tanto; no la modifico.`; }
    const data: Record<string, unknown> = {};
    if (c.titulo) data.title = c.titulo;
    if (c.descripcion) data.description = c.descripcion;
    if (c.tipo) data.type = c.tipo;
    if (c.prioridad) data.priority = c.prioridad;
    if (c.puntos !== null) data.points = c.puntos;
    if (r.asignadoNombre) { data.assigneeId = r.asignadoId ?? null; data.assigneeName = r.asignadoNombre; }
    if (r.dependeId) data.dependsOnTaskId = r.dependeId;
    if (r.sprintId && (r.sprintId !== previa.sprintId || !previa.taskCode)) {
      data.sprintId = r.sprintId;
      const sp = await prisma.sprint.findUnique({ where: { id: r.sprintId }, select: { sprintCode: true } });
      if (sp?.sprintCode) {
        const existentes = await prisma.backlogItem.findMany({ where: { taskCode: { startsWith: sp.sprintCode + '-' } }, select: { taskCode: true } });
        data.taskCode = codigoLibre(sp.sprintCode, existentes.length + 1, new Set(existentes.map(x => x.taskCode ?? '')));
      }
    }
    const t = await prisma.backlogItem.update({ where: { id: previa.id }, data });
    if (r.ejecutor) await prisma.$executeRaw`update "BacklogItem" set ejecutor = ${r.ejecutor} where id = ${t.id}`;
    await logActivity({ type: 'UPDATED', description: `modificó el ítem de backlog ${t.title} (Backlog Manager)`, entityType: 'backlogItem', entityId: t.id, userId: fila.userId });
    await marcar('APLICADA');
    return `Listo. «${t.title}» actualizada.`;
  } catch (e) {
    console.error('[backlog-manager] aplicar:', e);
    await marcar('ERROR').catch(() => {});
    return 'No pude aplicar el cambio. No se modificó nada que yo sepa; revisa el backlog.';
  }
}
