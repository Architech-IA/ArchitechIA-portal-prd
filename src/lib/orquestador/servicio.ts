// Sage como orquestador dentro del portal: recibe un pedido, decide a qué agente delegarlo y deja constancia.
// Los agentes no escriben por su cuenta: Booking Agent propone con botón, Presales + Documentador dejan una propuesta de documento.
import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { callOpenCode } from '@/lib/opencodeChat';
import { proponer } from '@/lib/agendador/servicio';
import { proponer as proponerBacklog } from '@/lib/backlog-agente/servicio';
import { responderConsulta } from '@/lib/documentador/servicio';
import { redactarConPresales, traspaso } from '@/lib/presales/colaboracion';
import { parsearRuta } from '@/lib/presales/nucleo';
import { puedeActuar } from '@/lib/agentes/config';

const OPC = { model: process.env.ORQUESTADOR_MODEL || 'deepseek-v4.1-flash' };

export interface RespuestaOrq { texto: string; hiloId?: string; agente?: string; propuestaId?: string; botonAplicar?: string; enCurso?: boolean }

const AYUDA = `Soy Sage, el orquestador. Reparto tu pedido entre los agentes:
- Booking Agent: crear, mover o cancelar reuniones, o ver tu agenda.
- Backlog Manager: consultar el backlog (tareas, sprints, épicas) y crear o modificar tareas y épicas.
- Documentador: consultar lo documentado (reuniones, pendientes, briefings, memoria de proyecto).
- Presales + Documentador: preparar o mejorar un documento de proyecto (briefing de diagnóstico, alcance...) o armar la propuesta comercial (con rangos de inversión por confirmar). Presales aporta el contenido técnico, el Documentador lo redacta y Presales lo revisa; queda como propuesta para que la aceptes en el editor.`;

export const AYUDA_PRESALES = `Soy el Presales Engineer de ArchiTechIA. Preparo o mejoro documentos de proyecto con enfoque técnico y de diagnóstico: briefing de diagnóstico, alcance preliminar, preguntas de descubrimiento, riesgos y estimación en rangos. También armo la propuesta comercial de un proyecto: alcance, entregables, plazos e inversión como rango sugerido por confirmar.

Pídeme, por ejemplo: «arma la propuesta comercial de La Promotora Seguros» o «mejora el briefing del primer contacto de La Promotora Seguros: qué falta por confirmar y qué preguntas hacer en el diagnóstico».

Presales aporta el contenido técnico, el Agente Documentador lo redacta y Presales lo revisa (hasta 3 rondas). Al final queda como propuesta en el documento del proyecto, y tú la aceptas o rechazas en el editor. Tarda unos minutos y te escribo cuando esté. Los precios los dejo como rangos por confirmar: tú fijas el valor final. No envío nada a clientes.`;

export interface OpcionesOrq { soloPresales?: boolean; alTerminar?: (texto: string) => Promise<void> }

