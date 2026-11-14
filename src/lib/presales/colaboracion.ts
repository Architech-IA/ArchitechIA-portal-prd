// Presales + Documentador trabajando juntos sobre un documento de proyecto:
//   Presales aporta el contenido técnico -> el Documentador redacta -> Presales revisa (aprueba, comenta o pide ajustes)
//   -> el Documentador corrige -> ... (máximo MAX_RONDAS). Al final el borrador queda como PROPUESTA del documento
//   (el editor del proyecto la muestra y una persona la acepta o rechaza). Presales nunca edita; el Documentador nunca decide el contenido.
import { prisma } from '@/lib/prisma';
import { callOpenCode } from '@/lib/opencodeChat';
import { hubATexto } from '@/lib/documentador/nucleo';
import { htmlADocTexto } from '@/lib/documentador/servicio';
import { puedeActuar, reglasExtra } from '@/lib/agentes/config';
import { MAX_RONDAS, esPropuestaComercial, parsearContenido, parsearRevision, limpiarHtml, contenidoATexto, comentariosATexto, type ContenidoTecnico } from './nucleo';

const OPC = { model: process.env.PRESALES_MODEL || 'deepseek-v4.1-flash' };

export async function traspaso(hiloId: string, de: string, a: string, tipo: string, ronda: number, contenido: string) {
  await prisma.agenteTraspaso.create({ data: { hiloId, de, a, tipo, ronda, contenido: contenido.slice(0, 60_000) } });
}

async function contextoProyecto(solucionId: string, entregableClave: string) {
  const sol = (await prisma.$queryRaw<{ id: string; nombre: string; empresa: string | null; descripcion: string | null }[]>`select id, nombre, empresa, descripcion from "Solucion" where id = ${solucionId}`)[0];
  if (!sol) return null;
  const docs = await prisma.$queryRaw<{ id: string; faseClave: string; entregableClave: string; titulo: string; contenido: string; version: number; propuesta: string | null }[]>`
    select id, "faseClave", "entregableClave", titulo, contenido, version, propuesta from "ProyectoDocumento" where "solucionId" = ${solucionId} order by "updatedAt" desc limit 12`;
  const mem = await prisma.$queryRaw<{ contenido: string }[]>`select contenido from "ProyectoMemoria" where "solucionId" = ${solucionId} and length(contenido) > 0 limit 1`;
  const clave = (sol.empresa || sol.nombre).split(/[\s·—-]+/).filter(w => w.length >= 4)[0] || sol.nombre;
  const reuniones = await prisma.meeting.findMany({
    where: { status: { not: 'CANCELLED' }, OR: [{ title: { contains: clave, mode: 'insensitive' } }, { attendees: { contains: clave, mode: 'insensitive' } }, { description: { contains: clave, mode: 'insensitive' } }] },
    orderBy: { date: 'desc' }, take: 4, select: { title: true, date: true, hub: true, notes: true },
  });
  const objetivo = docs.find(d => d.entregableClave === entregableClave) || null;
  let ctx = `PROYECTO: ${sol.nombre}${sol.empresa ? ` (${sol.empresa})` : ''}\n${sol.descripcion ? `Descripción: ${sol.descripcion}\n` : ''}`;
  for (const d of docs) ctx += `\n[Documento «${d.titulo}», fase ${d.faseClave}, versión ${d.version}]\n${htmlADocTexto(d.contenido).slice(0, 6000)}\n`;
  if (mem[0]) ctx += `\n[Memoria del proyecto]\n${mem[0].contenido.slice(0, 4000)}\n`;
  for (const r of reuniones) {
    const h = hubATexto(r.hub);
    ctx += `\n[Reunión «${r.title}», ${r.date.toISOString().slice(0, 10)}]\n${[h.notas, h.decisiones.length ? `Decisiones: ${h.decisiones.join('; ')}` : '', r.notes || ''].filter(Boolean).join('\n').slice(0, 3000)}\n`;
  }
  return { sol, objetivo, ctx: ctx.slice(0, 30_000) };
}

const COMERCIAL = `MODO PROPUESTA COMERCIAL. El documento es una propuesta para el cliente. Estructura: contexto y entendimiento del problema; solución propuesta; alcance (incluido y excluido); entregables; fases y plazos como rangos; equipo; inversión; supuestos y dependencias; riesgos; condiciones; siguientes pasos. Inversión: estima el esfuerzo por fase o entregable (rangos de horas o semanas) y propón un rango de inversión o un desglose, siempre marcado «Por confirmar» y con la base de cálculo explícita; el valor final lo fija una persona, nunca lo presentes como definitivo. Si el contexto no alcanza para estimar, di qué dato falta en lugar de adivinar. No prometas fechas ni compromisos legales.`;

