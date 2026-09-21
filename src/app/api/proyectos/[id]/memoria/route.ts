import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { usuarioActual, NO_AUTENTICADO, NO_ENCONTRADO, solucionExiste } from '@/lib/proyectos/auth'

export const dynamic = 'force-dynamic'

// Memoria del proyecto (markdown curado que la IA lee en todas las sesiones), con historial de versiones.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  if (!(await solucionExiste(id))) return NO_ENCONTRADO('Proyecto')

  const v = new URL(req.url).searchParams.get('version')
  if (v) {
    const ver = await prisma.proyectoMemoriaVersion.findUnique({ where: { solucionId_version: { solucionId: id, version: Number(v) } } })
    return ver ? NextResponse.json(ver) : NO_ENCONTRADO('Versión')
  }
  const [memoria, versiones, propuestas] = await Promise.all([
    prisma.proyectoMemoria.findUnique({ where: { solucionId: id } }),
    prisma.proyectoMemoriaVersion.findMany({ where: { solucionId: id }, orderBy: { version: 'desc' }, take: 50, select: { version: true, origen: true, autor: true, nota: true, createdAt: true } }),
    prisma.proyectoMemoriaPropuesta.findMany({ where: { solucionId: id, estado: 'PENDIENTE' }, orderBy: { createdAt: 'desc' } }),
  ])
  return NextResponse.json({ memoria: memoria ?? { solucionId: id, contenido: '', version: 0, actualizadoPor: null, updatedAt: null }, versiones, propuestas })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioActual(req)
  if (!u) return NO_AUTENTICADO()
  const { id } = await params
  if (!(await solucionExiste(id))) return NO_ENCONTRADO('Proyecto')
  const b = await req.json().catch(() => ({})) as { contenido?: string; nota?: string; baseVersion?: number }
  if (typeof b.contenido !== 'string') return NextResponse.json({ error: 'contenido requerido' }, { status: 400 })
  if (b.contenido.length > 30_000) return NextResponse.json({ error: 'La memoria no puede superar los 30.000 caracteres' }, { status: 400 })

  try {
    const res = await prisma.$transaction(async tx => {
      const actual = await tx.proyectoMemoria.findUnique({ where: { solucionId: id } })
      const version = actual?.version ?? 0
      // Control de conflictos: si otra persona guardó mientras editabas, no se pisa en silencio
      if (typeof b.baseVersion === 'number' && b.baseVersion !== version) return { conflicto: true as const, version, contenido: actual?.contenido ?? '' }
      const nueva = version + 1
      await tx.proyectoMemoriaVersion.create({ data: { solucionId: id, version: nueva, contenido: b.contenido!, origen: 'MANUAL', autor: u.nombre, nota: b.nota?.slice(0, 200) ?? null } })
      const m = await tx.proyectoMemoria.upsert({
        where: { solucionId: id },
        create: { solucionId: id, contenido: b.contenido!, version: nueva, actualizadoPor: u.nombre },
        update: { contenido: b.contenido!, version: nueva, actualizadoPor: u.nombre },
      })
      return { conflicto: false as const, memoria: m }
    })
    if (res.conflicto) return NextResponse.json({ error: 'Otra persona guardó una versión nueva mientras editabas.', version: res.version, contenido: res.contenido }, { status: 409 })
    return NextResponse.json(res.memoria)
  } catch (e) {
    console.error('[proyectos/memoria PUT]', e)
    return NextResponse.json({ error: 'No se pudo guardar la memoria' }, { status: 500 })
  }
}
