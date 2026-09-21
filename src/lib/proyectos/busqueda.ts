import { prisma } from '@/lib/prisma'

// Búsqueda de texto completo (español) sobre mensajes, adjuntos y memoria de un proyecto.
// Usa las columnas tsv generadas en la base (OpenCode no ofrece embeddings, así que no hay
// búsqueda vectorial: esto es léxica, privada y sin costo). Respeta las sesiones privadas.

export interface ResultadoBusqueda {
  tipo: 'MENSAJE' | 'ADJUNTO' | 'MEMORIA'
  id: string
  sesionId: string | null
  sesionTitulo: string | null
  titulo: string
  fragmento: string // con «coincidencias» marcadas
  rank: number
  fecha: Date
}

const OPC = `'MaxFragments=1, MaxWords=32, MinWords=12, StartSel=«, StopSel=»'`

export async function buscarProyecto(
  solucionId: string, q: string, usuarioId: string,
  opts: { excluirSesionId?: string | null; limite?: number; soloMensajes?: boolean } = {},
): Promise<ResultadoBusqueda[]> {
  const consulta = q.trim().slice(0, 300)
  if (!consulta) return []
  const limite = Math.min(Math.max(opts.limite ?? 15, 1), 40)
  const out: ResultadoBusqueda[] = []

  const params: unknown[] = [solucionId, consulta, usuarioId, limite]
  let excl = ''
  if (opts.excluirSesionId) { params.push(opts.excluirSesionId); excl = `AND s.id <> $${params.length}` }
  const mens = await prisma.$queryRawUnsafe<{ id: string; sesionId: string; titulo: string; rank: number; frag: string; createdAt: Date }[]>(
    `SELECT m.id, m."sesionId", s.titulo, ts_rank(m.tsv, query) AS rank,
            ts_headline('spanish', m.contenido, query, ${OPC}) AS frag, m."createdAt"
       FROM "ProyectoMensaje" m
       JOIN "ProyectoSesion" s ON s.id = m."sesionId",
            websearch_to_tsquery('spanish', $2) query
      WHERE s."solucionId" = $1 AND m.estado = 'LISTO' AND m.tsv @@ query
        AND (s.privada = false OR s."creadaPorId" = $3) ${excl}
      ORDER BY rank DESC LIMIT $4`, ...params)
  for (const r of mens) out.push({ tipo: 'MENSAJE', id: r.id, sesionId: r.sesionId, sesionTitulo: r.titulo, titulo: r.titulo, fragmento: r.frag, rank: Number(r.rank), fecha: r.createdAt })

  if (!opts.soloMensajes) {
    const adj = await prisma.$queryRawUnsafe<{ id: string; sesionId: string | null; nombre: string; rank: number; frag: string; createdAt: Date }[]>(
      `SELECT a.id, a."sesionId", a.nombre, ts_rank(a.tsv, query) AS rank,
              ts_headline('spanish', a.texto, query, ${OPC}) AS frag, a."createdAt"
         FROM "ProyectoAdjunto" a, websearch_to_tsquery('spanish', $2) query
        WHERE a."solucionId" = $1 AND a.legible AND a.tsv @@ query
        ORDER BY rank DESC LIMIT $3`, solucionId, consulta, limite)
    for (const r of adj) out.push({ tipo: 'ADJUNTO', id: r.id, sesionId: r.sesionId, sesionTitulo: null, titulo: r.nombre, fragmento: r.frag, rank: Number(r.rank), fecha: r.createdAt })

    const mem = await prisma.$queryRawUnsafe<{ rank: number; frag: string; updatedAt: Date }[]>(
      `SELECT ts_rank(to_tsvector('spanish', m.contenido), query) AS rank,
              ts_headline('spanish', m.contenido, query, ${OPC}) AS frag, m."updatedAt"
         FROM "ProyectoMemoria" m, websearch_to_tsquery('spanish', $2) query
        WHERE m."solucionId" = $1 AND to_tsvector('spanish', m.contenido) @@ query`, solucionId, consulta)
    for (const r of mem) out.push({ tipo: 'MEMORIA', id: solucionId, sesionId: null, sesionTitulo: null, titulo: 'Memoria del proyecto', fragmento: r.frag, rank: Number(r.rank), fecha: r.updatedAt })
  }

  return out.sort((a, b) => b.rank - a.rank).slice(0, limite)
}