const REGLAS = `Reglas de datos: usa SOLO lo que está en el contexto. No inventes precios, plazos, cifras, nombres, capacidades ni compromisos. Lo que falte va marcado «Por confirmar». Cita la fuente (documento y versión, o reunión y fecha).`;

async function pedirContenido(pedido: string, ctx: string, actual: string, comercial: boolean): Promise<ContenidoTecnico | null> {
  const system = `Eres el Presales Engineer de ArchiTechIA: la especialidad técnica y de diagnóstico previa a vender. Aportas el CONTENIDO técnico de un documento (hallazgos, preguntas de descubrimiento, hipótesis de solución, alcance preliminar, supuestos, riesgos, dependencias, estimación como rangos). No redactas el documento final: eso lo hace el Agente Documentador. ${comercial ? 'Armas el contenido de una propuesta comercial; los precios son solo rangos sugeridos por confirmar.' : 'No fijas precios ni condiciones comerciales.'}
${REGLAS}${comercial ? `
${COMERCIAL}` : ''}
Devuelve SOLO un JSON: {"titulo":"","secciones":[{"titulo":"","puntos":[""]}],"porConfirmar":[""],"fuentes":[""]}`;
  const salida = await callOpenCode(system + await reglasExtra('presales'), `PEDIDO: ${pedido}\n\n${actual ? `DOCUMENTO ACTUAL (la estructura y títulos se respetan):\n${actual}\n\n` : ''}CONTEXTO:\n${ctx}`, 'presales-contenido', { ...OPC, maxTokens: 12_000, timeoutMs: 300_000 });
  return parsearContenido(salida);
}

async function redactar(contenido: ContenidoTecnico, actual: string, borrador: string, comentarios: string, comercial: boolean): Promise<string | null> {
  const system = `Eres el Agente Documentador (writer) de ArchiTechIA. Conviertes el contenido técnico que te entrega Presales en un documento HTML para el editor del proyecto (usa solo h1, h2, h3, p, ul, ol, li, table, thead, tbody, tr, th, td, strong, em). Eres fiel al contenido: no agregas datos, no cambias cifras, no decides lo técnico. Lo «Por confirmar» queda visible en el documento.${comercial ? ' Es una propuesta comercial para un cliente: tono profesional y claro, cifras de inversión solo como rangos tal como llegan, marcadas «Por confirmar».' : ''}${actual ? ' Mantén la estructura y los títulos del documento actual cuando apliquen.' : ''}${borrador ? ' Estás corrigiendo tu borrador: aplica SOLO los comentarios de Presales y deja el resto igual.' : ''}
Devuelve SOLO el HTML, sin explicaciones ni bloques de código.`;
  const user = `CONTENIDO TÉCNICO DE PRESALES:\n${contenidoATexto(contenido)}\n${actual ? `\nDOCUMENTO ACTUAL:\n${actual}\n` : ''}${borrador ? `\nTU BORRADOR ANTERIOR (HTML):\n${borrador}\n\nCOMENTARIOS DE PRESALES A APLICAR:\n${comentarios}\n` : ''}`;
  return limpiarHtml(await callOpenCode(system + await reglasExtra('documentador'), user, 'documentador-redaccion', { ...OPC, maxTokens: 16_000, timeoutMs: 300_000 }));
}

async function revisar(contenido: ContenidoTecnico, borrador: string, comercial: boolean) {
  const system = `Eres el Presales Engineer de ArchiTechIA revisando el borrador que redactó el Agente Documentador a partir de tu contenido técnico. Comparas el borrador con tu contenido: ¿es fiel, completo y sin datos inventados? Las «dudas por confirmar» deben conservarse. No pidas cambios de estilo.${comercial ? ' Es una propuesta comercial: verifica además que ningún precio o plazo aparezca como definitivo y que la base de cálculo se conserve.' : ''} Si todo está bien, apruebas SIN comentarios; si no, pides ajustes concretos.
Devuelve SOLO un JSON: {"veredicto":"aprobar|ajustar","comentarios":[{"seccion":"","comentario":""}]}`;
  const salida = await callOpenCode(system + await reglasExtra('presales'), `TU CONTENIDO TÉCNICO:\n${contenidoATexto(contenido)}\n\nBORRADOR DEL DOCUMENTADOR (HTML):\n${borrador}`, 'presales-revision', { ...OPC, maxTokens: 6000, timeoutMs: 240_000 });
  return parsearRevision(salida);
}

