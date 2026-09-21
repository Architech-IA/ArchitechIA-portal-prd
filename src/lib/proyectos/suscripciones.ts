import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { callOpenCode } from '@/lib/opencodeChat'
import { getDateStrUTC5, getTimeStrUTC5 } from '@/lib/timezone'
import { construirContexto } from './contexto'

// Disparadores del proyecto: cada suscripción revisa algo (backlog, documentos, periodo) y
// publica lo que pasó en la Bitácora del proyecto (una sesión más, consultable con la IA).
// Las ejecuta un cron del servidor cada 10 minutos (POST /api/proyectos/suscripciones/ejecutar)
// y también se pueden lanzar a mano desde la interfaz.

const hash = (t: string | null | undefined) => crypto.createHash('md5').update(t ?? '').digest('hex')
const fechaHora = (d: Date) => `${getDateStrUTC5(d)} ${getTimeStrUTC5(d)}`

export async function obtenerBitacora(solucionId: string): Promise<string> {
  const ex = await prisma.proyectoSesion.findFirst({ where: { solucionId, tipo: 'BITACORA' }, select: { id: true } })
  if (ex) return ex.id
  const s = await prisma.proyectoSesion.create({ data: {
    solucionId, titulo: '📡 Bitácora del proyecto', tipo: 'BITACORA', creadaPorId: 'sistema', creadaPorNombre: 'Sistema', privada: false,
  } })
  return s.id
}

export async function publicarEnSesion(sesionId: string, contenido: string, metadata: Record<string, unknown> = {}): Promise<void> {
  await prisma.$transaction(async tx => {
    const max = await tx.proyectoMensaje.aggregate({ where: { sesionId }, _max: { orden: true } })
    await tx.proyectoMensaje.create({ data: {
      sesionId, orden: (max._max.orden ?? 0) + 1, rol: 'assistant', contenido, estado: 'LISTO',
      metadata: { origen: 'suscripcion', ...metadata } as never, autorId: 'sistema', autorNombre: 'Automatización',
    } })
    await tx.proyectoSesion.update({ where: { id: sesionId }, data: { updatedAt: new Date() } })
  })
}

type Sub = NonNullable<Awaited<ReturnType<typeof prisma.proyectoSuscripcion.findFirst>>>

