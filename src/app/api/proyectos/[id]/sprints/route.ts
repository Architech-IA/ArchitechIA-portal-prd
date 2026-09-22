import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO } from '@/lib/proyectos/auth'

export const dynamic = 'force-dynamic'

// Sprints de un proyecto (Solución), para el selector del panel «Ejecución» de Proyectos —
// ese panel reutiliza el mismo grafo/traza de la Sala de Control (/backlog/control/[sprintId])
// pero acotado a los sprints de ESTE proyecto, así que necesita saber cuáles son.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params

  const sprints = await prisma.$queryRawUnsafe<{
    id: string; sprintCode: string | null; name: string; status: string;
    total: bigint; enCurso: bigint; bloqueadas: bigint; fallidas: bigint; enCola: bigint; hechas: bigint;
  }[]>(
    `SELECT s.id, s."sprintCode", s.name, s.status,
            COUNT(bi.id)::bigint AS total,
            COUNT(*) FILTER (WHERE bi.status = 'IN_PROGRESS')::bigint AS "enCurso",
            COUNT(*) FILTER (WHERE bi.status = 'BLOCKED')::bigint AS bloqueadas,
            COUNT(*) FILTER (WHERE bi.status = 'FAILED')::bigint AS fallidas,
            COUNT(*) FILTER (WHERE bi.status = 'BACKLOG')::bigint AS "enCola",
            COUNT(*) FILTER (WHERE bi.status = 'DONE')::bigint AS hechas
       FROM "Sprint" s
       JOIN "Epic" e ON s."epicId" = e.id
       LEFT JOIN "BacklogItem" bi ON bi."sprintId" = s.id
      WHERE e."solucionId" = $1
      GROUP BY s.id, s."sprintCode", s.name, s.status, s."startDate"
      ORDER BY (COUNT(*) FILTER (WHERE bi.status = 'IN_PROGRESS')) DESC, s."startDate" DESC NULLS LAST`,
    id
  )

  return NextResponse.json(sprints.map(s => ({
    id: s.id, sprintCode: s.sprintCode, name: s.name, status: s.status,
    total: Number(s.total), enCurso: Number(s.enCurso), bloqueadas: Number(s.bloqueadas),
    fallidas: Number(s.fallidas), enCola: Number(s.enCola), hechas: Number(s.hechas),
  })))
}