export interface ResultadoColaboracion { aprobadoPorPresales: boolean; rondas: number; documentoId: string; pendientes: string[]; texto: string }

export async function redactarConPresales(hiloId: string, p: { solucionId: string; entregableClave: string; pedido: string; solicitante: string }): Promise<ResultadoColaboracion | { error: string }> {
  const permisoP = await puedeActuar('presales', 'preparar_documento');
  if (!permisoP.ok) return { error: permisoP.motivo };
  const permisoD = await puedeActuar('documentador', 'redactar');
  if (!permisoD.ok) return { error: permisoD.motivo };
  const c = await contextoProyecto(p.solucionId, p.entregableClave);
  if (!c) return { error: 'No encuentro ese proyecto.' };
  if (!c.objetivo) return { error: 'No encuentro ese documento en el proyecto; créalo primero desde la fase.' };
  if (c.objetivo.propuesta) return { error: 'Ese documento ya tiene una propuesta pendiente. Acéptala o recházala en el editor antes de pedir otra.' };
  const actual = htmlADocTexto(c.objetivo.contenido).slice(0, 8000);

  const comercial = esPropuestaComercial(c.objetivo.faseClave, c.objetivo.entregableClave, p.pedido);
  const contenido = await pedirContenido(p.pedido, c.ctx, actual, comercial);
  if (!contenido) return { error: 'Presales no logró armar el contenido técnico. Inténtalo de nuevo.' };
  await traspaso(hiloId, 'presales', 'documentador', 'contenido', 0, contenidoATexto(contenido));

  let borrador = '';
  let comentarios = '';
  let aprobado = false;
  let ultimos: string[] = [];
  let rondas = 0;
  for (let ronda = 1; ronda <= MAX_RONDAS; ronda++) {
    rondas = ronda;
    const html = await redactar(contenido, actual, borrador, comentarios, comercial);
    if (!html) return { error: 'El Documentador no logró redactar un borrador válido.' };
    borrador = html;
    await traspaso(hiloId, 'documentador', 'presales', 'borrador', ronda, borrador);
    const rev = await revisar(contenido, borrador, comercial);
    if (rev.veredicto === 'aprobar') { await traspaso(hiloId, 'presales', 'documentador', 'aprobado', ronda, 'Aprobado sin comentarios.'); aprobado = true; ultimos = []; break; }
    comentarios = comentariosATexto(rev.comentarios);
    ultimos = rev.comentarios.map(x => `[${x.seccion}] ${x.comentario}`);
    await traspaso(hiloId, 'presales', 'documentador', 'ajustes', ronda, comentarios);
  }

  const por = `${comercial ? 'Propuesta comercial · ' : ''}Presales + Documentador (pedido por ${p.solicitante})`;
  const nota = aprobado ? '' : `<p><em>Presales no dio su aprobación tras ${MAX_RONDAS} rondas. Comentarios pendientes: ${ultimos.join(' / ').replace(/[<>]/g, '')}</em></p>`;
  const guardado = await prisma.$executeRaw`update "ProyectoDocumento" set propuesta = ${nota + borrador}, "propuestaPor" = ${por}, "propuestaEn" = now() where id = ${c.objetivo.id} and propuesta is null`;
  if (guardado === 0) return { error: 'No pude dejar la propuesta (alguien más dejó una mientras tanto).' };
  const texto = aprobado
    ? `Listo. Presales aprobó el borrador en ${rondas} ronda(s). Quedó como propuesta en «${c.objetivo.titulo}» (${c.sol.nombre}); ábrelo en el editor del proyecto para aceptarla o rechazarla.`
    : `El borrador quedó como propuesta en «${c.objetivo.titulo}» (${c.sol.nombre}), pero Presales no lo aprobó del todo tras ${MAX_RONDAS} rondas. Comentarios pendientes:\n- ${ultimos.join('\n- ')}\nRevisa la propuesta en el editor antes de aceptarla.`;
  return { aprobadoPorPresales: aprobado, rondas, documentoId: c.objetivo.id, pendientes: ultimos, texto };
}