async function ejecutarUna(sub: Sub): Promise<string> {
  const desde = sub.ultimaEjecucion ?? sub.createdAt
  const destino = sub.sesionId ?? await obtenerBitacora(sub.solucionId)
  const ahora = new Date()

  if (sub.tipo === 'BACKLOG_CAMBIOS') {
    const items = await prisma.backlogItem.findMany({
      where: { solucionId: sub.solucionId, updatedAt: { gt: desde } }, orderBy: { updatedAt: 'desc' }, take: 40,
      select: { title: true, status: true, priority: true, taskCode: true, createdAt: true, updatedAt: true },
    })
    if (items.length === 0) return 'Sin cambios en el backlog'
    const nuevas = items.filter(i => i.createdAt > desde)
    const cambiadas = items.filter(i => i.createdAt <= desde)
    const fmt = (i: (typeof items)[number]) => `- [${i.status}] ${i.taskCode ? i.taskCode + ' ' : ''}${i.title}`
    const md = [
      `**Cambios en el backlog** (${fechaHora(desde)} → ${fechaHora(ahora)}, UTC-5)`,
      nuevas.length ? `\n**Tareas nuevas (${nuevas.length}):**\n${nuevas.map(fmt).join('\n')}` : '',
      cambiadas.length ? `\n**Tareas modificadas (${cambiadas.length}):**\n${cambiadas.map(fmt).join('\n')}` : '',
    ].filter(Boolean).join('\n')
    await publicarEnSesion(destino, md, { suscripcionId: sub.id, tipo: sub.tipo })
    return `${items.length} cambio(s) publicados`
  }

  if (sub.tipo === 'DOCUMENTOS_CAMBIOS') {
    const sol = await prisma.solucion.findUnique({ where: { id: sub.solucionId } })
    if (!sol) return 'El proyecto ya no existe'
    const actual: Record<string, string> = {
      'PRD': hash(sol.prd), 'Diseño técnico': hash(sol.disenoTecnico), 'Plan de ejecución': hash(sol.planEjecucion),
      'Arquitectura': hash(sol.arquitectura), 'Cronograma': hash(sol.cronograma), 'Plan de trabajo': hash(sol.planTrabajo),
    }
    const previo = (sub.config as { hashes?: Record<string, string> } | null)?.hashes
    await prisma.proyectoSuscripcion.update({ where: { id: sub.id }, data: { config: { ...(sub.config as object), hashes: actual } as never } })
    if (!previo) return 'Línea base registrada (se avisará a partir del próximo cambio)'
    const cambiados = Object.keys(actual).filter(k => previo[k] !== actual[k])
    if (cambiados.length === 0) return 'Sin cambios en los documentos'
    await publicarEnSesion(destino, `**Documentos modificados** (${fechaHora(ahora)}, UTC-5): ${cambiados.join(', ')}.\nLa próxima respuesta del asistente ya usa la versión actual.`, { suscripcionId: sub.id, tipo: sub.tipo })
    return `Cambiaron: ${cambiados.join(', ')}`
  }

  if (sub.tipo === 'RESUMEN_PERIODICO') {
    const ctx = await construirContexto(sub.solucionId, null, 'sistema')
    if (!ctx) return 'El proyecto ya no existe'
    const nuevos = await prisma.backlogItem.count({ where: { solucionId: sub.solucionId, updatedAt: { gt: desde } } })
    const salida = await callOpenCode(
      `Redactas el INFORME DE ESTADO periódico de un proyecto. Máximo 250 palabras, en español, con: avance del backlog, qué cambió desde el último informe, riesgos u hitos que requieren atención y próximos pasos sugeridos. Usa SOLO el contexto; cita fuentes entre corchetes ([Backlog], [PRD], [Riesgos]…); no inventes. Sé directo.`,
      `Periodo: ${fechaHora(desde)} → ${fechaHora(ahora)} (UTC-5). Tareas modificadas en el periodo: ${nuevos}.\n\n===== CONTEXTO =====\n${ctx.texto}`,
      `proyecto-informe-${sub.id}`, { maxTokens: 1500, timeoutMs: 120_000 })
    await publicarEnSesion(destino, `**Informe de estado** (${fechaHora(ahora)}, UTC-5)\n\n${salida.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()}`, { suscripcionId: sub.id, tipo: sub.tipo })
    return 'Informe publicado'
  }
  return `Tipo desconocido: ${sub.tipo}`
}

export async function ejecutarSuscripcion(id: string): Promise<string> {
  const sub = await prisma.proyectoSuscripcion.findUnique({ where: { id } })
  if (!sub) throw new Error('Suscripción no encontrada')
  let resultado: string
  try { resultado = await ejecutarUna(sub) } catch (e) { resultado = 'Error: ' + (e instanceof Error ? e.message.slice(0, 200) : String(e)) }
  await prisma.proyectoSuscripcion.update({ where: { id }, data: { ultimaEjecucion: new Date(), ultimoResultado: resultado } })
  return resultado
}

// Las que ya cumplieron su intervalo. Las ejecuta en serie para no saturar al modelo.
export async function ejecutarPendientes(): Promise<{ revisadas: number; ejecutadas: { id: string; resultado: string }[] }> {
  const subs = await prisma.proyectoSuscripcion.findMany({ where: { activa: true } })
  const ahora = Date.now()
  const ejecutadas: { id: string; resultado: string }[] = []
  for (const s of subs) {
    const toca = !s.ultimaEjecucion || ahora - s.ultimaEjecucion.getTime() >= s.intervaloMin * 60_000
    if (!toca) continue
    ejecutadas.push({ id: s.id, resultado: await ejecutarSuscripcion(s.id) })
  }
  return { revisadas: subs.length, ejecutadas }
}
