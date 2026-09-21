import { prisma } from '@/lib/prisma'
import { getDateStrUTC5 } from '@/lib/timezone'
import { htmlATextoPlano } from '@/lib/textoAHtml'
import { FASES_LEAD } from '@/lib/leadContext'
import { buscarProyecto } from './busqueda'
import type { FuenteCtx } from './tipos'

// Contexto EXACTO de una sesión de proyecto. Cada fuente se lee VIVA de la base en cada
// turno (si cambia el PRD, la IA lo ve al instante), tiene un tope propio y una prioridad.
// Nada se recorta en silencio: cada fuente devuelve su estado (incluida / excluida / vacía /
// recortada / omitida por presupuesto) y eso es lo que muestra el panel «Contexto» y lo que
// se guarda en cada respuesta para poder auditarla.

const PRESUPUESTO_TOTAL = 48_000

type SolRow = NonNullable<Awaited<ReturnType<typeof cargarSolucion>>>
export function cargarSolucion(id: string) { return prisma.solucion.findUnique({ where: { id } }) }

interface Ctx {
  sol: SolRow
  solucionId: string
  sesionId: string | null
  resumen: string
  usuarioId: string
  consulta?: string
}
interface Def {
  clave: string
  etiqueta: string
  prioridad: number
  max: number
  obligatoria?: boolean
  build: (c: Ctx) => Promise<{ texto: string; actualizado?: Date | null; nota?: string }>
}

const RUIDO = new Set(['id', 'backlogItemId', 'itemId', 'createdAt', 'updatedAt'])
const corta = (t: string, max: number) => (t.length > max ? t.slice(0, max) + '…' : t)

function aTexto(v: unknown, depth = 0): string {
  if (v == null) return ''
  if (typeof v === 'string') return htmlATextoPlano(v)
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.map(x => aTexto(x, depth + 1)).filter(Boolean).map(t => (depth > 0 ? t : `- ${t}`)).join(depth > 0 ? ' | ' : '\n')
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .filter(([k]) => !RUIDO.has(k))
      .map(([k, x]) => { const t = aTexto(x, depth + 1); return t ? `${k}: ${t}` : '' })
      .filter(Boolean).join(depth > 0 ? '; ' : '\n')
  }
  return ''
}
function jsonATexto(raw: string | null | undefined): string {
  if (!raw) return ''
  try { return aTexto(JSON.parse(raw)) } catch { return htmlATextoPlano(raw) }
}

function textoFase(content: string | null): string {
  if (!content) return ''
  try {
    const p = JSON.parse(content) as { tabs?: { name?: string; content?: string }[] }
    if (Array.isArray(p.tabs)) return p.tabs.map(t => ({ n: t.name || 'Nota', c: htmlATextoPlano(t.content || '') })).filter(t => t.c).map(t => `[${t.n}] ${t.c.replace(/\n+/g, ' ')}`).join(' | ')
  } catch {}
  return htmlATextoPlano(content).replace(/\n+/g, ' ')
}

