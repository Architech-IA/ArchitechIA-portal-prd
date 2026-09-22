import { prisma } from '@/lib/prisma'
import { htmlATextoPlano } from '@/lib/textoAHtml'
import { buscarProyecto } from './busqueda'
import { cargarSolucion, jsonATexto } from './contexto'
import { sesionVisible } from './auth'
import { crearRepositorioParaSolucion } from '@/lib/executor/repoConfig'

// Herramientas de SOLO LECTURA que el modelo puede pedir durante una respuesta para traer
// lo que el contexto fijo no alcanzó a incluir (documentos completos, adjuntos enteros,
// sesiones anteriores). Todo se limita al proyecto de la sesión y respeta sesiones privadas.
// Formato OpenAI de tool-calling, el mismo que ya usa el worker del Motor.

export const MAX_RESULTADO = 6000 // caracteres por llamada; para leer más se pide con «desde»

// Herramienta de ESCRITURA (a diferencia de todas las de arriba): crea un repositorio real en
// GitHub y lo asocia a la Solución. Solo se agrega a la lista de herramientas disponibles
// cuando la Solución todavía no tiene repositorio (ver modelo.ts) — así no aparece como opción
// en proyectos que ya tienen uno. No hay una confirmación forzada por código: el system prompt
// (AVISO_SIN_REPO en modelo.ts) le exige al modelo proponer el nombre y esperar una confirmación
// explícita de la persona en un mensaje aparte antes de llamarla — es disciplina de prompt, no
// una traba técnica, igual que el resto del tool-calling de Proyectos.
export const HERRAMIENTA_CREAR_REPO = {
  type: 'function',
  function: {
    name: 'crear_repositorio',
    description: 'Crea un repositorio nuevo en GitHub (privado por defecto) y lo asocia a este proyecto. SOLO llamar después de que la persona confirmó explícitamente el nombre propuesto en un mensaje separado — nunca en el mismo turno en que se lo proponés por primera vez.',
    parameters: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre propuesto para el repo (se normaliza: minúsculas, guiones, sin espacios ni acentos)' },
        privado: { type: 'boolean', description: 'true (repo privado) por defecto; false solo si la persona pidió explícitamente que sea público' },
      },
      required: ['nombre'],
    },
  },
}

