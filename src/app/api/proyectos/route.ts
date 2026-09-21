import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO } from '@/lib/proyectos/auth'

export const dynamic = 'force-dynamic'

// Lista de proyectos (= Soluciones) con su actividad de sesiones, memoria y adjuntos.
export async function GET(req: NextRequest) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()

  const [sols, ses, mem, props, adj] = await Promise.all([
    prisma.solucion.findMany({ select: { id: true, nombre: true, tipo: true, estado: true, solucionCode: true, updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
    prisma.proyectoSesion.groupBy({
      by: ['solucionId'], where: { estado: { not: 'ARCHIVADA' }, OR: [{ privada: false }, { creadaPorId: u.id }] },
      _count: { _all: true }, _max: { updatedAt: true },
    }),
    prisma.proyectoMemoria.findMany({ select: { solucionId: true, version: true } }),
    prisma.proyectoMemoriaPropuesta.groupBy({ by: ['solucionId'], where: { estado: 'PENDIENTE' }, _count: { _all: true } }),
    prisma.proyectoAdjunto.groupBy({ by: ['solucionId'], _count: { _all: true } }),
  ])
  const sm = new Map(ses.map(x => [x.solucionId, x]))
  const mm = new Map(mem.map(x => [x.solucionId, x.version]))
  const pm = new Map(props.map(x => [x.solucionId, x._count._all]))
  const am = new Map(adj.map(x => [x.solucionId, x._count._all]))

  const lista = sols.map(s => ({
    id: s.id, nombre: s.nombre, tipo: s.tipo, estado: s.estado, codigo: s.solucionCode,
    sesiones: sm.get(s.id)?._count._all ?? 0,
    ultimaActividad: sm.get(s.id)?._max.updatedAt ?? null,
    memoriaVersion: mm.get(s.id) ?? 0,
    propuestasPendientes: pm.get(s.id) ?? 0,
    adjuntos: am.get(s.id) ?? 0,
  }))
  // Primero los que tienen actividad reciente
  lista.sort((a, b) => (b.ultimaActividad ? +new Date(b.ultimaActividad) : 0) - (a.ultimaActividad ? +new Date(a.ultimaActividad) : 0))
  return NextResponse.json(lista)
}
