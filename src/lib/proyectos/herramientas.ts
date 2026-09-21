import { prisma } from '@/lib/prisma'
import { htmlATextoPlano } from '@/lib/textoAHtml'
import { buscarProyecto } from './busqueda'
import { cargarSolucion, jsonATexto } from './contexto'
import { sesionVisible } from './auth'

// Herramientas de SOLO LECTURA que el modelo puede pedir durante una respuesta para traer
// lo que el contexto fijo no alcanzó a incluir (documentos completos, adjuntos enteros,
// sesiones anteriores). Todo se limita al proyecto de la sesión y respeta sesiones privadas.
// Formato OpenAI de tool-calling, el mismo que ya usa el worker del Motor.

export const MAX_RESULTADO = 6000 // caracteres por llamada; para leer más se pide con «desde»

export const HERRAMIENTAS = [
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