export const HERRAMIENTAS: unknown[] = [
  {
    type: 'function',
    function: {
      name: 'buscar_en_proyecto',
      description: 'Busca por texto (español) en mensajes de todas las sesiones, adjuntos y memoria del proyecto. Devuelve fragmentos con el id de cada resultado para luego leerlo completo.',
      parameters: { type: 'object', properties: { consulta: { type: 'string', description: 'Palabras clave a buscar' } }, required: ['consulta'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'leer_documento',
      description: 'Lee completo (por partes) un documento del proyecto. Úsalo cuando el contexto lo muestre recortado o necesites un detalle que no aparece.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', enum: ['prd', 'diseno_tecnico', 'plan_ejecucion', 'cronograma', 'plan_trabajo', 'memoria'] },
          desde: { type: 'number', description: 'Posición (caracteres) desde donde leer; 0 por defecto' },
        },
        required: ['nombre'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'listar_adjuntos_y_sesiones',
      description: 'Lista los adjuntos y las sesiones del proyecto con sus ids, para poder leerlos con leer_adjunto y leer_sesion.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'leer_adjunto',
      description: 'Lee el texto de un adjunto (por partes). Acepta el id o parte del nombre.',
      parameters: {
        type: 'object',
        properties: { adjunto: { type: 'string', description: 'id o parte del nombre del adjunto' }, desde: { type: 'number', description: 'Posición en caracteres; 0 por defecto' } },
        required: ['adjunto'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'leer_sesion',
      description: 'Lee la conversación de otra sesión del proyecto (por partes), incluyendo su resumen. No puede leer sesiones privadas de otras personas.',
      parameters: {
        type: 'object',
        properties: { sesion_id: { type: 'string' }, desde: { type: 'number', description: 'Posición en caracteres; 0 por defecto' } },
        required: ['sesion_id'],
      },
    },
  },
]

HERRAMIENTAS.push(
  {
    type: 'function',
    function: {
      name: 'buscar_en_documentos',
      description: 'Busca palabras clave DENTRO del PRD, diseño técnico, plan de ejecución, cronograma, plan de trabajo y memoria, y devuelve fragmentos con su posición para leerlos con leer_documento.',
      parameters: { type: 'object', properties: { consulta: { type: 'string', description: 'Una o varias palabras clave' } }, required: ['consulta'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_backlog',
      description: 'Consulta el backlog y la gestión del proyecto: tareas (con filtros), sprints, riesgos o hitos.',
      parameters: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: ['tareas', 'sprints', 'riesgos', 'hitos'] },
          estado: { type: 'string', description: 'Solo tareas: BACKLOG, TODO, IN_PROGRESS, DONE, etc.' },
          texto: { type: 'string', description: 'Solo tareas: texto a buscar en título/código/descripción' },
          sprint: { type: 'string', description: 'Solo tareas: código del sprint (p. ej. XX-0001-0002)' },
          pagina: { type: 'number', description: 'Página de 20 resultados; 1 por defecto' },
        },
        required: ['tipo'],
      },
    },
  },
)

const corto = (t: string | null | undefined, n: number) => { const x = htmlATextoPlano(t ?? '').replace(/\s+/g, ' ').trim(); return x.length > n ? x.slice(0, n) + '…' : x }

export interface CtxHerramienta { solucionId: string; sesionId: string; usuarioId: string }

function trozo(texto: string, desde: number): string {
  const d = Number.isFinite(desde) && desde > 0 ? Math.floor(desde) : 0
  if (d >= texto.length) return `(Fin: el texto tiene ${texto.length} caracteres y pediste desde ${d}.)`
  const parte = texto.slice(d, d + MAX_RESULTADO)
  const hasta = d + parte.length
  return `${parte}\n\n[Caracteres ${d}–${hasta} de ${texto.length}.${hasta < texto.length ? ` Para continuar llama de nuevo con desde=${hasta}.` : ' Fin del texto.'}]`
}

export async function ejecutarHerramienta(nombre: string, argsJson: string, c: CtxHerramienta): Promise<string> {
  let a: Record<string, unknown> = {}
  try { a = argsJson ? JSON.parse(argsJson) : {} } catch { return 'Error: los argumentos no son un JSON válido.' }
  try {
    switch (nombre) {
      case 'buscar_en_proyecto': {
        const q = String(a.consulta ?? '').trim()
        if (!q) return 'Error: falta «consulta».'
        const r = await buscarProyecto(c.solucionId, q, c.usuarioId, { limite: 10 })
        if (r.length === 0) return 'Sin coincidencias.'
        return r.map(x => `- [${x.tipo}] id=${x.id}${x.sesionId ? ` sesion_id=${x.sesionId}` : ''} «${x.titulo}»: ${x.fragmento}`).join('\n').slice(0, MAX_RESULTADO)
      }
      case 'leer_documento': {
        const sol = await cargarSolucion(c.solucionId)
        if (!sol) return 'Error: el proyecto ya no existe.'
        let texto = ''
        switch (String(a.nombre)) {
          case 'prd': texto = jsonATexto(sol.prd); break
          case 'diseno_tecnico': texto = jsonATexto(sol.disenoTecnico); break
          case 'plan_ejecucion': texto = jsonATexto(sol.planEjecucion); break
          case 'cronograma': texto = jsonATexto(sol.cronograma); break
          case 'plan_trabajo': texto = htmlATextoPlano(sol.planTrabajo || ''); break
          case 'memoria': texto = (await prisma.proyectoMemoria.findUnique({ where: { solucionId: c.solucionId } }))?.contenido ?? ''; break
          default: return 'Error: documento desconocido.'
        }
        if (!texto.trim()) return 'Ese documento está vacío.'
        return trozo(texto, Number(a.desde))
      }
      case 'buscar_en_documentos': {
        const q = String(a.consulta ?? '').trim().toLowerCase()
        const palabras = q.split(/\s+/).filter(w => w.length >= 3)
        if (palabras.length === 0) return 'Error: falta «consulta» (palabras de 3 o más letras).'
        const sol = await cargarSolucion(c.solucionId)
        if (!sol) return 'Error: el proyecto ya no existe.'
        const mem = (await prisma.proyectoMemoria.findUnique({ where: { solucionId: c.solucionId } }))?.contenido ?? ''
        const docs: [string, string][] = [['prd', jsonATexto(sol.prd)], ['diseno_tecnico', jsonATexto(sol.disenoTecnico)], ['plan_ejecucion', jsonATexto(sol.planEjecucion)],
          ['cronograma', jsonATexto(sol.cronograma)], ['plan_trabajo', htmlATextoPlano(sol.planTrabajo || '')], ['memoria', mem]]
        const out: string[] = []
        for (const [nom, texto] of docs) {
          const bajo = texto.toLowerCase()
          const usados: number[] = []
          for (const w of palabras) {
            let i = bajo.indexOf(w)
            while (i >= 0 && usados.length < 4) {
              if (!usados.some(u => Math.abs(u - i) < 200)) { usados.push(i); out.push(`- [${nom}] pos ${i}: …${texto.slice(Math.max(0, i - 120), i + 200).replace(/\s+/g, ' ')}…`) }
              i = bajo.indexOf(w, i + w.length)
            }
          }
        }
        return out.length ? out.join('\n').slice(0, MAX_RESULTADO) : 'Sin coincidencias en los documentos.'
      }
      case 'consultar_backlog': {
        const pag = Math.max(1, Math.floor(Number(a.pagina) || 1))
        const skip = (pag - 1) * 20
        switch (String(a.tipo)) {
          case 'tareas': {
            const where: Record<string, unknown> = { solucionId: c.solucionId }
            if (a.estado) where.status = String(a.estado).toUpperCase()
            if (a.sprint) { const sp = await prisma.sprint.findFirst({ where: { solucionId: c.solucionId, sprintCode: String(a.sprint) }, select: { id: true } }); if (!sp) return 'Sprint no encontrado.'; where.sprintId = sp.id }
            if (a.texto) { const t = String(a.texto); where.OR = [{ title: { contains: t, mode: 'insensitive' } }, { taskCode: { contains: t, mode: 'insensitive' } }, { description: { contains: t, mode: 'insensitive' } }] }
            const [total, items] = await Promise.all([
              prisma.backlogItem.count({ where }),
              prisma.backlogItem.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take: 20, select: { taskCode: true, title: true, status: true, priority: true, description: true, resultado: true, assigneeName: true } }),
            ])
            if (items.length === 0) return `Sin tareas (total ${total}).`
            return `Tareas ${skip + 1}–${skip + items.length} de ${total}:\n` + items.map(i => `- [${i.status}/${i.priority}] ${i.taskCode ?? ''} ${i.title}${i.assigneeName ? ` (${i.assigneeName})` : ''}${i.description ? ` — ${corto(i.description, 200)}` : ''}${i.resultado ? ` | Resultado: ${corto(i.resultado, 150)}` : ''}`).join('\n').slice(0, MAX_RESULTADO)
          }
          case 'sprints': {
            const sp = await prisma.sprint.findMany({ where: { solucionId: c.solucionId }, orderBy: { startDate: 'desc' }, skip, take: 20, select: { sprintCode: true, name: true, status: true, goal: true, startDate: true, endDate: true } })
            return sp.length ? sp.map(x => `- ${x.sprintCode} «${x.name}» [${x.status}] ${x.startDate ? x.startDate.toISOString().slice(0, 10) : ''}→${x.endDate ? x.endDate.toISOString().slice(0, 10) : ''}${x.goal ? ` — ${corto(x.goal, 200)}` : ''}`).join('\n').slice(0, MAX_RESULTADO) : 'Sin sprints.'
          }
          case 'riesgos': {
            const r = await prisma.riesgo.findMany({ where: { solucionId: c.solucionId }, orderBy: { createdAt: 'desc' }, skip, take: 20 })
            return r.length ? r.map(x => `- [${x.severidad}/${x.estado}] ${x.titulo}${x.descripcion ? `: ${corto(x.descripcion, 250)}` : ''}${x.mitigacion ? ` (mitigación: ${corto(x.mitigacion, 200)})` : ''}`).join('\n').slice(0, MAX_RESULTADO) : 'Sin riesgos.'
          }
          case 'hitos': {
            const h = await prisma.hito.findMany({ where: { solucionId: c.solucionId }, orderBy: { createdAt: 'asc' }, skip, take: 20 })
            return h.length ? h.map(x => `- [${x.estado}] ${x.titulo}${x.fechaComprometida ? ` (comprometido ${x.fechaComprometida.toISOString().slice(0, 10)})` : ''}`).join('\n').slice(0, MAX_RESULTADO) : 'Sin hitos.'
          }
          default: return 'Error: tipo debe ser tareas, sprints, riesgos o hitos.'
        }
      }
      case 'crear_repositorio': {
        const nombre = String(a.nombre ?? '').trim()
        if (!nombre) return 'Error: falta «nombre».'
        const privado = a.privado === false ? false : true
        try {
          const r = await crearRepositorioParaSolucion(c.solucionId, nombre, privado)
          return `${r.creado ? 'Repositorio creado' : 'Repositorio ya existía en GitHub, se asoció igual'}: ${r.url} (${privado ? 'privado' : 'público'}). Ya quedó guardado en el proyecto — contáselo a la persona con el link.`
        } catch (e) {
          return `Error al crear el repositorio: ${e instanceof Error ? e.message.slice(0, 300) : String(e)}`
        }
      }
      case 'listar_adjuntos_y_sesiones': {
        const [adj, ses] = await Promise.all([
          prisma.proyectoAdjunto.findMany({ where: { solucionId: c.solucionId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, nombre: true, legible: true, texto: true } }),
          prisma.proyectoSesion.findMany({ where: { solucionId: c.solucionId, OR: [{ privada: false }, { creadaPorId: c.usuarioId }] }, orderBy: { updatedAt: 'desc' }, take: 50, select: { id: true, titulo: true, tipo: true, updatedAt: true } }),
        ])
        return `ADJUNTOS:\n${adj.map(x => `- id=${x.id} «${x.nombre}» ${x.legible ? `(${x.texto.length} caracteres)` : '(sin texto legible)'}`).join('\n') || '(ninguno)'}\n\nSESIONES:\n${ses.map(x => `- sesion_id=${x.id} «${x.titulo}» (${x.tipo}${x.id === c.sesionId ? ', ESTA' : ''})`).join('\n') || '(ninguna)'}`
      }
      case 'leer_adjunto': {
        const clave = String(a.adjunto ?? '').trim()
        if (!clave) return 'Error: falta «adjunto».'
        const d = (await prisma.proyectoAdjunto.findFirst({ where: { solucionId: c.solucionId, id: clave } }))
          ?? (await prisma.proyectoAdjunto.findFirst({ where: { solucionId: c.solucionId, nombre: { contains: clave, mode: 'insensitive' } }, orderBy: { createdAt: 'desc' } }))
        if (!d) return 'Adjunto no encontrado en este proyecto.'
        if (!d.legible || !d.texto.trim()) return `El adjunto «${d.nombre}» no tiene texto legible.`
        return `Adjunto «${d.nombre}»\n` + trozo(d.texto, Number(a.desde))
      }
      case 'leer_sesion': {
        const sid = String(a.sesion_id ?? '').trim()
        const s = await sesionVisible(c.solucionId, sid, { id: c.usuarioId, nombre: '', sistema: c.usuarioId === 'sistema' })
        if (!s) return 'Sesión no encontrada (o es privada de otra persona).'
        const msgs = await prisma.proyectoMensaje.findMany({ where: { sesionId: s.id, estado: 'LISTO', rol: { in: ['user', 'assistant'] } }, orderBy: { orden: 'asc' }, select: { rol: true, contenido: true, autorNombre: true } })
        const texto = (s.resumen ? `RESUMEN DE LA SESIÓN:\n${s.resumen}\n\nCONVERSACIÓN:\n` : '') + msgs.map(m => `${m.rol === 'user' ? (m.autorNombre || 'Usuario') : 'Asistente'}: ${m.contenido}`).join('\n\n')
        return `Sesión «${s.titulo}»\n` + trozo(texto, Number(a.desde))
      }
      default:
        return `Herramienta desconocida: ${nombre}`
    }
  } catch (e) {
    return `Error al ejecutar ${nombre}: ${e instanceof Error ? e.message.slice(0, 200) : String(e)}`
  }
}