const DEFS: Def[] = [
  {
    clave: 'ficha', etiqueta: 'Ficha del proyecto', prioridad: 1, max: 2500, obligatoria: true,
    build: async c => ({
      texto: [
        `Nombre: ${c.sol.nombre}`, `Tipo: ${c.sol.tipo}`, `Estado: ${c.sol.estado}`,
        c.sol.solucionCode ? `Código: ${c.sol.solucionCode}` : '', `Valor estimado: ${c.sol.valorEstimado}`,
        c.sol.empresa ? `Empresa: ${c.sol.empresa}` : '', c.sol.repositorio ? `Repositorio: ${c.sol.repositorio}` : '',
        c.sol.descripcion ? `Descripción: ${htmlATextoPlano(c.sol.descripcion)}` : '',
        `Creado: ${getDateStrUTC5(c.sol.createdAt)} | Última modificación: ${getDateStrUTC5(c.sol.updatedAt)}`,
        `Hoy: ${getDateStrUTC5(new Date())} (UTC-5)`,
      ].filter(Boolean).join('\n'),
      actualizado: c.sol.updatedAt,
    }),
  },
  {
    clave: 'memoria', etiqueta: 'Memoria del proyecto', prioridad: 2, max: 8000,
    build: async c => {
      const m = await prisma.proyectoMemoria.findUnique({ where: { solucionId: c.solucionId } })
      return { texto: m?.contenido?.trim() ?? '', actualizado: m?.updatedAt, nota: m ? `versión ${m.version}` : undefined }
    },
  },
  { clave: 'resumen', etiqueta: 'Resumen de esta sesión', prioridad: 3, max: 3500, build: async c => ({ texto: c.resumen.trim() }) },
  { clave: 'prd', etiqueta: 'PRD', prioridad: 4, max: 9000, build: async c => ({ texto: jsonATexto(c.sol.prd), actualizado: c.sol.updatedAt }) },
  { clave: 'diseno', etiqueta: 'Diseño técnico', prioridad: 5, max: 6000, build: async c => ({ texto: jsonATexto(c.sol.disenoTecnico), actualizado: c.sol.updatedAt }) },
  {
    clave: 'backlog', etiqueta: 'Backlog', prioridad: 6, max: 4500,
    build: async c => {
      const [conteo, items] = await Promise.all([
        prisma.backlogItem.groupBy({ by: ['status'], where: { solucionId: c.solucionId }, _count: { _all: true } }),
        prisma.backlogItem.findMany({
          where: { solucionId: c.solucionId }, orderBy: { updatedAt: 'desc' }, take: 60,
          select: { title: true, status: true, priority: true, taskCode: true, updatedAt: true },
        }),
      ])
      if (items.length === 0) return { texto: '' }
      const totales = conteo.map(x => `${x.status}: ${x._count._all}`).join(', ')
      return {
        texto: `Totales por estado: ${totales}\nÚltimas modificadas:\n` + items.map(i => `- [${i.status}/${i.priority}] ${i.taskCode ? i.taskCode + ' ' : ''}${i.title}`).join('\n'),
        actualizado: items[0].updatedAt,
      }
    },
  },
  {
    clave: 'adjuntos', etiqueta: 'Adjuntos del proyecto', prioridad: 7, max: 9000,
    build: async c => {
      const docs = await prisma.proyectoAdjunto.findMany({
        where: { solucionId: c.solucionId, legible: true }, orderBy: { createdAt: 'desc' }, take: 30,
        select: { nombre: true, texto: true, sesionId: true, createdAt: true },
      })
      if (docs.length === 0) return { texto: '' }
      // Primero los adjuntados en esta sesión
      docs.sort((a, b) => Number(b.sesionId === c.sesionId) - Number(a.sesionId === c.sesionId))
      let usado = 0
      const partes: string[] = []
      const fuera: string[] = []
      for (const d of docs) {
        if (usado >= 8500) { fuera.push(d.nombre); continue }
        const t = corta(d.texto.replace(/\n+/g, ' '), 3000)
        usado += t.length
        partes.push(`- [${d.nombre}] ${t}`)
      }
      return {
        texto: partes.join('\n') + (fuera.length ? `\n(Adjuntos no incluidos por presupuesto: ${fuera.join(', ')})` : ''),
        actualizado: docs.reduce((m, d) => (d.createdAt > m ? d.createdAt : m), docs[0].createdAt),
        nota: `${partes.length} de ${docs.length} leídos` ,
      }
    },
  },
  { clave: 'plan_ejec', etiqueta: 'Plan de ejecución', prioridad: 8, max: 4000, build: async c => ({ texto: jsonATexto(c.sol.planEjecucion), actualizado: c.sol.updatedAt }) },
  {
    clave: 'lead', etiqueta: 'Lead y cliente', prioridad: 9, max: 4500,
    build: async c => {
      if (!c.sol.leadId) return { texto: '' }
      const lead = await prisma.lead.findUnique({ where: { id: c.sol.leadId }, include: { cliente: { select: { nombre: true } } } })
      if (!lead) return { texto: '' }
      const fases = await prisma.leadHub.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: 'asc' }, select: { phase: true, content: true } })
      const notas = FASES_LEAD.map(f => {
        const t = textoFase(fases.find(x => x.phase === f.key)?.content ?? null)
        return t ? `- ${f.label}: ${corta(t, 1200)}` : ''
      }).filter(Boolean).join('\n')
      return {
        texto: [
          `Empresa: ${lead.companyName}`, lead.cliente?.nombre ? `Cliente: ${lead.cliente.nombre}` : '', `Contacto: ${lead.contactName}`,
          lead.scope ? `Alcance: ${corta(htmlATextoPlano(lead.scope), 600)}` : '',
          notas ? `Notas de las fases del lead:\n${notas}` : '',
        ].filter(Boolean).join('\n'),
        actualizado: lead.updatedAt,
      }
    },
  },
  {
    clave: 'historial', etiqueta: 'Otras sesiones (coincidencias)', prioridad: 10, max: 3500,
    build: async c => {
      if (!c.consulta) return { texto: '', nota: 'depende de cada pregunta' }
      const r = await buscarProyecto(c.solucionId, c.consulta, c.usuarioId, { excluirSesionId: c.sesionId, limite: 6, soloMensajes: true })
      return { texto: r.map(x => `- [Sesión: ${x.sesionTitulo}] ${x.fragmento.replace(/[«»]/g, '')}`).join('\n') }
    },
  },
  {
    clave: 'riesgos', etiqueta: 'Riesgos', prioridad: 11, max: 2500,
    build: async c => {
      const r = await prisma.riesgo.findMany({ where: { solucionId: c.solucionId }, orderBy: { createdAt: 'desc' }, take: 25 })
      return { texto: r.map(x => `- [${x.severidad}/${x.estado}] ${x.titulo}${x.descripcion ? ': ' + htmlATextoPlano(x.descripcion) : ''}${x.mitigacion ? ` (mitigación: ${htmlATextoPlano(x.mitigacion)})` : ''}`).join('\n'), actualizado: r[0]?.updatedAt }
    },
  },
  {
    clave: 'hitos', etiqueta: 'Hitos', prioridad: 12, max: 1500,
    build: async c => {
      const h = await prisma.hito.findMany({ where: { solucionId: c.solucionId }, orderBy: { createdAt: 'asc' }, take: 25 })
      return { texto: h.map(x => `- [${x.estado}] ${x.titulo}${x.fechaComprometida ? ` (comprometido ${getDateStrUTC5(x.fechaComprometida)})` : ''}`).join('\n'), actualizado: h[0]?.updatedAt }
    },
  },
  { clave: 'cronograma', etiqueta: 'Cronograma', prioridad: 13, max: 2000, build: async c => ({ texto: jsonATexto(c.sol.cronograma), actualizado: c.sol.updatedAt }) },
  { clave: 'plan_trabajo', etiqueta: 'Plan de trabajo', prioridad: 14, max: 3000, build: async c => ({ texto: htmlATextoPlano(c.sol.planTrabajo || ''), actualizado: c.sol.updatedAt }) },
]