export async function orquestar(mensaje: string, userId: string, nombreUsuario = 'el equipo', lanzar: (f: () => Promise<void>) => void = f => after(f), opc: OpcionesOrq = {}): Promise<RespuestaOrq> {
  const docs = await prisma.$queryRaw<{ solucionId: string; nombre: string; faseClave: string; entregableClave: string; titulo: string }[]>`
    select d."solucionId", s.nombre, d."faseClave", d."entregableClave", d.titulo from "ProyectoDocumento" d join "Solucion" s on s.id = d."solucionId" order by d."updatedAt" desc limit 40`;
  const lista = docs.map(d => `${d.solucionId} | ${d.nombre} | ${d.faseClave} | ${d.entregableClave} | ${d.titulo}`).join('\n') || '(ninguno)';
  const system = `Eres Sage, el orquestador de ArchiTechIA. Decides a qué agente delegar el pedido de una persona del equipo. Agentes:
- booking-agent: crear, mover, cancelar o consultar reuniones del calendario (agenda).
- backlog-manager: consultar el backlog (tareas, sprints, épicas, quién tiene qué, qué está bloqueado o sin responsable) y crear o modificar TAREAS y ÉPICAS del backlog.
- documentador: consultar lo ya documentado (reuniones, pendientes, clientes, briefings, memoria de proyecto) sin modificar nada.
- presales: preparar, redactar o mejorar un DOCUMENTO de proyecto con enfoque técnico y de diagnóstico (briefing de diagnóstico, alcance preliminar, preguntas de descubrimiento, estimación) y PROPUESTAS COMERCIALES (alcance, entregables, plazos, inversión). Solo sobre un documento de esta lista (solucionId | proyecto | fase | entregableClave | título):
${lista}
- ninguno: no encaja con ningún agente.
Devuelve SOLO un JSON: {"agente":"booking-agent|backlog-manager|documentador|presales|ninguno","tarea":"el pedido reformulado","solucionId":"","entregableClave":"","aclaracion":""}
Para presales, solucionId y entregableClave deben salir de la lista; si no está claro cuál documento, pon una pregunta corta en "aclaracion".`;
  let ruta;
  try { ruta = parsearRuta(await callOpenCode(system, mensaje.slice(0, 1500), 'orquestador-ruta', { ...OPC, maxTokens: 3000, timeoutMs: 120_000 })); }
  catch (e) { console.error('[orquestador] ruta:', e); return { texto: 'No pude decidir a qué agente delegar ahora mismo. Inténtalo de nuevo en un momento.' }; }
  if (opc.soloPresales && (!ruta || ruta.agente !== 'presales')) return { texto: AYUDA_PRESALES };
  if (!ruta || ruta.agente === 'ninguno') return { texto: AYUDA };
  if (ruta.aclaracion) return { texto: ruta.aclaracion };

  const chequeos: [string, string][] = ruta.agente === 'booking-agent' ? [['booking-agent', '*']] : ruta.agente === 'backlog-manager' ? [['backlog-manager', '*']] : ruta.agente === 'documentador' ? [['documentador', 'consulta']] : [['presales', 'preparar_documento'], ['documentador', 'redactar']];
  for (const [ag, ac] of chequeos) { const v = await puedeActuar(ag, ac); if (!v.ok) return { texto: v.motivo }; }

  const hilo = await prisma.agenteHilo.create({ data: { userId, tipo: ruta.agente, pedido: mensaje.slice(0, 2000) } });
  await traspaso(hilo.id, 'sage', ruta.agente, 'delegacion', 0, ruta.tarea || mensaje);
  const cerrar = (estado: string, resultado: string) => prisma.agenteHilo.update({ where: { id: hilo.id }, data: { estado, resultado, updatedAt: new Date() } });

  try {
    if (ruta.agente === 'booking-agent') {
      const r = await proponer(ruta.tarea || mensaje, userId, 'portal');
      await traspaso(hilo.id, 'booking-agent', 'sage', 'respuesta', 0, r.texto);
      await cerrar('LISTO', r.texto);
      return { ...r, hiloId: hilo.id, agente: 'booking-agent' };
    }
    if (ruta.agente === 'backlog-manager') {
      const r = await proponerBacklog(ruta.tarea || mensaje, userId, 'portal');
      await traspaso(hilo.id, 'backlog-manager', 'sage', 'respuesta', 0, r.texto);
      await cerrar('LISTO', r.texto);
      return { ...r, hiloId: hilo.id, agente: 'backlog-manager' };
    }
    if (ruta.agente === 'documentador') {
      const t = await responderConsulta(userId, ruta.tarea || mensaje);
      await traspaso(hilo.id, 'documentador', 'sage', 'respuesta', 0, t);
      await cerrar('LISTO', t);
      return { texto: t, hiloId: hilo.id, agente: 'documentador' };
    }
    // presales: trabajo largo (varias rondas con el modelo); sigue en segundo plano y se consulta por el hilo
    const doc = docs.find(d => d.solucionId === ruta.solucionId && d.entregableClave === ruta.entregableClave);
    if (!doc) { await cerrar('ERROR', 'Documento no identificado'); return { texto: 'No identifiqué cuál documento quieres trabajar. Dime el proyecto y el documento (por ejemplo: «mejora el briefing del primer contacto de La Promotora Seguros»).' }; }
    lanzar(() => ejecutarPresales(hilo.id, nombreUsuario, doc.solucionId, doc.entregableClave, ruta.tarea || mensaje, opc.alTerminar));
    return { texto: `Delegado a Presales + Documentador sobre «${doc.titulo}» (${doc.nombre}). Presales arma el contenido, el Documentador redacta y Presales revisa; puede tardar varios minutos. Te aviso aquí cuando esté.`, hiloId: hilo.id, agente: 'presales', enCurso: true };
  } catch (e) {
    console.error('[orquestador] delegación:', e);
    await cerrar('ERROR', e instanceof Error ? e.message : 'error').catch(() => {});
    return { texto: 'El agente tuvo un problema con el pedido. Inténtalo de nuevo.', hiloId: hilo.id };
  }
}

// Trabajo largo de Presales: se llama en segundo plano (after) y deja el resultado en el hilo.
export async function ejecutarPresales(hiloId: string, solicitante: string, solucionId: string, entregableClave: string, pedido: string, alTerminar?: (texto: string) => Promise<void>) {
  let texto = 'Presales tuvo un problema. Inténtalo de nuevo.';
  let estado = 'ERROR';
  try {
    const r = await redactarConPresales(hiloId, { solucionId, entregableClave, pedido, solicitante });
    texto = 'error' in r ? r.error : r.texto;
    estado = 'error' in r ? 'ERROR' : 'LISTO';
  } catch (e) {
    console.error('[orquestador] presales:', e);
  }
  await prisma.agenteHilo.update({ where: { id: hiloId }, data: { estado, resultado: texto, updatedAt: new Date() } }).catch(() => {});
  if (alTerminar) await alTerminar(texto).catch(e => console.error('[orquestador] aviso final:', e));
}