export interface ContextoConstruido {
  texto: string
  fuentes: FuenteCtx[]
  totalChars: number
  sol: SolRow
}

export async function construirContexto(
  solucionId: string,
  sesion: { id: string; resumen: string; fuentesExcluidas: unknown } | null,
  usuarioId: string,
  consulta?: string,
): Promise<ContextoConstruido | null> {
  const sol = await cargarSolucion(solucionId)
  if (!sol) return null
  const excluidas = new Set<string>(Array.isArray(sesion?.fuentesExcluidas) ? (sesion!.fuentesExcluidas as string[]) : [])
  const ctx: Ctx = { sol, solucionId, sesionId: sesion?.id ?? null, resumen: sesion?.resumen ?? '', usuarioId, consulta }

  const fuentes: FuenteCtx[] = []
  const cand: { def: Def; texto: string; f: FuenteCtx }[] = []
  for (const def of DEFS) {
    const base: FuenteCtx = { clave: def.clave, etiqueta: def.etiqueta, estado: 'incluida', chars: 0 }
    if (excluidas.has(def.clave) && !def.obligatoria) { fuentes.push({ ...base, estado: 'excluida' }); continue }
    let r: Awaited<ReturnType<Def['build']>>
    try { r = await def.build(ctx) } catch (e) { fuentes.push({ ...base, estado: 'vacia', nota: 'error al leerla' }); console.error('[proyectos/contexto]', def.clave, e); continue }
    const texto = r.texto.trim()
    const f: FuenteCtx = { ...base, nota: r.nota, actualizado: r.actualizado ? r.actualizado.toISOString() : null }
    if (!texto) { fuentes.push({ ...f, estado: 'vacia' }); continue }
    let t = texto
    if (t.length > def.max) { t = corta(t, def.max); f.estado = 'recortada'; f.nota = [f.nota, `tope de ${def.max} caracteres`].filter(Boolean).join(' · ') }
    f.chars = t.length
    fuentes.push(f)
    cand.push({ def, texto: t, f })
  }

  // Presupuesto total: se llena por prioridad; lo que no cabe se marca, nunca se pierde en silencio
  let usado = 0
  const partes: string[] = []
  for (const c of cand.sort((a, b) => a.def.prioridad - b.def.prioridad)) {
    const restante = PRESUPUESTO_TOTAL - usado
    if (c.texto.length <= restante) { usado += c.texto.length; partes.push(`## ${c.def.etiqueta}\n${c.texto}`); continue }
    if (restante > 1500) {
      const t = corta(c.texto, restante)
      usado += t.length; partes.push(`## ${c.def.etiqueta}\n${t}`)
      c.f.estado = 'recortada'; c.f.chars = t.length
      c.f.nota = [c.f.nota, 'recortada por presupuesto total de contexto'].filter(Boolean).join(' · ')
    } else {
      c.f.estado = 'omitida'; c.f.chars = 0
      c.f.nota = [c.f.nota, 'omitida: no cabe en el presupuesto total de contexto'].filter(Boolean).join(' · ')
    }
  }
  fuentes.sort((a, b) => DEFS.findIndex(d => d.clave === a.clave) - DEFS.findIndex(d => d.clave === b.clave))
  return { texto: partes.join('\n\n'), fuentes, totalChars: usado, sol }
}
